
import { AuditResult, Discrepancy } from "../../types";

export interface VerdictOutput {
    headline: string;
    summaryA: string;
    summaryB: string;
    primaryDrivers: string[];
    winnerId: string | null; // null if tie or inconclusive
}

export interface VerdictInput {
    truth_index: number;
    discrepancies: Discrepancy[];
    metrics?: {
        accuracy?: number; // 0-100
        fit?: number;      // 0-100
        noise?: number;    // 0-100 (Lower is better usually, but here likely formatted as Score)
    };
    strengths: string[];
    limitations: string[];
}

/**
 * Pure function to derive a verdict from two verified audits.
 * Returns a tagged result to safely handle missing data or readiness issues.
 */
export type VerdictResult =
    | { ok: true; verdict: VerdictOutput }
    | { ok: false; reason: 'NOT_READY' | 'INVALID_INPUT' | 'MISSING_TRUTH_INDEX' };

export function deriveVerdict(
    assetA: { id: string; model_name: string; audit: AuditResult },
    assetB: { id: string; model_name: string; audit: AuditResult }
): VerdictResult {

    // 1. Gate: Require Truth Index for both
    const tiA = assetA.audit.truth_index;
    const tiB = assetB.audit.truth_index;

    // Strict Gating: If TI is missing, we cannot render a "Verdict" authoritative enough for the UI.
    if (typeof tiA !== 'number' || typeof tiB !== 'number') {
        return { ok: false, reason: 'MISSING_TRUTH_INDEX' };
    }

    const delta = Math.abs(tiA - tiB);
    const winner = tiA > tiB ? assetA : assetB;
    const loser = tiA > tiB ? assetB : assetA;
    const winnerTI = tiA > tiB ? tiA : tiB;
    const loserTI = tiA > tiB ? tiB : tiA;

    const drivers: string[] = [];

    // 2. Identify Drivers

    // Driver: Accuracy (Truth Index)
    if (delta >= 15) {
        drivers.push("Claims Accuracy Major Disparity");
    } else if (delta >= 5) {
        drivers.push("Slight Accuracy Advantage");
    } else {
        drivers.push("Comparable Claims Accuracy");
    }

    // Driver: Discrepancy Volume
    // Ensure discrepancies is an array (safety check, though API should enforce)
    const discA = Array.isArray(assetA.audit.discrepancies) ? assetA.audit.discrepancies.length : 0;
    const discB = Array.isArray(assetB.audit.discrepancies) ? assetB.audit.discrepancies.length : 0;
    const discDelta = Math.abs(discA - discB);

    if (discDelta >= 3) {
        drivers.push(discA < discB ? `${assetA.model_name} has fewer red flags` : `${assetB.model_name} has fewer red flags`);
    }

    // 3. Construct Headline
    let headline = "No material forensic advantage detected.";
    let winnerId = null;

    if (delta >= 10) {
        headline = `${winner.model_name} demonstrates superior claim accuracy.`;
        winnerId = winner.id;
    } else if (discDelta >= 4) {
        const cleaner = discA < discB ? assetA : assetB;
        headline = `${cleaner.model_name} shows significantly fewer operational irregularities.`;
        winnerId = cleaner.id;
    } else if (delta < 5 && discDelta < 2) {
        headline = "No distinct forensic advantage in verified claims.";
        winnerId = null; // Tie
    }

    // 4. Summaries (using Strengths/Limitations if available, else generated)
    const summaryA = formatSummary(assetA.audit, assetB.audit);
    const summaryB = formatSummary(assetB.audit, assetA.audit);

    return {
        ok: true,
        verdict: {
            headline,
            summaryA,
            summaryB,
            primaryDrivers: drivers.slice(0, 3),
            winnerId
        }
    };
}

function formatSummary(focus: AuditResult, comparator: AuditResult): string {
    // Prefer Stage 4 strengths if available
    if (focus.strengths && focus.strengths.length > 0) {
        return focus.strengths[0]; // Top strength
    }

    // Fallback logic
    const ti = focus.truth_index || 0;
    const oppTi = comparator.truth_index || 0;

    if (ti > oppTi + 10) return "Validates closer to claimed specifications.";
    if (ti < oppTi - 10) return "Deviates significantly from manufacturer claims.";
    if (focus.discrepancies.length === 0) return "Clean forensic extraction.";

    return "Standard deviation within category norms.";
}
