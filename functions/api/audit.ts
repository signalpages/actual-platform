// functions/api/audit.ts
export const onRequestOptions: PagesFunction = async (ctx) => {
  const origin = ctx.request.headers.get("Origin") || "*";
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
};

export const onRequestGet: PagesFunction = async (ctx) => {
  const origin = ctx.request.headers.get("Origin") || "*";
  return new Response(
    JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED", hint: "POST /api/audit" }),
    { status: 405, headers: { "content-type": "application/json", ...corsHeaders(origin) } }
  );
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const origin = ctx.request.headers.get("Origin") || "*";

  const key = (ctx.env.GOOGLE_AI_STUDIO_KEY as string | undefined)?.trim();
  if (!key) {
    return json(
      { ok: false, error: "MISSING_SERVER_KEY" },
      500,
      origin
    );
  }

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

  // ---- Server-only Gemini call via REST (no client leakage) ----
  // You can swap models later; this is a reasonable default.
  const model = "gemini-3-flash-preview";

  const prompt = buildPrompt({ slug, depth, category });

  let rawText = "";
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        key
      )}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          // Encourage deterministic-ish output.
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: depth === "forensic" ? 2500 : 1400,
          },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return json(
        { ok: false, error: "GEMINI_HTTP_ERROR", status: resp.status, details: errText.slice(0, 800) },
        502,
        origin
      );
    }

    const data: any = await resp.json();
    rawText =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") ||
      "";
  } catch (e: any) {
    return json(
      { ok: false, error: "GEMINI_FETCH_FAILED", details: String(e?.message || e).slice(0, 500) },
      502,
      origin
    );
  }

  // Enforce JSON response (strip common fences)
  const cleaned = stripCodeFences(rawText).trim();
  const parsed = safeJsonParse(cleaned);

  if (!parsed) {
    // Fail safe: return raw text for debugging WITHOUT key, truncated.
    return json(
      {
        ok: false,
        error: "MODEL_RETURNED_NON_JSON",
        hint: "Model must return strict JSON only.",
        sample: cleaned.slice(0, 1200),
      },
      502,
      origin
    );
  }

  // Add metadata (useful for UI + caching)
  const result = {
    ...parsed,
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
  };
}

function json(payload: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

function stripCodeFences(s: string) {
  // removes ```json ... ``` and ``` ... ```
  return s.replace(/```json\s*/gi, "```").replace(/```[\s\S]*?```/g, (m) => {
    return m.replace(/^```/, "").replace(/```$/, "");
  });
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    // try to salvage if model included leading/trailing text
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {}
    }
    return null;
  }
}

function buildPrompt(input: { slug: string; depth: string; category?: string }) {
  const { slug, depth, category } = input;

  // IMPORTANT: we are not browsing the web here; we’re producing a structured response.
  // You can later replace this prompt with the real “fetch sources + summarize” pipeline.
  // For now: return a stable JSON shape your UI can render.

  return `
You are generating an audit response for Actual.fyi.

Return STRICT JSON only. No markdown. No commentary. No code fences.

Inputs:
- slug: "${slug}"
- category: "${category || ""}"
- depth: "${depth}"

Output schema (must match exactly):
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
- If you don't have enough info, set truth_index to null, is_verified to false, and include a discrepancy saying "Insufficient evidence".
- confidence must be 0 to 1.
- Keep claims list between 5 and 12 items for summary depth, 10 to 20 for forensic depth.
`;
}
