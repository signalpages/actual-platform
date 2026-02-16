"use client";

import React, { useMemo } from 'react';
import { Asset } from '@/types';
import { CanonicalAuditResult } from '@/lib/auditNormalizer';
import { StageCard } from './StageCard';
import { DiscrepancyCard } from './DiscrepancyCard';
import { MetricBars } from './MetricBars';
import { formatCategoryLabel } from '../lib/categoryFormatter';
import { composeClaimProfile } from '@/lib/claimProfileComposer';

interface AuditResultsProps {
    product: Asset;
    audit: CanonicalAuditResult | null;
}

export function AuditResults({ product, audit }: AuditResultsProps) {
    if (!audit) return null;

    const stages = audit.stages;

    // Helper to safely access stage data
    const stageStatus = (key: string) => (stages as any)?.[key]?.status || 'pending';
    const stageData = (key: string) => (stages as any)?.[key]?.data || {};

    // -------------------------
    // STAGE 1: Manufacturer Profile (composed from specs)
    // -------------------------
    const stage1 = stages.stage_1;

    // Primary: Compose from Technical Specs (Human Readable)
    // Fallback: Use audit claim_profile (Raw/Legacy)
    // Fallback C: Empty array
    let claimItems = composeClaimProfile(product.technical_specs, product.category);

    if (claimItems.length === 0) {
        // Fallback to raw if composer returned nothing (e.g. specs missing standard keys)
        claimItems = audit?.claim_profile ??
            (Array.isArray((product as any)?.claim_profile) ? (product as any).claim_profile : []);
    }

    // Guardrail B: Match seeder 3-spec threshold
    const hasSpecs = claimItems.length >= 3;

    // -------------------------
    // STAGE 2: Analysis/Signal
    // -------------------------
    const stage2 = stages.stage_2;
    const mostPraised = (stageData('stage_2').most_praised || []).map((p: any) =>
        typeof p === 'string' ? { text: p } : p
    );
    const mostReportedIssues = (stageData('stage_2').most_reported_issues || []).map((i: any) =>
        typeof i === 'string' ? { text: i } : i
    );

    // -------------------------
    // STAGE 3: Discrepancies
    // -------------------------
    const stage3 = stages.stage_3;

    const discrepancies = useMemo(() => {
        const data = stageData('stage_3');
        // Use entries (normalized) > discrepancies > red_flags, but NEVER concatenate
        const raw = data.entries || data.discrepancies || data.red_flags || [];
        // Deduplicate by key (safety net)
        const seen = new Set<string>();
        return raw.filter((d: any) => {
            const key = d.key || `${(d.claim || d.issue || '').toLowerCase().trim()}::${(d.reality || d.description || '').toLowerCase().trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [stages.stage_3?.data]);

    const stage3ParseError = (stageData('stage_3') as any)?._meta?.parse_error;

    // -------------------------
    // STAGE 4: Verdict
    // -------------------------
    const stage4 = stages.stage_4;
    const s4Data = stageData('stage_4');
    const verdict = {
        truthIndex: s4Data?.truth_index ?? null,
        metricBars: s4Data?.metric_bars || [],
        scoreInterpretation: s4Data?.score_interpretation ?? '',
        strengths: s4Data?.strengths || [],
        limitations: s4Data?.limitations || [],
        practicalImpact: s4Data?.practical_impact || [],
        goodFit: s4Data?.good_fit || [],
        considerAlternatives: s4Data?.consider_alternatives || [],
        dataConfidence: s4Data?.data_confidence ?? '',
    };

    const isStage4Done = stageStatus('stage_4') === 'done';

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* STAGE 1 */}
            <StageCard
                stageNumber={1}
                title="Manufacturer Profile"
                description="Specifications claimed by the manufacturer."
                status={hasSpecs ? 'done' : 'pending'}
                data={stage1}
            >
                <div className="space-y-6">
                    {/* Product Metadata */}
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Brand</div>
                            <div className="text-sm font-bold text-slate-800">{product.brand}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Model</div>
                            <div className="text-sm font-bold text-slate-800">{product.model_name}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</div>
                            <div className="text-sm font-bold text-slate-800">{formatCategoryLabel(product.category)}</div>
                        </div>
                    </div>

                    {/* Pending State */}
                    {!hasSpecs && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                            <div className="text-sm font-bold text-slate-700 mb-1">Specs not loaded yet</div>
                            <div className="text-xs text-slate-500">This product is in the catalog, but manufacturer specs haven't been entered.</div>
                        </div>
                    )}

                    {/* Paired Claim ↔ Ledger Rows */}
                    {hasSpecs && (
                        <div className="space-y-3">
                            {claimItems.map((claim, idx) => {
                                // STRICT CLAIM-TYPE-SCOPED VERIFICATION MATCHING
                                // Each claim type has specific allowed verification metrics
                                const claimType = claim.label.toLowerCase();

                                // Helper: check if verified value has compatible unit for this claim type
                                const isCompatibleUnit = (verifiedValue: string, claimType: string): boolean => {
                                    const val = verifiedValue.toLowerCase();

                                    // Universal fallback: If it says "Confirmed" and has a number, explicit unit check is skipped
                                    // This handles cases where LLM returns "Confirmed 1024" instead of "Confirmed 1024Wh"
                                    if (val.includes('confirmed') && /\d/.test(val)) {
                                        return true;
                                    }

                                    // Storage Capacity: must contain Wh or Ah
                                    if (claimType.includes('storage') || claimType.includes('capacity') || claimType.includes('battery capacity')) {
                                        return val.includes('wh') || val.includes('ah');
                                    }

                                    // AC Output / Power: must contain W (but not Wh)
                                    if (claimType.includes('ac output') || claimType.includes('output') || claimType.includes('power output')) {
                                        return (val.includes('w') && !val.includes('wh')) || val.includes('watt');
                                    }

                                    // AC Charging Speed / Input: must contain W or input-related
                                    if (claimType.includes('charging') || claimType.includes('ac charging') || claimType.includes('input')) {
                                        return (val.includes('w') && !val.includes('wh')) || val.includes('charge') || val.includes('input');
                                    }

                                    // Cycle Life: must contain 'cycle'
                                    if (claimType.includes('cycle')) {
                                        return val.includes('cycle');
                                    }

                                    // Cell Chemistry: must contain chemistry term
                                    if (claimType.includes('chemistry') || claimType.includes('cell')) {
                                        return val.includes('lfp') || val.includes('lifepo') || val.includes('li-ion') || val.includes('chemistry');
                                    }

                                    // Solar Input: must contain W
                                    if (claimType.includes('solar')) {
                                        return val.includes('w') || val.includes('watt');
                                    }

                                    // UPS/EPS: must contain ms or switchover
                                    if (claimType.includes('ups') || claimType.includes('eps')) {
                                        return val.includes('ms') || val.includes('switchover');
                                    }

                                    // Expansion: must contain kWh or expansion
                                    if (claimType.includes('expansion')) {
                                        return val.includes('kwh') || val.includes('expansion');
                                    }

                                    // Weight: must contain kg or lb
                                    if (claimType.includes('weight')) {
                                        return val.includes('kg') || val.includes('lb') || val.includes('lbs');
                                    }

                                    // Temperature/Operating: must contain °C, C, or F
                                    if (claimType.includes('temperature') || claimType.includes('thermal') || claimType.includes('operating')) {
                                        return val.includes('°') || val.includes('c') || val.includes('f');
                                    }

                                    // Efficiency: must contain %
                                    if (claimType.includes('efficiency')) {
                                        return val.includes('%') || val.includes('efficiency');
                                    }

                                    // Dimensions: in, cm, mm, x, or stackable
                                    if (claimType.includes('dimensions')) {
                                        return val.includes('in') || val.includes('cm') || val.includes('mm') || val.includes('x') || val.includes('stackable');
                                    }

                                    // Categorical/Identity fields: no unit validation needed
                                    if (claimType.includes('brand') || claimType.includes('model') ||
                                        claimType.includes('category') || claimType.includes('name') ||
                                        claimType.includes('manufacturer') || claimType.includes('type') ||
                                        claimType.includes('series')) {
                                        return true;
                                    }

                                    // Default: reject to avoid cross-contamination
                                    return false;
                                };

                                // Find STRICT matching ledger entry
                                const ledgerMatch = audit.reality_ledger.find((ledger) => {
                                    const ledgerType = ledger.label.toLowerCase();

                                    // Exact label substring match (first word)
                                    const claimFirstWord = claimType.split(' ')[0];
                                    const ledgerFirstWord = ledgerType.split(' ')[0];

                                    const labelMatches =
                                        ledgerType.includes(claimFirstWord) ||
                                        claimType.includes(ledgerFirstWord) ||
                                        ledgerType === claimType;

                                    // Unit validation guard
                                    // RELAXED PRE-CHECK: If verified value is "Not verified", "Pending", "TBD" etc, SKIP unit check
                                    const notVerifiedKeywords = ['not verified', 'pending', 'tbd', 'unknown', 'n/a'];
                                    const isNotVerified = notVerifiedKeywords.some(kw => ledger.value.toLowerCase().includes(kw));

                                    // If not verified, we consider it "compatible" (or rather, irrelevant to check) to avoid noise
                                    const unitIsCompatible = isNotVerified || isCompatibleUnit(ledger.value, claimType);

                                    // BOTH must be true
                                    const isValid = labelMatches && unitIsCompatible;

                                    // DEV GUARDRAIL: Log mismatches
                                    // Only log if we found a label match but unit failed (and it WAS verified)
                                    if (labelMatches && !unitIsCompatible && process.env.NODE_ENV === 'development') {
                                        console.error(
                                            `[Verification Error] Unit mismatch for "${claim.label}": ` +
                                            `verified value "${ledger.value}" has incompatible unit. Rejecting.`
                                        );
                                    }

                                    return isValid;
                                });

                                return (
                                    <div
                                        key={idx}
                                        className="grid grid-cols-2 gap-6 p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-white"
                                    >
                                        {/* Manufacturer Claim */}
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                {claim.label}
                                            </div>
                                            <div className="text-sm font-bold text-slate-800">
                                                {claim.value}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                Manufacturer Spec
                                            </div>
                                        </div>

                                        {/* Verified Ledger - CONDITIONAL RENDERING */}
                                        <div className="space-y-1 border-l-2 border-blue-100 pl-4">
                                            {ledgerMatch ? (
                                                <>
                                                    <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                                        <span>✓</span> Verified Data
                                                    </div>
                                                    <div className="text-sm font-bold text-blue-900">
                                                        {ledgerMatch.value}
                                                    </div>
                                                    <div className="text-[10px] text-blue-500 font-medium">
                                                        Lab Tested / Field Verified
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                                        Pending Verification
                                                    </div>
                                                    <div className="text-xs text-slate-400 italic">
                                                        Not yet independently verified
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </StageCard>

            {/* STAGE 2 */}
            <StageCard
                stageNumber={2}
                title="Cross-Source Validation"
                description="Aggregating owner reports and technical discussions."
                status={stageStatus('stage_2')}
                data={stage2}
            >
                {(mostPraised.length > 0 || mostReportedIssues.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Consistently Praised</h4>
                            <ul className="space-y-2 list-disc pl-4 text-xs text-slate-700 marker:text-emerald-300">
                                {mostPraised.map((p: any, i: number) => (
                                    <li key={i}>
                                        {p.text}
                                        {p.sources && <span className="text-slate-400"> ({p.sources})</span>}
                                    </li>
                                ))}
                                {mostPraised.length === 0 && <li className="text-slate-400 italic">No significant praise clusters detected.</li>}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-3">Reported Issues</h4>
                            <ul className="space-y-2 list-disc pl-4 text-xs text-slate-700 marker:text-amber-300">
                                {mostReportedIssues.map((i: any, k: number) => (
                                    <li key={k}>
                                        {i.text}
                                        {i.sources && <span className="text-slate-400"> ({i.sources})</span>}
                                    </li>
                                ))}
                                {mostReportedIssues.length === 0 && <li className="text-slate-400 italic">No significant issue clusters detected.</li>}
                            </ul>
                        </div>
                    </div>
                )}
            </StageCard>

            {/* STAGE 3 */}
            <StageCard
                stageNumber={3}
                title="Fact Verification"
                description="Checking claims against real-world performance data."
                status={stageStatus('stage_3')}
                data={stage3}
            >
                <div className="space-y-3">
                    {stage3ParseError && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 mb-4">
                            ⚠️ <strong>Partial Analysis Warning:</strong> The AI model output was truncated. Some discrepancies may be missing.
                        </div>
                    )}

                    {discrepancies.length > 0 ? (
                        discrepancies.map((d: any, idx: number) => (
                            <DiscrepancyCard key={idx} discrepancy={d} index={idx} />
                        ))
                    ) : (
                        stageStatus('stage_3') === 'done' && (
                            <div className="text-sm text-emerald-600 font-medium bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                ✓ No significant contradictions found between claims and owner data.
                            </div>
                        )
                    )}
                </div>
            </StageCard>

            {/* STAGE 4 */}
            <StageCard
                stageNumber={4}
                title="Final Verdict"
                description="Calculating Truth Index and generating summary."
                status={stageStatus('stage_4')}
                data={stage4}
            >
                {isStage4Done && (
                    <div className="space-y-8">
                        {/* Metric Bars */}
                        {verdict.metricBars.length > 0 && (
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Performance Metrics</h4>
                                <MetricBars metrics={verdict.metricBars} />
                            </div>
                        )}

                        {/* Pros/Cons Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Where it Delivers
                                </h4>
                                <ul className="space-y-3">
                                    {verdict.strengths.map((s: string, i: number) => (
                                        <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2">
                                            <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Limitations
                                </h4>
                                <ul className="space-y-3">
                                    {verdict.limitations.map((l: string, i: number) => (
                                        <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2">
                                            <span className="text-red-500 font-bold mt-0.5">✕</span>
                                            {l}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Practical Impact */}
                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Practical Impact</h4>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                {verdict.practicalImpact.map((s: string) => s.trim().replace(/\.?$/, '.')).join(' ')}
                            </p>
                        </div>

                        {/* Recommendation */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-700 mb-2">Best For</h4>
                                <div className="flex flex-wrap gap-2">
                                    {verdict.goodFit.map((fit: string, i: number) => (
                                        <span key={i} className="px-2 py-1 bg-white border border-emerald-100 rounded text-[10px] font-bold text-emerald-700 shadow-sm">
                                            {fit}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Consider Alternatives If</h4>
                                <div className="flex flex-wrap gap-2">
                                    {verdict.considerAlternatives.map((alt: string, i: number) => (
                                        <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 shadow-sm">
                                            {alt}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </StageCard>
        </div>
    );
}

