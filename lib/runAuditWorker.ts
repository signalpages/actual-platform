import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { executeStage1, executeStage2, executeStage3, executeStage4 } from "./stageExecutors";
import { validateStage3, validateStage4 } from "./stageValidators";
import { normalizeStage3, computeBaseScores, buildMetricBars } from "./normalizeStage3";
import { computeTruthIndex } from "./computeTruthIndex";

// Helper to update stage state in DB and shadow_specs
async function updateStageState(
    sb: SupabaseClient,
    runId: string,
    stageName: string,
    status: string,
    meta: any = {},
    data: any = null
) {
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
        // Safe Read-Merge-Upsert
        // Use deterministic ordering to find the canonical row (or best candidate)
        const { data: shadowRows } = await sb
            .from("shadow_specs")
            .select("stages")
            .eq("product_id", current.product_id)
            .order("created_at", { ascending: false })
            .limit(1);

        const shadowSpec = shadowRows?.[0];
        const existingStages = shadowSpec?.stages || {};

        // EXPLICIT MERGE: Shallow merge existing stages with the new stage payload
        const updatedStages = {
            ...existingStages, // Preserve S1, S2, etc.
            [stageName]: {
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

async function updateProgress(sb: SupabaseClient, runId: string, progress: number) {
    await sb.from("audit_runs").update({
        progress,
        last_heartbeat: new Date().toISOString()
    }).eq("id", runId);
}

// Helper to flatten nested specs
function flattenSpecs(obj: any, prefix = ''): Array<{ label: string; value: string }> {
    let results: Array<{ label: string; value: string }> = [];
    if (!obj || typeof obj !== 'object') return [];

    for (const [key, value] of Object.entries(obj)) {
        if (['spec_sources', 'evidence', 'content_hash'].includes(key)) continue;
        const newKey = prefix ? `${prefix} ${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            results = results.concat(flattenSpecs(value, newKey));
        } else {
            const label = newKey
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase());
            results.push({ label, value: String(value) });
        }
    }
    return results;
}

export async function runAuditWorker({
    runId,
    sb,
}: {
    runId: string;
    sb: SupabaseClient;
}) {
    let capturedRunId = runId;

    try {
        if (!runId) {
            throw new Error("MISSING_RUN_ID");
        }

        // 1. Fetch the audit run
        const { data: run, error: runError } = await sb
            .from("audit_runs")
            .select("*")
            .eq("id", runId)
            .single();

        if (runError || !run) {
            console.error("[Worker] Run not found:", runError);
            throw new Error("RUN_NOT_FOUND");
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
            throw new Error("PRODUCT_NOT_FOUND");
        }

        console.log(`[Worker] Starting audit for ${product.brand} ${product.model_name}`);

        // Mark as running
        await sb.from("audit_runs").update({
            status: "running",
            started_at: new Date().toISOString()
        }).eq("id", runId);

        // STAGE 1 (Deterministic): Map Claims directly from Product Specs
        console.log(`[Worker] Mapping claims for ${product.brand} ${product.model_name}`);
        await updateStageState(sb, runId, "discover", "running");

        let stage1Result: { claim_profile: any[] };
        try {
            // DIRECT MAPPING
            let claims: any[] = [];

            if (Array.isArray(product.technical_specs)) {
                claims = product.technical_specs.map((s: any) => ({
                    label: s.label || s.name || 'Unknown',
                    value: s.value || s.spec_value || 'Not specified'
                }));
            } else if (typeof product.technical_specs === 'object') {
                claims = flattenSpecs(product.technical_specs);
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

            await updateStageState(sb, runId, "discover", "done", { claim_count: claims.length });
            await updateProgress(sb, runId, 25);

        } catch (error: any) {
            console.error("[Worker Stage 1] Mapping Error:", error);
            await sb.from("audit_runs").update({
                status: "error",
                error: `Stage 1 Failed: ${error.message}`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);
            throw new Error(`STAGE1_FAILED: ${error.message}`);
        }

        // STAGE 2: Gather Independent Signals
        await updateStageState(sb, runId, "fetch", "running");
        let stage2Result;
        try {
            stage2Result = await executeStage2(product, stage1Result);
            console.log(`[Worker Stage 2] Found ${stage2Result.independent_signal.most_praised.length} signals`);
            await updateStageState(sb, runId, "fetch", "done", {
                praise_count: stage2Result.independent_signal.most_praised.length,
                issue_count: stage2Result.independent_signal.most_reported_issues.length
            });
            await updateProgress(sb, runId, 50);
        } catch (error: any) {
            console.error("[Worker Stage 2] Error:", error);
            await updateStageState(sb, runId, "fetch", "error", { error: error.message });

            await sb.from("audit_runs").update({
                status: "error",
                error: `Stage 2 Failed: ${error.message}`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);
            throw new Error(`STAGE2_FAILED: ${error.message}`);
        }

        // STAGE 3: Fact Verification
        await updateStageState(sb, runId, "stage_3", "running");
        const stage3Start = Date.now();
        let stage3Result;

        try {
            stage3Result = await executeStage3(product, stage1Result, stage2Result);
            const stage3Ms = Date.now() - stage3Start;

            // VALIDATE
            const validation = validateStage3(stage3Result);

            console.log(`[${runId}] stage3.model_ms=${stage3Ms} parse_ok=${!!stage3Result} item_count=${validation.itemCount}`);

            if (!validation.valid) {
                console.error(`[Worker Stage 3] Validation failed:`, validation.error);

                await updateStageState(sb, runId, "stage_3", "error", {
                    error: validation.error,
                    item_count: validation.itemCount,
                    model_ms: stage3Ms,
                    parse_ok: false,
                    raw_excerpt: JSON.stringify(stage3Result).slice(0, 1500)
                });

                await updateStageState(sb, runId, "stage_4", "blocked", {
                    reason: "stage3_invalid",
                    stage3_error: validation.error
                });

                await sb.from("audit_runs").update({
                    status: "incomplete",
                    error: `Stage 3 validation failed: ${validation.error}`,
                    finished_at: new Date().toISOString()
                }).eq("id", runId);

                throw new Error(`STAGE3_VALIDATION_FAILED: ${validation.error}`);
            }

            console.log(`[Worker Stage 3] Valid: ${validation.itemCount} items in ${validation.arrayKey}`);
            await updateStageState(sb, runId, "stage_3", "done", {
                item_count: validation.itemCount,
                array_key: validation.arrayKey,
                model_ms: stage3Ms,
                parse_ok: true
            }, stage3Result);
            await updateProgress(sb, runId, 75);

        } catch (error: any) {
            const stage3Ms = Date.now() - stage3Start;
            console.error("[Worker Stage 3] Error:", error);

            await updateStageState(sb, runId, "stage_3", "error", {
                error: error.message,
                model_ms: stage3Ms,
                parse_ok: false
            });

            await updateStageState(sb, runId, "stage_4", "blocked", {
                reason: "stage3_failed"
            });

            await sb.from("audit_runs").update({
                status: "error",
                error: `Stage 3 failed: ${error.message}`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);

            throw new Error(`STAGE3_FAILED: ${error.message}`);
        }

        // STAGE 3.5: Deterministic Normalization + Truth Index
        await updateStageState(sb, runId, "normalize", "running");
        const normalizedStage3 = normalizeStage3(stage3Result);
        const baseScores = computeBaseScores(normalizedStage3.entries);
        const metricBars = buildMetricBars(baseScores);

        // Compute deterministic Truth Index
        const truthBreakdown = computeTruthIndex(normalizedStage3.entries, baseScores);

        console.log(`[Worker Normalize] ${normalizedStage3.totalCount} raw → ${normalizedStage3.uniqueCount} unique entries`);

        await updateStageState(sb, runId, "normalize", "done", {
            totalCount: normalizedStage3.totalCount,
            uniqueCount: normalizedStage3.uniqueCount,
            baseScores,
            truthBreakdown
        });

        // STAGE 4 Check
        const stage3Validation = validateStage3(stage3Result);

        if (!stage3Validation.valid || normalizedStage3.uniqueCount < 1) {
            console.warn(`[Worker] Stage 4 BLOCKED - Stage 3 has no valid data`);

            await updateStageState(sb, runId, "stage_4", "blocked", {
                reason: "stage3_insufficient_data",
                stage3_error: stage3Validation.error,
                stage3_item_count: stage3Validation.itemCount
            });

            await sb.from("audit_runs").update({
                status: "incomplete",
                error: `Stage 4 blocked: Stage 3 has insufficient data`,
                finished_at: new Date().toISOString()
            }).eq("id", runId);

            throw new Error("STAGE4_BLOCKED");
        }

        // STAGE 4
        console.log(`[Worker] Stage 4 proceeding`);
        await updateStageState(sb, runId, "stage_4", "running");
        const stage4Start = Date.now();
        let stage4Result;

        try {
            stage4Result = await executeStage4(product, {
                stage1: stage1Result,
                stage2: stage2Result,
                stage3: { red_flags: normalizedStage3.entries, reality_ledger: stage3Result.reality_ledger || [] }
            }, { baseScores, metricBars, truthBreakdown });
            const stage4Ms = Date.now() - stage4Start;

            const validation = validateStage4(stage4Result);
            console.log(`[${runId}] stage4.model_ms=${stage4Ms} parse_ok=${!!stage4Result} truth_index=${stage4Result.truth_index}`);

            if (!validation.valid) {
                await updateStageState(sb, runId, "stage_4", "error", {
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

                throw new Error("STAGE4_VALIDATION_FAILED");
            }

            await updateStageState(sb, runId, "stage_4", "done", {
                truth_index: stage4Result.truth_index,
                model_ms: stage4Ms,
                parse_ok: true
            }, stage4Result);
            await updateProgress(sb, runId, 100);

        } catch (error: any) {
            const stage4Ms = Date.now() - stage4Start;
            console.error("[Worker Stage 4] Error:", error);
            const isTimeout = error.message?.includes('timeout') || error.message?.includes('TIMEOUT');

            await updateStageState(sb, runId, "stage_4", "error", {
                error: isTimeout ? "timeout" : error.message,
                model_ms: stage4Ms,
                parse_ok: false
            });

            await sb.from("audit_runs").update({
                status: isTimeout ? "timeout" : "error",
                error: error.message,
                finished_at: new Date().toISOString()
            }).eq("id", runId);

            throw new Error(`STAGE4_FAILED: ${error.message}`);
        }

        // FINAL PERSIST
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
                    entries: normalizedStage3.entries,
                    totalCount: normalizedStage3.totalCount,
                    uniqueCount: normalizedStage3.uniqueCount,
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

        const canonicalSpec = {
            claim_profile: stage1Result.claim_profile,
            reality_ledger: stage3Result.reality_ledger || [],
            discrepancies: normalizedStage3.entries,
            red_flags: normalizedStage3.entries
        };

        const { error: upsertError } = await sb.from("shadow_specs").upsert({
            product_id: product.id,
            claimed_specs: canonicalSpec.claim_profile,
            actual_specs: canonicalSpec.reality_ledger,
            red_flags: canonicalSpec.red_flags,
            stages: completeStages,
            is_verified: true,
            truth_score: stage4Result.truth_index,
            source_urls: []
        }, {
            onConflict: 'product_id'
        });

        if (upsertError) {
            throw new Error(`SHADOW_SPEC_PERSIST_FAILED: ${upsertError.message}`);
        }

        await sb.from("audit_assessments").upsert({
            audit_run_id: runId,
            assessment_json: {
                verdict: stage4Result.score_interpretation,
                truth_index: stage4Result.truth_index,
                strengths: stage4Result.strengths,
                limitations: stage4Result.limitations
            }
        });

        await sb.from("audit_runs").update({
            status: "done",
            progress: 100,
            finished_at: new Date().toISOString()
        }).eq("id", runId);

        console.log(`[Worker] Audit completed for ${product.brand} ${product.model_name}`);

        return {
            ok: true,
            runId,
            truth_index: stage4Result.truth_index
        };

    } catch (error: any) {
        console.error("[Worker] Fatal error:", error);
        // If we created a run but fell apart completely
        if (capturedRunId) {
            await sb.from("audit_runs").update({
                status: "error",
                error: error.message || "Worker failed fatallly",
                finished_at: new Date().toISOString()
            }).eq("id", capturedRunId);
        }
        throw error;
    }
}
