
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

    const discA = Array.isArray(assetA.audit.discrepancies) ? assetA.audit.discrepancies.length : 0;
    const discB = Array.isArray(assetB.audit.discrepancies) ? assetB.audit.discrepancies.length : 0;
    const discDelta = Math.abs(discA - discB);

    const drivers: string[] = [];

    // 2. Identify Dynamic, Data-Grounded Drivers instead of generic boilerplate
    const discListA = Array.isArray(assetA.audit.discrepancies) ? assetA.audit.discrepancies : [];
    const discListB = Array.isArray(assetB.audit.discrepancies) ? assetB.audit.discrepancies : [];

    const getSeverityRank = (sev?: string) => {
        const s = (sev || '').toLowerCase();
        if (s === 'high') return 3;
        if (s === 'med' || s === 'medium') return 2;
        if (s === 'low') return 1;
        return 0;
    };

    // Compile active discrepancies for both products
    const activeDiscrepancies: { model_name: string; issue: string; severity: string; rank: number }[] = [];
    discListA.forEach((d: any) => {
        if (d.issue && d.issue !== 'Discrepancy') {
            activeDiscrepancies.push({
                model_name: assetA.model_name,
                issue: d.issue,
                severity: d.severity || 'unknown',
                rank: getSeverityRank(d.severity)
            });
        }
    });
    discListB.forEach((d: any) => {
        if (d.issue && d.issue !== 'Discrepancy') {
            activeDiscrepancies.push({
                model_name: assetB.model_name,
                issue: d.issue,
                severity: d.severity || 'unknown',
                rank: getSeverityRank(d.severity)
            });
        }
    });

    // Sort by severity rank descending
    activeDiscrepancies.sort((a, b) => b.rank - a.rank);

    // Track added topics to avoid duplicates (e.g. don't put two "Capacity" drivers)
    const addedTopics = new Set<string>();

    // Helper to get general category/topic from issue to avoid duplicate fields
    const getTopic = (issue: string) => {
        const lower = issue.toLowerCase();
        if (lower.includes('capacity') || lower.includes('wh') || lower.includes('battery')) return 'capacity';
        if (lower.includes('output') || lower.includes('inverter') || lower.includes('watt') || lower.includes('power')) return 'output';
        if (lower.includes('solar') || lower.includes('input') || lower.includes('charge') || lower.includes('mppt')) return 'solar';
        if (lower.includes('weight') || lower.includes('portability')) return 'weight';
        return lower;
    };

    // 1. Add major discrepancies (severity high or medium)
    for (const d of activeDiscrepancies) {
        if (d.rank >= 2 && drivers.length < 3) {
            const topic = getTopic(d.issue);
            if (!addedTopics.has(topic)) {
                drivers.push(`Flagged: ${d.model_name} ${d.issue} deviation`);
                addedTopics.add(topic);
            }
        }
    }

    // 2. Add verified strengths/wins of either product
    const strengthsA = Array.isArray(assetA.audit.strengths) ? assetA.audit.strengths : [];
    const strengthsB = Array.isArray(assetB.audit.strengths) ? assetB.audit.strengths : [];

    // Let's add winner strengths first, then loser strengths
    const orderedStrengths = tiA >= tiB 
        ? [
            ...strengthsA.map(s => ({ model: assetA.model_name, strength: s })),
            ...strengthsB.map(s => ({ model: assetB.model_name, strength: s }))
          ]
        : [
            ...strengthsB.map(s => ({ model: assetB.model_name, strength: s })),
            ...strengthsA.map(s => ({ model: assetA.model_name, strength: s }))
          ];

    for (const item of orderedStrengths) {
        if (drivers.length < 3) {
            const topic = getTopic(item.strength);
            if (!addedTopics.has(topic)) {
                let cleanStr = item.strength;
                if (cleanStr.length > 50) {
                    cleanStr = cleanStr.slice(0, 47) + '...';
                }
                drivers.push(`Win: ${item.model} ${cleanStr}`);
                addedTopics.add(topic);
            }
        }
    }

    // 3. Add minor discrepancies
    for (const d of activeDiscrepancies) {
        if (d.rank === 1 && drivers.length < 3) {
            const topic = getTopic(d.issue);
            if (!addedTopics.has(topic)) {
                drivers.push(`Flagged: ${d.model_name} ${d.issue} deviation`);
                addedTopics.add(topic);
            }
        }
    }

    // 4. Fallback to general discrepancy count advantage if we still have space
    if (drivers.length < 3 && discA !== discB) {
        const cleaner = discA < discB ? assetA : assetB;
        const diff = Math.abs(discA - discB);
        drivers.push(`Integrity: ${cleaner.model_name} has ${diff} fewer flags`);
    }

    // 5. Fallback to verification score advantage
    if (drivers.length < 3 && delta >= 5) {
        drivers.push(`Accuracy: ${winner.model_name} leads by ${delta}%`);
    }

    // Ultimate fallback if absolutely empty
    if (drivers.length === 0) {
        drivers.push("Verified: Comparable claims accuracy");
        drivers.push("Verified: Identical spec compliance");
    }

    // 3. Construct Headline — always specific, always names the leader
    let headline: string;
    let winnerId: string | null = null;

    if (delta >= 10) {
        headline = `${winner.model_name} demonstrates a clear accuracy advantage — ${delta} points ahead on verified claims.`;
        winnerId = winner.id;
    } else if (discDelta >= 4) {
        const cleaner = discA < discB ? assetA : assetB;
        const messier = discA < discB ? assetB : assetA;
        headline = `${cleaner.model_name} carries ${Math.abs(discDelta)} fewer flagged discrepancies than ${messier.model_name} — a meaningful signal for accuracy-first buyers.`;
        winnerId = cleaner.id;
    } else if (delta >= 5) {
        headline = `${winner.model_name} leads by ${delta} points in a closely contested audit. Both products land in the same verification tier.`;
        winnerId = winner.id;
    } else {
        // Scores within 4 points — make it buyer-decision focused
        headline = `${winner.model_name} and ${loser.model_name} are forensically matched at ${winnerTI}% vs ${loserTI}%. Decision criteria: use case, price, and ecosystem fit.`;
        winnerId = null;
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
    // Prefer Stage 4 strengths if available — most specific signal
    if (focus.strengths && focus.strengths.length > 0) {
        return focus.strengths[0];
    }

    const ti = typeof focus.truth_index === 'number' ? focus.truth_index : null;
    const oppTi = typeof comparator.truth_index === 'number' ? comparator.truth_index : null;
    const discs = Array.isArray(focus.discrepancies) ? focus.discrepancies : [];
    const discCount = discs.length;

    // Count by severity
    const highCount = discs.filter(d => d.severity === 'high').length;
    const medCount = discs.filter(d => d.severity === 'med' || d.severity === 'medium').length;

    // Build a specific, data-grounded summary
    if (ti !== null) {
        const delta = oppTi !== null ? ti - oppTi : 0;

        // Accuracy tier
        const accuracyLabel =
            ti >= 90 ? 'Exceptionally high claims accuracy' :
            ti >= 80 ? 'Strong claims accuracy' :
            ti >= 65 ? 'Moderate claims accuracy' :
            'Below-average claims accuracy';

        // Discrepancy descriptor
        let discPhrase = '';
        if (discCount === 0) {
            discPhrase = 'with no flagged discrepancies';
        } else if (highCount > 0) {
            discPhrase = `with ${discCount} discrepanc${discCount !== 1 ? 'ies' : 'y'} including ${highCount} high-severity flag${highCount !== 1 ? 's' : ''}`;
        } else if (medCount > 0) {
            discPhrase = `with ${discCount} discrepanc${discCount !== 1 ? 'ies' : 'y'}, ${medCount} at medium severity`;
        } else {
            discPhrase = `with ${discCount} minor discrepanc${discCount !== 1 ? 'ies' : 'y'}`;
        }

        // Relative advantage
        const relPhrase =
            delta >= 10 ? ', notably outperforming its competitor on verified accuracy' :
            delta >= 5 ? ', with a slight edge in claim verification' :
            delta <= -10 ? ', trailing its competitor on verified accuracy' :
            delta <= -5 ? ', marginally behind on claim verification' :
            '';

        return `${accuracyLabel} at ${ti}% ${discPhrase}${relPhrase}.`;
    }

    // No truth_index at all — last resort
    if (discCount === 0) return 'No discrepancies flagged during forensic extraction.';
    return `${discCount} discrepanc${discCount !== 1 ? 'ies' : 'y'} flagged across verified claim categories.`;
}
