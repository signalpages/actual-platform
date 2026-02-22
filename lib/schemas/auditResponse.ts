/**
 * lib/schemas/auditResponse.ts
 *
 * Canonical shape of the audit API response.
 * Used to validate and ensure no undefined fields exist before
 * merging into client state.
 *
 * No Zod dependency — pure TypeScript types + runtime validator.
 */

export interface AuditStageShape {
    status: 'pending' | 'running' | 'done' | 'error' | 'blocked';
    completed_at?: string | null;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}

export interface AuditStages {
    stage_1?: AuditStageShape;
    stage_2?: AuditStageShape;
    stage_3?: AuditStageShape;
    stage_4?: AuditStageShape;
    [key: string]: AuditStageShape | undefined;
}

export interface CanonicalAuditPayload {
    claim_profile: unknown[];
    reality_ledger: unknown[];
    discrepancies: unknown[];
    verification_map: Record<string, unknown>;
    truth_index: number | null;
    strengths?: string[];
    limitations?: string[];
    practical_impact?: string[];
    stages: AuditStages;
}

export interface AuditAnalysis {
    status: 'ready' | 'pending' | 'failed' | 'running';
    verdictReady: boolean;
    runId: string;
    analyzedAt?: string | null;
    error?: { code: string; message: string } | null;
}

export interface AuditApiResponse {
    ok: boolean;
    analysis: AuditAnalysis;
    audit: CanonicalAuditPayload;
    runId?: string;
}

/** Empty skeleton — safe to spread into state, never undefined */
export const EMPTY_AUDIT_PAYLOAD: CanonicalAuditPayload = {
    claim_profile: [],
    reality_ledger: [],
    discrepancies: [],
    verification_map: {},
    truth_index: null,
    strengths: [],
    limitations: [],
    practical_impact: [],
    stages: {},
};

/**
 * Ensure an audit payload from the API has no undefined fields.
 * Fills missing fields with the canonical empty skeleton.
 */
export function sanitizeAuditPayload(raw: Partial<CanonicalAuditPayload> | null | undefined): CanonicalAuditPayload {
    if (!raw) return { ...EMPTY_AUDIT_PAYLOAD };
    return {
        claim_profile: Array.isArray(raw.claim_profile) ? raw.claim_profile : [],
        reality_ledger: Array.isArray(raw.reality_ledger) ? raw.reality_ledger : [],
        discrepancies: Array.isArray(raw.discrepancies) ? raw.discrepancies : [],
        verification_map: (raw.verification_map && typeof raw.verification_map === 'object') ? raw.verification_map : {},
        truth_index: typeof raw.truth_index === 'number' ? raw.truth_index : null,
        strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
        limitations: Array.isArray(raw.limitations) ? raw.limitations : [],
        practical_impact: Array.isArray(raw.practical_impact) ? raw.practical_impact : [],
        stages: (raw.stages && typeof raw.stages === 'object') ? raw.stages : {},
    };
}
