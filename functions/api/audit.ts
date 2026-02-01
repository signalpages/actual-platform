import { createClient } from "@supabase/supabase-js";
import { getProductBySlug, getAudit, saveAudit, mapShadowToResult } from "../../lib/dataBridge";
import { KNOWLEDGE_CANONICAL } from "../../lib/canonical";

export const onRequestPost: PagesFunction = async (ctx) => {
  const origin = ctx.request.headers.get("Origin") || "*";

  // 1. Env & Setup
  const supabaseUrl = ctx.env.SUPABASE_URL as string;
  const supabaseKey = ctx.env.SUPABASE_SERVICE_ROLE_KEY as string; // Must be service role for write access usually, or anon if RLS permits
  const geminiKey = ctx.env.GOOGLE_AI_STUDIO_KEY as string;

  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    return json({ ok: false, error: "SERVER_CONFIG_ERROR" }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 2. Parse Input
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ ok: false, error: "BAD_JSON" }, 400, origin);
  }

  const slug = String(body?.slug || "").trim();
  if (!slug) return json({ ok: false, error: "MISSING_SLUG" }, 200, origin);

  // 3. Resolve Product
  // Rule: Audit must be grounded in an existing DB product
  const product = await getProductBySlug(supabase, slug);
  if (!product) {
    return json({ ok: false, error: "ASSET_NOT_FOUND", slug }, 200, origin);
  }

  // 4. Check Cache
  const cached = await getAudit(supabase, product.id);
  if (cached) {
    // If verified or simply exists, return it to save tokens/time for V1
    return json({ ok: true, audit: mapShadowToResult(cached), cached: true }, 200, origin);
  }

  // 5. Build Prompt
  // Rule: Grounded inputs only.
  const prompt = buildGroundedPrompt(product);

  // 6. Call Gemini
  const model = "gemini-3-flash-preview";
  let payload: any = null;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        geminiKey
      )}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: AUDIT_SCHEMA,
          },
        }),
      }
    );

    if (!resp.ok) {
      // Rule: No 502s. We treat this as a failed audit entry.
      // We will create a "failed" persistence record below.
      console.error("Gemini API Error", await resp.text());
    } else {
      const data: any = await resp.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      payload = tryJson(rawText);
    }
  } catch (e) {
    console.error("Gemini Network/Parse Error", e);
  }

  // 7. Persist Result (Success or Failure)
  const isSuccess = payload && typeof payload === "object";

  const auditEntry = {
    product_id: product.id,
    claimed_specs: isSuccess ? payload.claims : [], // Mapping schema "claims" -> DB "claimed_specs"
    actual_specs: isSuccess ? payload.actuals : [], // see schema below
    // Schema mismatch note: AUDIT_SCHEMA below uses "claims", "discrepancies". 
    // DB uses "claimed_specs", "actual_specs", "red_flags".
    // We strictly map here.
    red_flags: isSuccess ? payload.discrepancies : [{ issue: "System Failure", description: "Audit generation failed or network error." }],
    truth_score: isSuccess ? payload.truth_index : null,
    source_urls: [],
    is_verified: isSuccess && payload.is_verified === true && typeof payload.truth_index === 'number',
  };

  const saved = await saveAudit(supabase, product.id, auditEntry);

  if (!saved) {
    return json({ ok: false, error: "DB_WRITE_FAILED" }, 500, origin);
  }

  return json({ ok: true, audit: mapShadowToResult(saved), cached: false }, 200, origin);
};

// ---------------- Helpers ----------------

function json(data: any, status: number, origin: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

function buildGroundedPrompt(p: any) {
  return `
You are an expert forensic auditor.
Analyze this product data and produce a structured audit.

Product: ${p.brand} ${p.model_name}
Category: ${p.category}
Tech Specs: ${JSON.stringify(p.technical_specs || {})}

Canonical Claims to Extract:
${KNOWLEDGE_CANONICAL.map(c => `- ${c}`).join("\n")}

Return STRICT JSON.
  `.trim();
}

function tryJson(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}

const AUDIT_SCHEMA = {
  type: "OBJECT",
  properties: {
    truth_index: { type: "NUMBER", nullable: true },
    is_verified: { type: "BOOLEAN" },
    claims: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" }, // Mapping to canonical
          value: { type: "STRING" }
        }
      }
    },
    actuals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          value: { type: "STRING" }
        }
      }
    },
    discrepancies: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          issue: { type: "STRING" },
          description: { type: "STRING" }
        }
      }
    }
  },
  required: ["truth_index", "is_verified", "claims", "actuals", "discrepancies"]
};
