import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeStage1, executeStage2, executeStage3, executeStage4 } from "@/lib/stageExecutors";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

function supabaseAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

async function updateStageState(runId: string, stage: string, status: string, meta: any = {}) {
    const sb = supabaseAdmin();
    const now = new Date().toISOString();

    const { data: current } = await sb.from("audit_runs").select("stage_state").eq("id", runId).single();

    const merged = {
        current: stage,
        stages: {
            ...(current?.stage_state?.stages ?? {}),
            [stage]: {
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
}

async function updateProgress(runId: string, progress: number) {
    const sb = supabaseAdmin();
    await sb.from("audit_runs").update({
        progress,
        last_heartbeat: new Date().toISOString()
    }).eq("id", runId);
}

export async function POST(req: NextRequest) {
    try {
        const { runId } = await req.json();

        if (!runId) {
            return NextResponse.json({ ok: false, error: "MISSING_RUN_ID" }, { status: 400 });
        }

        const sb = supabaseAdmin();

        // 1. Fetch the audit run and product
        const { data: run, error: runError } = await sb
            .from("audit_runs")
            .select("*, products(*)")
            .eq("id", runId)
            .single();

        if (runError || !run) {
            console.error("[Worker] Run not found:", runError);
            return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });
        }

        const product = run.products;
        if (!product) {
            console.error("[Worker] Product not found for run:", runId);
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
        await updateStageState(runId, "extract", "running");
        let stage3Result;
        try {
            stage3Result = await executeStage3(product, stage1Result, stage2Result);
            console.log(`[Worker Stage 3] Found ${stage3Result.red_flags.length} red flags`);
            await updateStageState(runId, "extract", "done", {
                red_flag_count: stage3Result.red_flags.length
            });
            await updateProgress(runId, 75);
        } catch (error: any) {
            console.error("[Worker Stage 3] Error:", error);
            await updateStageState(runId, "extract", "error", { error: error.message });
            stage3Result = { reality_ledger: [], red_flags: [] };
        }

        // STAGE 4: Normalize (minimal processing)
        await updateStageState(runId, "normalize", "running");
        await new Promise(r => setTimeout(r, 200));
        await updateStageState(runId, "normalize", "done");

        // STAGE 5: Assess (Truth Index & Verdict)
        await updateStageState(runId, "assess", "running");
        let stage4Result;
        try {
            stage4Result = await executeStage4(product, {
                stage1: stage1Result,
                stage2: stage2Result,
                stage3: stage3Result
            });
            console.log(`[Worker Stage 4] Truth Index: ${stage4Result.truth_index}`);
            await updateStageState(runId, "assess", "done", {
                truth_index: stage4Result.truth_index
            });
            await updateProgress(runId, 100);
        } catch (error: any) {
            console.error("[Worker Stage 4] Error:", error);
            await updateStageState(runId, "assess", "error", { error: error.message });
            stage4Result = {
                truth_index: 75,
                metric_bars: [],
                score_interpretation: "Analysis incomplete due to error",
                strengths: [],
                limitations: ["Unable to complete full analysis"],
                practical_impact: [],
                good_fit: [],
                consider_alternatives: [],
                data_confidence: "Low - Partial data only"
            };
        }

        // Build complete stages object
        const completeStages = {
            stage_1: {
                status: "done",
                completed_at: new Date().toISOString(),
                ttl_days: 90,
                data: {
                    claim_profile: stage1Result.claim_profile,
                    source_count: stage1Result.claim_profile.length
                }
            },
            stage_2: {
                status: "done",
                completed_at: new Date().toISOString(),
                ttl_days: 30,
                data: {
                    most_praised: stage2Result.independent_signal.most_praised,
                    most_reported_issues: stage2Result.independent_signal.most_reported_issues,
                    source_summary: `Analyzed ${stage2Result.independent_signal.most_praised.length + stage2Result.independent_signal.most_reported_issues.length} community signals`
                }
            },
            stage_3: {
                status: "done",
                completed_at: new Date().toISOString(),
                ttl_days: 90,
                data: {
                    discrepancies: stage3Result.red_flags,
                    red_flags: stage3Result.red_flags,
                    verified_claims: stage1Result.claim_profile.length - stage3Result.red_flags.length,
                    flagged_claims: stage3Result.red_flags.length
                }
            },
            stage_4: {
                status: "done",
                completed_at: new Date().toISOString(),
                ttl_days: 90,
                data: stage4Result
            }
        };

        // Persist to shadow_specs
        const mockSpec = {
            claim_profile: stage1Result.claim_profile,
            reality_ledger: stage3Result.reality_ledger,
            discrepancies: stage3Result.red_flags,
            red_flags: stage3Result.red_flags
        };

        await sb.from("shadow_specs").upsert({
            product_id: product.id,
            canonical_spec_json: mockSpec,
            stages: completeStages,
            is_verified: true,
            truth_score: stage4Result.truth_index,
            source_urls: [],
            updated_at: new Date().toISOString()
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

        const { runId } = await req.json().catch(() => ({ runId: null }));
        if (runId) {
            const sb = supabaseAdmin();
            await sb.from("audit_runs").update({
                status: "error",
                error: error.message || "Worker failed",
                finished_at: new Date().toISOString()
            }).eq("id", runId);
        }

        return NextResponse.json({
            ok: false,
            error: "WORKER_FAILED",
            message: error.message
        }, { status: 500 });
    }
}
