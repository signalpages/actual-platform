import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const runId = searchParams.get("runId");
        if (!runId) {
            return NextResponse.json({ ok: false, error: "MISSING_RUN_ID" }, { status: 400 });
        }

        const sb = supabaseAdmin();

        // 1. Get the requested run
        const { data: run, error: runError } = await sb
            .from("audit_runs")
            .select("*")
            .eq("id", runId)
            .single();

        if (runError || !run) {
            return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });
        }

        // 2. Determine which run to load data from
        let dataRunId = run.id;
        let dataSource = "current";

        const isWorking = run.status === "running" || run.status === "pending";
        const isFailed = run.status === "failed" || run.status === "error";

        // Find last successful run if current is working/failed
        if (isWorking || isFailed) {
            const { data: lastSuccess } = await sb
                .from("audit_runs")
                .select("id")
                .eq("product_id", run.product_id)
                .in("status", ["done", "complete"])
                .neq("id", run.id)
                .order("finished_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastSuccess) {
                dataRunId = lastSuccess.id;
                dataSource = "cached";
            }
        }

        // 3. Load data (Shadow Specs, Assessment, Evidence)
        const [
            { data: shadowSpec },
            { data: assessment },
            { data: evidence_chunks }
        ] = await Promise.all([
            sb.from("shadow_specs")
                .select("*")
                .eq("product_id", run.product_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            sb.from("audit_assessments").select("*").eq("audit_run_id", dataRunId).maybeSingle(),
            sb.from("evidence_chunks").select("*").eq("audit_run_id", dataRunId).order("created_at", { ascending: true })
        ]);

        // Map shadow_specs to 'canonical' shape for frontend compat
        let canonical = null;
        if (shadowSpec) {
            canonical = {
                ...shadowSpec,
                spec_json: shadowSpec.canonical_spec_json,
            };
        }

        // Fallback if current run finished but has no data
        if (dataSource === "current" && run.status === "done" && !canonical) {
            const { data: lastSuccess } = await sb
                .from("audit_runs")
                .select("*")
                .eq("product_id", run.product_id)
                .in("status", ["done", "complete"])
                .neq("id", run.id)
                .order("finished_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastSuccess) {
                const [s2, a2, e2] = await Promise.all([
                    sb.from("shadow_specs")
                        .select("*")
                        .eq("product_id", run.product_id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    sb.from("audit_assessments").select("*").eq("audit_run_id", lastSuccess.id).maybeSingle(),
                    sb.from("evidence_chunks").select("*").eq("audit_run_id", lastSuccess.id).order("created_at", { ascending: true })
                ]);

                if (s2.data) {
                    const c2 = {
                        ...s2.data,
                        spec_json: s2.data.canonical_spec_json
                    };
                    return NextResponse.json({
                        ok: true,
                        activeRun: run,
                        displayRun: lastSuccess,
                        run: run ?? lastSuccess ?? null,
                        canonical: c2,
                        assessment: a2.data,
                        evidence: e2.data ?? [],
                        status: "cached",
                        data_source: "cached_success"
                    });
                }
            }
        }

        // Map high-level status
        let status = "empty";
        let finalDataSource: "latest_success" | "cached_success" | "none" = "none";
        let displayRun = run;

        if (run.status === "pending" || run.status === "running") {
            status = "running";
            if (canonical) {
                finalDataSource = "cached_success";
                if (dataRunId !== run.id) {
                    const { data: cachedDisplayRun } = await sb.from("audit_runs").select("*").eq("id", dataRunId).single();
                    if (cachedDisplayRun) displayRun = cachedDisplayRun;
                }
            } else {
                finalDataSource = "none";
            }
        } else if (run.status === "done" && canonical) {
            status = "done";
            finalDataSource = "latest_success";
        } else if (canonical) {
            status = "cached";
            finalDataSource = "latest_success";
        }

        // Flatten data for frontend consumption
        const flatResponse: any = {
            ok: true,
            activeRun: run,
            displayRun: displayRun,
            status,
            data_source: canonical ? finalDataSource : "none"
        };

        if (canonical) {
            // 1. Base Audit Object
            flatResponse.audit = {
                ...canonical,
                ...RunDataParams(displayRun)
            };

            // 2. Stages - MERGE from both shadow_specs AND audit_runs
            const runStagesData = displayRun?.stages || {};
            const shadowStagesStatus = canonical.stages || {};

            flatResponse.stages = {
                ...shadowStagesStatus,
                ...runStagesData
            };

            // 3. Extracted / Normalized Data
            const spec = canonical.canonical_spec_json || {};
            flatResponse.claim_profile = spec.claim_profile || [];
            flatResponse.reality_ledger = spec.reality_ledger || [];
            flatResponse.discrepancies = spec.discrepancies || spec.red_flags || [];

            // 4. Assessment Data
            flatResponse.truth_index = assessment?.assessment_json?.truth_index ?? assessment?.final_score ?? canonical.truth_score ?? null;

            // 5. Analysis
            flatResponse.analysis = {
                status: assessment ? 'verified' : (canonical.is_verified ? 'verified' : 'provisional'),
                bms: assessment?.assessment_json?.bms_analysis,
                safety: assessment?.assessment_json?.safety_analysis,
                c_rate: assessment?.assessment_json?.c_rate_analysis,
                last_run_at: displayRun.finished_at
            };
        }

        return NextResponse.json(flatResponse);

    } catch (err: any) {
        console.error("Status endpoint error:", err);
        return NextResponse.json(
            { ok: false, error: "STATUS_EXCEPTION", message: err?.message ?? String(err) },
            { status: 500 }
        );
    }
}

function RunDataParams(run: any) {
    if (!run) return {};
    return {
        runId: run.id,
        created_at: run.created_at,
        platform_status: run.status
    };
}
