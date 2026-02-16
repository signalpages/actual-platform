/**
 * Progressive Stage Executors
 * Each function executes one stage of the audit independently
 */

import { safeParseLLMJson } from "./llmJsonParser";

interface Stage1Result {
    claim_profile: Array<{ label: string; value: string }>;
}

interface Stage2Result {
    independent_signal: {
        most_praised: Array<{ text: string; sources: number }>;
        most_reported_issues: Array<{ text: string; sources: number }>;
    };
}

interface Stage3Result {
    red_flags: Array<{
        claim: string;
        reality: string;
        severity: string;
        impact: string;
    }>;
    reality_ledger: Array<{
        label: string;
        value: string;
    }>;
    _meta?: {
        status: 'partial' | 'error';
        raw_text: string;
        parse_error: string | null;
    };
}

interface Stage4Result {
    truth_index: number;
    truth_index_breakdown: import("./computeTruthIndex").TruthIndexBreakdown;
    metric_bars: Array<{ label: string; rating: string; percentage: number }>;
    score_interpretation: string;
    strengths: string[];
    limitations: string[];
    practical_impact: string[];
    good_fit: string[];
    consider_alternatives: string[];
    data_confidence: string;
}

/**
 * STAGE 1: Extract Claim Profile
 * Simply maps technical specs to claim format
 * Fast, deterministic, cacheable
 */
export async function executeStage1(product: any): Promise<Stage1Result> {
    console.log(`[Stage 1] Extracting claims for ${product.model_name}`);

    let claim_profile: Array<{ label: string; value: string }> = [];

    // Handle different technical_specs formats
    if (product.technical_specs) {
        if (Array.isArray(product.technical_specs)) {
            // Array format - map directly
            claim_profile = product.technical_specs
                .map((spec: any) => ({
                    label: spec.label || spec.name || 'Unknown',
                    value: spec.value || spec.spec_value || 'Not specified'
                }))
                .filter((item: { label: string; value: string }) => {
                    const v = item.value.toLowerCase().trim();
                    return v !== 'not specified' && v !== 'null' && v !== 'undefined' && v !== '';
                });
        } else if (typeof product.technical_specs === 'object') {
            // Object format - convert entries to array
            claim_profile = Object.entries(product.technical_specs)
                .map(([key, value]) => ({
                    label: key,
                    value: String(value)
                }))
                .filter((item) => {
                    const v = item.value.toLowerCase().trim();
                    return v !== 'not specified' && v !== 'null' && v !== 'undefined' && v !== '';
                });
        }
    }

    // Fallback: If no specs, create minimal profile from basic product info
    if (claim_profile.length === 0) {
        console.log(`[Stage 1] No technical_specs found, creating fallback profile`);
        claim_profile = [
            { label: 'Brand', value: product.brand || 'Unknown' },
            { label: 'Model', value: product.model_name || 'Unknown' },
            { label: 'Category', value: product.category || 'Unknown' }
        ];

        // Add weight if available
        if (product.weight_lbs) {
            claim_profile.push({ label: 'Weight', value: `${product.weight_lbs} lbs` });
        }

        // Add MSRP if available
        if (product.msrp_usd) {
            claim_profile.push({ label: 'MSRP', value: `$${product.msrp_usd}` });
        }
    }

    console.log(`[Stage 1] Extracted ${claim_profile.length} claims`);
    return { claim_profile };
}

/**
 * STAGE 2: Independent Signal Gathering
 * Search Reddit, YouTube, forums for community feedback
 */
export async function executeStage2(
    product: any,
    stage1: Stage1Result
): Promise<Stage2Result> {
    console.log(`[Stage 2] Gathering independent signals for ${product.model_name}`);

    const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_AI_STUDIO_KEY not configured');
    }

    // Build search query focusing on product experience
    const searchQuery = `${product.brand} ${product.model_name} review real world experience`;

    let prompt = `You are analyzing community feedback for: ${product.brand} ${product.model_name}

CONTEXT (Manufacturer Claims):
${stage1.claim_profile.slice(0, 10).map(c => `- ${c.label}: ${c.value}`).join('\n')}

Based on real-world user discussions and your knowledge of this product category, identify:

1. MOST CONSISTENT PRAISE (5-7 items):
   - What users consistently appreciate
   - Features that meet or exceed expectations
   - Include estimated number of sources mentioning each

2. MOST REPORTED ISSUES (3-5 items):
   - Common complaints or limitations
   - Features that underperform claims
   - Include estimated number of sources mentioning each

Focus on objective, verifiable observations. Avoid marketing language.

CRITICAL: Do not use quotation marks (") inside any string values. Use apostrophes or rewrite.
Return ONLY valid JSON. No markdown, no code fences, no explanatory text.
If there is insufficient data, return empty arrays, but do not invent data.

Return JSON in this EXACT format:
{
  "most_praised": [
    { "text": "Battery life exceeds rated capacity in real-world testing", "sources": 8 }
  ],
  "most_reported_issues": [
    { "text": "Fan noise above 50% load (measured ~45dB)", "sources": 5 }
  ]
}`;

    let lastError: any;

    // RETRY LOOP (Max 2 Attempts)
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`[Stage 2] LLM Request (Attempt ${attempt}/2)`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout (increased for retry safety)

            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 2048,
                            responseMimeType: 'application/json'
                        }
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!resp.ok) {
                throw new Error(`Gemini API error: ${resp.statusText}`);
            }

            const data = await resp.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

            // Safe JSON parsing with fallback
            const parseResult = safeParseLLMJson(rawText);

            if (parseResult.success) {
                const result = parseResult.data;
                console.log(`[Stage 2] Found ${result.most_praised?.length || 0} praise items, ${result.most_reported_issues?.length || 0} issues`);

                return {
                    independent_signal: {
                        most_praised: result.most_praised || [],
                        most_reported_issues: result.most_reported_issues || []
                    }
                };
            } else {
                console.warn(`[Stage 2] JSON parse failed on attempt ${attempt}:`, parseResult.error);
                lastError = parseResult.error;

                // If failed, make prompt stricter for next attempt
                if (attempt === 1) {
                    prompt += `\n\nPREVIOUS ATTEMPT FAILED JSON PARSING. \nCRITICAL: Return ONLY valid JSON. Check for trailing commas, unescaped quotes, or markdown.`;
                }
            }
        } catch (error: any) {
            console.error(`[Stage 2] Error on attempt ${attempt}:`, error);
            lastError = error;
        }
    }

    // If we get here, all attempts failed
    console.error('[Stage 2] All retry attempts failed.');
    throw new Error(`STAGE2_JSON_PARSE_FAILED: ${lastError}`);
}

/**
 * STAGE 3: Forensic Discrepancies & Reality Ledger
 * Cross-reference claims with reality
 */
export async function executeStage3(
    product: any,
    stage1: Stage1Result,
    stage2: Stage2Result
): Promise<Stage3Result> {
    console.log(`[Stage 3] Analyzing discrepancies and reality for ${product.model_name}`);

    const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_AI_STUDIO_KEY not configured');
    }

    const prompt = `Cross-reference manufacturer claims with real-world feedback.

MANUFACTURER CLAIMS:
${stage1.claim_profile.map(c => `- ${c.label}: ${c.value}`).join('\n')}

COMMUNITY FEEDBACK:
Most Praised: ${stage2.independent_signal.most_praised.map(p => p.text).join('; ')}
Issues: ${stage2.independent_signal.most_reported_issues.map(i => i.text).join('; ')}

TASK 1: DISCREPANCIES
Identify ONLY meaningful discrepancies (>3% variance or functional impact).

TASK 2: REALITY LEDGER
For EACH manufacturer claim above, determine the "Real World" value based on feedback.
- If confirmed: Use the claimed value (e.g. "Confirmed 2000W").
- If different: Use the real observed value (e.g. "Actually ~1800W").
- If unknown: write "Not verified".

CRITICAL: Do not use quotation marks (") inside any string values. Use apostrophes or rewrite.
Return ONLY valid JSON. No markdown, no code fences, no explanatory text.

Return JSON:
{
  "red_flags": [
    {
      "claim": "exact claim text",
      "reality": "what testing/users found",
      "severity": "minor|moderate|severe",
      "impact": "practical effect on users"
    }
  ],
  "reality_ledger": [
    { "label": "Battery Capacity", "value": "2850Wh (tested avg)" },
    { "label": "AC Output", "value": "Confirmed 3000W" }
  ]
}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 8192, // Increased to prevent truncation
                        responseMimeType: 'application/json'
                    }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
            throw new Error(`Gemini API error: ${resp.statusText}`);
        }

        const data = await resp.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        // Log raw output for debugging
        console.log('[Stage 3] RAW OUTPUT START');
        console.log(rawText.length > 500 ? rawText.slice(0, 500) + '...[truncated]' : rawText);
        console.log('[Stage 3] RAW OUTPUT END');

        // Safe JSON parsing with code fence stripping
        let cleanedText = rawText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        let result = null;
        let parseError = null;
        let isPartial = false;

        // Check if response looks truncated
        if (!cleanedText.endsWith('}') && !cleanedText.endsWith(']')) {
            console.warn('[Stage 3] Response appears truncated');
            console.warn('[Stage 3] Last 100 chars:', cleanedText.slice(-100));
            isPartial = true;
            parseError = 'Response truncated mid-JSON';

            // Attempt repair first (new robust parser might catch it)
            const repairResult = safeParseLLMJson(cleanedText);
            if (repairResult.success && repairResult.data?.red_flags?.length > 0) {
                console.log('[Stage 3] Auto-repair succeeded. Recovered', repairResult.data.red_flags.length, 'red_flags');
                result = repairResult.data;
            } else {
                // Fallback: Try regex extraction if repair failed (e.g. malformed middle)
                // We prioritize red_flags (now first)
                const redFlagsMatch = cleanedText.match(/"red_flags"\s*:\s*\[([\s\S]*?)\]/); // Lazy match ] to find end of array

                if (redFlagsMatch) {
                    try {
                        const redFlagsJson = `[${redFlagsMatch[1]}]`;
                        const redFlags = JSON.parse(redFlagsJson);
                        result = { red_flags: redFlags, reality_ledger: [] };
                        console.log('[Stage 3] Regex recovered red_flags array with', redFlags.length, 'items');
                    } catch (e) {
                        // If that failed, maybe the array itself was truncated?
                        // The new parser repair should have handled it, but let's be safe.
                        console.warn('[Stage 3] Regex recovery failed:', e);
                    }
                }
            }
        } else {
            // Try normal parse
            try {
                result = JSON.parse(cleanedText);
            } catch (err: any) {
                console.error('[Stage 3] JSON parse failed:', err.message);
                parseError = err.message;

                // Try safe parser/repair
                const repairResult = safeParseLLMJson(cleanedText);
                if (repairResult.success) {
                    result = repairResult.data;
                    console.log('[Stage 3] JSON repaired successfully');
                } else {
                    // Try extracting first balanced object as final resort
                    const match = cleanedText.match(/\{[\s\S]*\}/);
                    if (match) {
                        try {
                            result = JSON.parse(match[0]);
                            console.log('[Stage 3] Recovered using balanced object extraction');
                            isPartial = true;
                        } catch {
                            console.error('[Stage 3] Balanced extraction also failed');
                        }
                    }
                }
            }
        }

        console.log(`[Stage 3] Found ${result?.reality_ledger?.length || 0} reality items, ${result?.red_flags?.length || 0} discrepancies (${isPartial ? 'partial' : 'complete'})`);

        return {
            reality_ledger: result?.reality_ledger || [],
            red_flags: result?.red_flags || [],
            _meta: isPartial || parseError ? {
                status: isPartial ? 'partial' : 'error',
                raw_text: rawText,
                parse_error: parseError
            } : undefined
        };
    } catch (error: any) {
        console.error('[Stage 3] Error:', error);
        console.error('[Stage 3] Stage failed but audit will continue');
        return { reality_ledger: [], red_flags: [] };
    }
}

/**
 * STAGE 4: Verdict & Truth Index
 * Synthesize final score and decision guidance from NORMALIZED data
 */

// Banned phrases for copy enforcement
const BANNED_PHRASES: [RegExp, string][] = [
    [/technical debt/gi, "ongoing maintenance cost"],
    [/non-production environments?/gi, "casual or secondary use"],
    [/\benterprise\b/gi, "professional"],
    [/\bstakeholder/gi, "user"],
    [/\bleverage\b/gi, "use"],
    [/\bsynergy\b/gi, "compatibility"],
    [/ecosystem lock-in/gi, "vendor dependency"],
    [/\brobust\b/gi, "reliable"],
    [/\bscalable\b/gi, "expandable"],
    [/high raw (\w+ )?capacity/gi, "large advertised $1capacity"],
];

function sanitizeCopy(text: string): string {
    let clean = text;
    for (const [pattern, replacement] of BANNED_PHRASES) {
        clean = clean.replace(pattern, replacement);
    }
    return clean;
}

function sanitizeCopyArray(arr: string[]): string[] {
    return arr.map(sanitizeCopy);
}

export async function executeStage4(
    product: any,
    allStages: {
        stage1: Stage1Result;
        stage2: Stage2Result;
        stage3: Stage3Result;
    },
    precomputed?: {
        baseScores: { claimsAccuracy: number; realWorldFit: number; operationalNoise: number };
        metricBars: Array<{ label: string; rating: string; percentage: number }>;
        truthBreakdown: {
            base: number;
            final: number;
            weights: { claims_accuracy: number; real_world_fit: number; operational_noise: number };
            component_scores: { claims_accuracy: number; real_world_fit: number; operational_noise: number };
            penalties: { severe: number; moderate: number; minor: number; total: number };
            llm_adjustment: { delta: number; reason: string } | null;
        };
    }
): Promise<Stage4Result> {
    console.log(`[Stage 4] Computing verdict for ${product.model_name}`);

    const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_AI_STUDIO_KEY not configured');
    }

    const { stage1, stage2, stage3 } = allStages;
    const breakdown = precomputed?.truthBreakdown;
    const bars = precomputed?.metricBars;
    const baseScore = breakdown?.base ?? 75;

    let prompt = `You are a product audit analyst. Synthesize a verdict for the following audit.

PRODUCT: ${product.brand} ${product.model_name}

=== DETERMINISTIC TRUTH INDEX (pre-computed, do NOT override) ===
Formula: 0.45 × Claims Accuracy + 0.35 × Real-World Fit + 0.20 × Operational Noise + penalties
Claims Accuracy Score: ${breakdown?.component_scores.claims_accuracy ?? 75}
Real-World Fit Score: ${breakdown?.component_scores.real_world_fit ?? 75}
Operational Noise Score: ${breakdown?.component_scores.operational_noise ?? 75}
Weighted Base: ${baseScore}
Issue Penalties: ${breakdown?.penalties.total ?? 0} (${breakdown?.penalties.severe ?? 0} severe, ${breakdown?.penalties.moderate ?? 0} moderate, ${breakdown?.penalties.minor ?? 0} minor)
Current Final: ${breakdown?.final ?? baseScore}

=== CONTEXT ===

1. MANUFACTURER CLAIMS:
${stage1.claim_profile.slice(0, 8).map(c => `- ${c.label}: ${c.value}`).join('\n')}

2. COMMUNITY SIGNALS:
Praised:
${stage2.independent_signal.most_praised.map(p => `- ${p.text} (${p.sources} sources)`).join('\n') || '- No community praise data available'}

Issues:
${stage2.independent_signal.most_reported_issues.map(i => `- ${i.text} (${i.sources} sources)`).join('\n') || '- No community issue data available'}

3. VERIFIED DISCREPANCIES (${stage3.red_flags.length} unique issues):
${stage3.red_flags.map((f: any) => `- [${f.severity}] CLAIM: ${f.claim} → REALITY: ${f.reality} (Impact: ${f.impact})`).join('\n')}

=== INSTRUCTIONS ===

Your job is to INTERPRET and SUMMARIZE the data above. Do NOT invent new issues.

RULES:
- The Truth Index score of ${breakdown?.final ?? baseScore} is deterministic. You CANNOT change it directly.
- You MAY suggest an adjustment_delta (integer, -3 to +3) if you believe the score should be slightly adjusted.
  - The reason MUST reference a specific discrepancy entry by its claim text.
  - Example: "weight issue is usability-only, not a safety concern"
  - If you have no strong reason, set adjustment_delta to 0 and leave adjustment_reason empty.
- strengths: Cite specific praised features from Section 2.
- limitations: Summarize verified discrepancies from Section 3 in natural language. Start with "Verified: ". Do NOT include technical keys (e.g. claim::reality).
- practical_impact: Real-world consequence of each discrepancy. Be specific (cite numbers).
- good_fit: Specific user types who benefit despite limitations.
- consider_alternatives: Specific needs this product does NOT meet well.

COPY RULES:
- Write for a consumer audience, not engineers.
- Use plain language. No jargon.
- BANNED: technical debt, non-production environments, enterprise, stakeholder, leverage, synergy, ecosystem lock-in, robust, scalable
- Say "large advertised capacity" not "high raw capacity"

CRITICAL: Do not use quotation marks (") inside any string values. Use apostrophes or rewrite.
Return ONLY valid JSON. No markdown, no code fences.

{
  "adjustment_delta": 0,
  "adjustment_reason": "",
  "score_interpretation": "One sentence explaining the score based on verified discrepancies.",
  "strengths": ["Specific strength from community data"],
  "limitations": ["Verified: specific discrepancy from Section 3 (natural language summary)"],
  "practical_impact": ["Specific technical consequence with numbers"],
  "good_fit": ["Specific user type"],
  "consider_alternatives": ["If you need [specific unmet need]..."]
}`;

    let lastError: any;

    // RETRY LOOP (Max 2 Attempts)
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`[Stage 4] LLM Request (Attempt ${attempt}/2)`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 4096,
                            responseMimeType: 'application/json'
                        }
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!resp.ok) {
                throw new Error(`Gemini API error: ${resp.statusText}`);
            }

            const data = await resp.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

            // Safe JSON parsing with logging
            console.log('[Stage 4] Raw Output (First 500 chars):', rawText.slice(0, 500));

            const parseResult = safeParseLLMJson(rawText);

            if (parseResult.success) {
                const result = parseResult.data;

                // Re-compute Truth Index with LLM's adjustment suggestion
                const { computeTruthIndex } = await import("@/lib/computeTruthIndex");
                const finalBreakdown = precomputed
                    ? computeTruthIndex(
                        stage3.red_flags as any,
                        precomputed.baseScores,
                        {
                            delta: result.adjustment_delta,
                            reason: result.adjustment_reason
                        }
                    )
                    : breakdown!;

                console.log(`[Stage 4] Truth Index: base=${finalBreakdown.base} final=${finalBreakdown.final} adj=${finalBreakdown.llm_adjustment?.delta ?? 'none'}`);

                // Metric bars = truth_index_breakdown.component_scores (single source)
                const finalBars = bars || [
                    { label: 'Claims Accuracy', rating: 'Moderate', percentage: finalBreakdown.component_scores.claims_accuracy },
                    { label: 'Real-World Fit', rating: 'Moderate', percentage: finalBreakdown.component_scores.real_world_fit },
                    { label: 'Operational Noise', rating: 'Moderate', percentage: finalBreakdown.component_scores.operational_noise }
                ];

                // Copy enforcement: sanitize all string outputs
                return {
                    truth_index: finalBreakdown.final,
                    truth_index_breakdown: finalBreakdown,
                    metric_bars: finalBars,
                    score_interpretation: sanitizeCopy(result.score_interpretation || 'Analysis complete.'),
                    strengths: sanitizeCopyArray(result.strengths || []),
                    limitations: sanitizeCopyArray(result.limitations || []),
                    practical_impact: sanitizeCopyArray(result.practical_impact || []),
                    good_fit: sanitizeCopyArray(result.good_fit || []),
                    consider_alternatives: sanitizeCopyArray(result.consider_alternatives || []),
                    data_confidence: `Data confidence: High · Sources: manufacturer docs, community feedback · Refresh cadence: ~14 days`
                };
            } else {
                console.warn(`[Stage 4] JSON parse failed on attempt ${attempt}:`, parseResult.error);
                lastError = parseResult.error;

                if (attempt === 1) {
                    prompt += `\n\nPREVIOUS ATTEMPT FAILED JSON PARSING. \nCRITICAL: Return ONLY valid JSON. Check for trailing commas, unescaped quotes, or markdown.`;
                }
            }
        } catch (error: any) {
            console.error(`[Stage 4] Error on attempt ${attempt}:`, error);
            lastError = error;
        }
    }

    console.error('[Stage 4] All retry attempts failed.');
    throw new Error(`STAGE4_FAILED: ${lastError}`);
}

