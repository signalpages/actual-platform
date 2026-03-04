"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { searchAssets } from '@/lib/dataBridge.client';
import { Asset } from '@/types';
import { filterRVProducts, RVProduct } from '@/lib/scenarioFilters';

function TierSection({
    tier,
    title,
    description,
    products
}: {
    tier: string,
    title: string,
    description: string,
    products: RVProduct[]
}) {
    if (products.length === 0) return null;

    const tierColor = tier === 'Tier 1' ? 'emerald' : tier === 'Tier 2' ? 'blue' : 'purple';
    const tierIcon = tier === 'Tier 1' ? 'W' : tier === 'Tier 2' ? 'E' : 'F';

    return (
        <section className={`mb-20 scroll-mt-24`} id={tier.toLowerCase().replace(' ', '-')}>
            <div className={`p-8 rounded-3xl border-2 border-${tierColor}-100 bg-${tierColor}-50/30 mb-8`}>
                <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
                    <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 bg-${tierColor}-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl`}>
                            {tierIcon}
                        </div>
                        <div>
                            <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-${tierColor}-600 mb-1`}>{tier} Category</div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">{title}</h2>
                        </div>
                    </div>
                    <p className="max-w-md text-slate-500 text-sm leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm min-w-[1000px] mb-6">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Model & Specs</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Truth Index</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Runtime (RV Fridge)
                                <div className="text-[7px] font-medium lowercase tracking-normal mt-1 opacity-70">
                                    Assumes 120W avg @ 85% efficiency.
                                </div>
                            </th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">30A (RV Port)</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Solar (W)</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Weight (lb)</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Audit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/20 transition-colors group">
                                <td className="px-6 py-6 max-w-[300px]">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{p.brand}</div>
                                    <div className="text-sm font-black text-slate-900 uppercase mb-2">{p.model_name}</div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.rvQualifiers.capacityWh}Wh</span>
                                        <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.rvQualifiers.continuousW}W Cont.</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {p.rvQualifiers.badges.map(b => (
                                            <span key={b} className="text-[8px] font-black uppercase tracking-widest bg-slate-900 text-white px-1.5 py-0.5 rounded-full">
                                                {b}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className={`text-xl font-black ${p.rvQualifiers.truthIndex && p.rvQualifiers.truthIndex >= 90 ? 'text-emerald-500' : 'text-blue-500'}`}>
                                        {p.rvQualifiers.truthIndex || 80}%
                                    </div>
                                    <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">Accuracy Score</div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 inline-block min-w-[120px]">
                                        <div className="text-lg font-black text-slate-900">~{p.rvQualifiers.runtimeFridgeHours}h</div>
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Fridge (@120W)</div>
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className={`text-sm font-black uppercase ${p.rvQualifiers.rv30a === 'TT-30' ? 'text-emerald-600' : p.rvQualifiers.rv30a === 'Adapter' ? 'text-blue-600' : 'text-slate-300'}`}>
                                        {p.rvQualifiers.rv30a}
                                    </div>
                                    <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">Plug Type</div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className="text-sm font-black text-slate-900">{p.rvQualifiers.solarInputW || '—'}</div>
                                    <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Max Input</div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className="text-sm font-black text-slate-900">{p.rvQualifiers.weightLb ? Math.round(p.rvQualifiers.weightLb) : '—'}</div>
                                    <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Pounds</div>
                                </td>
                                <td className="px-6 py-6 text-right">
                                    <Link href={`/specs/${p.slug}`} className="inline-block border border-slate-200 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 text-slate-900 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                        Full Audit
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex justify-end">
                    <Link href={`/compare?p1=${products[0]?.slug}&p2=${products[1]?.slug}${products[2] ? `&p3=${products[2].slug}` : ''}`} className={`text-[10px] font-black uppercase tracking-[0.2em] text-${tierColor}-600 hover:text-${tierColor}-700 flex items-center gap-2 transition-colors`}>
                        Compare all {tier} models <span className="text-base">→</span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

function RVScenarioContent() {
    const [products, setProducts] = useState<RVProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const assets = await searchAssets('', 'portable_power_station', 'all');

            const filtered = filterRVProducts(assets);

            // Sort by Capacity descending
            filtered.sort((a, b) => b.rvQualifiers.capacityWh! - a.rvQualifiers.capacityWh!);

            setProducts(filtered);
            setLoading(false);
        };
        load();
    }, []);

    const tiers = useMemo(() => {
        return {
            t1: products.filter(p => p.rvQualifiers.tier === 'Tier 1'),
            t2: products.filter(p => p.rvQualifiers.tier === 'Tier 2'),
            t3: products.filter(p => p.rvQualifiers.tier === 'Tier 3'),
        };
    }, [products]);

    const appliedThreshold = products.length > 8 ? 2400 : 2000;

    return (
        <main className="max-w-7xl mx-auto px-6 py-16 md:py-24">
            {/* Hero Section */}
            <header className="mb-20 text-center max-w-4xl mx-auto">
                <Link
                    href="/decision-surfaces"
                    className="inline-block bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 hover:bg-emerald-100 transition-colors"
                >
                    ← Buying Guides
                </Link>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-8">
                    RV Power <br />
                    <span className="text-emerald-600">Buying Guide</span>
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed mb-12">
                    Portable systems capable of supporting RV appliances, air conditioning (soft-start), and realistic off-grid usage.
                </p>

                {/* Tier jump nav */}
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                    <a
                        href="#tier-1"
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                        Weekend RV ↓
                    </a>
                    <a
                        href="#tier-2"
                        className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                        Extended Off-Grid ↓
                    </a>
                    <a
                        href="#tier-3"
                        className="bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                        Full-Time / Heavy ↓
                    </a>
                </div>
            </header>

            {/* Decision Education Block */}
            <section className="mb-24 bg-slate-900 text-white rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-0.5 w-12 bg-emerald-500"></div>
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-500">What Matters for RV?</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">1. Continuous + Surge</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                RV air conditioners and microwaves require substantial continuous power and momentary surge handling to start compressors without tripping the inverter.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">2. 30A Compatibility</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Direct TT-30 outlets are preferred. 30A NEMA L14-30 or L5-30 sockets with appropriate adapters are noted where direct support is absent.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">3. Recharge Strategy</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                High solar input capacity is critical for off-grid camping. We prioritize units that can handle rapid solar replenishment in various lighting conditions.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">4. Weight & Portability</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                RV users care about mobility and weight limits. We surface physical specs to help you balance capacity against the ease of moving the system.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="space-y-12">
                    {[1, 2].map(i => <div key={i} className="h-80 bg-slate-50 border border-slate-200 rounded-[2rem] animate-pulse" />)}
                </div>
            ) : products.length === 0 ? (
                <div className="py-24 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Strict Forensic Threshold unmet by current inventory.</p>
                </div>
            ) : (
                <div className="space-y-12">
                    <TierSection
                        tier="Tier 1"
                        title="Weekend RV Support"
                        description="2000–3000Wh systems. Optimized for shorter trips. Supports high-draw appliances and basic AC units with soft-start."
                        products={tiers.t1}
                    />
                    <TierSection
                        tier="Tier 2"
                        title="Extended Off-Grid Camping"
                        description="3000–5000Wh systems or high-solar units. Built for 2-3 days of independent camping with multiple appliances."
                        products={tiers.t2}
                    />
                    <TierSection
                        tier="Tier 3"
                        title="Full-Time RV / Heavy Loads"
                        description="5000Wh+ or high-capacity modular systems. Capable of supporting full-time living or extreme climate cooling."
                        products={tiers.t3}
                    />
                </div>
            )}

            {/* Practical Runtime Context Footer */}
            {!loading && products.length > 0 && (
                <section className="mt-24 bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6">Scenario Assumptions</h3>
                    <div className="grid sm:grid-cols-3 gap-8">
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">RV Fridge (~120W avg)</div>
                            <p className="text-xs text-slate-500 leading-relaxed italic">Assumes a standard 12V or compression fridge cycling. Runtime varies based on ambient temp and door usage.</p>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">85% Inverter Efficiency</div>
                            <p className="text-xs text-slate-500 leading-relaxed italic">Calculations factor in real-world energy loss during DC-to-AC conversion.</p>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Deterministic Inclusion</div>
                            <p className="text-xs text-slate-500 leading-relaxed italic">No paid inclusions. All results are live-filtered based on verified technical forensic data.</p>
                        </div>
                    </div>
                </section>
            )}

            {/* Integrity Statement */}
            <footer className="pt-20 mt-20 border-t border-slate-200">
                <div className="max-w-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">Integrity Statement</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Inclusion on this page is strictly rule-based and derived from the Actual.fyi forensic database. Products are only surfaced if they meet the hard technical criteria (Continuous ≥{appliedThreshold}W, 30A Capable, Surge Docs) and pass our audit with a Truth Index score of 80 or higher.
                    </p>
                </div>
            </footer>
        </main>
    );
}

export default function RVScenarioPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center text-slate-400 text-sm italic uppercase tracking-widest font-black">Aligning RV forensic data...</div>}>
            <RVScenarioContent />
        </Suspense>
    );
}
