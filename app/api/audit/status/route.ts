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

    // 3. Load data (Canonical, Assessment, Evidence) from dataRunId
    const [
      { data: canonical },
      { data: assessment },
      { data: evidence_chunks }
    ] = await Promise.all([
      sb.from("canonical_specs").select("*").eq("audit_run_id", dataRunId).maybeSingle(),
      sb.from("audit_assessments").select("*").eq("audit_run_id", dataRunId).maybeSingle(),
      sb.from("evidence_chunks").select("*").eq("audit_run_id", dataRunId).order("created_at", { ascending: true })
    ]);

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
        const [c2, a2, e2] = await Promise.all([
          sb.from("canonical_specs").select("*").eq("audit_run_id", lastSuccess.id).maybeSingle(),
          sb.from("audit_assessments").select("*").eq("audit_run_id", lastSuccess.id).maybeSingle(),
          sb.from("evidence_chunks").select("*").eq("audit_run_id", lastSuccess.id).order("created_at", { ascending: true })
        ]);

        if (c2.data) {
          return NextResponse.json({
            ok: true,
            activeRun: run,
            displayRun: lastSuccess, // The cached run we are showing
            canonical: c2.data,
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
    } else if (canonical) {
      status = "cached"; // It's done and we have data
      finalDataSource = "latest_success";
    }

    return NextResponse.json({
      ok: true,
      activeRun: run,
      displayRun: displayRun, // This will be the run whose data is actually displayed
      canonical: canonical ?? null,
      assessment: assessment ?? null,
      evidence: evidence_chunks ?? [],
      status, // Legacy status field fallback
      data_source: canonical ? finalDataSource : "none"
    });

  } catch (err: any) {
    console.error("Status endpoint error:", err);
    return NextResponse.json(
      { ok: false, error: "STATUS_EXCEPTION", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
