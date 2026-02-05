// lib/auditWorker.ts

import { createClient } from "@supabase/supabase-js";
import { getAuditRun, updateAuditRun, saveAudit, getProductBySlug } from "./dataBridge.server";
import { Product } from "@/types";

import {
  runStage1_ClaimProfile,
  runStage2_IndependentSignal,
  runStage3_ForensicDiscrepancies,
  runStage4_Verdict,
} from "@/lib/auditStages";

const getSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, { auth: { persistSession: false } });
};

/**
 * Stage 2 needs an "HTML" payload.
 * We create a deterministic, compact HTML bundle from product + Stage 1 claim profile.
 */
function makeStage2HtmlBundle(product: any, stage1: any): string {
  const claimProfile = stage1?.claim_profile ?? stage1?.data?.claim_profile ?? [];
  const listItems = Array.isArray(claimProfile)
    ? claimProfile
        .map((r: any) => {
          const label = r?.label ?? r?.name ?? r?.key ?? "Unknown";
          const value = r?.value ?? r?.val ?? r?.display_value ?? r?.displayValue ?? "—";
          return `<li><b>${String(label)}:</b> ${String(value)}</li>`;
        })
        .join("")
    : "";

  const desc = product?.description ? String(product.description) : "";

  return `
<div>
  <h1>${product?.brand ?? ""} ${product?.model_name ?? ""}</h1>
  <p><b>Category:</b> ${product?.category ?? ""}</p>

  <h2>Claim Profile</h2>
  <ul>${listItems}</ul>

  <h2>Description Snippet</h2>
  <p>${desc}</p>

  <h2>Extractor Rules</h2>
  <p>
    Extract community-style PRAISE and ISSUES only if explicitly supported by input text.
    No recommendations. No extra commentary. Output must match schema.
  </p>
</div>
`.trim();
}

/** Small helpers to tolerate shape drift without crashing the worker */
function pickStage2Signal(stage2: any) {
  return stage2?.independent_signal ?? stage2 ?? {};
}
function arr(x: any) {
  return Array.isArray(x) ? x : [];
}
function safeText(x: any) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x?.text === "string") return x.text;
  return String(x);
}
function safeSourcesCount(x: any): number {
  const v = (x?.sources ?? x?.source_count ?? x?.count);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Background worker for executing audit in progressive stages
 * Triggered by waitUntil() from /api/audit
 */
export async function runAuditWorker(runId: string, product: any): Promise<void> {
  // NOTE: supabase client created here in case your stage runners need it indirectly later.
  // (Your runStageX functions handle their own DB updates via service role envs.)
  getSupabase();

  try {
    // 1) Load run
    const run = await getAuditRun(runId);
    if (!run) {
      console.error(`[Worker] Audit run ${runId} not found`);
      return;
    }

    // Validate status
    if (run.status !== "pending" && run.status !== "running") {
      console.log(`[Worker] Audit run ${runId} already ${run.status}`);
      return;
    }

    // 2) Re-fetch product to ensure JSONB fields exist
    const freshProduct = await getProductBySlug(product.slug);
    if (!freshProduct) {
      await updateAuditRun(runId, {
        status: "error",
        error: "Product not found",
        finished_at: new Date().toISOString(),
      });
      return;
    }

    const productId = freshProduct.id;

    console.log("[Worker] Product loaded:", freshProduct.model_name);
    console.log("[Worker] technical_specs present:", !!(freshProduct as any).technical_specs);

    // 3) Mark run as running
    await updateAuditRun(runId, { status: "running", progress: 5 });

    // =========================
    // STAGE 1: Claim Profile
    // =========================
    console.log(`[Worker] Starting Stage 1 for ${freshProduct.model_name}`);
    await updateAuditRun(runId, { progress: 10 });

    const stage1 = await runStage1_ClaimProfile(productId, freshProduct as Product);

    await updateAuditRun(runId, { progress: 25 });

    // =========================
    // STAGE 2: Independent Signal (Schematron)
    // =========================
    console.log(`[Worker] Starting Stage 2 for ${freshProduct.model_name}`);
    await updateAuditRun(runId, { progress: 35 });

    const html = makeStage2HtmlBundle(freshProduct, stage1);
    const stage2 = await runStage2_IndependentSignal(productId, { product: freshProduct, html });

    await updateAuditRun(runId, { progress: 55 });

    // =========================
    // STAGE 3: Forensic Discrepancies
    // =========================
    console.log(`[Worker] Starting Stage 3 for ${freshProduct.model_name}`);
    await updateAuditRun(runId, { progress: 70 });

    const stage3 = await runStage3_ForensicDiscrepancies(productId, { stage1, stage2 });

    await updateAuditRun(runId, { progress: 85 });

    // =========================
    // STAGE 4: Verdict & Truth Index
    // =========================
    console.log(`[Worker] Starting Stage 4 for ${freshProduct.model_name}`);
    const stage4 = await runStage4_Verdict(productId, { stage1, stage2, stage3 });

    await updateAuditRun(runId, { progress: 92 });

    // =========================
    // Save consolidated audit
    // =========================
    const s2 = pickStage2Signal(stage2);

    const mostPraised = arr(s2?.most_praised);
    const mostIssues = arr(s2?.most_reported_issues);

    const redFlags = arr(stage3?.red_flags);
    const realityLedger = arr(stage3?.reality_ledger);

    const truthIndexRaw = stage4?.truth_index ?? stage4?.data?.truth_index ?? stage4?.truthIndex;
    const truthIndex = Number.isFinite(Number(truthIndexRaw)) ? Number(truthIndexRaw) : 0;

    const isVerified = truthIndex >= 85;

    const fullAudit: any = {
      truth_index: truthIndex,
      verification_status: isVerified ? "verified" : "provisional",
      last_updated: new Date().toISOString(),

      advertised_claims: stage1?.claim_profile ?? stage1?.data?.claim_profile ?? [],
      reality_ledger: realityLedger,

      key_wins: mostPraised.slice(0, 5).map((p: any) => ({
        label: safeText(p).slice(0, 80),
        value: `${safeSourcesCount(p)} sources`,
      })),

      key_divergences: mostIssues.slice(0, 5).map((i: any) => ({
        label: safeText(i).slice(0, 80),
        value: `${safeSourcesCount(i)} sources`,
      })),

      discrepancies: redFlags.map((flag: any) => ({
        issue: flag?.claim ?? flag?.issue ?? "Discrepancy",
        description: flag?.reality
          ? `${flag.reality} (${flag.severity ?? "unknown"})`
          : (flag?.description ?? ""),
        severity: flag?.severity ?? "unknown",
      })),

      // Optional pass-throughs if Stage 4 provides them
      metric_bars: stage4?.metric_bars ?? stage4?.data?.metric_bars ?? [],
      score_interpretation: stage4?.score_interpretation ?? stage4?.data?.score_interpretation,
      strengths: stage4?.strengths ?? stage4?.data?.strengths ?? [],
      limitations: stage4?.limitations ?? stage4?.data?.limitations ?? [],
      practical_impact: stage4?.practical_impact ?? stage4?.data?.practical_impact,
      good_fit: stage4?.good_fit ?? stage4?.data?.good_fit ?? [],
      consider_alternatives: stage4?.consider_alternatives ?? stage4?.data?.consider_alternatives ?? [],
      data_confidence: stage4?.data_confidence ?? stage4?.data?.data_confidence,

      // Required DB fields (keep as stubs until your search step fills it)
      source_urls: arr(s2?.sources).map((s: any) => s?.url).filter(Boolean),
      is_verified: isVerified,
      verdict: stage4?.verdict ?? stage4?.data?.verdict ?? null,
    };

    console.log("[Worker] Saving audit for product:", productId);
    console.log("[Worker] truth_index:", fullAudit.truth_index, "is_verified:", fullAudit.is_verified);

    const saved = await saveAudit(productId, fullAudit);

    if (!saved) {
      await updateAuditRun(runId, {
        status: "error",
        error: "Failed to save audit result",
        finished_at: new Date().toISOString(),
      });
      return;
    }

    // 6) Mark run as done
    await updateAuditRun(runId, {
      status: "done",
      progress: 100,
      result_shadow_spec_id: saved.id,
      finished_at: new Date().toISOString(),
    });

    console.log(`[Worker] ✅ Audit complete for ${freshProduct.model_name}`);
  } catch (error) {
    console.error(`[Worker] Audit worker error for run ${runId}:`, error);
    await updateAuditRun(runId, {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      finished_at: new Date().toISOString(),
    });
  }
}
