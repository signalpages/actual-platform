async function geminiJson(prompt: string): Promise<any> {
  const key = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!key) throw new Error("Missing GOOGLE_AI_STUDIO_KEY");

  const MODEL = "gemini-3-flash-preview";

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" +
    encodeURIComponent(key);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini assess failed: ${res.status} ${t}`);
  }

  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ?? "";
  return JSON.parse(text);
}

export async function assessCanonical(canonical: any) {
  const prompt = `
You are producing the FINAL assessment for a forensic hardware audit.
You MUST use only the provided canonical extracted JSON (no browsing, no outside assumptions).

Return JSON only in this schema:

{
  "verdict": "string",
  "discrepancies": [
    {
      "title": "string",
      "severity": "low|medium|high",
      "why": "string",
      "citations": ["url", "..."]
    }
  ],
  "truth_index_components": {
    "evidence_strength": 0,
    "consistency": 0,
    "clarity": 0
  }
}

Rules:
- citations must be a subset of canonical.claims[].citations.
- If insufficient evidence, verdict must say so and discrepancies should explain what’s missing.
- truth_index_components are integers 0-100.

Canonical JSON:
${JSON.stringify(canonical).slice(0, 120_000)}
`;
  return geminiJson(prompt);
}
