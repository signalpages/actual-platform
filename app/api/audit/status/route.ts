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

    // Criteria for fallback: current run is failed OR finished but has no canonical data (empty)
    // We check for canonical existence briefly or just assume if status is 'done' it should check
    // Optimization: Check if 'done' and 'result_shadow_spec_id' is null? Or just try to load later.
    // Let's optimistic load.

    // If run is running/pending, we still want to show previous success if available?
    // Prompt says: "If latest run failed but older success exists → return older success."
    // Also "UI always shows: last successful audit instantly"
    // So if current run is running, we ALSO want the data from the last success.

    const isWorking = run.status === "running" || run.status === "pending";
    const isFailed = run.status === "failed" || run.status === "error"; // "error" is schema val

    // We try to find a successful run if we are working or failed
    if (isWorking || isFailed) {
      const { data: lastSuccess } = await sb
        .from("audit_runs")
        .select("id")
        .eq("product_id", run.product_id)
        .in("status", ["done", "complete"]) // handle both legacy/new
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
    // V1 Persistence: Runner writes to 'shadow_specs', not 'canonical_specs'

    const [
      { data: shadowSpec },
      { data: assessment },
      { data: evidence_chunks }
    ] = await Promise.all([
      // Fetch latest shadow spec for this product (authoritative for V1)
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
        spec_json: shadowSpec.canonical_spec_json, // Map V1 field to Legacy field
      };
    }

    // Special case: if we tried to read "current" (finished) run but it was empty, try fallback?
    if (dataSource === "current" && run.status === "done" && !canonical) {
      // Retry fallback
      const { data: lastSuccess } = await sb
        .from("audit_runs")
        .select("*") // Select all to get the full run object
        .eq("product_id", run.product_id)
        .in("status", ["done", "complete"])
        .neq("id", run.id)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSuccess) {
        // Load from fallback
        const [s2, a2, e2] = await Promise.all([
          sb.from("shadow_specs")
            .select("*")
            .eq("product_id", run.product_id) // Still product_id based for V1
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
            displayRun: lastSuccess, // The cached run we are showing
            run: run ?? lastSuccess ?? null, // Compat field
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
    let displayRun = run; // Default to the active run

    if (run.status === "pending" || run.status === "running") {
      status = "running";
      // If we are running, and we have data (from cache), data_source is cached_success
      if (canonical) {
        finalDataSource = "cached_success";
        // If dataRunId is different from run.id, it means we loaded from a cached run
        if (dataRunId !== run.id) {
          const { data: cachedDisplayRun } = await sb.from("audit_runs").select("*").eq("id", dataRunId).single();
          if (cachedDisplayRun) displayRun = cachedDisplayRun;
        }
      } else {
        finalDataSource = "none";
      }
    } else if (run.status === "failed" || run.status === "error") {
      status = "failed";
      if (canonical) {
        finalDataSource = "cached_success";
        status = "cached"; // We are showing cached data, even if latest failed?
        // User said: "If latest run failed but older success exists → return older success data with 'failed' status for the current run?"
        // Actually they said: "Show cached audit" effectively masking failure?
        // Re-reading: "UI always shows: last successful audit instantly"
        // And: "activeRun (latest run, may be running/failed) displayRun (last successful run used for data)"
        // So we return full context.
        if (dataRunId !== run.id) {
          const { data: cachedDisplayRun } = await sb.from("audit_runs").select("*").eq("id", dataRunId).single();
          if (cachedDisplayRun) displayRun = cachedDisplayRun;
        }
      } else {
        finalDataSource = "none";
      }
    } else if (run.status === "done" && canonical) {
      // Fix: Return 'done' status when the run is completed successfully
      status = "done";
      finalDataSource = "latest_success";
    } else if (canonical) {
      // Fallback: older runs that might still have data
      status = "cached";
      finalDataSource = "latest_success";
    }

    // Flatten data for frontend consumption (match dataBridge expectations)
    // The client expects: audit, stages, claim_profile, reality_ledger, discrepancies, truth_index, etc.
    // We derive these from 'canonical' (Shadow Spec) and 'assessment'.

    const flatResponse: any = {
      ok: true,
      activeRun: run,
      displayRun: displayRun,
      status, // Legacy status field fallback
      data_source: canonical ? finalDataSource : "none"
    };

    if (canonical) {
      // 1. Base Audit Object
      flatResponse.audit = {
        ...canonical,
        ...RunDataParams(displayRun) // Helper to merge run meta if needed
      };

      // 2. Stages - MERGE from both shadow_specs AND audit_runs
      // Priority: audit_runs.stages (contains complete stage data) > shadow_specs.stages (legacy status)
      const runStagesData = displayRun?.stages || {};
      const shadowStagesStatus = canonical.stages || {};

      // Merge: use run stages if available, fallback to shadow_specs
      const mergedStages = {
        ...shadowStagesStatus, // Legacy status indicators
        ...runStagesData // Complete stage data from audit-runner
      };

      // Normalize Stage 4 metric_bars: map 'value' to 'percentage' if needed
      if (mergedStages.stage_4?.data?.metric_bars) {
        mergedStages.stage_4.data.metric_bars = mergedStages.stage_4.data.metric_bars.map((bar: any) => ({
          label: bar.label,
          rating: bar.rating || (bar.value >= 85 ? 'High' : bar.value >= 70 ? 'Moderate' : 'Low'),
          percentage: bar.percentage ?? bar.value ?? 0
        }));
      }

      flatResponse.stages = mergedStages;

      // 3. Extracted / Normalized Data
      // Map from canonical_spec_json (Shadow Spec)
      const spec = canonical.canonical_spec_json || {};
      flatResponse.claim_profile = spec.claim_profile || [];
      flatResponse.reality_ledger = spec.reality_ledger || [];
      flatResponse.discrepancies = spec.discrepancies || spec.red_flags || []; // Fallback to red_flags if discrepancies missing

      // 4. Assessment Data
      // Merge assessment data into analysis or top-level?
      // Client normalizer checks: truth_index -> s4Data -> canonical.truth_score
      // We provide truth_index explicitly
      flatResponse.truth_index = assessment?.assessment_json?.truth_index ?? assessment?.final_score ?? canonical.truth_score ?? null;

      // 5. Analysis
      // Construct analysis object from assessment
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
