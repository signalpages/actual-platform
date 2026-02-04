"use client";

import React, { useMemo } from 'react';
import { AuditResult, Asset } from '@/types';
import { StageCard } from './StageCard';
import { DiscrepancyCard } from './DiscrepancyCard';
import { MetricBars } from './MetricBars';

interface AuditResultsProps {
    product: Asset;
    audit: AuditResult | null;
}

export function AuditResults({ product, audit }: AuditResultsProps) {
    if (!audit) return null;

    const stages = audit.stages || {};

    // Helper to safely access stage data
    const stageStatus = (key: string) => (stages as any)?.[key]?.status || 'pending';
    const stageData = (key: string) => (stages as any)?.[key]?.data || {};

    // -------------------------
    // STAGE 1: Claim Profile
    // -------------------------
    const stage1 = stages.stage_1;
    const claimsCount = audit.claim_profile?.length || 0;

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
        return [
            ...(data.red_flags || []),
            ...(data.discrepancies || [])
        ];
    }, [stage3]);

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
                title="Claim Extraction"
                description="Parsing manufacturer specs from provided documentation."
                status={stageStatus('stage_1')}
                data={stage1}
            >
                {claimsCount > 0 && (
                    <div className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
                        ✓ {claimsCount} technical claims extracted from official sources.
                    </div>
                )}
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
                                {verdict.practicalImpact.join(' ')}
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

