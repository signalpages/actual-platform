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

  // Minimal Gemini REST call. If you already have a wrapper, swap this.
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(key);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini discovery failed: ${res.status} ${t}`);
  }

  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ?? "";
  return JSON.parse(text);
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
