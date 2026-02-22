"use client";

import React, { useMemo } from 'react';
import { Asset } from '@/types';
import { CanonicalAuditResult } from '@/lib/auditNormalizer';
import { StageCard } from './StageCard';
import { DiscrepancyCard } from './DiscrepancyCard';
import { MetricBars } from './MetricBars';
import { formatCategoryLabel } from '../lib/categoryFormatter';
import { composeClaimProfile } from '@/lib/claimProfileComposer';
import { hasMeaningfulSpecs } from '@/lib/hasMeaningfulSpecs';

interface AuditResultsProps {
    product: Asset;
    audit: CanonicalAuditResult | null;
    onRetryStage?: (stage: 'stage2' | 'stage3' | 'stage4') => void;
    isRunning?: boolean;
}

// Module-level helper: flatten nested JSONB spec objects into label/value pairs
// Handles { display: {...}, numeric: {...}, info: {...} } and plain flat objects.
function flattenSpecsRaw(specs: Record<string, any>): Array<{ label: string; value: string }> {
    const groups = ['numeric', 'display', 'info', 'specs'];
    const hasGroupKeys = groups.some(g => g in specs && specs[g] && typeof specs[g] === 'object');

    function flatten(obj: Record<string, any>): Array<{ label: string; value: string }> {
        const out: Array<{ label: string; value: string }> = [];
        for (const [k, v] of Object.entries(obj)) {
            if (v === null || v === undefined) continue;
            const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                out.push(...flatten(v as Record<string, any>));
            } else {
                const val = String(v).trim();
                if (val && val !== 'null' && val !== 'undefined' && val !== 'false') {
                    out.push({ label, value: val });
                }
            }
        }
        return out;
    }

    if (hasGroupKeys) {
        const out: Array<{ label: string; value: string }> = [];
        for (const g of groups) {
            if (specs[g] && typeof specs[g] === 'object') out.push(...flatten(specs[g] as Record<string, any>));
        }
        return out;
    }
    return flatten(specs);
}

export function AuditResults({ product, audit, onRetryStage, isRunning }: AuditResultsProps) {
    if (!audit) return null;

    const stages = audit.stages;

    // Helper to safely access stage data
    const stageStatus = (key: string) => (stages as any)?.[key]?.status || 'pending';
    const stageData = (key: string) => (stages as any)?.[key]?.data || {};

    // Small retry button, shown only when a stage has failed/blocked/stale
    const RetryButton = ({ stage }: { stage: 'stage2' | 'stage3' | 'stage4' }) => {
        if (!onRetryStage) return null;
        return (
            <button
                onClick={() => onRetryStage(stage)}
                disabled={isRunning}
                className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                title={`Re-run ${stage}`}
            >
                ↺ Retry
            </button>
        );
    };

    // -------------------------
    // STAGE 1: Manufacturer Profile (composed from specs)
    // -------------------------
    const stage1 = stages.stage_1;

    // Primary: schema composer (reads category-specific schema)
    let claimItems = composeClaimProfile(product.technical_specs, product.category);

    // Fallback A: use audit claim_profile
    if (claimItems.length === 0 && Array.isArray(audit?.claim_profile) && audit.claim_profile.length > 0) {
        claimItems = audit.claim_profile;
    }

    // Fallback B: raw-flatten the nested JSONB spec object
    if (claimItems.length === 0 && product.technical_specs && typeof product.technical_specs === 'object' && !Array.isArray(product.technical_specs)) {
        claimItems = flattenSpecsRaw(product.technical_specs as Record<string, any>);
    }

    const hasSpecs = claimItems.length >= 1;

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
    const isStage4Blocked = stageStatus('stage_4') === 'blocked';
    const isStage2Done = stageStatus('stage_2') === 'done';
    const isStage3Done = stageStatus('stage_3') === 'done';

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
                            {/* Simple Spec Table (Raw Snapshot) */}
                            {hasSpecs && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    {claimItems.map((claim, idx) => (
                                        <div key={idx} className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                                            <span className="text-sm text-slate-500 font-medium">{claim.label}</span>
                                            <span className="text-sm text-slate-900 font-bold text-right">{claim.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                {/* Stage 2 retry if pending */}
                {!isStage2Done && <RetryButton stage="stage2" />}
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
                    {/* Retry Stage 3 when still pending after Stage 2 ran */}
                    {!isStage3Done && isStage2Done && <RetryButton stage="stage3" />}
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
                {/* AUDIT-002: Blocked state — actionable, not a dead-end */}
                {isStage4Blocked && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">INCOMPLETE</div>
                                <div className="text-sm font-bold text-slate-700">Stage 4 did not produce a verdict</div>
                            </div>
                            <RetryButton stage="stage4" />
                        </div>
                        <div className="text-xs text-slate-500">
                            Stages 1–3 are preserved. Re-running Stage 4 may resolve this.
                        </div>
                    </div>
                )}
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

