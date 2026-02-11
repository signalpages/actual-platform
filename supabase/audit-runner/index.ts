import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // 1) Claim exactly ONE audit run (row-locked)
  const { data: claim, error: claimErr } = await sb.rpc(
    "claim_next_audit_run"
  );

  if (claimErr) {
    console.error("claim error", claimErr);
    return new Response("claim error", { status: 500 });
  }

  if (!claim) {
    // nothing to do
    return new Response("idle", { status: 200 });
  }

  const runId = claim as string;

  // 2) Load run state
  const { data: run, error: runErr } = await sb
    .from("audit_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runErr || !run) {
    console.error("run load error", runErr);
    return new Response("run load error", { status: 500 });
  }

  const stage = run.stage_state?.current ?? "discover";

  try {
    // 3) Advance ONE step
    if (stage === "discover") {
      // TODO: call Gemini discover here (next step)
      await sb.from("audit_runs").update({
        stage_state: {
          current: "fetch",
          stages: {
            ...run.stage_state.stages,
            discover: { status: "done" },
            fetch: { status: "running" }
          }
        }
      }).eq("id", runId);

      return new Response("discover→fetch", { status: 200 });
    }

    if (stage === "fetch") {
      // TODO: fetch ONE source
      return new Response("fetch step", { status: 200 });
    }

    if (stage === "extract") {
      // TODO: schematron ONE source
      return new Response("extract step", { status: 200 });
    }

    if (stage === "normalize") {
      // TODO: normalize canonical
      return new Response("normalize step", { status: 200 });
    }

    if (stage === "assess") {
      // TODO: gemini assess
      await sb.from("audit_runs").update({
        status: "complete",
        finished_at: new Date().toISOString()
      }).eq("id", runId);

      return new Response("complete", { status: 200 });
    }

    return new Response("unknown stage", { status: 400 });
  } catch (e) {
    await sb.from("audit_runs").update({
      status: "failed",
      error: String(e),
      finished_at: new Date().toISOString()
    }).eq("id", runId);

    console.error("runner error", e);
    return new Response("failed", { status: 500 });
  }
});
