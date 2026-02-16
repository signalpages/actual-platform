import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeStage1, executeStage2, executeStage3, executeStage4 } from "@/lib/stageExecutors";
import { validateStage3, validateStage4 } from "@/lib/stageValidators";
import { normalizeStage3, computeBaseScores, buildMetricBars } from "@/lib/normalizeStage3";
import { computeTruthIndex } from "@/lib/computeTruthIndex";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

function supabaseAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

async function updateStageState(
    runId: string,
    stageName: string,
    status: string,
    meta: any = {},
    data: any = null
) {
    const sb = supabaseAdmin();
    const now = new Date().toISOString();

    // 1. Update audit_runs.stage_state (lightweight tracking)
    const { data: current } = await sb.from("audit_runs").select("stage_state, product_id").eq("id", runId).single();

    const merged = {
        current: stageName,
        stages: {
            ...(current?.stage_state?.stages ?? {}),
            [stageName]: {
                status,
                updated_at: now,
                meta
            }
        }
    };

    await sb.from("audit_runs").update({
        stage_state: merged,
        last_heartbeat: now
    }).eq("id", runId);

    // 2. Persist to shadow_specs.stages (full data)
    if (current?.product_id) {
        const { data: shadowSpec } = await sb
            .from("shadow_specs")
            .select("stages")
            .eq("product_id", current.product_id)
            .single();

        const existingStages = shadowSpec?.stages || {};

        const updatedStages = {
            ...existingStages,
            [stageName]: {  // Use stageName directly
                status,
                completed_at: status === 'done' ? now : null,
                data,
                meta
            }
        };

        await sb.from("shadow_specs").upsert({
            product_id: current.product_id,
            stages: updatedStages,
            updated_at: now
        }, {
            onConflict: 'product_id'
        });
    }
}

async function updateProgress(runId: string, progress: number) {
    const sb = supabaseAdmin();
    await sb.from("audit_runs").update({
        progress,
        last_heartbeat: new Date().toISOString()
    }).eq("id", runId);
}

export async function POST(req: NextRequest) {
    let capturedRunId: string | null = null; // Captured for error handler
    try {
        const { runId } = await req.json();
        capturedRunId = runId;

        if (!runId) {
            return NextResponse.json({ ok: false, error: "MISSING_RUN_ID" }, { status: 400 });
        }

        const sb = supabaseAdmin();

        // 1. Fetch the audit run
        const { data: run, error: runError } = await sb
            .from("audit_runs")
            .select("*")
            .eq("id", runId)
            .single();

        if (runError || !run) {
            console.error("[Worker] Run not found:", runError);
            return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });
        }

        // 2. Fetch the product separately
        const { data: product, error: productError } = await sb
            .from("products")
            .select("*")
            .eq("id", run.product_id)
            .single();

        if (productError || !product) {
            console.error("[Worker] Product not found for run:", runId, productError);
            await sb.from("audit_runs").update({
                status: "error",
                error: "Product not found",
                finished_at: new Date().toISOString()
            }).eq("id", runId);
            return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });
        }

        console.log(`[Worker] Starting audit for ${product.brand} ${product.model_name}`);

        // Mark as running
        await sb.from("audit_runs").update({
            status: "running",
            started_at: new Date().toISOString()
        }).eq("id", runId);

        // STAGE 1 (Deterministic): Map Claims directly from Product Specs
        // We do NOT run an LLM stage here. It is purely deterministic.
        console.log(`[Worker] Mapping claims for ${product.brand} ${product.model_name}`);
        await updateStageState(runId, "discover", "running");

        let stage1Result: { claim_profile: any[] };
        try {
            // DIRECT MAPPING - No "executeStage1"
            let claims: any[] = [];

            if (Array.isArray(product.technical_specs)) {
                claims = product.technical_specs.map((s: any) => ({
                    label: s.label || s.name || 'Unknown',
                    value: s.value || s.spec_value || 'Not specified'
                }));
            } else if (typeof product.technical_specs === 'object') {
                claims = Object.entries(product.technical_specs)
                    .filter(([key]) => key !== 'spec_sources' && key !== 'evidence' && key !== 'content_hash')
                    .map(([key, value]) => ({
                        label: key,
                        value: String(value)
                    }));
            }

            // Filter invalid
            claims = claims.filter((i: any) => {
                const v = String(i.value).toLowerCase().trim();
                return v !== 'not specified' && v !== 'null' && v !== 'undefined' && v !== '';
            });

            stage1Result = { claim_profile: claims };

            console.log(`[Worker Stage 1] Mapped ${claims.length} claims inside worker`);

            if (claims.length === 0) {
                console.warn("[Worker] No claims found in technical_specs. Audit might have weak signal.");
            }

            await updateStageState(runId, "discover", "done", { claim_count: claims.length });
            await updateProgress(runId, 25);

        } catch (error: any) {
            console.error("[Worker Stage 1] Mapping Error:", error);
            // Critical failure - cannot audit without claims
            await sb.from("audit_runs").update({
                status: "error",
                error: `Stage 1 Failed: ${error.message}`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);
            return NextResponse.json({ ok: false, error: "STAGE1_FAILED" }, { status: 500 });
        }

        // STAGE 2: Gather Independent Signals
        await updateStageState(runId, "fetch", "running");
        let stage2Result;
        try {
            stage2Result = await executeStage2(product, stage1Result);
            console.log(`[Worker Stage 2] Found ${stage2Result.independent_signal.most_praised.length} signals`);
            await updateStageState(runId, "fetch", "done", {
                praise_count: stage2Result.independent_signal.most_praised.length,
                issue_count: stage2Result.independent_signal.most_reported_issues.length
            });
            await updateProgress(runId, 50);
        } catch (error: any) {
            console.error("[Worker Stage 2] Error:", error);
            await updateStageState(runId, "fetch", "error", { error: error.message });

            // TERMINAL ERROR - Do not proceed with empty signals
            await sb.from("audit_runs").update({
                status: "error",
                error: `Stage 2 Failed: ${error.message}`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);
            return NextResponse.json({ ok: false, error: "STAGE2_FAILED", details: error.message }, { status: 500 });
        }

        // STAGE 3: Fact Verification
        await updateStageState(runId, "stage_3", "running");
        const stage3Start = Date.now();
        let stage3Result;

        try {
            stage3Result = await executeStage3(product, stage1Result, stage2Result);
            const stage3Ms = Date.now() - stage3Start;

            // VALIDATE before marking done
            const validation = validateStage3(stage3Result);

            console.log(`[${runId}] stage3.model_ms=${stage3Ms} parse_ok=${!!stage3Result} item_count=${validation.itemCount}`);

            if (!validation.valid) {
                console.error(`[Worker Stage 3] Validation failed:`, validation.error);

                // Persist error with excerpt
                await updateStageState(runId, "stage_3", "error", {
                    error: validation.error,
                    item_count: validation.itemCount,
                    model_ms: stage3Ms,
                    parse_ok: false,
                    raw_excerpt: JSON.stringify(stage3Result).slice(0, 1500)
                });

                // Block Stage 4
                await updateStageState(runId, "stage_4", "blocked", {
                    reason: "stage3_invalid",
                    stage3_error: validation.error
                });

                // Mark run as incomplete
                await sb.from("audit_runs").update({
                    status: "incomplete",
                    error: `Stage 3 validation failed: ${validation.error}`,
                    finished_at: new Date().toISOString()
                }).eq("id", runId);

                return NextResponse.json({
                    ok: false,
                    error: "STAGE3_VALIDATION_FAILED",
                    details: validation.error
                }, { status: 422 });
            }

            // Valid! Persist with full data
            console.log(`[Worker Stage 3] Valid: ${validation.itemCount} items in ${validation.arrayKey}`);
            await updateStageState(runId, "stage_3", "done", {
                item_count: validation.itemCount,
                array_key: validation.arrayKey,
                model_ms: stage3Ms,
                parse_ok: true
            }, stage3Result); // Pass full data object
            await updateProgress(runId, 75);

        } catch (error: any) {
            const stage3Ms = Date.now() - stage3Start;
            console.error("[Worker Stage 3] Error:", error);

            // NO FALLBACK - persist error and return
            await updateStageState(runId, "stage_3", "error", {
                error: error.message,
                model_ms: stage3Ms,
                parse_ok: false
            });

            await updateStageState(runId, "stage_4", "blocked", {
                reason: "stage3_failed"
            });

            await sb.from("audit_runs").update({
                status: "error",
                error: `Stage 3 failed: ${error.message}`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);

            return NextResponse.json({ ok: false, error: "STAGE3_FAILED" }, { status: 500 });
        }

        // STAGE 3.5: Deterministic Normalization + Truth Index
        await updateStageState(runId, "normalize", "running");
        const normalizedStage3 = normalizeStage3(stage3Result);
        const baseScores = computeBaseScores(normalizedStage3.entries);
        const metricBars = buildMetricBars(baseScores);

        // Compute deterministic Truth Index (pre-LLM — base only)
        const truthBreakdown = computeTruthIndex(normalizedStage3.entries, baseScores);

        console.log(`[Worker Normalize] ${normalizedStage3.totalCount} raw → ${normalizedStage3.uniqueCount} unique entries`);
        console.log(`[Worker Normalize] Bucket scores: claims=${baseScores.claimsAccuracy} fit=${baseScores.realWorldFit} noise=${baseScores.operationalNoise}`);
        console.log(`[Worker Normalize] Truth Index: base=${truthBreakdown.base} final=${truthBreakdown.final} penalties=${truthBreakdown.penalties.total}`);

        await updateStageState(runId, "normalize", "done", {
            totalCount: normalizedStage3.totalCount,
            uniqueCount: normalizedStage3.uniqueCount,
            baseScores,
            truthBreakdown
        });

        // STAGE 5: Assess (Truth Index & Verdict)
        // HARD GATE: Validate Stage 3 before proceeding
        const stage3Validation = validateStage3(stage3Result);

        if (!stage3Validation.valid || normalizedStage3.uniqueCount < 1) {
            console.warn(`[Worker] Stage 4 BLOCKED - Stage 3 has no valid data (itemCount=${stage3Validation.itemCount})`);

            await updateStageState(runId, "stage_4", "blocked", {
                reason: "stage3_insufficient_data",
                stage3_error: stage3Validation.error,
                stage3_item_count: stage3Validation.itemCount
            });

            await sb.from("audit_runs").update({
                status: "incomplete",
                error: `Stage 4 blocked: Stage 3 has insufficient data (${stage3Validation.itemCount} items)`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);

            return NextResponse.json({
                ok: false,
                error: "STAGE4_BLOCKED",
                reason: "stage3_insufficient_data"
            }, { status: 422 });
        }

        console.log(`[Worker] Stage 4 proceeding - Stage 3 has ${stage3Validation.itemCount} valid items`);

        await updateStageState(runId, "stage_4", "running");
        const stage4Start = Date.now();
        let stage4Result;

        try {
            stage4Result = await executeStage4(product, {
                stage1: stage1Result,
                stage2: stage2Result,
                stage3: { red_flags: normalizedStage3.entries, reality_ledger: stage3Result.reality_ledger || [] }
            }, { baseScores, metricBars, truthBreakdown });
            const stage4Ms = Date.now() - stage4Start;

            // VALIDATE Stage 4 output
            const validation = validateStage4(stage4Result);

            console.log(`[${runId}] stage4.model_ms=${stage4Ms} parse_ok=${!!stage4Result} truth_index=${stage4Result.truth_index}`);

            if (!validation.valid) {
                console.error(`[Worker Stage 4] Validation failed:`, validation.error);

                await updateStageState(runId, "stage_4", "error", {
                    error: validation.error,
                    model_ms: stage4Ms,
                    parse_ok: false,
                    raw_excerpt: JSON.stringify(stage4Result).slice(0, 1500)
                });

                await sb.from("audit_runs").update({
                    status: "error",
                    error: `Stage 4 validation failed: ${validation.error}`,
                    finished_at: new Date().toISOString()
                }).eq("id", runId);

                return NextResponse.json({
                    ok: false,
                    error: "STAGE4_VALIDATION_FAILED"
                }, { status: 422 });
            }

            // Valid! Persist with full data
            console.log(`[Worker Stage 4] Valid: Truth Index ${stage4Result.truth_index}`);
            await updateStageState(runId, "stage_4", "done", {
                truth_index: stage4Result.truth_index,
                model_ms: stage4Ms,
                parse_ok: true
            }, stage4Result); // Pass full data object
            await updateProgress(runId, 100);

        } catch (error: any) {
            const stage4Ms = Date.now() - stage4Start;
            console.error("[Worker Stage 4] Error:", error);

            const isTimeout = error.message?.includes('timeout') || error.message?.includes('TIMEOUT');

            // DON'T mark as done - mark as error/timeout
            await updateStageState(runId, "stage_4", "error", {
                error: isTimeout ? "timeout" : error.message,
                model_ms: stage4Ms,
                parse_ok: false
            });

            await sb.from("audit_runs").update({
                status: isTimeout ? "timeout" : "error",
                error: error.message,
                finished_at: new Date().toISOString()
            }).eq("id", runId);

            return NextResponse.json({ ok: false, error: "STAGE4_FAILED" }, { status: 500 });
        }

        // Build complete stages object (normalized data only)
        const now = new Date().toISOString();
        const completeStages = {
            stage_1: {
                status: "done",
                completed_at: now,
                ttl_days: 90,
                data: {
                    claim_profile: stage1Result.claim_profile,
                    source_count: stage1Result.claim_profile.length
                }
            },
            stage_2: {
                status: "done",
                completed_at: now,
                ttl_days: 30,
                data: {
                    most_praised: stage2Result.independent_signal.most_praised,
                    most_reported_issues: stage2Result.independent_signal.most_reported_issues,
                    source_summary: `Analyzed ${stage2Result.independent_signal.most_praised.length + stage2Result.independent_signal.most_reported_issues.length} community signals`
                }
            },
            stage_3: {
                status: "done",
                completed_at: now,
                ttl_days: 90,
                data: {
                    // Normalized entries only — no duplicate keys
                    entries: normalizedStage3.entries,
                    totalCount: normalizedStage3.totalCount,
                    uniqueCount: normalizedStage3.uniqueCount,
                    // Legacy keys point to normalized list
                    red_flags: normalizedStage3.entries,
                    discrepancies: normalizedStage3.entries,
                    verified_claims: stage1Result.claim_profile.length - normalizedStage3.uniqueCount,
                    flagged_claims: normalizedStage3.uniqueCount
                }
            },
            stage_4: {
                status: "done",
                completed_at: now,
                ttl_days: 90,
                data: stage4Result
            }
        };

        // Persist to shadow_specs (using correct schema columns)
        // Schema: claimed_specs, actual_specs, red_flags, stages, truth_score, source_urls
        // Removed: canonical_spec_json, updated_at (not in schema)

        const canonicalSpec = {
            claim_profile: stage1Result.claim_profile,
            reality_ledger: stage3Result.reality_ledger || [],
            discrepancies: normalizedStage3.entries,
            red_flags: normalizedStage3.entries
        };

        console.log(`[Worker] Final persist - ${normalizedStage3.uniqueCount} unique entries, truth_index=${stage4Result.truth_index}`);
        console.log(`[Worker] Truth breakdown: base=${stage4Result.truth_index_breakdown?.base} final=${stage4Result.truth_index_breakdown?.final}`);

        // Manual Upsert to avoid "missing unique constraint" error
        // 1. Check if exists
        const { data: existingShadow, error: fetchShadowError } = await sb
            .from("shadow_specs")
            .select("id")
            .eq("product_id", product.id)
            .maybeSingle();

        if (fetchShadowError) {
            throw new Error(`SHADOW_SPEC_FETCH_FAILED: ${fetchShadowError.message}`);
        }

        let upsertError;
        if (existingShadow) {
            // Update
            const { error } = await sb.from("shadow_specs").update({
                claimed_specs: canonicalSpec.claim_profile,
                actual_specs: canonicalSpec.reality_ledger,
                red_flags: canonicalSpec.red_flags,
                stages: completeStages,
                is_verified: true,
                truth_score: stage4Result.truth_index,
                source_urls: []
            }).eq("id", existingShadow.id);
            upsertError = error;
        } else {
            // Insert
            const { error } = await sb.from("shadow_specs").insert({
                product_id: product.id,
                claimed_specs: canonicalSpec.claim_profile,
                actual_specs: canonicalSpec.reality_ledger,
                red_flags: canonicalSpec.red_flags,
                stages: completeStages,
                is_verified: true,
                truth_score: stage4Result.truth_index,
                source_urls: []
            });
            upsertError = error;
        }

        if (upsertError) {
            console.error("[Worker] Failed to persist shadow_spec:", upsertError);
            throw new Error(`SHADOW_SPEC_PERSIST_FAILED: ${upsertError.message}`);
        }

        // Persist assessment
        await sb.from("audit_assessments").upsert({
            audit_run_id: runId,
            assessment_json: {
                verdict: stage4Result.score_interpretation,
                truth_index: stage4Result.truth_index,
                strengths: stage4Result.strengths,
                limitations: stage4Result.limitations
            }
        });

        // Mark run as complete
        await sb.from("audit_runs").update({
            status: "done",
            progress: 100,
            finished_at: new Date().toISOString()
        }).eq("id", runId);

        console.log(`[Worker] Audit completed for ${product.brand} ${product.model_name}`);

        return NextResponse.json({
            ok: true,
            runId,
            truth_index: stage4Result.truth_index
        });

    } catch (error: any) {
        console.error("[Worker] Fatal error:", error);

        if (capturedRunId) {
            const sb = supabaseAdmin();
            await sb.from("audit_runs").update({
                status: "error",
                error: error.message || "Worker failed",
                finished_at: new Date().toISOString()
            }).eq("id", capturedRunId);
        }

        return NextResponse.json({
            ok: false,
            error: "WORKER_FAILED",
            message: error.message
        }, { status: 500 });
    }
}
