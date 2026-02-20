import React from 'react';
import { Asset, AuditResult } from '@/types';
import { VerdictOutput } from '@/lib/compare/deriveVerdict';

interface DecisionSummaryProps {
    assets: [Asset | null, Asset | null];
    audits: [AuditResult | null, AuditResult | null];
    verdict: VerdictOutput;
}

export function DecisionSummary({ assets, audits, verdict }: DecisionSummaryProps) {
    if (!assets[0] || !assets[1] || !audits[0] || !audits[1]) return null;

    const [a1, a2] = assets as [Asset, Asset];
    const [audit1, audit2] = audits as [AuditResult, AuditResult];

    // Helper to get fit
    const getGoodFit = (audit: AuditResult) => {
        // Prefer explicit 'good_fit' from Stage 4
        if (audit.good_fit && audit.good_fit.length > 0) return audit.good_fit[0];
        // Fallback to practical impact
        if (audit.practical_impact && audit.practical_impact.length > 0) return audit.practical_impact[0];
        return "Pending classification...";
    };

    return (
        <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 md:p-14 shadow-xl mt-12 relative overflow-hidden">
            {/* Background Texture/Gradient */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="flex flex-col md:flex-row gap-12 items-start relative z-10">

                {/* HEADLINE & PROTOCOL SECTION */}
                <div className="md:w-1/3">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest mb-6">
                        Verdict Protocol Active
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 leading-tight">
                        {verdict.headline}
                    </h2>

                    {/* Decision Drivers */}
                    <div className="mb-8">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Primary Drivers</p>
                        <ul className="space-y-1">
                            {verdict.primaryDrivers.map((driver, i) => (
                                <li key={i} className="text-sm font-bold text-blue-300 flex items-center gap-2">
                                    <span className="w-1 h-1 bg-blue-500 rounded-full"></span> {driver}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                            Decision Weighting
                        </p>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                            Comparison prioritizes: Claims Accuracy (45%), Real-World Fit (35%), Operational Noise (20%).
                        </p>
                    </div>
                </div>

                {/* ASSET COLUMNS */}
                <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Asset A */}
                    <VerdictColumn
                        asset={a1}
                        audit={audit1}
                        isWinner={verdict.winnerId === a1.id}
                        summary={verdict.summaryA}
                        goodFit={getGoodFit(audit1)}
                    />

                    {/* Asset B */}
                    <VerdictColumn
                        asset={a2}
                        audit={audit2}
                        isWinner={verdict.winnerId === a2.id}
                        summary={verdict.summaryB}
                        goodFit={getGoodFit(audit2)}
                    />
                </div>
            </div>
        </div>
    );
}

function VerdictColumn({ asset, audit, isWinner, summary, goodFit }: { asset: Asset, audit: AuditResult, isWinner: boolean, summary: string, goodFit: string }) {
    const strengths = audit.strengths || [];
    const limitations = audit.limitations || [];

    return (
        <div className={`
            relative p-6 rounded-2xl flex flex-col h-full transition-all
            ${isWinner ? 'bg-blue-900/20 border-2 border-blue-500/50 shadow-lg shadow-blue-900/20' : 'bg-slate-800/50 border border-slate-700/50'}
        `}>
            {isWinner && (
                <div className="absolute -top-3 left-6 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    Top Choice
                </div>
            )}

            <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2 mt-2">
                {asset.model_name}
            </h3>

            {/* Generated Summary */}
            <p className="text-xs text-slate-300 leading-relaxed font-medium mb-6">
                {summary}
            </p>

            {/* Forensic Details */}
            <div className="space-y-6 mb-6">
                {strengths.length > 0 && (
                    <div>
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-2">Forensic Strengths</h4>
                        <ul className="space-y-2">
                            {strengths.slice(0, 3).map((w, i) => (
                                <li key={i} className="text-[11px] font-medium text-slate-300 flex items-start gap-2">
                                    <span className="text-emerald-500/50 mt-0.5">•</span> {w}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {limitations.length > 0 && (
                    <div>
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2">Tradeoffs</h4>
                        <ul className="space-y-2">
                            {limitations.slice(0, 3).map((w, i) => (
                                <li key={i} className="text-[11px] font-medium text-slate-300 flex items-start gap-2">
                                    <span className="text-amber-500/50 mt-0.5">•</span> {w}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="mt-auto pt-6 border-t border-slate-700/50">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-1">Ideally Suited For</span>
                <p className="text-xs font-bold text-white">{goodFit}</p>
            </div>
        </div>
    );
}
