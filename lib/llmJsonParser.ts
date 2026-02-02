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
 * Strategy: Extract JSON boundaries only, never mutate interior content
 */
export function safeParseLLMJson(rawText: string): ParseResult {
    if (!rawText || typeof rawText !== 'string') {
        return {
            success: false,
            error: 'Empty or invalid input',
            raw: rawText
        };
    }

    // Step 1: Strip ONLY markdown code fences (boundary markers)
    let cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    // Step 2: Try direct parse (most common case)
    try {
        const parsed = JSON.parse(cleaned);
        return { success: true, data: parsed };
    } catch (e) {
        // Continue to boundary extraction
    }

    // Step 3: Extract JSON by finding outer boundaries
    // Find first { and matching last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const extracted = cleaned.substring(firstBrace, lastBrace + 1);

        try {
            const parsed = JSON.parse(extracted);
            return { success: true, data: parsed };
        } catch (e) {
            // Try array extraction
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

    // All parsing strategies failed
    return {
        success: false,
        error: 'Could not extract valid JSON from response',
        raw: cleaned.slice(0, 200)
    };
}

/**
 * Normalize string value after JSON parsing
 * Handles double-encoded quotes and empty quoted strings
 */
export function normalizeStringValue(value: any): string {
    if (value === null || value === undefined) {
        return '';
    }

    // Convert to string
    let str = String(value).trim();

    // Handle empty or quote-only strings
    if (!str || str === '""' || str === "''") {
        return '';
    }

    // Strip ONE layer of wrapping quotes if present
    // But preserve interior quotes
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
        const unwrapped = str.slice(1, -1);
        // Only unwrap if it doesn't leave us with just quotes
        if (unwrapped && unwrapped !== '"' && unwrapped !== "'") {
            str = unwrapped;
        }
    }

    return str;
}

/**
 * Build a strict retry prompt for Gemini when initial parse fails
 */
export function buildStrictJsonPrompt(originalPrompt: string): string {
    return `${originalPrompt}

CRITICAL: Return ONLY valid JSON. No commentary. No markdown. No explanation. No code fences.
The response must be parseable by JSON.parse() with no preprocessing.`;
}
