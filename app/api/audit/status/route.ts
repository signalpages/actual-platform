import { NextRequest, NextResponse } from "next/server";
import { getAuditRun, getAudit, mapShadowToResult } from "@/lib/dataBridge.server";

export const runtime = "nodejs";

// Helper to get list of completed stage names
function getCompletedStages(stages: any): string[] {
  if (!stages) return [];
  return Object.keys(stages).filter((key) => stages[key]?.status === "done");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ ok: false, error: "MISSING_RUN_ID" }, { status: 400 });
    }

    // Get run status
    const run = await getAuditRun(runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });
    }

    // If done, include audit result with stages
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
          stages: audit.stages || null, // Back-compat: keep sibling stages
        });
      }
    }

    // If error, return error details
    if (run.status === "error") {
      return NextResponse.json({
        ok: true,
        status: "error",
        progress: run.progress,
        error: run.error || "Unknown error",
      });
    }

    // Otherwise return current status with partial stage data
    const audit = await getAudit(run.product_id);
    return NextResponse.json({
      ok: true,
      status: run.status,
      progress: run.progress,
      stages: audit?.stages || null, // Progressive stage updates
      completed_stages: getCompletedStages(audit?.stages),
    });
  } catch (err: any) {
    console.error("Status endpoint error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "STATUS_EXCEPTION",
        message: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
