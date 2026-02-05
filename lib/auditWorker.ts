import { createClient } from "@supabase/supabase-js";

import { discoverSources } from "@/lib/stage2/discoverSources";
import { fetchAndRender } from "@/lib/stage2/fetchAndRender";
import { schematronExtract } from "@/lib/stage2/schematronExtract";
import { normalizeEvidence } from "@/lib/stage2/normalizeEvidence";
import { assessCanonical } from "@/lib/stage2/assessCanonical";

type Source = { url: string; type?: string };

const EXTRACTOR_VERSION = "schematron-v1";
const STAGE_ORDER = ["discover", "fetch", "extract", "normalize", "assess"] as const;

// Hard caps so nothing runs forever (Vercel will kill long jobs anyway)
const MAX_RUN_MS = 80_000;
const DISCOVER_MS = 20_000;
const FETCH_MS = 12_000;
const EXTRACT_MS = 10_000;
const NORMALIZE_MS = 8_000;
const ASSESS_MS = 20_000;

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`TIMEOUT:${label}:${ms}ms`)), ms);

    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

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
 * Merge stage_state so we don’t nuke prior stages.
 * Writes: audit_runs.status, audit_runs.progress, audit_runs.stage_state
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

  const progress = typeof current?.progress === "number" ? current.progress : computeProgress(merged);

  await sb.from("audit_runs").update({
    status: runStatus,
    progress,
    stage_state: merged,
  }).eq("id", runId);
}

async function markComplete(runId: string) {
  const sb = supabaseAdmin();
  await sb.from("audit_runs").update({
    status: "complete",
    progress: 100,
    finished_at: new Date().toISOString(),
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
  // store reason in stage meta + audit_runs.error for visibility
  await setStage(runId, stage, "insufficient_signal", { reason });

  const sb = supabaseAdmin();
  await sb.from("audit_runs").update({
    status: "insufficient_signal",
    error: reason,
    finished_at: new Date().toISOString(),
  }).eq("id", runId);
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
    extracted_json: extracted, // ✅ matches your schema
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

async function runAuditWorkerImpl(runId: string, product: any): Promise<void> {
  // STAGE 1: Discovery
  await setStage(runId, "discover", "running", { last_tick: new Date().toISOString() });

  const sources = await withTimeout(discoverSources(product), DISCOVER_MS, "discoverSources");

  if (!sources || sources.length < 3) {
    await markInsufficient(runId, "discover", "Less than 3 independent long-term usage sources found.");
    return;
  }

  // store sources in stage meta (you don’t have audit_runs.meta)
  await setStage(runId, "discover", "running", {
    source_count: sources.length,
    sources,
    last_tick: new Date().toISOString(),
  });

  await setStage(runId, "discover", "done", { source_count: sources.length });

  // STAGE 2: Fetch + Render (per source progress, hard timeout per URL)
  await setStage(runId, "fetch", "running", { done: 0, total: sources.length, last_tick: new Date().toISOString() });

  const fetched: { src: Source; html: string }[] = [];

  for (let i = 0; i < sources.length; i++) {
    const url = sources[i].url;

    await setStage(runId, "fetch", "running", {
      done: i,
      total: sources.length,
      current_url: url,
      last_tick: new Date().toISOString(),
    });

    const html = await withTimeout(fetchAndRender(url), FETCH_MS, `fetchAndRender:${i}`).catch(() => null);

    if (html) fetched.push({ src: sources[i], html });

    await setStage(runId, "fetch", "running", {
      done: i + 1,
      total: sources.length,
      fetched: fetched.length,
      last_tick: new Date().toISOString(),
    });
  }

  if (fetched.length < 2) {
    await markInsufficient(runId, "fetch", "Too many sources failed to fetch/render.");
    return;
  }

  await setStage(runId, "fetch", "done", { fetched: fetched.length, total: sources.length });

  // STAGE 3: Extract (insert evidence_chunks progressively)
  await setStage(runId, "extract", "running", { done: 0, total: fetched.length, last_tick: new Date().toISOString() });

  for (let i = 0; i < fetched.length; i++) {
    const { src, html } = fetched[i];

    await setStage(runId, "extract", "running", {
      done: i,
      total: fetched.length,
      current_url: src.url,
      last_tick: new Date().toISOString(),
    });

    const extracted = await withTimeout(schematronExtract(html), EXTRACT_MS, `schematronExtract:${i}`).catch((e) => ({
      ok: false,
      data: { claim_cards: [] },
      errors: [{ code: "EXTRACT_TIMEOUT_OR_FAIL", message: e?.message ?? String(e) }],
    }));

    const ok = !!extracted?.ok;
    await insertEvidenceChunk(runId, src, extracted?.data ?? null, ok, extracted?.errors ?? null);

    await setStage(runId, "extract", "running", {
      done: i + 1,
      total: fetched.length,
      last_tick: new Date().toISOString(),
    });
  }

  await setStage(runId, "extract", "done", { total: fetched.length });

  // STAGE 4: Normalize (deterministic, from DB)
  await setStage(runId, "normalize", "running", { last_tick: new Date().toISOString() });

  const canonical = await withTimeout(normalizeEvidence(runId), NORMALIZE_MS, "normalizeEvidence");

  const claimCount = canonical?.claim_count ?? 0;
  const sourceCount = canonical?.source_count ?? 0;

  if (!canonical || claimCount < 5 || sourceCount < 3) {
    await markInsufficient(runId, "normalize", "Canonical payload below minimum (>=5 claims, >=3 sources).");
    return;
  }

  await saveCanonical(runId, canonical);
  await setStage(runId, "normalize", "done", { claim_count: claimCount, source_count: sourceCount });

  // STAGE 5: Assess (Gemini ONLY on canonical JSON)
  await setStage(runId, "assess", "running", { last_tick: new Date().toISOString() });

  const assessment = await withTimeout(assessCanonical(canonical), ASSESS_MS, "assessCanonical");

  if (!assessment) {
    await markFailed(runId, "Assessment returned empty payload.");
    return;
  }

  await saveAssessment(runId, assessment);
  await setStage(runId, "assess", "done");

  await markComplete(runId);
}

/**
 * Public entrypoint — applies global watchdog so runs cannot hang forever.
 */
export async function runAuditWorker(runId: string, product: any): Promise<void> {
  try {
    await withTimeout(runAuditWorkerImpl(runId, product), MAX_RUN_MS, "run");
  } catch (e: any) {
    await markFailed(runId, e?.message ?? String(e));
  }
}
