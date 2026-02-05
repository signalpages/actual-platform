import "dotenv/config";

/**
 * Simple, boring Schematron extractor.
 * - Uses Inference.net Responses API directly
 * - Forces rigid text format
 * - Parses deterministically
 */

const API_URL = "https://api.inference.net/v1/responses";
const MODEL = "inference-net/schematron-3b";

if (!process.env.SCHEMATRON_API_KEY) {
  throw new Error("Missing SCHEMATRON_API_KEY in env");
}

function parsePraiseIssues(text) {
  const praise = [];
  const issues = [];

  let mode = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "PRAISE:") {
      mode = "praise";
      continue;
    }

    if (trimmed === "ISSUES:") {
      mode = "issues";
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (mode === "praise") praise.push(trimmed.slice(2));
      if (mode === "issues") issues.push(trimmed.slice(2));
    }
  }

  return { praise, issues };
}

async function run() {
  const body = {
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Return EXACTLY this format. No extra text.

PRAISE:
- <one praise item>

ISSUES:
- <one issue item>

HTML:
<p>I love the battery life, but the unit is heavy and loud.</p>`,
          },
        ],
      },
    ],
    temperature: 0,
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SCHEMATRON_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Schematron error ${res.status}: ${errText}`);
  }

  const json = await res.json();

  const outputText =
    json?.output?.[0]?.content?.[0]?.text ?? "";

  console.log("\nRAW OUTPUT:\n");
  console.log(outputText);

  const extracted = parsePraiseIssues(outputText);

  console.log("\nPARSED:\n");
  console.log(JSON.stringify(extracted, null, 2));
}

run().catch(err => {
  console.error("\nFAILED:\n", err);
  process.exit(1);
});
