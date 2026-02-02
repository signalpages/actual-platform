/**
 * StageCard component for progressive audit loading
 * Shows individual stage status: locked, loading, complete, or error
 */

import React from 'react';
import { StageStatus } from '@/types';

interface StageCardProps {
    stageNumber: number;
    title: string;
    description: string;
    status: StageStatus;
    data?: any;
    error?: string;
    estimatedTime?: string;
}

export function StageCard({
    stageNumber,
    title,
    description,
    status,
    data,
    error,
    estimatedTime
}: StageCardProps) {

    // Locked state (pending)
    if (status === 'pending') {
        return (
            <div className="bg-slate-100 border-2 border-slate-200 rounded-[1.5rem] p-6 mb-4 opacity-60">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
                        <span className="text-sm font-black text-slate-500">🔒</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
                            Stage {stageNumber}: {title}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">Waiting for earlier stages...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state (running)
    if (status === 'running') {
        return (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-[1.5rem] p-6 mb-4 relative overflow-hidden">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 animate-pulse opacity-50"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center animate-spin">
                            <span className="text-sm">⏳</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-blue-900">
                                Stage {stageNumber}: {title}
                            </h3>
                            <p className="text-xs text-blue-600 font-medium">{description}</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 bg-blue-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>

                    {estimatedTime && (
                        <p className="text-[10px] text-blue-500 font-black uppercase mt-2 tracking-widest">
                            Est: {estimatedTime}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Error state
    if (status === 'error') {
        return (
            <div className="bg-red-50 border-2 border-red-200 rounded-[1.5rem] p-6 mb-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-sm">❌</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-red-900">
                            Stage {stageNumber}: {title}
                        </h3>
                        <p className="text-xs text-red-600 font-medium">{error || 'Failed to complete'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800 px-3 py-1 bg-red-100 rounded-lg">
                        Skip
                    </button>
                    <button className="text-[10px] font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Success state (done)
    if (status === 'done') {
        return (
            <div className="bg-white border-2 border-emerald-200 rounded-[1.5rem] p-6 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                            <span className="text-sm">✅</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                                Stage {stageNumber}: {title}
                            </h3>
                            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">
                                Completed
                            </p>
                        </div>
                    </div>
                </div>

                {/* Render stage-specific data */}
                {data && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        {renderStageData(stageNumber, data)}
                    </div>
                )}
            </div>
        );
    }

    return null;
}

// Helper to render stage-specific data
function renderStageData(stageNumber: number, data: any) {
    switch (stageNumber) {
        case 1: // Claim Profile
            return (
                <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Manufacturer Claims</h4>
                    {data.claim_profile?.slice(0, 5).map((claim: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                            <span className="font-medium text-slate-600">{claim.label}:</span>
                            <span className="font-black text-slate-900">{claim.value}</span>
                        </div>
                    ))}
                </div>
            );

        case 2: // Independent Signal
            return (
                <div className="space-y-3">
                    {data.independent_signal?.most_praised?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black uppercase text-emerald-600 mb-2">Most Praised</h4>
                            <ul className="space-y-1">
                                {data.independent_signal.most_praised.slice(0, 3).map((item: any, i: number) => (
                                    <li key={i} className="text-xs text-slate-700">
                                        • {item.trait} {item.frequency && `(${item.frequency} mentions)`}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {data.independent_signal?.most_reported_issues?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black uppercase text-red-600 mb-2">Common Issues</h4>
                            <ul className="space-y-1">
                                {data.independent_signal.most_reported_issues.slice(0, 3).map((item: any, i: number) => (
                                    <li key={i} className="text-xs text-slate-700">
                                        • {item.issue} {item.frequency && `(${item.frequency} reports)`}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );

        case 3: // Forensic Discrepancies
            return data.red_flags?.length > 0 ? (
                <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-red-600 mb-2">Discrepancies Found</h4>
                    {data.red_flags.map((flag: any, i: number) => (
                        <div key={i} className="bg-red-50 p-3 rounded-lg text-xs">
                            <div className="font-bold text-red-900 mb-1">{flag.category}</div>
                            <div className="text-slate-700">
                                <span className="font-medium">Claim:</span> {flag.claim}
                            </div>
                            <div className="text-slate-700">
                                <span className="font-medium">Reality:</span> {flag.reality}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-emerald-600 font-medium">No major discrepancies found.</p>
            );

        case 4: // Verdict
            return (
                <div className="text-center space-y-3">
                    <div>
                        <div className="text-4xl font-black text-blue-600 mb-1">
                            {data.truth_index}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Truth Index
                        </div>
                    </div>
                    <div className={`inline-block px-4 py-2 rounded-full text-xs font-black uppercase ${data.verification_status === 'verified'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {data.verification_status}
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-3">
                        {data.verdict}
                    </p>
                </div>
            );

        default:
            return null;
    }
}
