import React, { useState } from 'react';
import { Asset, AuditResult } from '@/types';
import { DiscrepancyCard } from './DiscrepancyCard';
import { MetricBars } from './MetricBars';
// ... imports

// ... existing components ...

export function ComparisonDiscrepancies({ product, audit, className }: ComparisonSectionProps) {
    const [showAll, setShowAll] = useState(false);

    // Always render container for alignment, even if empty
    if (!audit) return <div className={`flex flex-col h-full ${className}`} />;

    const s3 = audit.stages?.stage_3?.data || {};
    const discrepancies = audit.discrepancies || s3.red_flags || [];

    if (discrepancies.length === 0) return <div className={`flex flex-col h-full min-h-[200px] bg-slate-50/50 rounded-[2rem] border border-slate-100 p-8 ${className}`}><span className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center my-auto">No Discrepancies Detected</span></div>;

    const visibleCount = showAll ? discrepancies.length : 3;
    const remaining = discrepancies.length - 3;

    return (
        <div className={`bg-red-50/10 border border-red-100 p-8 rounded-[2rem] flex flex-col h-full ${className}`}>
            <div className="flex items-center gap-3 mb-8 min-h-[24px]">
                <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center text-red-600 font-black text-[10px]">!</div>
                <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest">FORENSIC DISCREPANCIES</h3>
            </div>

            <div className="flex-1 space-y-6">
                {discrepancies.slice(0, visibleCount).map((d: any, i: number) => (
                    <div key={d.key || i} className="flex flex-col">
                        <DiscrepancyCard discrepancy={d} index={i} />
                        {/* Standardized Impact Section Spacing - enforced in DiscrepancyCard but wrapper helps if needed */}
                    </div>
                ))}
            </div>

            {remaining > 0 && !showAll && (
                <button
                    onClick={() => setShowAll(true)}
                    className="mt-6 w-full py-3 bg-white border border-red-100 shadow-sm rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
                >
                    View {remaining} More Discrepancies
                </button>
            )}

            {showAll && discrepancies.length > 3 && (
                <button
                    onClick={() => setShowAll(false)}
                    className="mt-6 w-full py-3 bg-transparent border border-transparent text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                    Show Less
                </button>
            )}
        </div>
    );
}
import { formatCategoryLabel } from '@/lib/categoryFormatter';

interface ComparisonSectionProps {
    product: Asset;
    audit: AuditResult | null | undefined;
    className?: string; // For h-full alignment
}

export function ComparisonHeader({ product, audit, className }: ComparisonSectionProps) {
    if (!audit) return <div className={className} />;
    const s4 = audit.stages?.stage_4?.data || {};
    const truthIndex = s4.truth_index ?? audit.truth_index ?? null;

    return (
        <div className={`bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm flex flex-col justify-between ${className}`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">
                        {product.brand} <span className="text-slate-300">—</span> {formatCategoryLabel(product.category)}
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                        {product.model_name}
                    </h2>
                </div>
                {truthIndex !== null && (
                    <div className="text-right">
                        <div className={`text-4xl font-black ${(truthIndex || 0) >= 90 ? 'text-emerald-500' : 'text-blue-600'} leading-none`}>
                            {truthIndex}%
                        </div>
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Truth Index</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ComparisonMetrics({ product, audit, className }: ComparisonSectionProps) {
    if (!audit) return <div className={className} />;
    const s4 = audit.stages?.stage_4?.data || {};
    const metricBars = s4.metric_bars || [];

    if (metricBars.length === 0) return <div className={className} />; // Placeholder for alignment

    return (
        <div className={`bg-slate-50/50 p-6 rounded-xl border border-slate-100 flex flex-col ${className}`}>
            <div className="min-h-[20px] mb-4">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Performance Metrics</h4>
            </div>
            <div className="flex-1">
                <MetricBars metrics={metricBars} />
            </div>
        </div>
    );
}

export function ComparisonSpecs({ product, audit, className }: ComparisonSectionProps) {
    if (!audit) return <div className={className} />;
    const specs = audit.claim_profile || [];

    if (specs.length === 0) return <div className={className} />;

    return (
        <div className={`bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm flex flex-col ${className}`}>
            <div className="flex items-center gap-2 mb-6 min-h-[24px]">
                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Stage 1</span>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Manufacturer Specs</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                {specs.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start border-b border-slate-50 pb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide truncate pr-2">{item.label}</span>
                        <span className="text-sm font-black text-slate-900 text-right">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ComparisonInsights({ product, audit, className }: ComparisonSectionProps) {
    if (!audit) return <div className={className} />;
    const s4 = audit.stages?.stage_4?.data || {};
    const strengths = s4.strengths || [];
    const limitations = s4.limitations || [];

    if (strengths.length === 0 && limitations.length === 0) return <div className={className} />;

    return (
        <div className={`grid grid-cols-1 gap-6 h-full ${className}`}>
            {strengths.length > 0 && (
                <div className="bg-emerald-50/20 border border-emerald-100 p-6 rounded-[1.5rem] flex flex-col h-full">
                    <div className="min-h-[24px] mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Where it Delivers
                        </h4>
                    </div>
                    <ul className="space-y-3 flex-1">
                        {strengths.slice(0, 4).map((s: string, i: number) => (
                            <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2 line-clamp-2">
                                <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">✓</span>
                                {s}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {limitations.length > 0 && (
                <div className="bg-red-50/20 border border-red-100 p-6 rounded-[1.5rem] flex flex-col h-full">
                    <div className="min-h-[24px] mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Limitations
                        </h4>
                    </div>
                    <ul className="space-y-3 flex-1">
                        {limitations.slice(0, 4).map((l: string, i: number) => (
                            <li key={i} className="text-xs font-medium text-slate-700 flex items-start gap-2 line-clamp-2">
                                <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">✕</span>
                                {l}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export function ComparisonEvidence({ product, audit, className }: ComparisonSectionProps) {
    if (!audit) return <div className={className} />;
    const s2 = audit.stages?.stage_2?.data || {};
    const mostPraised = (s2.most_praised || []).map((p: any) => typeof p === 'string' ? { text: p } : p);
    const mostReportedIssues = (s2.most_reported_issues || []).map((i: any) => typeof i === 'string' ? { text: i } : i);

    if (mostPraised.length === 0 && mostReportedIssues.length === 0) return <div className={className} />;

    return (
        <div className={`bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm flex flex-col ${className}`}>
            <div className="flex items-center gap-2 mb-6 min-h-[24px]">
                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Stage 2</span>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Evidence Summary</h4>
            </div>

            <div className="space-y-6 flex-1">
                {mostPraised.length > 0 && (
                    <div>
                        <h5 className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Consistently Praised</h5>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 marker:text-emerald-300">
                            {mostPraised.slice(0, 3).map((p: any, i: number) => (
                                <li key={i} className="line-clamp-2">{p.text}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {mostReportedIssues.length > 0 && (
                    <div>
                        <h5 className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-2">Reported Issues</h5>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 marker:text-amber-300">
                            {mostReportedIssues.slice(0, 3).map((p: any, i: number) => (
                                <li key={i} className="line-clamp-2">{p.text}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}


