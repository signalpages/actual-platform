"use client";

import React, { useState } from "react";
import { CanonicalAuditResult } from "@/lib/auditNormalizer";
import { Asset } from "@/types";

interface AuditDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    audit: CanonicalAuditResult | null;
    product: Asset;
}

export function AuditDetailsModal({ isOpen, onClose, audit, product }: AuditDetailsModalProps) {
    const [showRawSnapshot, setShowRawSnapshot] = useState(false);

    if (!isOpen || !audit) return null;

    // Stage 1 Data Extraction
    const stage1 = audit.stages?.stage_1;
    const s1Data = stage1?.data || {};

    // Coverage Metrics (Prioritize Server Side)
    const serverMapped = s1Data.mapped_count;
    const serverParsed = s1Data.parsed_count;
    const serverUnmapped = s1Data.unmapped_count;

    // Fallback Client-Side Calc (if needed, though server should populate)
    const claimItems = audit.claim_profile || [];
    const parsedCount = serverParsed ?? claimItems.length;
    // We can't easily re-compute unmapped here without rules, so rely on server or 0
    const unmappedCount = serverUnmapped ?? 0;
    const mappedCount = serverMapped ?? (parsedCount - unmappedCount);

    // Unmapped Items (Need to pass them? Or re-derive?
    // Stage 1 data usually doesn't store the *list* of unmapped items separately in DB, just counts.
    // The previous AuditResults component computed them on the fly using CATEGORY_RULES.
    // We should probably move that logic here or accept it as prop.
    // For now, let's just show the full snapshot and maybe highlight unmapped if we can,
    // but simplified: Just show what we have.
    // Actually, `s1Data` might have `compose_meta`?
    // `app/api/audit/worker/route.ts` saves `compose_meta` to stage state.
    const composeMeta = s1Data.compose_meta;
    const unmappedKeys = composeMeta?.unmappedKeys || [];

    // Filter claim profile for unmapped if we have the keys
    const unmappedItems = unmappedKeys.length > 0
        ? claimItems.filter(c => unmappedKeys.includes(c.label))
        : []; // If we don't have keys, we can't easily show *just* unmapped without re-importing rules.

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 font-sans">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-20">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                            Audit Details
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            Forensic Ledger for {product.model_name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-8 space-y-8">

                    {/* Section A: Summary */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                Truth Index
                            </label>
                            <span className={`text-3xl font-black ${(audit.truth_index || 0) >= 90 ? 'text-emerald-500' :
                                (audit.truth_index || 0) >= 60 ? 'text-blue-500' : 'text-amber-500'
                                }`}>
                                {audit.truth_index ?? '--'}%
                            </span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                Last Updated
                            </label>
                            <span className="text-sm font-bold text-slate-700">
                                {stage1?.completed_at ? new Date(stage1.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                            </span>
                        </div>
                    </div>

                    {/* Section A2: Interpretation */}
                    {audit.score_interpretation && (
                        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-inner">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-2">
                                Verdict Summary
                            </label>
                            <p className="text-sm font-medium text-slate-200 leading-relaxed italic">
                                "{audit.score_interpretation}"
                            </p>
                        </div>
                    )}

                    {/* Section B: Coverage */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Data Coverage
                        </h3>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-3 border border-slate-100 rounded-lg">
                                <div className="text-xl font-black text-slate-900">{parsedCount}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Parsed</div>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg bg-emerald-50/50 border-emerald-100">
                                <div className="text-xl font-black text-emerald-600">{mappedCount}</div>
                                <div className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest">Mapped</div>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg bg-amber-50/50 border-amber-100">
                                <div className="text-xl font-black text-amber-600">{unmappedCount}</div>
                                <div className="text-[9px] font-bold text-amber-600/60 uppercase tracking-widest">Unmapped</div>
                            </div>
                        </div>
                    </div>

                    {/* Section C: Unmapped Fields (Interactive) */}
                    {unmappedItems.length > 0 && (
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Unmapped Fields ({unmappedItems.length})
                            </h3>
                            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 max-h-40 overflow-y-auto">
                                <div className="grid grid-cols-1 gap-2">
                                    {unmappedItems.map((item, i) => (
                                        <div key={i} className="flex justify-between text-xs border-b border-amber-100/50 last:border-0 py-1">
                                            <span className="font-medium text-amber-900/70">{item.label}</span>
                                            <span className="font-mono text-amber-900">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section D: Sources */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            Evidence Sources
                        </h3>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-700">Official Specs (Manufacturer)</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        Source: {product.manual_url ? 'PDF Manual / Official Listing' : 'Cached Product Snapshot'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                                        ID: {audit.assetId.slice(0, 8)}...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section E: Debug Raw Data */}
                    <div className="border-t border-slate-100 pt-6">
                        <button
                            onClick={() => setShowRawSnapshot(!showRawSnapshot)}
                            className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-widest"
                        >
                            <span>Raw Snapshot Data (Debug)</span>
                            <span>{showRawSnapshot ? '−' : '+'}</span>
                        </button>

                        {showRawSnapshot && (
                            <div className="mt-4 bg-slate-900 rounded-xl p-4 overflow-x-auto text-slate-300 font-mono text-[10px]">
                                <pre>{JSON.stringify(claimItems, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
