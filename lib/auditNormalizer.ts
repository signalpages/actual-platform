import { AuditResult, AuditStages, Discrepancy, AuditItem } from "../types";

export interface CanonicalAuditResult extends AuditResult {
    // Explicitly enforce presence of key fields for UI
    claim_profile: AuditItem[];
    reality_ledger: AuditItem[];
    discrepancies: Discrepancy[];
    truth_index: number | null;
    stages: AuditStages;
    // Metadata for dev usage
    _schema_source?: 'forensic' | 'summary' | 'unknown';
}

export function normalizeAuditResult(raw: any): CanonicalAuditResult {
    if (!raw) {
        return createEmptyAudit();
    }

    // Detect schema source for debugging
    const hasStages = !!raw.stages;
    const hasDirectClaims = !!(raw.claim_profile && raw.claim_profile.length > 0);
    const schemaSource = hasStages ? 'forensic' : (hasDirectClaims ? 'summary' : 'unknown');

    // 1. Extract Stages
    const defaultStage = { status: 'pending', completed_at: null, ttl_days: 0, data: {} };
    const defaultStages: AuditStages = {
        stage_1: { ...defaultStage, status: 'pending' } as any,
        stage_2: { ...defaultStage, status: 'pending' } as any,
        stage_3: { ...defaultStage, status: 'pending' } as any,
        stage_4: { ...defaultStage, status: 'pending' } as any,
    };

    const rawStages = raw.stages || raw.audit?.stages || {};
    const stages: AuditStages = {
        stage_1: rawStages.stage_1 || defaultStages.stage_1,
        stage_2: rawStages.stage_2 || defaultStages.stage_2,
        stage_3: rawStages.stage_3 || defaultStages.stage_3,
        stage_4: rawStages.stage_4 || defaultStages.stage_4,
    };

    // Helper to get stage data safely
    const s1Data = stages.stage_1?.data || {};
    const s2Data = stages.stage_2?.data || {};
    const s3Data = stages.stage_3?.data || {};
    const s4Data = stages.stage_4?.data || {};

    // 2. Canonicalize Claim Profile
    // Priority: raw -> stage_1.data.claim_profile -> empty
    let claim_profile = Array.isArray(raw.claim_profile) ? raw.claim_profile :
        (Array.isArray(s1Data.claim_profile) ? s1Data.claim_profile : []);

    // 3. Canonicalize Reality Ledger
    // Priority: raw -> stage_1.data.reality_ledger -> empty
    let reality_ledger = Array.isArray(raw.reality_ledger) ? raw.reality_ledger :
        (Array.isArray(s1Data.reality_ledger) ? s1Data.reality_ledger : []);

    // 4. Canonicalize Discrepancies
    // Priority: raw.discrepancies -> raw.forensic.claim_cards -> stage_3.data.discrepancies -> stage_3.data.claim_cards -> stage_3.data.red_flags -> empty
    let discrepancies = [];
    if (Array.isArray(raw.discrepancies)) discrepancies = raw.discrepancies;
    else if (raw.forensic && Array.isArray(raw.forensic.claim_cards)) discrepancies = raw.forensic.claim_cards;
    else if (Array.isArray(s3Data.discrepancies)) discrepancies = s3Data.discrepancies;
    else if (Array.isArray(s3Data.claim_cards)) discrepancies = s3Data.claim_cards;
    else if (Array.isArray(s3Data.red_flags)) discrepancies = s3Data.red_flags;

    // 5. Canonicalize Truth Index
    // Priority: raw.truth_index -> stage_4.data.truth_index -> raw.truth_score -> null
    let truth_index = raw.truth_index;
    if (truth_index === undefined || truth_index === null) truth_index = s4Data.truth_index;
    if (truth_index === undefined || truth_index === null) truth_index = raw.truth_score;
    if (truth_index === undefined || truth_index === null) truth_index = s4Data.truth_score;

    // Normalized Base
    const canonical: CanonicalAuditResult = {
        assetId: raw.assetId || raw.slug || 'unknown',
        analysis: raw.analysis || { status: 'provisional', last_run_at: null },
        claim_profile,
        reality_ledger,
        discrepancies,
        truth_index: typeof truth_index === 'number' ? truth_index : null,
        stages,
        _schema_source: schemaSource,

        // Pass through other S4 fields if they exist
        metric_bars: raw.metric_bars || s4Data.metric_bars,
        strengths: raw.strengths || s4Data.strengths,
        limitations: raw.limitations || s4Data.limitations,
        practical_impact: raw.practical_impact || s4Data.practical_impact,
        good_fit: raw.good_fit || s4Data.good_fit,
        consider_alternatives: raw.consider_alternatives || s4Data.consider_alternatives,
        score_interpretation: raw.score_interpretation || s4Data.score_interpretation,
        data_confidence: raw.data_confidence || s4Data.data_confidence,
    };

    return canonical;
}

function createEmptyAudit(): CanonicalAuditResult {
    const defaultStage = { status: 'pending', completed_at: null, ttl_days: 0, data: {} };
    return {
        assetId: 'unknown',
        analysis: { status: 'failed', last_run_at: null },
        claim_profile: [],
        reality_ledger: [],
        discrepancies: [],
        truth_index: null,
        stages: {
            stage_1: { ...defaultStage, status: 'pending' } as any,
            stage_2: { ...defaultStage, status: 'pending' } as any,
            stage_3: { ...defaultStage, status: 'pending' } as any,
            stage_4: { ...defaultStage, status: 'pending' } as any,
        },
        _schema_source: 'unknown'
    };
}
