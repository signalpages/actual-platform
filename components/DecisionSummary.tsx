import React from 'react';
import { Asset, AuditResult } from '@/types';

interface DecisionSummaryProps {
    assets: [Asset | null, Asset | null];
    audits: [AuditResult | null, AuditResult | null];
}

export function DecisionSummary({ assets, audits }: DecisionSummaryProps) {
    if (!assets[0] || !assets[1] || !audits[0] || !audits[1]) return null;

    // Safety check: Don't render if either audit is not ready/analyzed
    const s4_A = audits[0]?.stages?.stage_4?.data;
    const s4_B = audits[1]?.stages?.stage_4?.data;

    // Allow rendering if at least one side has data, or fail gracefully
    if (!s4_A && !s4_B) return null;

    // Helper to extract wins/strengths safely
    const getStrengths = (s4: any) => s4?.strengths || [];
    const getGoodFit = (s4: any) => s4?.good_fit?.[0] || "No specific fit identified";

    const winsA = getStrengths(s4_A);
    const winsB = getStrengths(s4_B);

    return (
        <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 md:p-14 shadow-xl mt-12">
            <div className="flex flex-col md:flex-row gap-12 items-start">
                <div className="md:w-1/3">
                    <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest mb-6">Decision Protocol</div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Verdict Summary</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Forensic analysis suggests distinct profiles for each asset. Use this summary to align with your specific prioritization framework.
                    </p>
                </div>

                <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Asset A Summary */}
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                        <h3 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-3">
                            <span className="text-blue-400">A /</span> {assets[0].model_name}
                        </h3>
                        {winsA.length > 0 ? (
                            <ul className="space-y-3 mb-6">
                                {winsA.slice(0, 3).map((w: string, i: number) => (
                                    <li key={i} className="text-xs font-medium text-slate-300 flex items-start gap-2">
                                        <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-slate-500 italic mb-6">No distinct forensic advantages detected.</p>
                        )}
                        <div className="mt-auto">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">Ideally Suited For</span>
                            <p className="text-sm font-bold text-white">{s4_A ? getGoodFit(s4_A) : "Pending Analysis..."}</p>
                        </div>
                    </div>

                    {/* Asset B Summary */}
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                        <h3 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-3">
                            <span className="text-blue-400">B /</span> {assets[1].model_name}
                        </h3>
                        {winsB.length > 0 ? (
                            <ul className="space-y-3 mb-6">
                                {winsB.slice(0, 3).map((w: string, i: number) => (
                                    <li key={i} className="text-xs font-medium text-slate-300 flex items-start gap-2">
                                        <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-slate-500 italic mb-6">No distinct forensic advantages detected.</p>
                        )}
                        <div className="mt-auto">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">Ideally Suited For</span>
                            <p className="text-sm font-bold text-white">{s4_B ? getGoodFit(s4_B) : "Pending Analysis..."}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
