import { createClient } from "@supabase/supabase-js";

import { discoverSources } from "@/lib/stage2/discoverSources";
import { fetchAndRender } from "@/lib/stage2/fetchAndRender";
import { schematronExtract } from "@/lib/stage2/schematronExtract";
import { normalizeEvidence } from "@/lib/stage2/normalizeEvidence";
import { assessCanonical } from "@/lib/stage2/assessCanonical";

type Source = { url: string; type?: string };

const EXTRACTOR_VERSION = "schematron-v1";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

const STAGE_ORDER = ["discover", "fetch", "extract", "normalize", "assess"] as const;

function computeProgress(stageState: any): number {
  try {
    const stages = stageState?.stages ?? {};
    const done = STAGE_ORDER.filter((s) => stages?.[s]?.status === "done").length;
    return Math.round((done / STAGE_ORDER.length) * 100);
  } catch {
    return 0;
  }
}

async function getStageState(runId: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("audit_runs").select("stage_state").eq("id", runId).single();
  if (error) throw new Error(error.message);
  return data?.stage_state ?? null;
}

/**
 * Merge stage_state instead of overwriting it.
 * This prevents nuking prior stage statuses/meta.
 */
async function setStage(runId: string, stage: string, status: string, meta: any = {}) {
  const sb = supabaseAdmin();
  const now = new Date().toISOString();

  const current = await getStageState(runId);
  const merged = {
    current: stage,
    stages: {
      ...(current?.stages ?? {}),
      [stage]: {
        ...(current?.stages?.[stage] ?? {}),
        status,
        updated_at: now,
        meta: { ...(current?.stages?.[stage]?.meta ?? {}), ...(meta ?? {}) },
      },
    },
  };

  const runStatus =
    status === "failed" ? "failed" :
    status === "insufficient_signal" ? "insufficient_signal" :
    "running";

  const progress = computeProgress(merged);

  await sb.from("audit_runs").update({
    status: runStatus,
    progress,
    stage_state: merged,
  }).eq("id", runId);
}

async function markComplete(runId: string) {
  const sb = supabaseAdmin();
  const stageState = await getStageState(runId);
  await sb.from("audit_runs").update({
    status: "complete",
    progress: 100,
    finished_at: new Date().toISOString(),
    stage_state: stageState ?? undefined,
  }).eq("id", runId);
}

async function markFailed(runId: string, errorMsg: string) {
  const sb = supabaseAdmin();
  await sb.from("audit_runs").update({
    status: "failed",
    error: errorMsg,
    finished_at: new Date().toISOString(),
  }).eq("id", runId);
}

async function markInsufficient(runId: string, stage: string, reason: string) {
  // store reason in stage meta AND in audit_runs.error for visibility
  await setStage(runId, stage, "insufficient_signal", { reason });
  const sb = supabaseAdmin();
  await sb.from("audit_runs").update({
    status: "insufficient_signal",
    error: reason,
    finished_at: new Date().toISOString(),
  }).eq("id", runId);
}

async function saveSources(runId: string, sources: Source[]) {
  // No audit_runs.meta column in your schema → store in stage_state meta
  await setStage(runId, "discover", "running", { sources });
}

async function insertEvidenceChunk(
  runId: string,
  src: Source,
  extracted: any,
  isValid: boolean,
  validationErrors?: any
) {
  const sb = supabaseAdmin();
  await sb.from("evidence_chunks").insert({
    audit_run_id: runId,
    source_url: src.url,
    source_type: src.type ?? null,
    fetched_at: new Date().toISOString(),
    extractor_version: EXTRACTOR_VERSION,
    extracted_json: extracted,          // ✅ your schema uses extracted_json
    is_valid: isValid,
    validation_errors: validationErrors ?? null,
  });
}

async function saveCanonical(runId: string, canonical: any) {
  const sb = supabaseAdmin();
  await sb.from("canonical_specs").upsert({
    audit_run_id: runId,
    normalized_json: canonical,
    claim_count: canonical?.claim_count ?? 0,
    source_count: canonical?.source_count ?? 0,
    last_normalized_at: new Date().toISOString(),
  });
}

async function saveAssessment(runId: string, assessment: any) {
  const sb = supabaseAdmin();
  await sb.from("audit_assessments").upsert({
    audit_run_id: runId,
    assessment_json: assessment,
  });
}

/**
 * Stage 2 Pilot Worker (schema-correct)
 * Triggered via waitUntil() from app/api/audit/route.ts
 */
export async function runAuditWorker(runId: string, product: any): Promise<void> {
  try {
    // STAGE 1: Discovery
    await setStage(runId, "discover", "running");
    const sources = await discoverSources(product);

    if (!sources || sources.length < 3) {
      await markInsufficient(runId, "discover", "Less than 3 independent long-term usage sources found.");
      return;
    }

    await saveSources(runId, sources);
    await setStage(runId, "discover", "done", { source_count: sources.length });

    // STAGE 2: Fetch + Render
    await setStage(runId, "fetch", "running", { done: 0, total: sources.length });

    const fetched: { src: Source; html: string }[] = [];
    for (let i = 0; i < sources.length; i++) {
      const html = await fetchAndRender(sources[i].url);
      if (html) fetched.push({ src: sources[i], html });
      await setStage(runId, "fetch", "running", { done: i + 1, total: sources.length });
    }

    if (fetched.length < 2) {
      await markInsufficient(runId, "fetch", "Too many sources failed to fetch/render.");
      return;
    }

    await setStage(runId, "fetch", "done", { fetched: fetched.length, total: sources.length });

    // STAGE 3: Schematron Extract (progressive inserts)
    await setStage(runId, "extract", "running", { done: 0, total: fetched.length });

    for (let i = 0; i < fetched.length; i++) {
      const { src, html } = fetched[i];
      const extracted = await schematronExtract(html);

      // expected: { ok, data, errors }
      const ok = !!extracted?.ok;
      await insertEvidenceChunk(runId, src, extracted?.data ?? null, ok, extracted?.errors ?? null);

      await setStage(runId, "extract", "running", { done: i + 1, total: fetched.length });
    }

    await setStage(runId, "extract", "done");

    // STAGE 4: Normalize (deterministic, code only)
    await setStage(runId, "normalize", "running");
    const canonical = await normalizeEvidence(runId);

    const claimCount = canonical?.claim_count ?? 0;
    const sourceCount = canonical?.source_count ?? 0;

    if (!canonical || claimCount < 5 || sourceCount < 3) {
      await markInsufficient(runId, "normalize", "Canonical payload below minimum (>=5 claims, >=3 sources).");
      return;
    }

    await saveCanonical(runId, canonical);
    await setStage(runId, "normalize", "done", { claim_count: claimCount, source_count: sourceCount });

    // STAGE 5: Assess (Gemini on canonical only)
    await setStage(runId, "assess", "running");
    const assessment = await assessCanonical(canonical);

    if (!assessment) {
      await markFailed(runId, "Assessment returned empty payload.");
      return;
    }

    await saveAssessment(runId, assessment);
    await setStage(runId, "assess", "done");

    await markComplete(runId);
  } catch (e: any) {
    await markFailed(runId, e?.message ?? String(e));
  }
}
