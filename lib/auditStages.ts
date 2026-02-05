// lib/auditStages.ts
/**
 * Progressive audit stages (V1)
 *
 * Stage 1: Claim Profile (from product JSON fields)
 * Stage 2: Independent Signal (Schematron extraction from provided HTML bundle)
 * Stage 3: Forensic Discrepancies (placeholder unless you wire Gemini here)
 * Stage 4: Verdict & Truth Index (simple calc placeholder unless you wire Gemini here)
 */

import { createClient } from "@supabase/supabase-js";
import type { Product } from "@/types";
import { updateStageHelper } from "./updateStageHelper";

type StageName = "stage_1" | "stage_2" | "stage_3" | "stage_4";
type StageStatus = "pending" | "running" | "done" | "error";

const STAGE_TTL_DAYS: Record<StageName, number> = {
  stage_1: 30,
  stage_2: 14,
  stage_3: 30,
  stage_4: 30,
};

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
 * Stage 1: Claim Profile
 * -------------------------
 * Writes:
 *   stage_1.data.claim_profile = [{label,value}]
 */
export async function runStage1_ClaimProfile(productId: string, product: Product) {
  await updateStage(productId, "stage_1", { status: "running" satisfies StageStatus });

  try {
    const raw = (product as any)?.technical_specs;

    // Accept BOTH shapes:
    // 1) [{label,value}] array
    // 2) { "Storage Capacity": "1024Wh", ... } object
    const normalizedSpecs: { label: string; value: string }[] = (() => {
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

    // Always include identity at top
    const claimProfile: { label: string; value: string }[] = [
      { label: "Brand", value: product?.brand ? String(product.brand) : "—" },
      { label: "Model", value: product?.model_name ? String(product.model_name) : "—" },
      { label: "Category", value: product?.category ? String(product.category) : "—" },
      ...normalizedSpecs,
    ];

    const payload = {
      status: "done" satisfies StageStatus,
      ttl_days: STAGE_TTL_DAYS.stage_1,
      completed_at: new Date().toISOString(),
      data: { claim_profile: claimProfile },
    };

    await updateStage(productId, "stage_1", payload);
    return payload.data;
  } catch (err: any) {
    await updateStage(productId, "stage_1", {
      status: "error" satisfies StageStatus,
      error: err?.message ?? "Stage 1 failed",
    });
    throw err;
  }
}

/**
 * -------------------------
 * Stage 2: Independent Signal (Schematron)
 * -------------------------
 * Input:
 *   args.html = deterministic HTML bundle created by auditWorker
 *
 * Writes:
 *   stage_2.data.most_praised = [{text, sources?, source_urls?}]
 *   stage_2.data.most_reported_issues = [{text, sources?, source_urls?}]
 *   stage_2.data.sources = [{title,url,kind}]
 */
export async function runStage2_IndependentSignal(
  productId: string,
  args: { product: Product; html: string }
) {
  await updateStage(productId, "stage_2", { status: "running" satisfies StageStatus });

  try {
    const apiKey = process.env.SCHEMATRON_API_KEY || process.env.INFERENCE_API_KEY;
    if (!apiKey) throw new Error("Missing SCHEMATRON_API_KEY (or INFERENCE_API_KEY)");

    const model = process.env.SCHEMATRON_MODEL || "inference-net/schematron-3b";

    // Schematron is STRICT: you MUST supply json_schema response format.
    const schema = {
      name: "independent_signal",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          most_praised: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                sources: { type: "number" },
                source_urls: { type: "array", items: { type: "string" } },
              },
              required: ["text"],
            },
          },
          most_reported_issues: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                sources: { type: "number" },
                source_urls: { type: "array", items: { type: "string" } },
              },
              required: ["text"],
            },
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                kind: { type: "string" },
              },
              required: ["url"],
            },
          },
        },
        required: ["most_praised", "most_reported_issues"],
      },
    } as const;

    const prompt = `
You are an extraction model.

Task:
Extract PRAISE and ISSUES only if explicitly supported by the provided HTML bundle.
No recommendations. No commentary. No extra keys.

Return JSON that matches the provided JSON Schema.

HTML:
${args.html}
`.trim();

    const body = {
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      temperature: 0,
      max_output_tokens: 600,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    };

    const resp = await fetch("https://api.inference.net/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Schematron HTTP ${resp.status}: ${txt || resp.statusText}`);
    }

    const raw = await resp.json();
    const parsed = extractJsonFromInferenceResponse(raw);

    if (!parsed || typeof parsed !== "object") {
      throw new Error(`Schematron returned no parsed JSON. Output: ${safeStringify(parsed)}`);
    }

    // Normalize + guard
    const most_praised = Array.isArray((parsed as any).most_praised) ? (parsed as any).most_praised : [];
    const most_reported_issues = Array.isArray((parsed as any).most_reported_issues)
      ? (parsed as any).most_reported_issues
      : [];
    const sources = Array.isArray((parsed as any).sources) ? (parsed as any).sources : [];

    const data = { most_praised, most_reported_issues, sources };

    await updateStage(productId, "stage_2", {
      status: "done" satisfies StageStatus,
      ttl_days: STAGE_TTL_DAYS.stage_2,
      completed_at: new Date().toISOString(),
      data,
    });

    return data;
  } catch (err: any) {
    await updateStage(productId, "stage_2", {
      status: "error" satisfies StageStatus,
      error: err?.message ?? "Stage 2 failed",
    });
    throw err;
  }
}

/**
 * -------------------------
 * Stage 3: Forensic Discrepancies (placeholder)
 * -------------------------
 * Replace this with your Gemini synthesis when ready.
 */
export async function runStage3_ForensicDiscrepancies(productId: string, input: { stage1: any; stage2: any }) {
  await updateStage(productId, "stage_3", { status: "running" satisfies StageStatus });

  try {
    const data = {
      red_flags: [],
      reality_ledger: [],
    };

    await updateStage(productId, "stage_3", {
      status: "done" satisfies StageStatus,
      ttl_days: STAGE_TTL_DAYS.stage_3,
      completed_at: new Date().toISOString(),
      data,
    });

    return data;
  } catch (err: any) {
    await updateStage(productId, "stage_3", {
      status: "error" satisfies StageStatus,
      error: err?.message ?? "Stage 3 failed",
    });
    throw err;
  }
}

/**
 * -------------------------
 * Stage 4: Verdict & Truth Index (placeholder)
 * -------------------------
 * Replace with your real scoring logic when ready.
 */
export async function runStage4_Verdict(productId: string, input: { stage1: any; stage2: any; stage3: any }) {
  await updateStage(productId, "stage_4", { status: "running" satisfies StageStatus });

  try {
    const redFlags = Array.isArray(input?.stage3?.red_flags) ? input.stage3.red_flags : [];
    const truth_index = Math.max(0, 100 - redFlags.length * 5);

    const data = {
      truth_index,
      verdict: redFlags.length === 0 ? "No major discrepancies detected." : `${redFlags.length} discrepancies detected.`,
      metric_bars: [],
      score_interpretation: null,
      strengths: [],
      limitations: [],
      practical_impact: null,
      good_fit: [],
      consider_alternatives: [],
      data_confidence: null,
    };

    await updateStage(productId, "stage_4", {
      status: "done" satisfies StageStatus,
      ttl_days: STAGE_TTL_DAYS.stage_4,
      completed_at: new Date().toISOString(),
      data,
    });

    return data;
  } catch (err: any) {
    await updateStage(productId, "stage_4", {
      status: "error" satisfies StageStatus,
      error: err?.message ?? "Stage 4 failed",
    });
    throw err;
  }
}

/**
 * =========================
 * Parsing helpers
 * =========================
 * inference.net /responses returns a "response" object with output content.
 * When response_format=json_schema is used, providers may emit structured JSON content.
 * We handle multiple shapes and fall back safely.
 */
function extractJsonFromInferenceResponse(raw: any): any | null {
  // Most common: output[0].content includes a json-ish payload.
  const out = raw?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;

      // Look for a structured json block first
      for (const c of content) {
        if (!c) continue;

        // Some providers return { type: "output_json", json: {...} }
        if (c.type === "output_json" && c.json && typeof c.json === "object") return c.json;

        // Some return { type: "output_text", text: "{...json...}" }
        if (c.type === "output_text" && typeof c.text === "string") {
          const maybe = tryParseJson(c.text);
          if (maybe) return maybe;
        }
      }
    }
  }

  // Sometimes there is a top-level output_text string.
  if (typeof raw?.output_text === "string") {
    const maybe = tryParseJson(raw.output_text);
    if (maybe) return maybe;
  }

  return null;
}

function tryParseJson(s: string): any | null {
  const t = s.trim();
  if (!t) return null;

  // If provider wrapped JSON in extra text, try to extract first {...} blob
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = t.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // fallthrough
    }
  }

  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function safeStringify(x: any) {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}
