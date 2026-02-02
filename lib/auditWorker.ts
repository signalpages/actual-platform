import { getAuditRun, updateAuditRun, saveAudit } from './dataBridge.server';
import { getProductBySlug } from './dataBridge.server';
import { sanitizeDiscrepancy } from './textSanitizer';
import { safeParseLLMJson, buildStrictJsonPrompt } from './llmJsonParser';

/**
 * Background worker for executing audit
 * Triggered by waitUntil() from /api/audit
 */
export async function runAuditWorker(runId: string, product: any): Promise<void> {
    try {
        // 1. Load run
        const run = await getAuditRun(runId);
        if (!run) {
            console.error(`Audit run ${runId} not found`);
            return;
        }

        // Validate status
        if (run.status !== 'pending' && run.status !== 'running') {
            console.log(`Audit run ${runId} already ${run.status}`);
            return;
        }

        // 2. Mark as running
        await updateAuditRun(runId, {
            status: 'running',
            progress: 10,
        });

        // 3. Execute Gemini audit
        await updateAuditRun(runId, { progress: 30 });

        const auditResult = await executeGeminiAudit(product);

        // 5. Save result
        await updateAuditRun(runId, { progress: 80 });

        const saved = await saveAudit(product.id, auditResult);

        if (!saved) {
            await updateAuditRun(runId, {
                status: 'error',
                error: 'Failed to save audit result',
                finished_at: new Date().toISOString(),
            });
            return;
        }

        // 6. Mark as done
        await updateAuditRun(runId, {
            status: 'done',
            progress: 100,
            result_shadow_spec_id: saved.id,
            finished_at: new Date().toISOString(),
        });

    } catch (error) {
        console.error(`Audit worker error for run ${runId}:`, error);
        await updateAuditRun(runId, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            finished_at: new Date().toISOString(),
        });
    }
}

/**
 * Execute Gemini audit (extracted from route.ts)
 */
async function executeGeminiAudit(product: any): Promise<any> {
    const modelName = "gemini-3-flash-preview";
    const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;

    if (!apiKey) {
        throw new Error('GOOGLE_AI_STUDIO_KEY not configured');
    }

    const prompt = buildGroundedPrompt(product);

    // Make Gemini API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout

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
                        maxOutputTokens: 2048,
                        responseMimeType: "application/json",
                        responseSchema: AUDIT_SCHEMA,
                    },
                }),
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(`Gemini API Error: ${errorText.slice(0, 100)}`);
        }

        const data: any = await resp.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        // Attempt safe parsing
        let parseResult = safeParseLLMJson(rawText);

        // If initial parse failed, try strict retry
        if (!parseResult.success) {
            console.warn(`Initial JSON parse failed for product ${product.id}, retrying with strict prompt`);

            // Build strict retry prompt
            const strictPrompt = buildStrictJsonPrompt(prompt);

            // Retry Gemini call
            const retryResp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: strictPrompt }] }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 2048,
                            responseMimeType: "application/json",
                            responseSchema: AUDIT_SCHEMA,
                        },
                    }),
                    signal: controller.signal,
                }
            );

            if (retryResp.ok) {
                const retryData: any = await retryResp.json();
                const retryRawText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
                parseResult = safeParseLLMJson(retryRawText);

                if (parseResult.success) {
                    console.log(`Retry successful for product ${product.id}`);
                }
            }
        }

        // Final validation - if still failed, throw detailed error
        if (!parseResult.success) {
            console.error(`JSON parse failed after retry. Raw (truncated): ${parseResult.raw}`);
            throw new Error('Audit response validation failed. Please retry.');
        }

        const payload = parseResult.data;

        // Enhance and normalize
        const enhanced = enhanceAuditSynthesis(payload, product);
        const normalizedTruthScore = normalizeTruthIndex(enhanced.truth_score);

        // Sanitize discrepancies to remove non-English text
        const sanitizedDiscrepancies = (enhanced.discrepancies || []).map((d: any) => {
            return sanitizeDiscrepancy(d);
        });

        return {
            product_id: product.id,
            claimed_specs: enhanced.advertised_claims || [],
            actual_specs: enhanced.reality_ledger || [],
            red_flags: sanitizedDiscrepancies,
            truth_score: normalizedTruthScore,
            source_urls: [],
            is_verified: normalizedTruthScore !== null && normalizedTruthScore >= 80 && (sanitizedDiscrepancies?.length || 0) <= 3,
        };

    } finally {
        clearTimeout(timeoutId);
    }
}

// Helper functions (will need to be extracted/imported properly)
function buildGroundedPrompt(p: any) {
    return `
Perform a deep-dive technical audit on the ${p.brand} ${p.model_name} (${p.category}).

Core Model:
- Every entry is CLAIM vs REALITY.

Rules:
- Prefer independent tests, manuals, spec sheets, teardown data, and measured results.
- REDDIT FORENSICS: Query r/Solar, r/Preppers, and r/PortablePower for owner troubleshoot logs.
- TECHNICAL DISCHARGE TESTS: Find measured Wh (Watt-hours) and surge peaks.
- PDF MANUAL SCRAPE: Extract peak surge duration and thermal cut-off points.
- FCC ID LOOKUP: Check for hardware revisions.

Return STRICT JSON with:
- truth_score: 0–100 integer
- advertised_claims: max 8 items (label + value)
- reality_ledger: max 8 items (label + value)
- key_wins: min 2 items
- key_divergences: min 2 items  
- discrepancies: min 4 items (issue + description)

Product Data:
${JSON.stringify(p.technical_specs || {}, null, 2)}
`.trim();
}

function tryJson(s: string) {
    try { return JSON.parse(s); } catch { return null; }
}

function normalizeTruthIndex(raw: unknown): number | null {
    if (typeof raw !== "number" || Number.isNaN(raw)) return null;
    if (raw > 0 && raw <= 1) return Math.round(raw * 100);
    if (raw >= 0 && raw <= 100) return Math.round(raw);
    return null;
}

function enhanceAuditSynthesis(payload: any, product: any): any {
    if (!Array.isArray(payload.advertised_claims)) payload.advertised_claims = [];
    if (!Array.isArray(payload.reality_ledger)) payload.reality_ledger = [];
    if (!Array.isArray(payload.discrepancies)) payload.discrepancies = [];

    const validatedScore = validateTruthScore(
        payload.truth_score,
        payload.advertised_claims,
        payload.reality_ledger,
        payload.discrepancies
    );
    payload.truth_score = validatedScore;

    if (payload.discrepancies.length < 2) {
        payload.discrepancies.push({
            issue: "Limited Verification Data",
            description: "Insufficient independent test data available for comprehensive verification."
        });
    }

    return payload;
}

function validateTruthScore(score: number | null | undefined, advertised: any[], reality: any[], discrepancies: any[]): number {
    if (typeof score === 'number' && score >= 0 && score <= 100) return score;

    let truthScore = 100;
    discrepancies.forEach((d: any) => {
        const severity = d.severity?.toLowerCase();
        if (severity === 'high') truthScore -= 15;
        else if (severity === 'med' || severity === 'medium') truthScore -= 10;
        else truthScore -= 5;
    });

    const realityRatio = advertised.length > 0 ? reality.length / advertised.length : 1;
    if (realityRatio < 0.5) truthScore -= 20;
    else if (realityRatio < 0.7) truthScore -= 10;

    if (advertised.length === 0) truthScore -= 30;

    return Math.max(0, Math.min(100, Math.round(truthScore)));
}

const AUDIT_SCHEMA = {
    type: "OBJECT",
    properties: {
        truth_score: { type: "NUMBER" },
        advertised_claims: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    label: { type: "STRING" },
                    value: { type: "STRING" }
                }
            }
        },
        reality_ledger: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    label: { type: "STRING" },
                    value: { type: "STRING" }
                }
            }
        },
        key_wins: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    label: { type: "STRING" },
                    value: { type: "STRING" }
                }
            }
        },
        key_divergences: {
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
    required: ["truth_score", "advertised_claims", "reality_ledger", "discrepancies"]
};
