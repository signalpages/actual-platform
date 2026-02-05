import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Fallback to your existing v1 dataBridge if Stage 2 tables aren’t ready
import { getAuditRun, getAudit, mapShadowToResult } from "@/lib/dataBridge.server";

export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapStage2Status(runStatus: string | null | undefined) {
  switch (runStatus) {
    case "complete":
      return "done";
    case "insufficient_signal":
      return "done"; // ✅ terminal, not error
    case "failed":
      return "error";
    case "running":
      return "running";
    case "pending":
    default:
      return "pending";
  }
}

function computeProgress(stageState: any): number {
  if (!stageState?.stages) return 0;
  const order = ["discover", "fetch", "extract", "normalize", "assess"];
  const doneCount = order.filter((s) => stageState.stages?.[s]?.status === "done").length;
  return Math.round((doneCount / order.length) * 100);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");
    if (!runId) {
      return NextResponse.json({ ok: false, error: "MISSING_RUN_ID" }, { status: 400 });
    }

    // --- Stage 2 path: read directly from Supabase tables ---
    try {
      const sb = supabaseAdmin();

      // If audit_runs exists and the row loads, we attempt Stage 2 response shape
      const { data: run } = await sb
        .from("audit_runs")
        .select("*")
        .eq("id", runId)
        .single();

      if (run) {
        // Stage 2 response — ALWAYS return here
        }


      if (run) {
        const { data: chunks } = await sb
          .from("evidence_chunks")
          .select("*")
          .eq("audit_run_id", runId)
          .order("created_at", { ascending: true });

        const { data: canonical } = await sb
          .from("canonical_specs")
          .select("*")
          .eq("audit_run_id", runId)
          .maybeSingle();

        const { data: assessment } = await sb
          .from("audit_assessments")
          .select("*")
          .eq("audit_run_id", runId)
          .maybeSingle();

        // Back-compat fields
        const stageState = run.stage_state ?? null;
        const progress =
            typeof run.progress === "number"
                ? run.progress
                : computeProgress(stageState);

        return NextResponse.json({
          ok: true,

          // Stage 2 fields (new)
          run,
          evidence_chunks: chunks ?? [],
          canonical: canonical ?? null,
          assessment: assessment ?? null,

          // Back-compat fields (old UI)
          status: mapStage2Status(run.status),
          progress,
          stages: stageState?.stages ?? null,
        });
      }
    } catch (e) {
      // If Stage 2 tables don’t exist yet, or schema is mid-migration, fall through to v1.
    }

    // --- V1 fallback (your existing behavior) ---
    const run = await getAuditRun(runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });
    }

    if (run.status === "done" && run.result_shadow_spec_id) {
      const audit = await getAudit(run.product_id);
      if (audit) {
        return NextResponse.json({
          ok: true,
          status: "done",
          progress: 100,
          audit: {
            ...mapShadowToResult(audit),
            stages: audit.stages || null,
          },
          stages: audit.stages || null,
        });
      }
    }

    if (run.status === "error") {
      return NextResponse.json({
        ok: true,
        status: "error",
        progress: run.progress,
        error: run.error || "Unknown error",
      });
    }

    const audit = await getAudit(run.product_id);
    return NextResponse.json({
      ok: true,
      status: run.status,
      progress: run.progress,
      stages: audit?.stages || null,
    });
  } catch (err: any) {
    console.error("Status endpoint error:", err);
    return NextResponse.json(
      { ok: false, error: "STATUS_EXCEPTION", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
