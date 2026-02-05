type Source = { url: string; type?: string };

function uniqBy<T>(arr: T[], keyFn: (t: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function domainOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function looksBad(url: string) {
  const u = url.toLowerCase();
  // kill obvious affiliate/listicle sludge for pilot
  return (
    u.includes("amazon.") ||
    u.includes("utm_") ||
    u.includes("ref=") ||
    u.includes("click") ||
    u.includes("coupon") ||
    u.includes("best-") ||
    u.includes("/best") ||
    u.includes("top-") ||
    u.includes("/top")
  );
}

async function geminiJson(prompt: string): Promise<any> {
  const key = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!key) throw new Error("Missing GOOGLE_AI_STUDIO_KEY");

  const MODEL = "gemini-3-flash-preview";

  const url =
    `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);

 let res: Response;

try {
  res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: ctrl.signal,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
      },
    }),
  });
} catch (e: any) {
  if (e?.name === "AbortError") {
    throw new Error("Gemini discovery timed out (12s)");
  }
  throw new Error(`Gemini discovery fetch failed: ${e?.message ?? String(e)}`);
}

if (!res.ok) {
  const txt = await res.text().catch(() => "");
  throw new Error(`Gemini discovery failed: ${res.status} ${txt}`);
}

let json: any;
try {
  json = await res.json();
} catch {
  throw new Error("Gemini discovery returned invalid JSON");
}

const text =
  json?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text)
    .join("") ?? "";

try {
  return JSON.parse(text);
} catch {
  throw new Error("Gemini discovery returned non-JSON payload");
} finally {
  clearTimeout(t);
}
}

export async function discoverSources(product: any): Promise<Source[]> {
  const name =
    product?.model_name ||
    product?.name ||
    product?.slug ||
    "Unknown product";

  const category = product?.category || "unknown category";

  const prompt = `
Find 3 to 5 independent sources about long-term usage, ownership reports, reliability, measured testing, manuals, or teardowns for:
"${name}" (${category})

Rules:
- Prefer independent testing, manuals/spec sheets, teardowns, and long-term owner reports.
- Avoid affiliate listicles, coupon pages, and store landing pages.
- Return JSON ONLY in this schema:

{
  "sources": [
    { "url": "https://...", "type": "review|forum|manual|teardown|gov" }
  ]
}

Return 3 to 5 sources. Domains should be diverse (no duplicates if possible).
`;

  const out = await geminiJson(prompt);

  const raw: Source[] = Array.isArray(out?.sources) ? out.sources : [];
  const cleaned = raw
    .map((s) => ({ url: String(s?.url || ""), type: s?.type ? String(s.type) : undefined }))
    .filter((s) => s.url.startsWith("http"))
    .filter((s) => !looksBad(s.url));

  // Dedupe by domain first, then by url
  const byDomain = uniqBy(cleaned, (s) => domainOf(s.url));
  const final = uniqBy(byDomain, (s) => s.url).slice(0, 5);

  return final;
}
