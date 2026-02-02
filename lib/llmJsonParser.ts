/**
 * Safe LLM JSON parsing utilities
 * Handles common LLM output issues: markdown fences, commentary, partial JSON
 */

export interface ParseResult {
    success: boolean;
    data?: any;
    error?: string;
    raw?: string;
}

/**
 * Safely parse JSON from LLM output
 * Handles markdown fences, trailing text, and other common issues
 */
export function safeParseLLMJson(rawText: string): ParseResult {
    if (!rawText || typeof rawText !== 'string') {
        return {
            success: false,
            error: 'Empty or invalid input',
            raw: rawText
        };
    }

    // Step 1: Strip markdown code fences
    let cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    // Step 2: Try direct parse
    try {
        const parsed = JSON.parse(cleaned);
        return { success: true, data: parsed };
    } catch (e) {
        // Continue to more aggressive cleaning
    }

    // Step 3: Extract JSON from surrounding text
    // Look for first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const extracted = cleaned.substring(firstBrace, lastBrace + 1);

        try {
            const parsed = JSON.parse(extracted);
            return { success: true, data: parsed };
        } catch (e) {
            // Continue to array extraction
        }
    }

    // Step 4: Try array extraction [...]
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const extracted = cleaned.substring(firstBracket, lastBracket + 1);

        try {
            const parsed = JSON.parse(extracted);
            return { success: true, data: parsed };
        } catch (e) {
            // All strategies failed
        }
    }

    // Step 5: All parsing strategies failed
    return {
        success: false,
        error: 'Could not extract valid JSON from response',
        raw: cleaned.slice(0, 200) // Only log first 200 chars
    };
}

/**
 * Build a strict retry prompt for Gemini when initial parse fails
 */
export function buildStrictJsonPrompt(originalPrompt: string): string {
    return `${originalPrompt}

CRITICAL: Return ONLY valid JSON. No commentary. No markdown. No explanation. No code fences.
The response must be parseable by JSON.parse() with no preprocessing.`;
}
