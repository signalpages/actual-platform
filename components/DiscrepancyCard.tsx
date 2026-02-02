"use client";

import { useState } from 'react';
import { Discrepancy } from '@/types';

interface DiscrepancyCardProps {
    discrepancy: Discrepancy;
    index: number;
}

export function DiscrepancyCard({ discrepancy, index }: DiscrepancyCardProps) {
    const [showExcerpt, setShowExcerpt] = useState(false);
    const hasNonEnglish = !!discrepancy.source_excerpt_original;

    return (
        <div className="bg-red-50/30 border border-red-50 p-4 rounded-xl shadow-sm">
            {/* Main content */}
            <p className="text-xs font-black text-red-900 mb-1 leading-tight">
                {discrepancy.issue}
            </p>
            <p className="text-[11px] font-medium text-red-800/70 leading-relaxed italic">
                "{discrepancy.description}"
            </p>

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
