// functions/api/audit.ts
// Cloudflare Pages Functions
// Server-only Gemini call. Model unchanged (gemini-3-flash-preview).

export const onRequestOptions: PagesFunction = async (ctx) => {
  const origin = ctx.request.headers.get("Origin") || "*";
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

export const onRequestGet: PagesFunction = async (ctx) => {
  const origin = ctx.request.headers.get("Origin") || "*";
  return json(
    { ok: false, error: "METHOD_NOT_ALLOWED", hint: "POST /api/audit" },
    405,
    origin
  );
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const origin = ctx.request.headers.get("Origin") || "*";

  const key = (ctx.env.GOOGLE_AI_STUDIO_KEY as string | undefined)?.trim();
  if (!key) return json({ ok: false, error: "MISSING_SERVER_KEY" }, 500, origin);

  // Parse request
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ ok: false, error: "BAD_JSON" }, 400, origin);
  }

  const slug = String(body?.slug || "").trim();
  const depth = String(body?.depth || "summary").trim(); // "summary" | "forensic"
  const category = String(body?.category || "").trim();  // optional

  if (!slug) return json({ ok: false, error: "MISSING_SLUG" }, 400, origin);

  // ✅ Do NOT change model
  const model = "gemini-3-flash-preview";

  // Prompt: make it harder for Gemini to “chat”
  const prompt = buildPrompt({ slug, depth, category });

  let rawText = "";
  let upstreamStatus = 0;
  let upstreamDetails = "";

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        key
      )}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // slightly lower = less “creative”
            maxOutputTokens: depth === "forensic" ? 2500 : 1400,
            // ✅ Strong hint to return JSON (supported on v1beta)
            responseMimeType: "application/json",
          },
        }),
      }
    );

    upstreamStatus = resp.status;

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      upstreamDetails = errText.slice(0, 1600);
      return json(
        {
          ok: false,
          error: "GEMINI_HTTP_ERROR",
          status: upstreamStatus,
          details: upstreamDetails,
        },
        502,
        origin
      );
    }

    const data: any = await resp.json();

    rawText =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .filter(Boolean)
        .join("") || "";

    // Some responses include safety or other blocks; capture minimal debug if needed
    if (!rawText) {
      upstreamDetails = JSON.stringify(data)?.slice(0, 1600) || "";
      return json(
        {
          ok: false,
          error: "EMPTY_MODEL_TEXT",
          status: upstreamStatus,
          details: upstreamDetails,
        },
        502,
        origin
      );
    }
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: "GEMINI_FETCH_FAILED",
        details: String(e?.message || e).slice(0, 800),
      },
      502,
      origin
    );
  }

  // ---- Strict JSON enforcement + salvage ----
  const cleaned = normalizeModelText(rawText);

  // 1) Try strict
  let parsed = tryJson(cleaned);

  // 2) Try extracting the first balanced JSON object (handles “Here’s the JSON: …”)
  if (!parsed) {
    const extracted = extractFirstBalancedObject(cleaned);
    if (extracted) parsed = tryJson(extracted);
  }

  // 3) Try substring from first "{" to last "}" as last resort
  if (!parsed) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = tryJson(cleaned.slice(start, end + 1));
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return json(
      {
        ok: false,
        error: "MODEL_RETURNED_NON_JSON",
        hint: "Model must return strict JSON only (single object).",
        status: upstreamStatus || 502,
        sample: cleaned.slice(0, 1500),
      },
      502,
      origin
    );
  }

  // Optional: hard-validate expected keys exist (prevents half-baked objects)
  const requiredKeys = ["verdict", "truth_index", "is_verified", "summary", "claims", "discrepancies"];
  const missing = requiredKeys.filter((k) => !(k in (parsed as any)));
  if (missing.length) {
    return json(
      {
        ok: false,
        error: "JSON_SCHEMA_MISMATCH",
        hint: "Model returned JSON but missing required keys.",
        missing,
        sample: JSON.stringify(parsed).slice(0, 1500),
      },
      502,
      origin
    );
  }

  // Add metadata (useful for UI + caching)
  const result = {
    ...(parsed as any),
    meta: {
      slug,
      depth,
      category: category || null,
      generatedAt: new Date().toISOString(),
      model,
    },
  };

  return json({ ok: true, result }, 200, origin);
};

// ---------------- helpers ----------------

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    // helps avoid weird caching while debugging
    "cache-control": "no-store",
  };
}

function json(payload: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

function normalizeModelText(s: string) {
  if (!s) return "";

  // Remove common code fences
  let out = s.replace(/```json/gi, "```").replace(/```/g, "");

  // Normalize smart quotes
  out = out.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Normalize non-breaking spaces
  out = out.replace(/\u00A0/g, " ");

  // Trim junk around it
  return out.trim();
}

function tryJson(s: string) {
  try {
    const fixed = removeTrailingCommas(s);
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}

// Removes trailing commas like: { "a": 1, } or [1,2,]
function removeTrailingCommas(s: string) {
  // This is intentionally conservative; it won’t rewrite valid strings.
  return s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
}

/**
 * Extract the first balanced {...} block, respecting strings/escapes.
 * This catches “Here is the JSON: { ... } thanks!”
 */
function extractFirstBalancedObject(s: string) {
  const first = s.indexOf("{");
  if (first < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = first; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") depth--;

    if (depth === 0) {
      return s.slice(first, i + 1);
    }
  }

  return null;
}

function buildPrompt(input: { slug: string; depth: string; category?: string }) {
  const { slug, depth, category } = input;

  const nMin = depth === "forensic" ? 10 : 5;
  const nMax = depth === "forensic" ? 20 : 12;

  return `
Return STRICT JSON only. No markdown. No code fences. No explanation. No extra text.
Return exactly ONE JSON object.

You are generating an audit response for Actual.fyi.

Inputs:
- slug: "${slug}"
- category: "${category || ""}"
- depth: "${depth}"

Output schema (MUST match exactly):
{
  "verdict": "string",
  "truth_index": number|null,
  "is_verified": boolean,
  "summary": "string",
  "claims": [
    {
      "claim": "string",
      "reality": "string",
      "evidence": "string",
      "confidence": number
    }
  ],
  "discrepancies": [
    {
      "title": "string",
      "detail": "string",
      "severity": "low"|"medium"|"high"
    }
  ]
}

Rules:
- confidence is a number from 0 to 1.
- claims must have between ${nMin} and ${nMax} items.
- If insufficient evidence: truth_index=null, is_verified=false, and discrepancies must include:
  { "title": "Insufficient evidence", ... }
- Do not include trailing commas.
`.trim();
}
