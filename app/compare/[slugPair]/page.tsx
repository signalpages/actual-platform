// app/compare/[slugPair]/page.tsx
"use client";

export const runtime = "edge";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAssetBySlug, runAudit } from '@/lib/dataBridge.client';
import { Asset, AuditResult } from '@/types';
import { AssetSelector } from '@/components/ComparisonPicker';
import { formatCategoryLabel } from '@/lib/categoryFormatter';
import { normalizeAuditResult } from '@/lib/auditNormalizer';
import { FullAuditPanel } from '@/components/FullAuditPanel';
import { DecisionSummary } from '@/components/DecisionSummary';
import { deriveVerdict, VerdictOutput } from '@/lib/compare/deriveVerdict';

type AuditState = 'idle' | 'running' | 'ready' | 'error';

// Comparison State Machine
// READY: Both sides are fully audited (Stage 3+4) and verdict is derived.
// PARTIAL: One or both are pending/running.
// FAILED: One or both failed.
type ComparisonStatus = 'READY' | 'PARTIAL' | 'FAILED';

export default function Comparison() {
    const params = useParams();
    const slugPair = Array.isArray(params.slugPair) ? params.slugPair[0] : params.slugPair;

    const router = useRouter();
    const [assets, setAssets] = useState<[Asset | null, Asset | null]>([null, null]);
    const [audits, setAudits] = useState<[AuditResult | null, AuditResult | null]>([null, null]);
    const [auditStatuses, setAuditStatuses] = useState<[AuditState, AuditState]>(['idle', 'idle']);

    // Explicit error state for UI feedback
    const [errors, setErrors] = useState<[string | null, string | null]>([null, null]);

    const scanInitiated = useRef<Record<string, boolean>>({});

    const handleDeepScan = useCallback(async (index: 0 | 1, targetAsset: Asset) => {
        if (auditStatuses[index] === 'running') return;

        // Reset error state on retry
        setErrors(prev => { const n = [...prev] as [string | null, string | null]; n[index] = null; return n; });
        setAuditStatuses(prev => { const n = [...prev] as [AuditState, AuditState]; n[index] = 'running'; return n; });

        try {
            const result = await runAudit({ slug: targetAsset.slug });
            setAudits(prev => { const n = [...prev] as [AuditResult | null, AuditResult | null]; n[index] = result; return n; });

            // Map API status to local state
            const info = result.analysis;
            if (info.status === 'failed') throw new Error(info.error?.message || 'Audit failed');

            setAuditStatuses(prev => { const n = [...prev] as [AuditState, AuditState]; n[index] = 'ready'; return n; });
        } catch (e: any) {
            console.error(`Audit failed for ${targetAsset.slug}:`, e);
            setErrors(prev => { const n = [...prev] as [string | null, string | null]; n[index] = e.message || 'Unknown error'; return n; });
            setAuditStatuses(prev => { const n = [...prev] as [AuditState, AuditState]; n[index] = 'error'; return n; });
        }
    }, [auditStatuses]);

    useEffect(() => {
        const load = async () => {
            if (!slugPair) return;
            const slugs = slugPair.split('-vs-');
            if (slugs.length !== 2) return;

            const [p1, p2] = await Promise.all([getAssetBySlug(slugs[0]), getAssetBySlug(slugs[1])]);
            setAssets([p1, p2]);
        };
        load();
    }, [slugPair]);

    useEffect(() => {
        assets.forEach((a, i) => {
            if (a && !scanInitiated.current[a.slug] && auditStatuses[i] !== 'running') {
                scanInitiated.current[a.slug] = true;
                handleDeepScan(i as 0 | 1, a);
            }
        });
    }, [assets, auditStatuses, handleDeepScan]);

    const handleReplacement = (index: 0 | 1, newAsset: Asset) => {
        if (!slugPair) return;
        const slugs = slugPair.split('-vs-');
        slugs[index] = newAsset.slug;
        const newPair = slugs.sort().join('-vs-');
        router.push(`/compare/${newPair}`);
    };

    // Helper: effective audit generation
    const effectiveAudits = assets.map((a, i) =>
        audits[i] || (a ? normalizeAuditResult(null, a) : null)
    ) as [AuditResult | null, AuditResult | null];

    // DERIVE GLOBAL STATE & VERDICT
    // We only show the Verdict Summary if both sides are 'ready' AND have verdictReady=true (S3+S4 + TI)
    // Note: effectiveAudit structure might be provisional, so we check the `audits` state mostly.

    // Check if failed
    const isFailed = auditStatuses.some(s => s === 'error') || audits.some(a => a?.analysis?.status === 'failed');

    // Check if ready for verdict
    const leftReady = audits[0]?.analysis?.verdictReady === true;
    const rightReady = audits[1]?.analysis?.verdictReady === true;
    const isVerdictReady = leftReady && rightReady;

    let comparisonParams: { verdict: VerdictOutput | null, status: ComparisonStatus } = {
        verdict: null,
        status: isFailed ? 'FAILED' : (isVerdictReady ? 'READY' : 'PARTIAL')
    };

    // If READY, derive the verdict
    if (comparisonParams.status === 'READY' && assets[0] && assets[1] && audits[0] && audits[1]) {
        const result = deriveVerdict(
            { id: assets[0].id, model_name: assets[0].model_name, audit: audits[0]! },
            { id: assets[1].id, model_name: assets[1].model_name, audit: audits[1]! }
        );

        if (result.ok) {
            comparisonParams.verdict = result.verdict;
        } else {
            console.warn("Verdict derivation failed despite READY state:", result.reason);
            // Fallback to partial if logic fails safety checks
            comparisonParams.status = 'PARTIAL';
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest mb-4">Comparative Lab Node</div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">Forensic Showdown</h1>
                    <p className="text-slate-500 font-medium mt-2 tracking-tight">Standardized side-by-side audit inspection.</p>
                </div>
                <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">← Return Home</Link>
            </header>

            {/* 2-Column Full Audit Comparison Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative mb-12 items-start">
                <div className="hidden lg:flex absolute left-1/2 top-32 -translate-x-1/2 w-12 h-12 bg-slate-900 text-white rounded-full items-center justify-center font-black text-xs z-20 shadow-xl border-4 border-[#f8fafc]">VS</div>

                {[0, 1].map(idx => (
                    <div key={idx} className="flex flex-col h-full">
                        {assets[idx] ? (
                            <AssetColumn
                                asset={assets[idx]!}
                                audit={audits[idx]}
                                status={auditStatuses[idx]}
                                error={errors[idx]}
                                onRetry={() => handleDeepScan(idx as 0 | 1, assets[idx]!)}
                            />
                        ) : (
                            <div className="h-full bg-white border border-slate-200 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center shadow-sm min-h-[600px]">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Slot {idx + 1} Open for Comparison</p>
                                {assets[1 - idx] && <AssetSelector category={assets[1 - idx]!.category} onSelect={(a) => handleReplacement(idx as 0 | 1, a)} placeholder="Select comparison asset..." className="max-w-xs" />}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Verdict Summary - Gated by State Machine */}
            {comparisonParams.status === 'READY' && comparisonParams.verdict && (
                <DecisionSummary
                    verdict={comparisonParams.verdict}
                    assets={assets as [Asset, Asset]}
                    audits={effectiveAudits as [AuditResult, AuditResult]}
                />
            )}

            {comparisonParams.status === 'FAILED' && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
                    <h3 className="text-red-800 font-bold mb-2">Comparison Failed</h3>
                    <p className="text-red-600 text-sm">One or more audits failed to complete. Please retry.</p>
                </div>
            )}

            {comparisonParams.status === 'PARTIAL' && !isFailed && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center animate-pulse">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Constructing Unbiased Verdict...</p>
                </div>
            )}
        </div>
    );
}

interface AssetColumnProps {
    asset: Asset;
    audit: AuditResult | null;
    status: AuditState;
    error: string | null;
    onRetry: () => void;
}

const AssetColumn: React.FC<AssetColumnProps> = ({ asset, audit, status, error, onRetry }) => {
    // Audit is technically ready if we have data, but might be pending completion
    const isReady = (audit?.analysis?.status === 'ready') || status === 'ready';
    const isRunning = status === 'running';
    const isError = status === 'error';

    // Create effective audit for display if real audit is missing
    const effectiveAudit = audit || normalizeAuditResult(null, asset);

    const isVerifiedAudit = isReady && !!(audit?.truth_index);
    const isProvisional = asset.verification_status === 'provisional';

    let auditStatusLabel = "Verified Ledger Entry";
    if (isRunning) auditStatusLabel = "Forensic extraction active";
    else if (isProvisional) auditStatusLabel = "Provisional Synthesis Required";
    else if (!isVerifiedAudit) auditStatusLabel = "Verified (Pending Full Audit)";

    if (isRunning) {
        return (
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col h-full transition-all">
                <div className="p-10 border-b border-slate-100">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600">
                            {asset.brand} <span className="text-slate-300">—</span> {formatCategoryLabel(asset.category)}
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] py-2">
                            {asset.model_name}
                        </h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 animate-pulse">
                            {auditStatusLabel}
                        </p>
                    </div>
                </div>
                <div className="p-12 flex flex-col items-center justify-center h-full text-center min-h-[400px]">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Consulting Forensic Grounds...</p>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col h-full transition-all">
                <div className="p-10 border-b border-slate-100">
                    <h2 className="text-2xl font-black uppercase text-slate-900">{asset.model_name}</h2>
                    <button onClick={onRetry} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] uppercase font-black">Retry Scan</button>
                </div>
                <div className="p-10 text-center text-slate-400 text-xs">
                    <p className="text-red-500 font-bold mb-2">Analysis Failed</p>
                    <p>{error || "Please try again."}</p>
                </div>
            </div>
        );
    }

    // Default: Render FullAuditPanel
    return (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden h-full">
            <FullAuditPanel product={asset} audit={effectiveAudit as any} />
        </div>
    );
};
