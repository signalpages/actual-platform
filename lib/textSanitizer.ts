/**
 * Text sanitization utilities for audit discrepancies
 * Detects and normalizes non-English (CJK) text
 */

// CJK Unicode ranges
const CJK_RANGES = [
    [0x4E00, 0x9FFF],   // CJK Unified Ideographs
    [0x3040, 0x30FF],   // Hiragana + Katakana
    [0xAC00, 0xD7AF],   // Hangul
    [0x3400, 0x4DBF],   // CJK Extension A
    [0x20000, 0x2A6DF], // CJK Extension B
];

export interface NormalizedText {
    clean: string;
    hadNonEnglish: boolean;
    original?: string;
}

/**
 * Check if text contains significant non-Latin characters
 */
export function hasNonEnglish(text: string, threshold = 0.1): boolean {
    if (!text) return false;

    let nonEnglishCount = 0;
    let totalChars = 0;

    for (const char of text) {
        const code = char.codePointAt(0);
        if (code === undefined) continue;

        totalChars++;

        // Check if in CJK ranges
        for (const [start, end] of CJK_RANGES) {
            if (code >= start && code <= end) {
                nonEnglishCount++;
                break;
            }
        }
    }

    if (totalChars === 0) return false;

    const ratio = nonEnglishCount / totalChars;
    return ratio > threshold;
}

/**
 * Normalize discrepancy text by removing/quarantining non-English content
 */
export function normalizeDiscrepancyText(text: string): NormalizedText {
    if (!text) {
        return { clean: text, hadNonEnglish: false };
    }

    // Trim weird punctuation and repeated quotes
    let cleaned = text
        .replace(/[""]/g, '"')  // Normalize quotes
        .replace(/['']/g, "'")  // Normalize apostrophes
        .replace(/"{2,}/g, '"') // Remove repeated quotes
        .replace(/\s+/g, ' ')   // Normalize whitespace
        .trim();

    // Check for non-English content
    const containsNonEnglish = hasNonEnglish(cleaned);

    if (containsNonEnglish) {
        // Return fallback message, preserve original
        return {
            clean: "Non-English source excerpt captured. See evidence.",
            hadNonEnglish: true,
            original: cleaned
        };
    }

    return {
        clean: cleaned,
        hadNonEnglish: false
    };
}

/**
 * Sanitize entire discrepancy object
 */
export function sanitizeDiscrepancy(disc: any): any {
    const issueNorm = normalizeDiscrepancyText(disc.issue || '');
    const descNorm = normalizeDiscrepancyText(disc.description || '');

    const sanitized: any = {
        issue: issueNorm.clean,
        description: descNorm.clean,
    };

    // Copy severity if present
    if (disc.severity) {
        sanitized.severity = disc.severity;
    }

    // If either had non-English, preserve originals
    if (issueNorm.hadNonEnglish || descNorm.hadNonEnglish) {
        sanitized.source_excerpt_original = [
            issueNorm.original,
            descNorm.original
        ].filter(Boolean).join(' | ');
    }

    // Preserve sources if present
    if (disc.sources) {
        sanitized.sources = disc.sources;
    }

    return sanitized;
}
