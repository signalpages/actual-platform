
import React from 'react';

interface AuditOverlayProps {
    status: 'scanning' | 'verified' | 'discrepancy' | 'provisional';
    label?: string;
}

export function AuditOverlay({ status, label }: AuditOverlayProps) {
    const colorMap = {
        scanning: 'bg-blue-500',
        verified: 'bg-emerald-500',
        discrepancy: 'bg-amber-500',
        provisional: 'bg-slate-400'
    };

    const pulseColor = colorMap[status];

    return (
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <span className="relative flex h-3 w-3">
                {(status === 'scanning' || status === 'discrepancy') && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColor}`}></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${pulseColor}`}></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                {label || status}
            </span>
        </div>
    );
}
