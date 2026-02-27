"use client";

import React, { useState, useEffect, Suspense } from 'react'; // Added Suspense for useSearchParams
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { searchAssets, listCategories } from '@/lib/dataBridge.client';
import { Asset, Category } from '@/types';
import { formatCategoryLabel } from '@/lib/categoryFormatter';

function SpecLedgerContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const statusTab = (searchParams.get('status') as 'verified' | 'provisional') || 'verified';
    const categoryParam = searchParams.get('category') || 'all';

    const [assets, setAssets] = useState<Asset[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brandFilter, setBrandFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState(categoryParam);
    const [sortMethod, setSortMethod] = useState<'truth_score' | 'delta' | 'cleanest'>('truth_score');
    const [loading, setLoading] = useState(true);

    // Update local filter when URL param changes
    useEffect(() => {
        if (categoryParam) setCategoryFilter(categoryParam);
    }, [categoryParam]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [assetData, categoryData] = await Promise.all([
                searchAssets('', 'all', 'all'),
                listCategories()
            ]);
            setAssets(assetData);
            setCategories(categoryData as Category[]);
            setLoading(false);
        };
        load();
    }, []);

    // 1. Filter by Category and Status first
    const categoryAndStatusAssets = assets.filter(a => {
        const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
        const matchesStatus = a.verification_status === statusTab;
        return matchesCategory && matchesStatus;
    });

    // 2. Derive available brands ONLY from the assets visible in this category/status view
    const brands = Array.from(new Set(categoryAndStatusAssets.map(a => a.brand).filter(Boolean))).sort();

    // 3. Apply the brand filter for the final display list
    const filteredAssets = categoryAndStatusAssets.filter(a => {
        const matchesBrand = brandFilter === 'all' || a.brand === brandFilter;
        return matchesBrand;
    });

    // -- Sort Logic --
    const sortedAssets = [...filteredAssets].sort((a, b) => {
        if (sortMethod === 'truth_score') {
            return (b.truth_score || 0) - (a.truth_score || 0);
        }
        if (sortMethod === 'delta') {
            // Placeholder: Sort by count of discrepancies if no numeric delta available yet
            return (b.latest_discrepancies?.length || 0) - (a.latest_discrepancies?.length || 0);
        }
        if (sortMethod === 'cleanest') {
            // Inverse of delta
            return (a.latest_discrepancies?.length || 0) - (b.latest_discrepancies?.length || 0);
        }
        return 0;
    });

    // -- Aggregation Metrics --
    const totalAssets = filteredAssets.length;
    const assetsWithAudits = filteredAssets.filter(a => a.truth_score !== null && a.truth_score !== undefined);

    // Calculate Variance Metrics
    let totalDeltaSum = 0;
    let deltaCount = 0;
    let materialVarianceCount = 0;

    assetsWithAudits.forEach(asset => {
        // Approximate claim delta using Truth Index inverse if explicit delta not readily available in flat list
        // In full impl, we would compare actual vs claimed for every spec.
        // For V1, we'll use (100 - Truth Index) as a proxy for "Total Variance"
        const variance = 100 - (asset.truth_score || 0);
        totalDeltaSum += variance;
        deltaCount++;

        if (variance > 5) materialVarianceCount++;
    });

    const avgTruthIndex = assetsWithAudits.length > 0
        ? Math.round(assetsWithAudits.reduce((acc, a) => acc + (a.truth_score || 0), 0) / assetsWithAudits.length)
        : '-';

    const avgClaimDelta = deltaCount > 0 ? (totalDeltaSum / deltaCount).toFixed(1) : '0.0';
    const percentMaterialVariance = totalAssets > 0 ? Math.round((materialVarianceCount / totalAssets) * 100) : 0;

    // Lowest Variance Asset (Highest Truth Score)
    const lowestVarianceAsset = [...assetsWithAudits].sort((a, b) => (b.truth_score || 0) - (a.truth_score || 0))[0];

    const handleTabChange = (status: 'verified' | 'provisional') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('status', status);
        router.push(`/specs?${params.toString()}`);
    };

    return (
        <main className="max-w-7xl mx-auto px-6 py-12">
            <header className="mb-12 border-b border-slate-200 pb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <Link href="/" className="inline-block bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 hover:bg-slate-700 transition-colors">
                            Actual.fyi
                        </Link>
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-2">
                            Forensic Ledger
                        </h1>
                        <p className="text-slate-500 font-medium text-xs uppercase tracking-wide mb-4">
                            {categoryFilter === 'all' ? 'BoM Level Inventory' : `Category: ${categories.find(c => c.id === categoryFilter)?.label}`}
                        </p>
                        {categoryFilter !== 'all' && (
                            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                                <Link href="/specs" className="text-blue-500 hover:text-blue-700 transition-colors">
                                    ← All Products
                                </Link>
                                <span className="text-slate-300">|</span>
                                <Link href="/compare" className="text-blue-500 hover:text-blue-700 transition-colors">
                                    Compare Products →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Category Intelligence Overview (Dashboard) */}
            {categoryFilter !== 'all' && !loading && (
                <section className="mb-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Audited Assets</div>
                        <div className="text-3xl font-black">{totalAssets}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Truth Index</div>
                        <div className={`text-3xl font-black ${typeof avgTruthIndex === 'number' && avgTruthIndex < 80 ? 'text-amber-500' : 'text-blue-600'}`}>
                            {avgTruthIndex}
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Material Variance ({'>'}5%)</div>
                        <div className="text-3xl font-black text-amber-600">{percentMaterialVariance}%</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl shadow-sm">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Lowest Variance</div>
                        <div className="text-lg font-black text-emerald-900 leading-tight truncate">
                            {lowestVarianceAsset?.model_name || 'N/A'}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium mt-1">
                            {lowestVarianceAsset ? `Variance: ${(100 - (lowestVarianceAsset.truth_score || 0)).toFixed(1)}%` : ''}
                        </div>
                    </div>
                </section>
            )}

            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur py-4 mb-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    {/* Brand Filter */}
                    <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-widest rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-all"
                    >
                        <option value="all">Manufacturer: All</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    {/* Sort Control */}
                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setSortMethod('truth_score')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${sortMethod === 'truth_score' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Truth Index
                        </button>
                        <button
                            onClick={() => setSortMethod('delta')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${sortMethod === 'delta' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Max Variance
                        </button>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => handleTabChange('verified')}
                        className={`text-[10px] font-black uppercase tracking-widest transition-colors ${statusTab === 'verified' ? 'text-slate-900 decoration-blue-500 underline decoration-2 underline-offset-4' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Verified
                    </button>
                    <button
                        onClick={() => handleTabChange('provisional')}
                        className={`text-[10px] font-black uppercase tracking-widest transition-colors ${statusTab === 'provisional' ? 'text-amber-700 decoration-amber-500 underline decoration-2 underline-offset-4' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Provisional
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-slate-50 border border-slate-200 rounded-3xl animate-pulse" />)}
                </div>
            ) : (
                <div id="productGrid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedAssets.map((asset) => (
                        <div key={asset.id} className="group bg-white border border-slate-200 rounded-[2rem] p-0 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all flex flex-col relative">
                            {/* Card Header */}
                            <div className="p-8 pb-4 border-b border-slate-50">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                        {asset.brand}
                                    </div>
                                    {asset.truth_score && (
                                        <div className="flex items-center gap-1.5">
                                            <div className={`text-xl font-black ${asset.truth_score >= 90 ? 'text-emerald-500' : asset.truth_score >= 80 ? 'text-blue-500' : 'text-amber-500'}`}>
                                                {asset.truth_score}
                                            </div>
                                            <div className="text-[8px] font-bold text-slate-300 uppercase leading-none">
                                                Truth<br />Index
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">{asset.model_name}</h2>
                            </div>

                            {/* Forensic Mini-Table */}
                            <div className="px-8 py-6 bg-white flex-grow">
                                {asset.truth_score ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2 text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">
                                            <span>Spec</span>
                                            <span className="text-right">Claim</span>
                                            <span className="text-right">Verif</span>
                                            <span className="text-right">Delta</span>
                                            <span className="text-right">Sev</span>
                                        </div>
                                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2 items-center text-[10px] font-mono border-b border-slate-50 pb-2">
                                            <span className="font-bold text-slate-700 font-sans">Capacity</span>
                                            <span className="text-right text-slate-500">2048</span>
                                            <span className="text-right text-slate-900 font-bold">2055</span>
                                            <span className="text-right text-emerald-600 font-bold">+0.3%</span>
                                            <span className="text-right"><div className="w-2 h-2 rounded-full bg-slate-200 ml-auto"></div></span>
                                        </div>
                                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2 items-center text-[10px] font-mono">
                                            <span className="font-bold text-slate-700 font-sans">Cycles</span>
                                            <span className="text-right text-slate-500">3500</span>
                                            <span className="text-right text-slate-900 font-bold">3100</span>
                                            <span className="text-right text-amber-600 font-bold">-11.4%</span>
                                            <span className="text-right"><div className="w-2 h-2 rounded-full bg-amber-500 ml-auto"></div></span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4 text-center bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            Provisional Asset
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium">
                                            Insufficient Evidence Depth<br />
                                            Truth Index Withheld
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Footer */}
                            <div className="p-4 bg-white mt-auto">
                                <Link href={`/specs/${asset.slug}`} className="block w-full text-center bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-colors shadow-lg shadow-blue-900/10">
                                    View Full Audit
                                </Link>
                            </div>
                        </div>
                    ))}
                    {sortedAssets.length === 0 && (
                        <div className="col-span-full py-24 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">No audits found matching criteria.</p>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}


export default function SpecLedger() {
    return (
        <Suspense fallback={<div className="p-20 text-center">Loading Inventory...</div>}>
            <SpecLedgerContent />
        </Suspense>
    );
}
