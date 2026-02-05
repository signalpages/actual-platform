/**
 * Stage execution helpers for progressive audit loading
 *
 * Stage 1: Claim Profile (from manufacturer/product data; no LLM)
 * Stage 2: Independent Signal (Schematron extractor; structured JSON)
 * Stage 3: Forensic Discrepancies (Gemini synthesis - placeholder for now)
 * Stage 4: Verdict & Truth Index (computed - placeholder for now)
 */

import { createClient } from "@supabase/supabase-js";
import { updateStageHelper } from "./updateStageHelper";
import type { Product } from "@/types";
import OpenAI from "openai";

type StageName = "stage_1" | "stage_2" | "stage_3" | "stage_4";
type StageStatus = "pending" | "running" | "done" | "error";

const STAGE_TTL_DAYS = {
  stage_1: 30,
  stage_2: 14,
  stage_3: 30,
  stage_4: 30,
} as const;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function updateStage(productId: string, stageName: StageName, stageData: any) {
  const supabase = getSupabase();
  return updateStageHelper({ productId, stageName, stageData, supabase });
}

/**
 * -------------------------
 * Schematron Client (Stage 2)
 * -------------------------
 */
function getSchematronClient() {
  const apiKey = process.env.SCHEMATRON_API_KEY;
  if (!apiKey) throw new Error("Missing SCHEMATRON_API_KEY");
  return new OpenAI({
    baseURL: "https://api.inference.net/v1",
    apiKey,
  });
}

type Stage2Extract = {
  most_praised: { text: string }[];
  most_reported_issues: { text: string }[];
};

async function schematronStage2Extract(args: {
  html: string;
  brand?: string;
  model?: string;
}): Promise<Stage2Extract> {
  const client = getSchematronClient();

  const prompt = `
Return JSON ONLY that matches this schema exactly:

{
  "most_praised": [{"text": "string"}],
  "most_reported_issues": [{"text": "string"}]
}

Context:
Brand: ${args.brand ?? "—"}
Model: ${args.model ?? "—"}

HTML:
${args.html}
`.trim();

  // IMPORTANT: Schematron requires json_schema response format
  const resp = await client.responses.create({
    model: "inference-net/schematron-3b",
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "stage2_independent_signal",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["most_praised", "most_reported_issues"],
          properties: {
            most_praised: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["text"],
                properties: { text: { type: "string" } },
              },
            },
            most_reported_issues: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["text"],
                properties: { text: { type: "string" } },
              },
            },
          },
        },
      },
    },
    temperature: 0,
  });

  // Inference/OpenAI Responses API: parsed JSON is here if schema worked
  const parsed = (resp as any).output_parsed as Stage2Extract | undefined;

  if (!parsed) {
    // Helpful debug if it returns text instead
    const outputText =
      (resp as any)?.output?.[0]?.content?.find((c: any) => c?.type === "output_text")?.text ??
      (resp as any)?.output_text ??
      null;

    throw new Error(`Schematron returned no parsed JSON. Output: ${outputText ?? "[no output_text]"}`);
  }

  // Extra safety: enforce shape at runtime
  if (!Array.isArray(parsed.most_praised) || !Array.isArray(parsed.most_reported_issues)) {
    throw new Error("Schematron parsed JSON missing required arrays");
  }

  return parsed;
}

/**
 * -------------------------
 * Stage 1: Claim Profile
 * TTL: 30 days
 * Source: product.technical_specs (array or object)
 * -------------------------
 */
export async function runStage1_ClaimProfile(productId: string, product: Product) {
  console.log(`[Stage 1] Starting claim profile for ${product?.brand ?? ""} ${product?.model_name ?? ""}`);
  await updateStage(productId, "stage_1", { status: "running" satisfies StageStatus });

  try {
    const raw = (product as any)?.technical_specs;

    const normalizedSpecs: { label: string; value: string }[] = (() => {
      // array case: [{label,value}] etc
      if (Array.isArray(raw)) {
        return raw
          .map((s: any) => {
            const label = s?.label ?? s?.name ?? s?.key ?? s?.title;
            const value = s?.value ?? s?.val ?? s?.display_value ?? s?.displayValue;
            if (!label) return null;
            return {
              label: String(label),
              value: value === undefined || value === null || value === "" ? "—" : String(value),
            };
          })
          .filter(Boolean) as { label: string; value: string }[];
      }

      // object case: { "Storage Capacity": "1024Wh", ... }
      if (raw && typeof raw === "object") {
        return Object.entries(raw)
          .map(([k, v]) => ({
            label: String(k),
            value: v === undefined || v === null || v === "" ? "—" : String(v),
          }))
          .filter((row) => row.label);
      }

      return [];
    })();

    const claimProfile = [
      { label: "Brand", value: product?.brand ? String(product.brand) : "—" },
      { label: "Model", value: product?.model_name ? String(product.model_name) : "—" },
      { label: "Category", value: product?.category ? String(product.category) : "—" },
      ...normalizedSpecs,
    ];

    await updateStage(productId, "stage_1", {
      status: "done" satisfies StageStatus,
      completed_at: new Date().toISOString(),
      ttl_days: STAGE_TTL_DAYS.stage_1,
      data: { claim_profile: claimProfile },
    });

    console.log(`[Stage 1] ✅ Done (${claimProfile.length} rows)`);
    return { claim_profile: claimProfile };
  } catch (error: any) {
    console.error(`[Stage 1] ❌ Failed:`, error);
    await updateStage(productId, "stage_1", {
      status: "error" satisfies StageStatus,
      error: error?.message ?? String(error),
    });
    throw error;
  }
}

/**
 * -------------------------
 * Stage 2: Independent Signal (Schematron)
 * TTL: 14 days
 *
 * IMPORTANT:
 * UI expects:
 *   stage_2.data.most_praised
 *   stage_2.data.most_reported_issues
 *
 * No fallback. If Schematron fails -> stage_2 error.
 * -------------------------
 */
export async function runStage2_IndependentSignal(productId: string, args: { product: Product; html: string }) {
  const { product, html } = args;
  console.log(`[Stage 2] Starting independent signal for ${product?.brand ?? ""} ${product?.model_name ?? ""}`);

  await updateStage(productId, "stage_2", { status: "running" satisfies StageStatus });

  try {
    const extracted = await schematronStage2Extract({
      html,
      brand: product?.brand ? String(product.brand) : undefined,
      model: product?.model_name ? String(product.model_name) : undefined,
    });

    await updateStage(productId, "stage_2", {
      status: "done" satisfies StageStatus,
      completed_at: new Date().toISOString(),
      ttl_days: STAGE_TTL_DAYS.stage_2,
      data: {
        most_praised: extracted.most_praised,
        most_reported_issues: extracted.most_reported_issues,
      },
    });

    console.log(
      `[Stage 2] ✅ Done (praise=${extracted.most_praised.length}, issues=${extracted.most_reported_issues.length})`
    );
    return extracted;
  } catch (error: any) {
    console.error(`[Stage 2] ❌ Failed:`, error);
    await updateStage(productId, "stage_2", {
      status: "error" satisfies StageStatus,
      error: error?.message ?? String(error),
    });
    throw error;
  }
}

/**
 * -------------------------
 * Stage 3: Forensic Discrepancies (placeholder)
 * TTL: 30 days
 * -------------------------
 */
export async function runStage3_ForensicDiscrepancies(productId: string, input: { stage1: any; stage2: any }) {
  console.log(`[Stage 3] Starting forensic discrepancies`);
  await updateStage(productId, "stage_3", { status: "running" satisfies StageStatus });

  try {
    // TODO: wire Gemini synthesis here (claims vs observed reality)
    const claim_cards: any[] = [];

    await updateStage(productId, "stage_3", {
      status: "done" satisfies StageStatus,
      completed_at: new Date().toISOString(),
      ttl_days: STAGE_TTL_DAYS.stage_3,
      data: { claim_cards },
    });

    console.log(`[Stage 3] ✅ Done (claim_cards=${claim_cards.length})`);
    return { claim_cards };
  } catch (error: any) {
    console.error(`[Stage 3] ❌ Failed:`, error);
    await updateStage(productId, "stage_3", {
      status: "error" satisfies StageStatus,
      error: error?.message ?? String(error),
    });
    throw error;
  }
}

/**
 * -------------------------
 * Stage 4: Verdict & Truth Index (placeholder)
 * TTL: 30 days
 * -------------------------
 */
export async function runStage4_Verdict(productId: string, input: { stages: any }) {
  console.log(`[Stage 4] Computing verdict/truth index`);
  await updateStage(productId, "stage_4", { status: "running" satisfies StageStatus });

  try {
    const claimCards = input?.stages?.stage_3?.data?.claim_cards ?? [];
    // Placeholder scoring logic (you will replace with your real gate)
    const truth_index = Math.max(0, 100 - Math.min(60, claimCards.length * 5));
    const verdict =
      truth_index >= 80 ? "High integrity: claims align with observed reality." : "Provisional: insufficient evidence.";

    await updateStage(productId, "stage_4", {
      status: "done" satisfies StageStatus,
      completed_at: new Date().toISOString(),
      ttl_days: STAGE_TTL_DAYS.stage_4,
      data: {
        truth_index,
        verdict,
      },
    });

    console.log(`[Stage 4] ✅ Done (truth_index=${truth_index})`);
    return { truth_index, verdict };
  } catch (error: any) {
    console.error(`[Stage 4] ❌ Failed:`, error);
    await updateStage(productId, "stage_4", {
      status: "error" satisfies StageStatus,
      error: error?.message ?? String(error),
    });
    throw error;
  }
}

/**
 * Check if a stage is fresh based on TTL
 */
export function isStageFresh(stageData: any, ttlDays: number): boolean {
  if (!stageData || stageData.status !== "done" || !stageData.completed_at) return false;
  const completedAt = new Date(stageData.completed_at);
  const ageMs = Date.now() - completedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < ttlDays;
}
