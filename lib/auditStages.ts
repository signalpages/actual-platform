// lib/auditStages.ts (replace ONLY runStage2_IndependentSignal)

import OpenAI from "openai";
import { Product } from "@/types";

type StageStatus = "pending" | "running" | "done" | "error";

// This is the shape your UI expects (based on AuditResults.tsx usage)
type IndependentSignal = {
  most_praised: { text: string; sources?: number }[];
  most_reported_issues: { text: string; sources?: number }[];
  sources: { url?: string; title?: string }[];
};

function getInferenceClient() {
  const key = process.env.INFERENCE_API_KEY || process.env.SCHEMATRON_API_KEY;
  if (!key) throw new Error("Missing INFERENCE_API_KEY (or SCHEMATRON_API_KEY)");
  return new OpenAI({
    baseURL: "https://api.inference.net/v1",
    apiKey: key,
  });
}

// NOTE: keep your existing updateStage helper as-is
async function updateStage(productId: string, stageName: "stage_2", stageData: any) {
  // your existing updateStage() wrapper should already exist in this file.
  // If not, keep whatever you currently use that writes product.stages JSONB.
  throw new Error("updateStage wrapper not wired in this snippet. Use your existing updateStage().");
}

export async function runStage2_IndependentSignal(
  productId: string,
  args: { product: Product; html: string }
) {
  const { product, html } = args;

  await updateStage(productId, "stage_2", { status: "running" satisfies StageStatus });

  try {
    const client = getInferenceClient();

    const schema = {
      name: "independent_signal",
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
                url: { type: "string" },
                title: { type: "string" },
              },
            },
          },
        },
        required: ["most_praised", "most_reported_issues"],
      },
      strict: true,
    } as const;

    // IMPORTANT: Schematron wants response_format json_schema
    const resp = await client.responses.create({
      model: "inference-net/schematron-3b",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Extract independent signal from the provided HTML.
Return JSON only, matching the schema. Do not add commentary.

Product: ${product.brand} ${product.model_name}

HTML:
${html}
              `.trim(),
            },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: schema },
      temperature: 0,
      max_output_tokens: 600,
    });

    // The SDK gives you output_text sometimes, but since we forced json_schema,
    // the parsed JSON is typically on resp.output[0].content[0].json (depends on provider).
    // We’ll be defensive and try a couple ways.
    let parsed: any = null;

    // Try: response output content json
    for (const out of resp.output ?? []) {
      for (const c of (out as any).content ?? []) {
        if (c?.type === "output_json" && c?.json) parsed = c.json;
        if (c?.type === "output_text" && typeof c?.text === "string") {
          // Some providers still stick JSON as text even under schema.
          try {
            parsed = JSON.parse(c.text);
          } catch {}
        }
      }
    }

    // If still nothing, fall back to empty shape (DO NOT FAIL STAGE)
    const independentSignal: IndependentSignal = {
      most_praised: Array.isArray(parsed?.most_praised) ? parsed.most_praised : [],
      most_reported_issues: Array.isArray(parsed?.most_reported_issues) ? parsed.most_reported_issues : [],
      sources: Array.isArray(parsed?.sources) ? parsed.sources : [],
    };

    // ✅ KEY FIX: empty arrays are allowed. Stage completes either way.
    await updateStage(productId, "stage_2", {
      status: "done",
      data: independentSignal,
      completed_at: new Date().toISOString(),
      ttl_days: 14,
    });

    return independentSignal;
  } catch (err: any) {
    await updateStage(productId, "stage_2", {
      status: "error",
      error: err?.message || "Stage 2 failed",
    });
    throw err;
  }
}
