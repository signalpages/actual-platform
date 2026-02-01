'use client';

import { useState, useEffect } from 'react';

export default function DiagnosticsPage() {
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function runDiagnostics() {
            try {
                // Mock diagnostics - replace with actual Supabase checks
                const result = {
                    connectionStatus: 'DEGRADED',
                    resolvedHost: 'mock',
                    configMode: 'Mock Data Fallback',
                    inventory: {
                        totalAssets: 0,
                        activeLedger: 0,
                        verifiedSpecs: 0,
                        pendingAudit: 0
                    },
                    warnings: ['Running in mock mode.']
                };

                setDiagnostics(result);
            } catch (error) {
                console.error('Diagnostics failed:', error);
            } finally {
                setLoading(false);
            }
        }

        runDiagnostics();
    }, []);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-16">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-4 text-slate-600">Running diagnostics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tightest mb-2">
                        SYSTEM DIAGNOSTICS
                    </h1>
                    <p className="text-slate-600">
                        Verification of Supabase routing and inventory integrity.
                    </p>
                </div>
                <a
                    href="/specs"
                    className="text-sm font-bold text-blue-600 hover:underline"
                >
                    EXIT LABS →
                </a>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Connection Status */}
                <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Connection Status
                        </span>
                        <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                            {diagnostics?.connectionStatus || 'UNKNOWN'}
                        </span>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">
                                Resolved Host
                            </div>
                            <div className="font-black text-lg tracking-tight">
                                {diagnostics?.resolvedHost || 'N/A'}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">
                                Config Mode
                            </div>
                            <div className="font-black text-lg tracking-tight">
                                {diagnostics?.configMode || 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory Audit */}
                <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Inventory Audit
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">
                                Total Assets
                            </div>
                            <div className="text-4xl font-black tracking-tightest">
                                {diagnostics?.inventory?.totalAssets || 0}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-blue-600 uppercase mb-1">
                                Active Ledger
                            </div>
                            <div className="text-4xl font-black tracking-tightest text-blue-600">
                                {diagnostics?.inventory?.activeLedger || 0}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-green-600 uppercase mb-1">
                                Verified Specs
                            </div>
                            <div className="text-4xl font-black tracking-tightest text-green-600">
                                {diagnostics?.inventory?.verifiedSpecs || 0}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-orange-600 uppercase mb-1">
                                Pending Audit
                            </div>
                            <div className="text-4xl font-black tracking-tightest text-orange-600">
                                {diagnostics?.inventory?.pendingAudit || 0}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Critical Warnings */}
            {diagnostics?.warnings && diagnostics.warnings.length > 0 && (
                <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-6 mb-8">
                    <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-4">
                        Critical Warnings
                    </div>
                    {diagnostics.warnings.map((warning: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-red-900">
                            <span className="font-black">!</span>
                            <span className="italic">"{warning}"</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Integrity Check */}
            <div className="bg-slate-900 text-white rounded-2xl p-8 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                    Integrity Check Cycle Completed
                </div>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        RERUN VALIDATION PROTOCOL
                    </button>
                    <a
                        href="/specs"
                        className="px-6 py-3 border-2 border-white text-white font-bold rounded-xl hover:bg-white hover:text-slate-900 transition-colors"
                    >
                        REVIEW LEDGER
                    </a>
                </div>
            </div>
        </div>
    );
}
