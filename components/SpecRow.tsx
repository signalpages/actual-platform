"use strict";
import React, { useState } from 'react';
import { ProductAudit } from '@/types';
import { ProofModal } from './ProofModal';

interface SpecRowProps {
    label: string;
    claimedValue: string | number;
    auditEntry?: ProductAudit;
    delayIndex?: number; // For staggered animation
}

export function SpecRow({ label, claimedValue, auditEntry, delayIndex = 0 }: SpecRowProps) {
    const [showProof, setShowProof] = useState(false);

    // States
    const isAudited = !!auditEntry;
    const isMatch = auditEntry?.status === 'match';
    const isMismatch = auditEntry?.status === 'mismatch';

    const statusColor = isMatch
        ? "bg-emerald-500/10 border-emerald-500/20"
        : isMismatch
            ? "bg-amber-500/10 border-amber-500/20"
            : "border-transparent";

    return (
        <>
            <div
                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-500 ${statusColor} group relative overflow-hidden`}
                style={{ animationDelay: `${delayIndex * 50}ms` }}
            >
                <div className="flex items-center gap-3 relative z-10">
                    {/* Status Indicator */}
                    <div className="w-5 flex justify-center">
                        {!isAudited ? (
                            <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse" title="Scanning..." />
                        ) : isMatch ? (
                            <span className="text-emerald-500 text-sm animate-in zoom-in spin-in-90 duration-300">✓</span>
                        ) : isMismatch ? (
                            <span className="text-amber-500 text-sm animate-in zoom-in shake duration-300">⚠️</span>
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-200" />
                        )}
                    </div>

                    <span className={`text-xs font-medium uppercase tracking-wide ${isMismatch ? 'text-slate-500' : 'text-slate-400'}`}>
                        {label}
                    </span>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    {isMismatch ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 line-through decoration-slate-300 decoration-2">
                                {claimedValue}
                            </span>
                            <span className="text-sm font-bold text-amber-600 animate-in fade-in slide-in-from-right-4">
                                {auditEntry!.found_value}
                            </span>
                            <button
                                onClick={() => setShowProof(true)}
                                className="w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors ml-1"
                            >
                                ?
                            </button>
                        </div>
                    ) : (
                        <span className={`text-sm font-bold ${isMatch ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {claimedValue}
                        </span>
                    )}
                </div>

                {/* Scan line effect only when pending */}
                {!isAudited && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 -skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]" />
                )}
            </div>

            <ProofModal
                isOpen={showProof}
                onClose={() => setShowProof(false)}
                audit={auditEntry || null}
            />
        </>
    );
}
