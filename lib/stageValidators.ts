/**
 * Stage Payload Validators
 * Ensures stages cannot be marked "done" with invalid/empty data
 */

export interface Stage3ValidationResult {
    valid: boolean;
    error?: string;
    itemCount: number;
    arrayKey?: string;
}

export interface Stage4ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates Stage 3 (Fact Verification) payload
 * Checks for known array keys: red_flags, fact_checks, checks, discrepancies
 */
export function validateStage3(data: any): Stage3ValidationResult {
    if (!data) {
        return { valid: false, error: "missing_data", itemCount: 0 };
    }

    // Check for known array keys in order of preference
    const arrayKeys = ['red_flags', 'fact_checks', 'checks', 'discrepancies'];
    let foundArray: any[] | null = null;
    let foundKey: string | null = null;

    for (const key of arrayKeys) {
        if (Array.isArray(data[key])) {
            foundArray = data[key];
            foundKey = key;
            break;
        }
    }

    if (!foundArray) {
        return { valid: false, error: "no_valid_array_found", itemCount: 0 };
    }

    // ALLOW EMPTY ARRAYS - Valid result (no discrepancies found)
    if (foundArray.length === 0) {
        return { valid: true, itemCount: 0, arrayKey: foundKey || 'red_flags' };
    }

    // Validate each item has required fields (flexible based on actual schema)
    for (const item of foundArray) {
        // Must have claim/label
        if (!item.claim && !item.label) {
            return { valid: false, error: "missing_claim_field", itemCount: foundArray.length };
        }
        // Must have at least one verification field
        if (!item.reality && !item.verdict && !item.severity && !item.status) {
            return { valid: false, error: "missing_verification_field", itemCount: foundArray.length };
        }
    }

    return { valid: true, itemCount: foundArray.length, arrayKey: foundKey };
}

/**
 * Validates Stage 4 (Final Verdict) payload
 * Ensures truth_index exists and required arrays are present
 */
export function validateStage4(data: any): Stage4ValidationResult {
    if (!data || typeof data.truth_index !== 'number') {
        return { valid: false, error: "missing_truth_index" };
    }

    if (!data.score_interpretation) {
        return { valid: false, error: "missing_score_interpretation" };
    }

    if (!Array.isArray(data.strengths) || !Array.isArray(data.limitations)) {
        return { valid: false, error: "missing_arrays" };
    }

    return { valid: true };
}
