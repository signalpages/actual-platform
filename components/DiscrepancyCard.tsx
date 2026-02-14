"use client";

import { useState } from 'react';
import { Discrepancy } from '@/types';

interface DiscrepancyCardProps {
    discrepancy: Discrepancy;
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

export function DiscrepancyCard({ discrepancy, index }: DiscrepancyCardProps) {
    const [showExcerpt, setShowExcerpt] = useState(false);
    const hasNonEnglish = !!discrepancy.source_excerpt_original;

    // Safe rendering - never show empty/quoted strings
    // Support both old format (issue/description) and new format (claim/reality)
    const issueText = discrepancy.issue || (discrepancy as any).claim;
    const descText = discrepancy.description || (discrepancy as any).reality;

    const safeIssue = renderSafeText(issueText);
    const safeDescription = renderSafeText(descText);

    return (
        <div className="bg-red-50/30 border border-red-50 p-4 rounded-xl shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 min-w-0">
                    {/* Severity Badge */}
                    {(discrepancy as any).severity && (
                        <div className="inline-flex items-center gap-1.5 mb-2">
                            <span className={`
                                text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded
                                ${(discrepancy as any).severity === 'severe' ? 'bg-red-600 text-white' : ''}
                                ${(discrepancy as any).severity === 'moderate' ? 'bg-amber-500 text-white' : ''}
                                ${(discrepancy as any).severity === 'minor' ? 'bg-yellow-400 text-slate-900' : ''}
                            `}>
                                {(discrepancy as any).severity === 'severe' && '🔴 Severe'}
                                {(discrepancy as any).severity === 'moderate' && '🟠 Moderate'}
                                {(discrepancy as any).severity === 'minor' && '🟡 Minor'}
                            </span>
                        </div>
                    )}
                    <p className="text-xs font-black text-red-900 mb-1 leading-tight">
                        {safeIssue}
                    </p>
                    <p className="text-[11px] font-medium text-red-800/70 leading-relaxed italic">
                        "{safeDescription}"
                    </p>
                </div>

                {(discrepancy as any).impact && (
                    <div className="w-full md:w-1/3 flex-shrink-0">
                        <div className="bg-red-100/50 px-3 py-2 rounded-lg h-full">
                            <span className="text-[9px] font-black text-red-800 uppercase tracking-widest block mb-1">
                                Impact
                            </span>
                            <p className="text-[10px] text-red-700 font-medium leading-relaxed">
                                {((discrepancy as any).impact || '').trim().replace(/\.?$/, '.')}
                            </p>
                        </div>
                    </div>
                )}
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
