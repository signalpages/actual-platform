"use client";

import React, { useMemo } from 'react';
import { Asset } from '@/types';
import { CanonicalAuditResult } from '@/lib/auditNormalizer';
import { DiscrepancyCard } from './DiscrepancyCard';
import { MetricBars } from './MetricBars';
import { formatCategoryLabel } from '@/lib/categoryFormatter';
import Link from 'next/link';

interface FullAuditPanelProps {
    product: Asset;
    audit: CanonicalAuditResult | null;
    isRightColumn?: boolean;
}

export function FullAuditPanel({ product, audit, isRightColumn }: FullAuditPanelProps) {
    if (!audit) {
        // Fallback for missing audit (should verify pending/skeleton logic in parent)
        return (
            <div className="p-8 text-center opacity-50">
                <p className="text-sm font-bold">Audit Pending</p>
            </div>
        );
    }

    const stages = audit.stages;
    const stageData = (key: string) => (stages as any)?.[key]?.data || {};
    const stageStatus = (key: string) => (stages as any)?.[key]?.status || 'pending';

    // -------------------------
    // STAGE 4: Verdict & Metrics
    // -------------------------
    const s4Data = stageData('stage_4');
    const verdict = {
        truthIndex: s4Data?.truth_index ?? null,
        metricBars: s4Data?.metric_bars || [],
        strengths: s4Data?.strengths || [],
        limitations: s4Data?.limitations || [],
        practicalImpact: s4Data?.practical_impact || [],
    };

    // -------------------------
    // STAGE 3: Discrepancies
    // -------------------------
    const discrepancies = useMemo(() => {
        const data = stageData('stage_3');
        const raw = data.entries || data.discrepancies || data.red_flags || [];
        const seen = new Set<string>();
        return raw.filter((d: any) => {
            const key = d.key || `${(d.claim || d.issue || '').toLowerCase().trim()}::${(d.reality || d.description || '').toLowerCase().trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [stages.stage_3?.data]);

    // -------------------------
    // STAGE 2: Signals
    // -------------------------
    const mostPraised = (stageData('stage_2').most_praised || []).map((p: any) =>
        typeof p === 'string' ? { text: p } : p
    );
    const mostReportedIssues = (stageData('stage_2').most_reported_issues || []).map((i: any) =>
        typeof i === 'string' ? { text: i } : i
    );

    const isVerified = audit.analysis?.status === 'ready' || stageStatus('stage_3') === 'done';
    const truthColor = isVerified
        ? (audit.truth_index || 0) >= 90 ? "text-emerald-500" : "text-blue-600"
        : "text-slate-300";

    return (
        <div className="space-y-10">
            {/* Header Section */}
            <div className="px-6 pt-6 pb-2 border-b border-slate-100/50">
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {formatCategoryLabel(product.category)}
                    </p>
                    <Link href={`/product/${product.slug}`} className="group block">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none group-hover:text-blue-600 transition-colors">
                            {product.model_name}
                        </h2>
                        <p className="text-xs font-bold text-slate-500 mt-1">{product.brand}</p>
                    </Link>

                    <div className="mt-4 flex items-baseline gap-2">
                        <span className={`text-6xl font-black ${truthColor} tracking-tighter`}>
                            {isVerified ? audit.truth_index ?? '--' : '--'}%
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Truth Index
                        </span>
                    </div>
                </div>
            </div>

            {/* STAGE 4: Analysis & Metrics */}
            <div className="px-6 space-y-8">
                {verdict.metricBars.length > 0 && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Performance Metrics</h4>
                        <MetricBars metrics={verdict.metricBars} />
                    </div>
                )}

                {/* Pros & Cons */}
                <div className="space-y-6">
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3 border-b border-emerald-100 pb-2">Top Strengths</h4>
                        <ul className="space-y-2">
                            {verdict.strengths.slice(0, 4).map((s: string, i: number) => (
                                <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2">
                                    <span className="text-emerald-500 font-bold">✓</span> {s}
                                </li>
                            ))}
                            {verdict.strengths.length === 0 && <li className="text-slate-400 text-xs italic">No specific strengths isolated.</li>}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-3 border-b border-red-100 pb-2">Critical Limitations</h4>
                        <ul className="space-y-2">
                            {verdict.limitations.slice(0, 4).map((l: string, i: number) => (
                                <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2">
                                    <span className="text-red-500 font-bold">✕</span> {l}
                                </li>
                            ))}
                            {verdict.limitations.length === 0 && <li className="text-slate-400 text-xs italic">No critical limitations found.</li>}
                        </ul>
                    </div>
                </div>

                {/* Practical Impact */}
                {verdict.practicalImpact.length > 0 && (
                    <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-100">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-2">Practical Impact</h4>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {verdict.practicalImpact.slice(0, 2).map((s: string) => s.trim().replace(/\.?$/, '.')).join(' ')}
                        </p>
                    </div>
                )}
            </div>

            {/* STAGE 2: Community Signals (Compact) */}
            <div className="px-6 pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Community Signal</h4>
                <div className="grid grid-cols-1 gap-4">
                    {mostPraised.length > 0 && (
                        <div>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase mb-1 block">Praised For</span>
                            <p className="text-xs text-slate-600 line-clamp-3">
                                {mostPraised.map((p: any) => p.text).join('. ')}
                            </p>
                        </div>
                    )}
                    {mostReportedIssues.length > 0 && (
                        <div>
                            <span className="text-[9px] font-bold text-amber-600 uppercase mb-1 block">Reported Issues</span>
                            <p className="text-xs text-slate-600 line-clamp-3">
                                {mostReportedIssues.map((i: any) => i.text).join('. ')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* STAGE 3: Discrepancies (The Meat) */}
            <div className="px-6 pt-6 pb-10 bg-slate-50/50 border-t border-slate-200">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                    <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px]">{discrepancies.length}</span>
                    Verified Discrepancies
                </h3>

                <div className="space-y-4">
                    {discrepancies.length > 0 ? (
                        discrepancies.map((d: any, idx: number) => (
                            <DiscrepancyCard key={idx} discrepancy={d} index={idx} />
                        ))
                    ) : (
                        <div className="text-xs text-emerald-600 font-bold bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                            ✓ No discrepancies verified
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
