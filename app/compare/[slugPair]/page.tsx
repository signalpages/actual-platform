"use client";

export const runtime = "edge";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAssetBySlug, runAudit } from '@/lib/dataBridge.client';
import { Asset, AuditResult, AuditItem } from '@/types';
import { AssetSelector } from '@/components/ComparisonPicker';
import { formatCategoryLabel } from '@/lib/categoryFormatter';

type AuditState = 'idle' | 'running' | 'ready' | 'error';

// Authoritative Canonical Schema for row alignment
const CANONICAL_CLAIM_PROFILE = [
    'Storage Capacity',
    'Continuous AC Output',
    'Peak Surge Output',
    'Cell Chemistry',
    'Cycle Life Rating',
    'AC Charging Speed',
    'Solar Input (Max)',
    'UPS/EPS Protocol',
    'Expansion Capacity',
    'Thermal Operating Range'
];

const CANONICAL_REALITY_LEDGER = [
    'Measured Discharge Wh',
    'Observed Efficiency %',
    'Stable Output Threshold',
    'Thermal Cut-off Point',
    'Software Reserve Behavior',
    'Measured Noise Level (dB)'
];

export default function Comparison() {
    const params = useParams();
    const slugPair = Array.isArray(params.slugPair) ? params.slugPair[0] : params.slugPair;

    const router = useRouter();
    const [assets, setAssets] = useState<[Asset | null, Asset | null]>([null, null]);
    const [audits, setAudits] = useState<[AuditResult | null, AuditResult | null]>([null, null]);
    const [auditStatuses, setAuditStatuses] = useState<[AuditState, AuditState]>(['idle', 'idle']);
    const [loading, setLoading] = useState(true);

    const scanInitiated = useRef<Record<string, boolean>>({});

    const handleDeepScan = useCallback(async (index: 0 | 1, targetAsset: Asset) => {
        if (auditStatuses[index] === 'running') return;
        setAuditStatuses(prev => { const n = [...prev] as [AuditState, AuditState]; n[index] = 'running'; return n; });

        try {
            const result = await runAudit({ slug: targetAsset.slug });
            setAudits(prev => { const n = [...prev] as [AuditResult | null, AuditResult | null]; n[index] = result; return n; });
            setAuditStatuses(prev => { const n = [...prev] as [AuditState, AuditState]; n[index] = 'ready'; return n; });
        } catch (e) {
            setAuditStatuses(prev => { const n = [...prev] as [AuditState, AuditState]; n[index] = 'error'; return n; });
        }
    }, [auditStatuses]);

    useEffect(() => {
        const load = async () => {
            if (!slugPair) return;
            const slugs = slugPair.split('-vs-');
            if (slugs.length !== 2) return;

            setLoading(true);
            const [p1, p2] = await Promise.all([getAssetBySlug(slugs[0]), getAssetBySlug(slugs[1])]);
            setAssets([p1, p2]);
            setLoading(false);
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

    // Check for category mismatch
    const [assetA, assetB] = assets;
    const categoryMismatch = assetA && assetB && assetA.category !== assetB.category;

    if (categoryMismatch) {
        return (
            <div className="max-w-5xl mx-auto px-6 py-20">
                <div className="bg-white border-2 border-red-200 rounded-[2rem] p-12 text-center shadow-xl">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-4">
                        Category Mismatch
                    </h2>
                    <p className="text-sm text-slate-600 font-medium mb-6 max-w-md mx-auto">
                        These products belong to different equipment categories and cannot be compared directly.
                    </p>
                    <div className="flex items-center justify-center gap-6 mb-8">
                        <div className="bg-slate-50 px-6 py-3 rounded-xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {assetA.brand} {assetA.model_name}
                            </p>
                            <p className="text-xs font-bold text-blue-600">
                                {formatCategoryLabel(assetA.category)}
                            </p>
                        </div>
                        <span className="text-slate-300 font-black">≠</span>
                        <div className="bg-slate-50 px-6 py-3 rounded-xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {assetB.brand} {assetB.model_name}
                            </p>
                            <p className="text-xs font-bold text-blue-600">
                                {formatCategoryLabel(assetB.category)}
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/specs"
                        className="inline-block bg-slate-900 text-white px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                    >
                        ← Back to Products
                    </Link>
                </div>
            </div>
        );
    }

    // Helper to check if a value exists for a canonical key
    const resolveValue = (canonicalLabel: string, source: AuditItem[] | undefined) => {
        if (!source) return null;
        const match = source.find(item => {
            const label = item.label.toLowerCase();
            const canonical = canonicalLabel.toLowerCase();
            return label.includes(canonical) || canonical.includes(label);
        });
        return match?.value || null;
    };

    // Calculate union of keys that have data on either side
    const getVisibleKeys = (schema: string[], sourceA?: AuditItem[], sourceB?: AuditItem[]) => {
        return schema.filter(label => {
            const valA = resolveValue(label, sourceA);
            const valB = resolveValue(label, sourceB);
            return valA !== null || valB !== null;
        });
    };

    const visibleClaims = getVisibleKeys(CANONICAL_CLAIM_PROFILE, audits[0]?.claim_profile, audits[1]?.claim_profile);
    const visibleLedger = getVisibleKeys(CANONICAL_REALITY_LEDGER, audits[0]?.reality_ledger, audits[1]?.reality_ledger);

    const getDivergences = () => {
        if (auditStatuses[0] !== 'ready' || auditStatuses[1] !== 'ready' || !audits[0] || !audits[1]) return [];

        const divergences: string[] = [];
        const realityA = audits[0].reality_ledger;
        const realityB = audits[1].reality_ledger;

        const findVal = (ledger: AuditItem[], label: string) =>
            ledger.find(r => r.label.toLowerCase().includes(label.toLowerCase()))?.value;

        const capA = findVal(realityA, 'capacity') || findVal(realityA, 'wh');
        const capB = findVal(realityB, 'capacity') || findVal(realityB, 'wh');
        if (capA && capB && capA !== capB) {
            divergences.push("Observed storage capacity varies between units under identical load profiles.");
        }

        const outA = findVal(realityA, 'output') || findVal(realityA, 'watt');
        const outB = findVal(realityB, 'output') || findVal(realityB, 'watt');
        if (outA && outB && outA !== outB) {
            divergences.push("Sustained power output thresholds differ under thermal stress testing.");
        }

        if (divergences.length === 0 && audits[0].truth_index !== audits[1].truth_index) {
            divergences.push("Clinical truth index variance indicates differing levels of claim alignment.");
            divergences.push("Forensic signatures show divergent thermal management and efficiency profiles.");
        }

        return divergences;
    };

    if (loading) return (
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Comparison Matrix...</p>
        </div>
    );

    const divergences = getDivergences();

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative mb-12 items-start">
                <div className="hidden lg:flex absolute left-1/2 top-32 -translate-x-1/2 w-12 h-12 bg-slate-900 text-white rounded-full items-center justify-center font-black text-xs z-20 shadow-xl border-4 border-[#f8fafc]">VS</div>

                {[0, 1].map(idx => (
                    <div key={idx} className="flex flex-col h-full">
                        {assets[idx] ? (
                            <AssetColumn
                                asset={assets[idx]!}
                                audit={audits[idx]}
                                status={auditStatuses[idx]}
                                onRetry={() => handleDeepScan(idx as 0 | 1, assets[idx]!)}
                                visibleClaims={visibleClaims}
                                visibleLedger={visibleLedger}
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

            {divergences.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 md:p-14 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-8 flex items-center gap-3">
                        <span className="w-4 h-[1.5px] bg-blue-600"></span>
                        Key Observed Divergences
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {divergences.map((div, i) => (
                            <div key={i} className="flex items-start gap-4">
                                <span className="text-blue-200 font-black text-lg">/</span>
                                <p className="text-sm font-medium text-slate-600 leading-relaxed italic">{div}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

interface AssetColumnProps {
    asset: Asset;
    audit: AuditResult | null;
    status: AuditState;
    onRetry: () => void;
    visibleClaims: string[];
    visibleLedger: string[];
}

const AssetColumn: React.FC<AssetColumnProps> = ({ asset, audit, status, onRetry, visibleClaims, visibleLedger }) => {
    const isReady = status === 'ready';
    const isRunning = status === 'running';
    const isError = status === 'error';

    const isVerifiedAudit = isReady && !!(audit?.truth_index);
    const isProvisional = asset.verification_status === 'provisional';

    const truthColor = isVerifiedAudit ? ((audit?.truth_index || 0) >= 90 ? 'text-emerald-500' : 'text-blue-600') : 'text-slate-200';

    let auditStatusLabel = "Verified Ledger Entry";
    if (isRunning) auditStatusLabel = "Forensic extraction active";
    else if (isProvisional) auditStatusLabel = "Provisional Synthesis Required";
    else if (!isVerifiedAudit) auditStatusLabel = "Verified (Pending Full Audit)";

    const resolveValueLocal = (canonicalLabel: string, source: AuditItem[] | undefined) => {
        if (!source) return null;
        const match = source.find(item => {
            const label = item.label.toLowerCase();
            const canonical = canonicalLabel.toLowerCase();
            return label.includes(canonical) || canonical.includes(label);
        });
        return match?.value || null;
    };

    return (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col h-full transition-all">
            {/* Audit Header */}
            <div className="p-10 border-b border-slate-100">
                <div className="flex flex-col gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600">
                            {asset.brand} <span className="text-slate-300">—</span> {formatCategoryLabel(asset.category)}
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] py-2">
                            {asset.model_name}
                        </h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            {auditStatusLabel}
                        </p>
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <div className={`text-6xl font-black ${truthColor} leading-none`}>
                                {isVerifiedAudit ? `${audit?.truth_index}%` : '--'}
                            </div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">Truth Index</p>
                        </div>
                        {isError && (
                            <button onClick={onRetry} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Retry</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Audit Body */}
            <div className="flex-grow">
                {isRunning ? (
                    <div className="p-12 flex flex-col items-center justify-center h-full text-center min-h-[400px]">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Consulting Forensic Grounds...</p>
                    </div>
                ) : isReady ? (
                    <>
                        {/* CLAIM PROFILE */}
                        {visibleClaims.length > 0 && (
                            <div className="p-10 border-b border-slate-50">
                                <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-10 flex items-center gap-3">
                                    <span className="w-4 h-[1.5px] bg-blue-600"></span> CLAIM PROFILE
                                </h3>
                                <div className="space-y-10">
                                    {visibleClaims.map((label) => {
                                        const val = resolveValueLocal(label, audit?.claim_profile);
                                        return (
                                            <div key={label} className="min-h-[44px]">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
                                                {val ? (
                                                    <p className="text-sm font-black text-slate-900 leading-tight">{val}</p>
                                                ) : (
                                                    <p className="text-xs font-medium text-slate-300 italic">Not publicly specified</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* REALITY LEDGER */}
                        {visibleLedger.length > 0 && (
                            <div className="p-10 bg-slate-50/20 border-b border-slate-50">
                                <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-10 flex items-center gap-3">
                                    <span className="w-4 h-[1.5px] bg-blue-600"></span> REALITY LEDGER
                                </h3>
                                <div className="space-y-10">
                                    {visibleLedger.map((label) => {
                                        const val = resolveValueLocal(label, audit?.reality_ledger);
                                        return (
                                            <div key={label} className="min-h-[44px]">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
                                                {val ? (
                                                    <p className="text-sm font-black text-blue-800 leading-tight">{val}</p>
                                                ) : (
                                                    <p className="text-xs font-medium text-slate-300 italic">Data point unresolved</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* FORENSIC DISCREPANCIES */}
                        {audit?.discrepancies?.length ? (
                            <div className="p-10 border-t border-red-50">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center text-red-600 font-black text-[10px]">!</div>
                                    <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest">FORENSIC DISCREPANCIES</h3>
                                </div>
                                <div className="space-y-4">
                                    {audit.discrepancies.map((d, i) => (
                                        <div key={i} className="bg-red-50/30 border border-red-50 p-4 rounded-xl shadow-sm">
                                            <p className="text-xs font-black text-red-900 mb-1 leading-tight">{d.issue}</p>
                                            <p className="text-[11px] font-medium text-red-800/70 leading-relaxed italic">"{d.description}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div className="p-12 flex flex-col items-center justify-center h-full text-center text-slate-200 min-h-[500px]">
                        <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Synthesis</p>
                    </div>
                )}
            </div>
        </div>
    );
};
