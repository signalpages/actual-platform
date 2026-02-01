import { NextRequest, NextResponse } from 'next/server';
import { getProductBySlug, getAudit, saveAudit, mapShadowToResult } from "@/lib/dataBridge.server";
import { KNOWLEDGE_CANONICAL } from "@/lib/canonical";

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        // 1. Strict Env Check
        // Note: In Cloudflare Pages, env vars are often on `process.env`.
        const envChecks = {
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            GOOGLE_AI_STUDIO_KEY: !!process.env.GOOGLE_AI_STUDIO_KEY,
        };

        if (!envChecks.SUPABASE_URL || !envChecks.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing Server Env:", envChecks);
            return NextResponse.json(
                { ok: false, error: "SERVER_CONFIG_ERROR", details: "Missing database credentials" },
                { status: 500 }
            );
        }

        // 2. Parse Input safely
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ ok: false, error: "BAD_JSON" }, { status: 400 });
        }

        const slug = String(body?.slug || "").trim();
        if (!slug) return NextResponse.json({ ok: false, error: "MISSING_SLUG" }, { status: 200 });

        // 3. Resolve Product (Server Bridge)
        const product = await getProductBySlug(slug);
        if (!product) {
            return NextResponse.json({ ok: false, error: "ASSET_NOT_FOUND", slug }, { status: 200 });
        }

        // 4. Check Cache
        const cached = await getAudit(product.id);
        if (cached) {
            return NextResponse.json({ ok: true, audit: mapShadowToResult(cached), cached: true }, { status: 200 });
        }

        // 5. Build Prompt
        const prompt = buildGroundedPrompt(product);

        // 6. Call Gemini
        const modelName = "gemini-1.5-flash";
        const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;

        if (!apiKey) {
            return NextResponse.json({ ok: false, error: "SERVER_CONFIG_ERROR_AI" }, { status: 500 });
        }

        let payload: any = null;
        let aiError: string | null = null;

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
                const errorText = await resp.text();
                console.error("Gemini API Error", errorText);
                aiError = `Provider Error: ${errorText.slice(0, 100)}`;
            } else {
                const data: any = await resp.json();
                const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
                payload = tryJson(rawText);
                if (!payload) {
                    aiError = "Invalid JSON response from model";
                }
            }
        } catch (e) {
            console.error("Gemini Network/Parse Error", e);
            aiError = `Network/Execution Error: ${String(e).slice(0, 100)}`;
        }

        // 7. Persist Result (Success or Failure)
        // If payload exists and is object, success. Otherwise, failure.
        const isSuccess = !aiError && payload && typeof payload === "object";

        const auditEntry = {
            product_id: product.id,
            claimed_specs: isSuccess ? payload.claims : [],
            actual_specs: isSuccess ? payload.actuals : [],
            red_flags: isSuccess ? payload.discrepancies : [{ issue: "Audit Synthesis Failed", description: aiError || "Unknown Model Error" }],
            truth_score: isSuccess ? payload.truth_index : null,
            source_urls: [],
            is_verified: isSuccess && payload.is_verified === true && typeof payload.truth_index === 'number',
        };

        const saved = await saveAudit(product.id, auditEntry);

        if (!saved) {
            console.error("DB Write Failed for product:", product.id);
            return NextResponse.json({ ok: false, error: "DB_WRITE_FAILED" }, { status: 500 });
        }

        // Return 200 OK even if audit failed (it's a valid "failed" audit)
        return NextResponse.json({ ok: true, audit: mapShadowToResult(saved), cached: false }, { status: 200 });

    } catch (err: any) {
        console.error("Unhandled API Exception:", err);
        return NextResponse.json(
            {
                ok: false,
                error: "AUDIT_EXCEPTION",
                message: err?.message ?? String(err),
                stack: err?.stack ? String(err.stack).slice(0, 500) : null,
            },
            { status: 500 }
        );
    }
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
