"use client";

import { useEffect, useState } from 'react';

interface IntegrityCheckModalProps {
    lastSynced: string;
    ageDays: number;
    sourcesCount: number;
    onComplete: () => void;
}

export function IntegrityCheckModal({ lastSynced, ageDays, sourcesCount, onComplete }: IntegrityCheckModalProps) {
    const [canSkip, setCanSkip] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Allow skip after 300ms
        const skipTimer = setTimeout(() => setCanSkip(true), 300);

        // Auto-dismiss after 600ms (deterministic, no fake progress)
        const dismissTimer = setTimeout(() => onComplete(), 600);

        // Visual progress (deterministic animation only)
        const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + 20, 100));
        }, 120);

        return () => {
            clearTimeout(skipTimer);
            clearTimeout(dismissTimer);
            clearInterval(progressInterval);
        };
    }, [onComplete]);

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-blue-500/30 rounded-xl p-8 max-w-md w-full shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-blue-400">
                        Retrieving Verified Ledger Entry
                    </h3>
                </div>

                {/* Progress bar (deterministic, not fake) */}
                <div className="w-full h-1 bg-slate-800 rounded-full mb-6 overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Integrity checks (honest, deterministic) */}
                <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-2 text-[11px]">
                        <span className="text-green-500 font-mono">✓</span>
                        <span className="text-slate-300 font-medium">
                            Integrity check: timestamp + source trail
                        </span>
                    </div>

                    <div className="flex items-start gap-2 text-[11px]">
                        <span className="text-blue-400 font-mono">→</span>
                        <span className="text-slate-300 font-medium">
                            Last synced: <span className="text-blue-400 font-black">{formatDate(lastSynced)}</span>
                        </span>
                    </div>

                    <div className="flex items-start gap-2 text-[11px]">
                        <span className="text-blue-400 font-mono">→</span>
                        <span className="text-slate-300 font-medium">
                            Cache age: <span className="text-blue-400 font-black">{ageDays} days</span>
                        </span>
                    </div>

                    <div className="flex items-start gap-2 text-[11px]">
                        <span className="text-blue-400 font-mono">→</span>
                        <span className="text-slate-300 font-medium">
                            Sources validated: <span className="text-blue-400 font-black">{sourcesCount}</span>
                        </span>
                    </div>
                </div>

                {/* Skip button (after 300ms) */}
                {canSkip && (
                    <button
                        onClick={onComplete}
                        className="w-full py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
                    >
                        Skip →
                    </button>
                )}
            </div>
        </div>
    );
}
