"use client";

import { useState } from 'react';
import { Discrepancy } from '@/types';

import { formatLabel } from '@/lib/formatters';

interface DiscrepancyCardProps {
    discrepancy: any; // Explicitly any to handle loose schema
    index: number;
}

/**
 * Render helper - never display empty strings, quotes, or invalid values
 */
function renderSafeText(value: string | undefined | null): string {
    if (!value) return '—';

    const trimmed = value.trim();

    // Check for empty, quote-only, or whitespace-only
    if (!trimmed || trimmed === '""' || trimmed === "''" || /^["'\s]+$/.test(trimmed)) {
        return '—';
    }

    return trimmed;
}

// New Layout: Claim vs Actual (No Strikethrough)
export function DiscrepancyCard({ discrepancy, index }: DiscrepancyCardProps) {
    const [showExcerpt, setShowExcerpt] = useState(false);
    const hasNonEnglish = !!discrepancy.source_excerpt_original;

    // Use specific fields or fallback to generic ones
    const claimText = (discrepancy as any).claim || discrepancy.issue;
    const actualText = (discrepancy as any).reality || discrepancy.description;
    const impactText = (discrepancy as any).impact || discrepancy.issue;
    const severity = (discrepancy as any).severity || 'moderate';

    const safeClaim = formatLabel(renderSafeText(claimText));
    const safeActual = renderSafeText(actualText);

    return (
        <div className="bg-white border border-slate-200 border-l-4 border-l-red-400 p-5 rounded-2xl shadow-sm">
            {/* Header: Claim vs Actual Columns */}
            <div className="flex justify-between items-start gap-4 mb-4">
                <div className="w-[45%]">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Claim</span>
                    <p className="text-sm font-semibold text-slate-700 leading-tight">
                        {safeClaim}
                    </p>
                </div>
                <div className="w-[50%] text-right">
                    <span className="text-[9px] font-black uppercase text-red-500 tracking-widest block mb-1.5">Actual</span>
                    <p className="text-sm font-black text-slate-900 leading-tight">
                        {safeActual}
                    </p>
                </div>
            </div>

            {/* Divider */}
            <hr className="border-red-100 mb-4 opacity-50" />

            {/* Impact - Standardized Layout */}
            <div className="mt-4 pt-4 border-t border-neutral-200">
                <div className="flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${discrepancy.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        discrepancy.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                        {discrepancy.severity || 'Notice'}
                    </span>
                    <p className="text-xs text-slate-600 leading-normal">
                        <span className="font-bold text-slate-900 mr-1">Impact:</span>
                        {discrepancy.impact}
                    </p>
                </div>
            </div>

            {/* Non-English evidence badge and toggle */}
            {hasNonEnglish && (
                <div className="mt-3 pt-3 border-t border-red-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase tracking-wider">
                            Evidence captured (non-English)
                        </span>
                        <button
                            onClick={() => setShowExcerpt(!showExcerpt)}
                            className="text-[9px] font-bold text-red-600 hover:text-red-800 uppercase tracking-wide"
                        >
                            {showExcerpt ? '− Hide source excerpt' : '+ Show source excerpt'}
                        </button>
                    </div>

                    {/* Collapsible excerpt */}
                    {showExcerpt && (
                        <div className="bg-white/50 border border-amber-200 rounded p-3 space-y-2">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    Original Source
                                </p>
                                <p className="text-[10px] font-mono text-slate-700 leading-relaxed">
                                    {discrepancy.source_excerpt_original}
                                </p>
                            </div>

                            {discrepancy.source_excerpt_en && (
                                <div>
                                    <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">
                                        Translation
                                    </p>
                                    <p className="text-[10px] font-medium text-blue-900 leading-relaxed">
                                        {discrepancy.source_excerpt_en}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
