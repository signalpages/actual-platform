/**
 * Deterministic Truth Index Engine
 *
 * Single source of truth for the Truth Index score.
 * No other code path should produce a score — if you need a Truth Index,
 * call computeTruthIndex().
 *
 * Formula (V2 - fixed double-count):
 *   Bucket scores (from normalizeStage3) already have penalties baked in
 *   base  = round(0.45 × claimsAccuracy + 0.35 × realWorldFit + 0.20 × operationalNoise)
 *   final = clamp(base + llm_adjustment, 0, 100)
 *
 * LLM adjustment (optional):
 *   Allowed iff |delta| ≤ 3 AND reason is non-empty AND reason references an entry key.
 */

import type { NormalizedEntry, Severity, BaseScores } from "./normalizeStage3";

// ── Types ──────────────────────────────────────────────

export interface TruthIndexBreakdown {
    base: number;
    final: number;
    weights: {
        claims_accuracy: number;
        real_world_fit: number;
        operational_noise: number;
    };
    component_scores: {
        claims_accuracy: number;
        real_world_fit: number;
        operational_noise: number;
    };
    penalties: {
        severe: number;
        moderate: number;
        minor: number;
        total: number;
    };
    llm_adjustment: {
        delta: number;
        reason: string;
    } | null;
}

// ── Constants ──────────────────────────────────────────

const WEIGHTS = {
    claims_accuracy: 0.45,
    real_world_fit: 0.35,
    operational_noise: 0.20,
} as const;

// ── Core Function ──────────────────────────────────────

export function computeTruthIndex(
    entries: NormalizedEntry[],
    bucketScores: BaseScores,
    llmSuggestion?: { delta?: number; reason?: string }
): TruthIndexBreakdown {
    // 1. Weighted blend of per-bucket scores (which already have penalties)
    const base = Math.round(
        WEIGHTS.claims_accuracy * bucketScores.claimsAccuracy +
        WEIGHTS.real_world_fit * bucketScores.realWorldFit +
        WEIGHTS.operational_noise * bucketScores.operationalNoise
    );

    // 2. Count penalties for UI display (NOT for deduction — already in bucket scores)
    let severeCt = 0;
    let moderateCt = 0;
    let minorCt = 0;

    for (const e of entries) {
        if (e.severity === "severe") severeCt++;
        else if (e.severity === "moderate") moderateCt++;
        else minorCt++;
    }

    // Note: penalties.total is informational only, not applied again
    const penaltyTotal = -(severeCt * 3 + moderateCt * 2 + minorCt * 1);

    // 3. LLM adjustment (validate strictly)
    const llmAdj = validateLLMAdjustment(llmSuggestion, entries);

    // 4. Final score = base + LLM only (bucket scores already have penalties)
    const raw = base + (llmAdj?.delta ?? 0);
    const final = Math.max(0, Math.min(100, raw));

    return {
        base,
        final,
        weights: {
            claims_accuracy: 0.45,
            real_world_fit: 0.35,
            operational_noise: 0.20,
        },
        component_scores: {
            claims_accuracy: bucketScores.claimsAccuracy,
            real_world_fit: bucketScores.realWorldFit,
            operational_noise: bucketScores.operationalNoise,
        },
        penalties: {
            severe: severeCt,
            moderate: moderateCt,
            minor: minorCt,
            total: penaltyTotal, // for UI display only
        },
        llm_adjustment: llmAdj,
    };
}

// ── LLM Adjustment Validation ──────────────────────────

function validateLLMAdjustment(
    suggestion: { delta?: number; reason?: string } | undefined,
    entries: NormalizedEntry[]
): { delta: number; reason: string } | null {
    if (!suggestion) return null;

    const delta = suggestion.delta;
    const reason = (suggestion.reason || "").trim();

    // Gate 1: delta must exist and be bounded
    if (typeof delta !== "number" || Math.abs(delta) > 3 || delta === 0) return null;

    // Gate 2: reason must be non-empty
    if (!reason || reason.length < 10) return null;

    // Gate 3: reason must reference at least one entry by key fragment or claim text
    const reasonLower = reason.toLowerCase();
    const referencesEntry = entries.some(e => {
        const claimLower = (e.claim || "").toLowerCase();
        const keyFragments = e.key.split("::").filter(Boolean);

        // Match if reason contains a significant portion of a claim or key
        return (
            (claimLower.length > 8 && reasonLower.includes(claimLower.substring(0, 20))) ||
            keyFragments.some(frag => frag.length > 5 && reasonLower.includes(frag.substring(0, 15)))
        );
    });

    if (!referencesEntry) return null;

    return { delta: Math.round(delta), reason };
}
