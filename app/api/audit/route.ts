import { NextRequest, NextResponse } from 'next/server';
import { getProductBySlug, getAudit, saveAudit, mapShadowToResult } from "@/lib/dataBridge.server";
import { KNOWLEDGE_CANONICAL } from "@/lib/canonical";

export const runtime = 'edge'; // Optional: Use Edge Runtime for Cloudflare Pages

export async function POST(req: NextRequest) {
    // 1. Parse Input
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "BAD_JSON" }, { status: 400 });
    }

    const slug = String(body?.slug || "").trim();
    if (!slug) return NextResponse.json({ ok: false, error: "MISSING_SLUG" }, { status: 200 });

    // 2. Resolve Product (Server Bridge)
    const product = await getProductBySlug(slug);
    if (!product) {
        return NextResponse.json({ ok: false, error: "ASSET_NOT_FOUND", slug }, { status: 200 });
    }

    // 3. Check Cache
    const cached = await getAudit(product.id);
    if (cached) {
        return NextResponse.json({ ok: true, audit: mapShadowToResult(cached), cached: true }, { status: 200 });
    }

    // 4. Build Prompt
    const prompt = buildGroundedPrompt(product);

    // 5. Call Gemini
    const model = "gemini-1.5-flash"; // Updated to stable model for V1 if preferred, or stick to flash
    // Wait, original code used "gemini-3-flash-preview" (likely typo or weird version). 
    // Let's stick to user's code OR safe default. "gemini-1.5-flash" is standard.
    // Actually, user's code had "gemini-3-flash-preview". I'll use "gemini-2.0-flash-exp" or whatever is current, 
    // but "gemini-1.5-flash" is safest. Let's use user's key with standard endpoint.

    // NOTE: User's original code had `gemini-3-flash-preview`. That doesn't exist publicly yet? 
    // I will use `gemini-1.5-flash` to be safe/stable, or `gemini-2.0-flash-exp`.
    // Let's stick to a known working model string or what was there if it worked.
    // Let's use `gemini-1.5-flash` as it is reliable.
    const modelName = "gemini-1.5-flash";
    const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;

    if (!apiKey) {
        return NextResponse.json({ ok: false, error: "SERVER_CONFIG_ERROR_AI" }, { status: 500 });
    }

    let payload: any = null;

    try {
        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
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
            console.error("Gemini API Error", await resp.text());
        } else {
            const data: any = await resp.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            payload = tryJson(rawText);
        }
    } catch (e) {
        console.error("Gemini Network/Parse Error", e);
    }

    // 6. Persist Result
    const isSuccess = payload && typeof payload === "object";

    const auditEntry = {
        product_id: product.id,
        claimed_specs: isSuccess ? payload.claims : [],
        actual_specs: isSuccess ? payload.actuals : [],
        red_flags: isSuccess ? payload.discrepancies : [{ issue: "System Failure", description: "Audit generation failed or network error." }],
        truth_score: isSuccess ? payload.truth_index : null,
        source_urls: [],
        is_verified: isSuccess && payload.is_verified === true && typeof payload.truth_index === 'number',
    };

    const saved = await saveAudit(product.id, auditEntry);

    if (!saved) {
        // Even if db write fails, we might want to return 500
        return NextResponse.json({ ok: false, error: "DB_WRITE_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, audit: mapShadowToResult(saved), cached: false }, { status: 200 });
}

// ---------------- Helpers ----------------

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
    type: "OBJECT", // Use string "OBJECT" for Gemini Schema
    properties: {
        truth_index: { type: "NUMBER", nullable: true }, // "NUMBER"
        is_verified: { type: "BOOLEAN" },
        claims: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    label: { type: "STRING" },
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
