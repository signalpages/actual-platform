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
 * Attempt to repair common JSON syntax errors from LLMs
 */
function repairJson(jsonString: string): string {
    let repaired = jsonString.trim();

    // 1. Remove trailing commas in objects and arrays (before closing braces)
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // 2. Count open braces/brackets to close truncation
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === '{') openBraces++;
            else if (char === '}') openBraces = Math.max(0, openBraces - 1);
            else if (char === '[') openBrackets++;
            else if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
        }
    }

    // 3. Close open structures (brackets first, then braces usually, but we assume simple nesting)
    // Naively append closing characters. A purely stack-based approach would be better but this covers 90% of LLM truncation.
    // If it's a mix, this might fail, but it's a repair attempt.
    // Ideally we'd maintain a stack of what opened last.

    // Rerun with stack for correctness
    const stack: string[] = [];
    inString = false;
    escaped = false;
    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if (char === '}' || char === ']') {
                const expected = stack[stack.length - 1];
                if (expected === char) stack.pop();
            }
        }
    }

    // Append missing closers in reverse order
    while (stack.length > 0) {
        repaired += stack.pop();
    }

    return repaired;
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
        // Continue to repair/extraction
    }

    // Step 2b: Try repairing common syntax errors (trailing commas)
    try {
        const repaired = repairJson(cleaned);
        const parsed = JSON.parse(repaired);
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
            // Try repairing the extracted segment
            try {
                const repaired = repairJson(extracted);
                const parsed = JSON.parse(repaired);
                return { success: true, data: parsed };
            } catch (e2) {
                // Try array extraction
            }
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
            // Try repairing the extracted segment
            try {
                const repaired = repairJson(extracted);
                const parsed = JSON.parse(repaired);
                return { success: true, data: parsed };
            } catch (e2) {
                // All strategies failed
            }
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
