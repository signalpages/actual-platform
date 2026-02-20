import { AuditResult, AuditStages, Discrepancy, AuditItem } from "../types";

import { formatLabel } from "./formatters";

export interface CanonicalAuditResult extends AuditResult {
    // Explicitly enforce presence of key fields for UI
    claim_profile: AuditItem[];
    reality_ledger: AuditItem[];
    discrepancies: Discrepancy[];
    truth_index: number | null;
    truth_index_breakdown?: any;
    stages: AuditStages;
    // Metadata for dev usage
    _schema_source?: 'forensic' | 'summary' | 'unknown';
}

const DEFAULT_METHODOLOGY = {
    base: 0,
    final: 0,
    weights: {
        claims_accuracy: 0.45,
        real_world_fit: 0.35,
        operational_noise: 0.20
    },
    component_scores: {
        claims_accuracy: 0,
        real_world_fit: 0,
        operational_noise: 0
    },
    penalties: {
        severe: 0,
        moderate: 0,
        minor: 0,
        total: 0
    },
    llm_adjustment: null
};

// Helper to flatten nested specs
function flattenSpecs(obj: any, prefix = ''): Array<{ label: string; value: string }> {
    let results: Array<{ label: string; value: string }> = [];
    if (!obj || typeof obj !== 'object') return [];

    for (const [key, value] of Object.entries(obj)) {
        if (['spec_sources', 'evidence', 'content_hash'].includes(key)) continue;
        const newKey = prefix ? `${prefix} ${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            results = results.concat(flattenSpecs(value, newKey));
        } else {
            const label = newKey
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase());
            results.push({ label, value: String(value) });
        }
    }
    return results;
}

export function normalizeAuditResult(raw: any, product?: any): CanonicalAuditResult {
    const canonicalBase = raw || createEmptyAudit();

    // Detect schema source for debugging
    const hasStages = !!canonicalBase.stages;
    const hasDirectClaims = !!(canonicalBase.claim_profile && canonicalBase.claim_profile.length > 0);
    const schemaSource = hasStages ? 'forensic' : (hasDirectClaims ? 'summary' : 'unknown');

    // 1. Extract Stages
    const defaultStage = { status: 'pending', completed_at: null, ttl_days: 0, data: {} };
    const defaultStages: AuditStages = {
        stage_1: { ...defaultStage, status: 'pending' } as any,
        stage_2: { ...defaultStage, status: 'pending' } as any,
        stage_3: { ...defaultStage, status: 'pending' } as any,
        stage_4: { ...defaultStage, status: 'pending' } as any,
    };

    const rawStages = canonicalBase.stages || canonicalBase.audit?.stages || {};
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
    // Priority: raw -> stage_1.data.claim_profile -> PRODUCT SPECS (Instant) -> empty
    let claim_profile = Array.isArray(canonicalBase.claim_profile) && canonicalBase.claim_profile.length > 0 ? canonicalBase.claim_profile :
        (Array.isArray(s1Data.claim_profile) && s1Data.claim_profile.length > 0 ? s1Data.claim_profile : []);

    // Instant Backfill from Product Specs if audit is pending/empty
    if (claim_profile.length === 0 && product?.technical_specs) {
        if (Array.isArray(product.technical_specs)) {
            claim_profile = product.technical_specs
                .map((spec: any) => ({
                    label: spec.label || spec.name || 'Unknown',
                    value: spec.value || spec.spec_value || 'Not specified'
                }))
                .filter((i: any) => {
                    const v = i.value.toLowerCase().trim();
                    return v !== 'not specified' && v !== 'null' && v !== 'undefined' && v !== '';
                });
        } else if (typeof product.technical_specs === 'object') {
            const flattened = flattenSpecs(product.technical_specs);
            claim_profile = flattened.filter((i: any) => {
                const v = i.value.toLowerCase().trim();
                return v !== 'not specified' && v !== 'null' && v !== 'undefined' && v !== '';
            });
        }
    }

    // 3. Canonicalize Reality Ledger
    // Priority: raw -> stage_3.data.reality_ledger -> stage_1.data.reality_ledger -> empty
    // Note: 'raw' (canonicalBase) now comes pre-populated from bridge with the best available ledger
    // We also check 'actual_specs' which is the DB column name
    let reality_ledger = Array.isArray(canonicalBase.reality_ledger) && canonicalBase.reality_ledger.length > 0
        ? canonicalBase.reality_ledger
        : (Array.isArray(canonicalBase.actual_specs) ? canonicalBase.actual_specs :
            (Array.isArray(s3Data.reality_ledger) ? s3Data.reality_ledger :
                (Array.isArray(s1Data.reality_ledger) ? s1Data.reality_ledger : [])));

    // 4. Canonicalize Discrepancies
    // Priority: raw.discrepancies -> raw.forensic.claim_cards -> stage_3.data.discrepancies -> stage_3.data.claim_cards -> stage_3.data.red_flags -> empty
    let discrepancies = [];
    if (Array.isArray(canonicalBase.discrepancies)) discrepancies = canonicalBase.discrepancies;
    else if (canonicalBase.forensic && Array.isArray(canonicalBase.forensic.claim_cards)) discrepancies = canonicalBase.forensic.claim_cards;
    else if (Array.isArray(s3Data.discrepancies)) discrepancies = s3Data.discrepancies;
    else if (Array.isArray(s3Data.claim_cards)) discrepancies = s3Data.claim_cards;
    else if (Array.isArray(s3Data.red_flags)) discrepancies = s3Data.red_flags;

    // 5. Canonicalize Truth Index
    let truth_index = canonicalBase.truth_index;
    if (truth_index === undefined || truth_index === null) truth_index = s4Data.truth_index;
    if (truth_index === undefined || truth_index === null) truth_index = canonicalBase.truth_score;
    if (truth_index === undefined || truth_index === null) truth_index = s4Data.truth_score;

    // Normalized Base
    const canonical: CanonicalAuditResult = {
        assetId: canonicalBase.assetId || canonicalBase.slug || product?.slug || 'unknown',
        analysis: {
            status: canonicalBase.analysis?.status || 'provisional',
            last_run_at: canonicalBase.analysis?.analyzedAt || null,
            verdictReady: canonicalBase.analysis?.verdictReady || false,
            runId: canonicalBase.analysis?.runId
        },
        claim_profile,
        reality_ledger,
        discrepancies,
        truth_index: typeof truth_index === 'number' ? truth_index : null,
        stages,
        _schema_source: schemaSource,

        // Pass through other S4 fields if they exist
        metric_bars: canonicalBase.metric_bars || s4Data.metric_bars,
        truth_index_breakdown: canonicalBase.truth_index_breakdown || s4Data.truth_index_breakdown || DEFAULT_METHODOLOGY,
        strengths: canonicalBase.strengths || s4Data.strengths,
        limitations: canonicalBase.limitations || s4Data.limitations,
        practical_impact: canonicalBase.practical_impact || s4Data.practical_impact,
        good_fit: canonicalBase.good_fit || s4Data.good_fit,
        consider_alternatives: canonicalBase.consider_alternatives || s4Data.consider_alternatives,
        score_interpretation: canonicalBase.score_interpretation || s4Data.score_interpretation,
        data_confidence: canonicalBase.data_confidence || s4Data.data_confidence,
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
