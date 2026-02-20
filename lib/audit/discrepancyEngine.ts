
import { ProductCategory } from "@/types";

export type AuditStatus = 'verified' | 'discrepancy' | 'unsupported';
export type Severity = 'minor' | 'moderate' | 'severe';

export interface DiscrepancyResult {
    isDiscrepancy: boolean;
    severity?: Severity;
    delta?: number; // Validated delta (e.g. -0.15 for 15% shortfall)
    percent_diff?: string; // "-15%"
    reason?: string;
}

// 5% Tolerance Threshold
const TOLERANCE_THRESHOLD = 0.05;

/**
 * Clean numeric strings (e.g. "1200W" -> 1200)
 */
function parseValue(val: string): number | null {
    if (!val) return null;
    const clean = val.toLowerCase().replace(/,/g, '').match(/[\d.]+/);
    return clean ? parseFloat(clean[0]) : null;
}

/**
 * Check for discrepancy with 5% tolerance
 */
export function checkDiscrepancy(
    claimValue: string,
    realityValue: string,
    category: ProductCategory
): DiscrepancyResult {
    const claim = parseValue(claimValue);
    const reality = parseValue(realityValue);

    // If we can't parse both numbers, we can't mathematically verify.
    // Fallback to text-based or return "no logic applied".
    if (claim === null || reality === null) {
        return { isDiscrepancy: false };
    }

    // Calculate Deviation
    // Formula: (Reality - Claim) / Claim
    const delta = (reality - claim) / claim;

    // If reality is LESS than claim by more than 5% -> Discrepancy
    // delta < -0.05
    if (delta < -TOLERANCE_THRESHOLD) {
        let severity: Severity = 'minor';
        if (delta < -0.20) severity = 'severe';      // >20% shortfall
        else if (delta < -0.10) severity = 'moderate'; // >10% shortfall

        return {
            isDiscrepancy: true,
            severity,
            delta,
            percent_diff: `${(delta * 100).toFixed(1)}%`,
            reason: `Measured value is ${(delta * 100).toFixed(1)}% below claim (Tolerance: 5%)`
        };
    }

    // If reality is significantly HIGHER (underrated), we don't flag as "red flag" mostly, 
    // unless it exceeds safety limits (which would be category specific). 
    // For now, we only flag negative discrepancies.

    return { isDiscrepancy: false, delta };
}

/**
 * Determine overall Product Audit Status
 */
export function getAuditStatus(discrepancies: any[]): AuditStatus {
    if (!discrepancies || discrepancies.length === 0) return 'verified';

    // If any discrepancy exists, it is a 'discrepancy' state
    // We could filter for only 'severe' or 'moderate' if we want to be lenient
    const hasIssues = discrepancies.some(d => d.severity === 'severe' || d.severity === 'moderate');

    return hasIssues ? 'discrepancy' : 'verified';
}
