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
        const forceRefresh = body?.forceRefresh === true;
        if (!slug) return NextResponse.json({ ok: false, error: "MISSING_SLUG" }, { status: 200 });

        // 3. Resolve Product (Server Bridge)
        const product = await getProductBySlug(slug);
        if (!product) {
            return NextResponse.json({ ok: false, error: "ASSET_NOT_FOUND", slug }, { status: 200 });
        }

        // 4. Check Cache (skip if forceRefresh requested)
        if (!forceRefresh) {
            const cached = await getAudit(product.id);
            if (cached) {
                // Only return cached if it was successful, otherwise allow re-run
                const isCachedSuccess = cached.claimed_specs && cached.claimed_specs.length > 0;
                if (isCachedSuccess) {
                    return NextResponse.json({ ok: true, audit: mapShadowToResult(cached), cached: true }, { status: 200 });
                }
                // If cached audit failed, proceed to new analysis
                console.log("Cached audit was empty/failed, running fresh analysis");
            }
        }

        // 5. Build Prompt
        const prompt = buildGroundedPrompt(product);

        // 6. Call Gemini
        const modelName = "gemini-3-flash-preview";
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

        // Enhance and validate Gemini's synthesis
        if (isSuccess && payload) {
            payload = enhanceAuditSynthesis(payload, product);
        }

        // Normalize truth_score to integer 0-100
        const normalizedTruthScore = isSuccess ? normalizeTruthIndex(payload.truth_score) : null;

        const auditEntry = {
            product_id: product.id,
            claimed_specs: isSuccess ? payload.advertised_claims : [],
            actual_specs: isSuccess ? payload.reality_ledger : [],
            red_flags: isSuccess ? payload.discrepancies : [{ issue: "Audit Synthesis Failed", description: aiError || "Unknown Model Error" }],
            truth_score: normalizedTruthScore,
            source_urls: [],
            is_verified: isSuccess &&
                normalizedTruthScore !== null &&
                normalizedTruthScore >= 80 &&
                (payload.discrepancies?.length || 0) <= 3,
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

function normalizeTruthIndex(raw: unknown): number | null {
    if (typeof raw !== "number" || Number.isNaN(raw)) return null;

    // Accept 0–1 decimals and convert
    if (raw > 0 && raw <= 1) return Math.round(raw * 100);

    // Accept 0–100 numbers (int or float) and round
    if (raw >= 0 && raw <= 100) return Math.round(raw);

    return null;
}

/**
 * Validate and enhance Gemini's audit synthesis
 */
function enhanceAuditSynthesis(payload: any, product: any): any {
    // Ensure arrays exist
    if (!Array.isArray(payload.advertised_claims)) payload.advertised_claims = [];
    if (!Array.isArray(payload.reality_ledger)) payload.reality_ledger = [];
    if (!Array.isArray(payload.discrepancies)) payload.discrepancies = [];

    // Validate truth_score
    const validatedScore = validateTruthScore(
        payload.truth_score,
        payload.advertised_claims,
        payload.reality_ledger,
        payload.discrepancies
    );
    payload.truth_score = validatedScore;

    // Ensure minimum discrepancies (prompt asks for 4 minimum)
    if (payload.discrepancies.length < 2) {
        // Add generic fallback discrepancy
        payload.discrepancies.push({
            issue: "Limited Verification Data",
            description: "Insufficient independent test data available for comprehensive verification."
        });
    }

    return payload;
}

/**
 * Validate or calculate truth_score with fallback logic
 */
function validateTruthScore(
    score: number | null | undefined,
    advertised: any[],
    reality: any[],
    discrepancies: any[]
): number {
    // If Gemini provided valid score, use it (with some validation)
    if (typeof score === 'number' && score >= 0 && score <= 100) {
        // Accept Gemini's score if it seems reasonable
        return score;
    }

    // Fallback calculation
    let truthScore = 100;

    // Penalize based on discrepancies
    discrepancies.forEach((d: any) => {
        const severity = d.severity?.toLowerCase();
        if (severity === 'high') truthScore -= 15;
        else if (severity === 'med' || severity === 'medium') truthScore -= 10;
        else truthScore -= 5;
    });

    // Penalize if reality data is significantly less than advertised
    const realityRatio = advertised.length > 0 ? reality.length / advertised.length : 1;
    if (realityRatio < 0.5) truthScore -= 20;
    else if (realityRatio < 0.7) truthScore -= 10;

    // Penalize if no claims found
    if (advertised.length === 0) truthScore -= 30;

    return Math.max(0, Math.min(100, Math.round(truthScore)));
}

function buildGroundedPrompt(p: any) {
    return `
Perform a deep-dive technical audit on the ${p.brand} ${p.model_name} (${p.category}).

Core Model (do not break this):
- Every entry is CLAIM vs REALITY.

Rules:
- Prefer independent tests, manuals, spec sheets, teardown data, and measured results.
- Return audit results as maximum two sentences for each claim_profile and Reality_ledger item
- If a value cannot be found, use "Not publicly specified" but still include the line.
- REDDIT FORENSICS: Query r/Solar, r/Preppers, and r/PortablePower for owner troubleshoot logs.
- TECHNICAL DISCHARGE TESTS: Find measured Wh (Watt-hours) and surge peaks.
- PDF MANUAL SCRAPE: Extract peak surge duration and thermal cut-off points.
- FCC ID LOOKUP: Check for hardware revisions.

Return STRICT JSON with:
- truth_score: 0–100 integer (no decimals)
- advertised_claims: no more than 8 items (label + value) — manufacturer statements
- reality_ledger: no more than 8 (label + value) — measured reality with conditions/ranges
- key_wins: Minimum 2 items (label + value)
- key_divergences: Minimum 2 items (label + value) — the biggest expectation gaps
- discrepancies: 4 items minimum, each with issue + description

CRITICAL: Also return a "forensic" object.

forensic.claim_cards:
- MUST be 8–10 items (no duplicates).

Pressure rules:
- Use CONFIRMED by default when the marketing claim matches reality under normal conditions.
- Use CONDITIONAL only when a clear boundary is required (voltage, temperature, load, wiring, firmware).
- Use MISLEADING only when marketing implication would cause a buyer to expect something materially different.

Field rules:
- If pressure is CONFIRMED, OMIT condition/delta/mechanism/impact (do not include them).
- If pressure is CONDITIONAL, include ONLY condition (required) and delta (optional).
- If pressure is MISLEADING, include condition + delta + mechanism + impact.

Delta rules:
- Delta MUST be quantified (%, W, kW, ms, °C, dB, A, V, Wh, etc).
- If no meaningful delta exists, OMIT delta entirely.

forensic.discrepancy_cards:
- MUST be 4–10 items.
- Each item: title, summary (2–4 sentences), severity (low|med|high), linked_claim_keys (optional).

Product Data:
${JSON.stringify(p.technical_specs || {}, null, 2)}
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
