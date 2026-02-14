import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeStage1, executeStage2, executeStage3, executeStage4 } from "@/lib/stageExecutors";
import { validateStage3, validateStage4 } from "@/lib/stageValidators";
import { normalizeStage3, computeBaseScores, buildMetricBars } from "@/lib/normalizeStage3";

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

        // STAGE 1: Extract Claim Profile
        await updateStageState(runId, "discover", "running");
        let stage1Result;
        try {
            stage1Result = await executeStage1(product);
            console.log(`[Worker Stage 1] Extracted ${stage1Result.claim_profile.length} claims`);
            await updateStageState(runId, "discover", "done", { claim_count: stage1Result.claim_profile.length });
            await updateProgress(runId, 25);
        } catch (error: any) {
            console.error("[Worker Stage 1] Error:", error);
            await updateStageState(runId, "discover", "error", { error: error.message });
            // Use fallback
            stage1Result = {
                claim_profile: Array.isArray(product.technical_specs)
                    ? product.technical_specs.map((s: any) => ({
                        label: s.label || s.name || 'Unknown',
                        value: s.value || s.spec_value || 'Not specified'
                    }))
                    : []
            };
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
            stage2Result = { independent_signal: { most_praised: [], most_reported_issues: [] } };
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

        // STAGE 3.5: Deterministic Normalization
        await updateStageState(runId, "normalize", "running");
        const normalizedStage3 = normalizeStage3(stage3Result);
        const baseScores = computeBaseScores(normalizedStage3.entries);
        const metricBars = buildMetricBars(baseScores);

        console.log(`[Worker Normalize] ${normalizedStage3.totalCount} raw → ${normalizedStage3.uniqueCount} unique entries`);
        console.log(`[Worker Normalize] Base scores: overall=${baseScores.overall} claims=${baseScores.claimsAccuracy} fit=${baseScores.realWorldFit} noise=${baseScores.operationalNoise}`);

        await updateStageState(runId, "normalize", "done", {
            totalCount: normalizedStage3.totalCount,
            uniqueCount: normalizedStage3.uniqueCount,
            baseScores
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
            }, { baseScores, metricBars });
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

        // Persist to shadow_specs (normalized only)
        const canonicalSpec = {
            claim_profile: stage1Result.claim_profile,
            reality_ledger: stage3Result.reality_ledger || [],
            discrepancies: normalizedStage3.entries,
            red_flags: normalizedStage3.entries
        };

        console.log(`[Worker] Final persist - ${normalizedStage3.uniqueCount} unique entries, truth_index=${stage4Result.truth_index}`);

        await sb.from("shadow_specs").upsert({
            product_id: product.id,
            canonical_spec_json: canonicalSpec,
            stages: completeStages,
            is_verified: true,
            truth_score: stage4Result.truth_index,
            source_urls: [],
            updated_at: now
        }, {
            onConflict: 'product_id'
        });

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
