import React from 'react';
import { Asset, AuditResult } from '@/types';
import { DiscrepancyCard } from './DiscrepancyCard';
import { MetricBars } from './MetricBars';
import { formatCategoryLabel } from '@/lib/categoryFormatter';

interface FullAuditPanelProps {
    product: Asset;
    audit: AuditResult | null | undefined;
}

export function FullAuditPanel({ product, audit }: FullAuditPanelProps) {
    if (!audit) return null;

    const stages = (audit.stages || {}) as any;
    const s1 = stages.stage_1?.data || {};
    const s2 = stages.stage_2?.data || {};
    const s3 = stages.stage_3?.data || {};
    const s4 = stages.stage_4?.data || {};

    // S4 Verdict
    const verdict = {
        truthIndex: s4.truth_index ?? audit.truth_index ?? null,
        metricBars: s4.metric_bars || [],
        strengths: s4.strengths || [],
        limitations: s4.limitations || [],
        practicalImpact: s4.practical_impact || [],
        goodFit: s4.good_fit || [],
        considerAlternatives: s4.consider_alternatives || [],
    };

    // S2 Evidence
    const mostPraised = (s2.most_praised || []).map((p: any) =>
        typeof p === 'string' ? { text: p } : p
    );
    const mostReportedIssues = (s2.most_reported_issues || []).map((i: any) =>
        typeof i === 'string' ? { text: i } : i
    );
    const sourceSummary = s2.source_summary || {};

    // S3 Discrepancies
    const discrepancies = audit?.discrepancies || s3.red_flags || [];

    return (
        <div className="space-y-12 h-full">
            {/* 1. Header & Score Breakdown */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">
                            {product.brand} <span className="text-slate-300">—</span> {formatCategoryLabel(product.category)}
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                            {product.model_name}
                        </h2>
                    </div>
                    {verdict.truthIndex !== null && (
                        <div className="text-right">
                            <div className={`text-4xl font-black ${(verdict.truthIndex || 0) >= 90 ? 'text-emerald-500' : 'text-blue-600'} leading-none`}>
                                {verdict.truthIndex}%
                            </div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Truth Index</p>
                        </div>
                    )}
                </div>

                {verdict.metricBars.length > 0 && (
                    <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Performance Metrics</h4>
                        <MetricBars metrics={verdict.metricBars} />
                    </div>
                )}
            </div>

            {/* 1.5 Manufacturer Profile (Stage 1 Specs) */}
            {audit?.claim_profile && audit.claim_profile.length > 0 && (
                <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Stage 1</span>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Manufacturer Specs</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                        {audit.claim_profile.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-baseline border-b border-slate-50 pb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{item.label}</span>
                                <span className="text-sm font-black text-slate-900">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Key Insights (S4 Strengths & Limitations) */}
            {(verdict.strengths.length > 0 || verdict.limitations.length > 0) && (
                <div className="grid grid-cols-1 gap-6">
                    {verdict.strengths.length > 0 && (
                        <div className="bg-emerald-50/20 border border-emerald-100 p-6 rounded-[1.5rem]">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Where it Delivers
                            </h4>
                            <ul className="space-y-3">
                                {verdict.strengths.slice(0, 4).map((s: string, i: number) => (
                                    <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {verdict.limitations.length > 0 && (
                        <div className="bg-red-50/20 border border-red-100 p-6 rounded-[1.5rem]">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                Limitations
                            </h4>
                            <ul className="space-y-3">
                                {verdict.limitations.slice(0, 4).map((l: string, i: number) => (
                                    <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2">
                                        <span className="text-red-500 font-bold mt-0.5">✕</span>
                                        {l}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* 3. Practical Impact (S4 Narrative) */}
            {verdict.practicalImpact.length > 0 && (
                <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100/50">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-3">Practical Impact</h4>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                        {verdict.practicalImpact.map((s: string) => s.trim().replace(/\.?$/, '.')).join(' ')}
                    </p>
                </div>
            )}

            {/* 4. Evidence Summary (S2) */}
            {(mostPraised.length > 0 || mostReportedIssues.length > 0) && (
                <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Stage 2</span>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Evidence Summary</h4>
                    </div>

                    <div className="space-y-6">
                        {mostPraised.length > 0 && (
                            <div>
                                <h5 className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Consistently Praised</h5>
                                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 marker:text-emerald-300">
                                    {mostPraised.slice(0, 3).map((p: any, i: number) => (
                                        <li key={i}>{p.text}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {mostReportedIssues.length > 0 && (
                            <div>
                                <h5 className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-2">Reported Issues</h5>
                                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 marker:text-amber-300">
                                    {mostReportedIssues.slice(0, 3).map((p: any, i: number) => (
                                        <li key={i}>{p.text}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. Forensic Discrepancies (S3) */}
            {discrepancies.length > 0 && (
                <div className="bg-red-50/10 border border-red-100 p-8 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center text-red-600 font-black text-[10px]">!</div>
                        <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest">FORENSIC DISCREPANCIES</h3>
                    </div>
                    <div className="space-y-6">
                        {discrepancies.map((d: any, i: number) => (
                            <DiscrepancyCard key={d.key || i} discrepancy={d} index={i} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
