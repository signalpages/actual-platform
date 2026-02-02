"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { runAudit, getAssetBySlug } from '@/lib/dataBridge.client';
import { AssetSelector } from '@/components/ComparisonPicker';
import { DiscrepancyCard } from '@/components/DiscrepancyCard';
import { IntegrityCheckModal } from '@/components/IntegrityCheckModal';
import { Asset, AuditResult } from '@/types';
import SubmissionSuccess from '@/components/SubmissionSuccess';

interface ProductDetailViewProps {
    initialAsset: Asset | null;
    initialAudit?: AuditResult | null;
    slug: string;
}

export default function ProductDetailView({ initialAsset, initialAudit, slug }: ProductDetailViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const auditProcessed = useRef<string | null>(null);

    const [asset, setAsset] = useState<Asset | null>(initialAsset);
    const [audit, setAudit] = useState<AuditResult | null>(initialAudit || null);
    const [loading, setLoading] = useState(!initialAsset);
    const [isScanning, setIsScanning] = useState(false);
    const [scanLogs, setScanLogs] = useState<string[]>([]);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);
    const [showSubmissionFlow, setShowSubmissionFlow] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [showIntegrityCheck, setShowIntegrityCheck] = useState(false);
    const [cacheMetadata, setCacheMetadata] = useState<any>(null);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const shouldAutoRun = searchParams.get('autoRun') === 'true';

    // Hydrate if initial data missing (fallback)
    useEffect(() => {
        if (!asset && slug) {
            getAssetBySlug(slug).then(data => {
                setAsset(data);
                setLoading(false);
            });
        }
    }, [asset, slug]);

    // Check if initialAudit has cache metadata - show integrity check on load
    useEffect(() => {
        const auditWithCache = initialAudit as AuditResult & { cache?: any };
        if (auditWithCache?.cache?.hit) {
            setCacheMetadata(auditWithCache.cache);
            setShowIntegrityCheck(true);
            setTimeout(() => setShowIntegrityCheck(false), 600);
        }
    }, [initialAudit]);

    // Load Audit from Session Storage if not provided by server
    useEffect(() => {
        if (!audit && slug) {
            const storedAudits = JSON.parse(sessionStorage.getItem('actual_fyi_audits') || '{}');
            if (storedAudits[slug.toLowerCase()]) {
                setAudit(storedAudits[slug.toLowerCase()]);
            }
        }
    }, [audit, slug]);


    const handleDeepScan = useCallback(async (targetAsset: Asset, forceRefresh = false) => {
        if (!targetAsset || isScanning) return;
        setIsScanning(true);
        setScanLogs(["System Boot: Forensic Truth Engine V2.6", "PROTOCOL: LIVE SYNTHESIS ACTIVE..."]);

        const steps = [
            "Accessing High-Friction Search Grounds...",
            "Normalizing Owner Troubleshooting Logs...",
            "Scraping PDF manual 'Operating Thresholds'...",
            "Querying Reddit Technical Forensics...",
            "Cross-referencing FCC IDs...",
            "Synthesizing Forensic Discrepancy Ledger...",
            "CALCULATING VERDICT..."
        ];

        for (const step of steps) {
            await new Promise(r => setTimeout(r, 400));
            setScanLogs(prev => [...prev, `[CMD]: ${step}`]);
        }

        try {
            const result = await runAudit({ slug: targetAsset.slug, forceRefresh });

            // If cached result, show integrity check modal instead of processing steps
            if (result.cache?.hit) {
                setCacheMetadata(result.cache);
                setShowIntegrityCheck(true);
                // Modal will auto-dismiss and set audit
                setTimeout(() => {
                    setAudit(result);
                    setShowIntegrityCheck(false);
                    setIsScanning(false);
                }, 600);
            } else {
                // Fresh audit - show completion
                setAudit(result);
                setScanLogs(prev => [...prev, "SYNTHESIS COMPLETE."]);
                setTimeout(() => setIsScanning(false), 800);
            }

            // Cache result in session
            const current = JSON.parse(sessionStorage.getItem('actual_fyi_audits') || '{}');
            current[targetAsset.slug.toLowerCase()] = result;
            sessionStorage.setItem('actual_fyi_audits', JSON.stringify(current));

            // Show submission flow only if result is still empty after fresh analysis
            if (result.analysis.status === 'failed' || result.claim_profile.length === 0) {
                setShowSubmissionFlow(true);
            }

            setTimeout(() => setIsScanning(false), 800);
        } catch (e: any) {
            setScanLogs(prev => [...prev, "CRITICAL ERROR: Protocol rejected."]);
            setErrorMessage(e?.message || 'Audit failed. Please try again.');
            setShowErrorModal(true);
            setTimeout(() => setIsScanning(false), 1500);
        }
    }, [isScanning]);

    // Auto-Run Logic
    useEffect(() => {
        if (asset && shouldAutoRun && auditProcessed.current !== slug && !audit) {
            auditProcessed.current = slug;
            handleDeepScan(asset);
        }
    }, [asset, shouldAutoRun, slug, audit, handleDeepScan]);


    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consulting Ledger...</p>
        </div>
    );

    if (!asset) return (
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
            <div className="bg-white border border-slate-200 p-12 rounded-3xl shadow-sm">
                <h2 className="text-2xl font-black uppercase mb-4 tracking-tighter text-slate-900">Asset Not Located</h2>
                <p className="text-slate-500 mb-8 text-sm italic">The product signature "{slug}" could not be resolved in the current session.</p>
                <Link href="/" className="inline-block bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Return Home</Link>
            </div>
        </div>
    );

    const hasClaims = !!(audit?.claim_profile && audit.claim_profile.length > 0);
    const isVerifiedAudit = hasClaims && !!(audit?.truth_index);
    const isProvisional = asset.verification_status === 'provisional';
    const noDataFound = isProvisional && !isScanning && (!audit || audit.analysis.status === 'failed' || audit.claim_profile.length === 0);

    let auditStatusLabel = "Verified Ledger Entry";
    if (isScanning) auditStatusLabel = "Forensic extraction in progress";
    else if (isProvisional) auditStatusLabel = "Preliminary synthesis required";
    else if (!isVerifiedAudit) auditStatusLabel = "Verified Asset (Pending Full Audit)";

    const truthColor = isVerifiedAudit ? ((audit?.truth_index || 0) >= 90 ? 'text-emerald-500' : 'text-blue-600') : 'text-slate-300';

    return (
        <div className="max-w-5xl mx-auto px-6 py-12">
            {isScanning && (
                <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 font-mono text-emerald-400">
                    <div className="w-full max-w-xl bg-black border border-slate-700 rounded-xl p-8 shadow-2xl overflow-hidden">
                        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
                            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500">Active Forensic Synthesis</span>
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        </div>
                        <div className="h-60 overflow-y-auto space-y-1 text-[11px]">
                            {scanLogs.map((log, i) => <p key={i}> {log}</p>)}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden">
                <div className="p-10 md:p-14 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                        <div className="space-y-1 flex-grow">
                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-blue-600">
                                {asset.brand} <span className="text-slate-300">—</span> {asset.category.replace(/_/g, ' ')}
                            </div>
                            <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none py-2">{asset.model_name}</h1>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${isVerifiedAudit ? 'text-emerald-600' : 'text-slate-400'}`}>AUDIT STATUS: {auditStatusLabel}</p>
                        </div>
                        <div className="flex flex-col items-end gap-6 min-w-[220px]">
                            <div className="text-right">
                                <div className={`text-7xl font-black ${truthColor} leading-none`}>
                                    {isVerifiedAudit ? (audit?.truth_index || '--') : '--'}%
                                </div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">
                                    {isVerifiedAudit ? 'Truth Index' : 'Pending Verification'}
                                </p>
                            </div>
                            {!isVerifiedAudit && !isScanning && (
                                <button
                                    onClick={() => handleDeepScan(asset, true)}
                                    className="w-full bg-blue-600 text-white font-black uppercase px-6 py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all text-xs tracking-widest"
                                >
                                    ▶ Run Forensic Analysis
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {noDataFound ? (
                    <div className="p-10 md:p-20 bg-slate-50/50">
                        {formSubmitted ? (
                            <SubmissionSuccess variant={3} onReset={() => setFormSubmitted(false)} />
                        ) : (
                            <div className="max-w-2xl mx-auto">
                                <div className="mb-10 text-center">
                                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6 shadow-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-3">Missing Asset Protocol</h2>
                                    <p className="text-sm text-slate-500 font-medium">Our forensic engine was unable to synthesize a reliable Truth Index for this asset. Please submit official documentation or technical specs to initiate a manual audit.</p>
                                </div>

                                <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm">
                                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6">Technical Submission Form</h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Source URL (PDF Manual, Spec Sheet, or Official Listing)</label>
                                            <input type="url" placeholder="https://..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:border-blue-600 transition-all" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Observed Capacity / Output (Optional)</label>
                                            <input type="text" placeholder="e.g. 2048Wh, 1800W" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:border-blue-600 transition-all" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Notes on Discrepancies</label>
                                            <textarea placeholder="Describe any technical inaccuracies you've observed..." className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:border-blue-600 transition-all resize-none"></textarea>
                                        </div>
                                        <button
                                            onClick={() => setFormSubmitted(true)}
                                            className="w-full bg-slate-900 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                                        >
                                            Submit for Forensic Review
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            <div className="p-10 md:p-14 md:border-r border-slate-100">
                                <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-10 flex items-center gap-3"><span className="w-4 h-[1.5px] bg-blue-600"></span> CLAIM PROFILE</h3>
                                <div className="space-y-10">
                                    {hasClaims ? audit?.claim_profile.map((c, i) => (
                                        <div key={i}>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{c.label}</p>
                                            <p className="text-sm font-black text-slate-900 leading-tight">{c.value}</p>
                                        </div>
                                    )) : (
                                        <div className="py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest italic border-2 border-dashed border-slate-50 rounded-2xl flex items-center justify-center text-center px-4 leading-relaxed">
                                            Run Forensic Analysis to extract manufacturer claims.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-10 md:p-14 bg-slate-50/20">
                                <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-10 flex items-center gap-3"><span className="w-4 h-[1.5px] bg-blue-600"></span> REALITY LEDGER</h3>
                                <div className="space-y-10">
                                    {isVerifiedAudit ? audit?.reality_ledger.map((c, i) => (
                                        <div key={i}>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{c.label}</p>
                                            <p className="text-sm font-black text-blue-800 leading-tight">{c.value}</p>
                                        </div>
                                    )) : (
                                        <div className="py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest italic flex items-center justify-center text-center px-4 leading-relaxed">
                                            Synthesis required.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isVerifiedAudit && audit?.discrepancies?.length && (
                            <div className="p-10 md:p-14 border-t border-red-50 bg-white">
                                <div className="flex items-center gap-3 mb-10">
                                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-black">!</div>
                                    <h3 className="text-[11px] font-black text-red-600 uppercase tracking-widest">FORENSIC DISCREPANCIES</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {audit.discrepancies.map((d, i) => (
                                        <DiscrepancyCard key={i} discrepancy={d} index={i} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] shadow-xl text-center">
                {!isComparisonOpen ? (
                    <button onClick={() => setIsComparisonOpen(true)} className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 hover:text-white transition-colors">
                        + Add Side-by-Side Comparison Asset
                    </button>
                ) : (
                    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compare {asset.brand} with:</p>
                            <button onClick={() => setIsComparisonOpen(false)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest">Cancel</button>
                        </div>
                        <AssetSelector
                            category={asset.category}
                            onSelect={(target) => router.push(`/compare/${asset.slug}-vs-${target.slug}`)}
                            placeholder={`Search competitor ${asset.category.replace(/_/g, ' ')}...`}
                            className="text-left"
                        />
                    </div>
                )}
            </div>

            {/* Error Modal for Failed Audits */}
            {showErrorModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border-2 border-red-200 rounded-xl p-8 max-w-md w-full shadow-2xl">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 mb-3 text-center">
                            Audit Failed
                        </h3>
                        <p className="text-sm text-slate-600 font-medium mb-6 text-center">
                            {errorMessage}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowErrorModal(false)}
                                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowErrorModal(false);
                                    if (asset) handleDeepScan(asset, true);
                                }}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Integrity Check Modal for Cached Results */}
            {showIntegrityCheck && cacheMetadata && (
                <IntegrityCheckModal
                    lastSynced={cacheMetadata.last_synced_at}
                    ageDays={cacheMetadata.age_days}
                    sourcesCount={cacheMetadata.sources_count}
                    onComplete={() => setShowIntegrityCheck(false)}
                />
            )}
        </div>
    );
}
