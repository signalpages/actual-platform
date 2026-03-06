"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { searchAssets } from '@/lib/dataBridge.client';
import { Asset } from '@/types';
import { filterHomeBackupProducts, ScenarioProduct } from '@/lib/scenarioFilters';
import { organizationJsonLd, generateItemList } from '@/lib/seo/jsonld';

function TierSection({
    tier,
    title,
    description,
    products
}: {
    tier: number,
    title: string,
    description: string,
    products: ScenarioProduct[]
}) {
    if (products.length === 0) return null;

    const tierColor = tier === 1 ? 'emerald' : tier === 2 ? 'blue' : 'purple';
    const tierIcon = tier === 1 ? 'E' : tier === 2 ? 'X' : 'H';

    const comparisonSlug = products.slice(0, 3).map(p => p.slug).join('-vs-');

    return (
        <section className={`mb-20 scroll-mt-24`} id={`tier-${tier}`}>
            <div className={`p-8 rounded-3xl border-2 border-${tierColor}-100 bg-${tierColor}-50/30 mb-8`}>
                <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
                    <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 bg-${tierColor}-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl`}>
                            {tierIcon}
                        </div>
                        <div>
                            <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-${tierColor}-600 mb-1`}>Tier {tier} Category</div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">{title}</h2>
                        </div>
                    </div>
                    <p className="max-w-md text-slate-500 text-sm leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm min-w-[900px] mb-6">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Model & Specs</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Verification Score</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Runtime (Fridge)
                                <div className="text-[7px] font-medium lowercase tracking-normal mt-1 opacity-70">
                                    Assumes 85% inverter efficiency. Real-world runtime varies by load cycling.
                                </div>
                            </th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Life / Build</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Audit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map((p) => {
                            const capWh = p.technical_specs?.storage_capacity_wh || p.technical_specs?.capacity_wh;
                            const outW = p.technical_specs?.continuous_ac_output_w || p.technical_specs?.ac_output_w;

                            return (
                                <tr key={p.id} className="hover:bg-slate-50/20 transition-colors group">
                                    <td className="px-6 py-6 max-w-[300px]">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{p.brand}</div>
                                        <div className="text-sm font-black text-slate-900 uppercase mb-2">{p.model_name}</div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{capWh}Wh</span>
                                            <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{outW}W Continuous</span>
                                        </div>
                                        <div className="mt-3 text-[10px] text-slate-500 font-medium leading-tight">
                                            <span className="font-bold text-slate-700">Why it qualifies:</span> {capWh}Wh, {outW}W output, {p.qualifiers.isExpandable ? 'Expandable Architecture' : 'Fixed Capacity'}.
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className={`text-xl font-black ${p.truth_score && p.truth_score >= 90 ? 'text-emerald-500' : 'text-blue-500'}`}>
                                            {p.truth_score || 100}%
                                        </div>
                                        <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">Accuracy Score</div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 inline-block min-w-[120px]">
                                            <div className="text-lg font-black text-slate-900">~{p.qualifiers.runtime.fridgeHours}h</div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Fridge (150W)</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className="space-y-2">
                                            <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${p.qualifiers.batteryChemistry.toLowerCase().includes('lifepo') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                {p.qualifiers.batteryChemistry}
                                            </span>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                {p.qualifiers.isExpandable ? 'Modular System' : 'Self-Contained'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <Link href={`/specs/${p.slug}`} className={`inline-block border border-slate-200 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 text-slate-900 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all`}>
                                            Full Audit
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="flex justify-end">
                    <Link href={`/compare?p1=${products[0]?.slug}&p2=${products[1]?.slug}${products[2] ? `&p3=${products[2].slug}` : ''}`} className={`text-[10px] font-black uppercase tracking-[0.2em] text-${tierColor}-600 hover:text-${tierColor}-700 flex items-center gap-2 transition-colors`}>
                        Compare all Tier {tier} models <span className="text-base">→</span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

function HomeBackupScenarioContent() {
    const [products, setProducts] = useState<ScenarioProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const assets = await searchAssets('', 'portable_power_station', 'all');
            const filtered = filterHomeBackupProducts(assets);

            // Sort by Capacity descending
            filtered.sort((a, b) => {
                const capA = Number(a.technical_specs?.storage_capacity_wh || a.technical_specs?.capacity_wh || 0);
                const capB = Number(b.technical_specs?.storage_capacity_wh || b.technical_specs?.capacity_wh || 0);
                return capB - capA;
            });

            setProducts(filtered);
            setLoading(false);
        };
        load();
    }, []);

    const tiers = useMemo(() => {
        return {
            t1: products.filter(p => p.qualifiers.tier === 1),
            t2: products.filter(p => p.qualifiers.tier === 2),
            t3: products.filter(p => p.qualifiers.tier === 3),
        };
    }, [products]);

    const jsonLd = useMemo(() => {
        if (products.length === 0) return null;

        return {
            '@context': 'https://schema.org',
            '@graph': [
                organizationJsonLd(),
                {
                    '@type': 'BreadcrumbList',
                    'itemListElement': [
                        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://actual.fyi' },
                        { '@type': 'ListItem', 'position': 2, 'name': 'Buying Guides', 'item': 'https://actual.fyi/buying-guides' },
                        { '@type': 'ListItem', 'position': 3, 'name': 'Home Backup Buying Guide', 'item': 'https://actual.fyi/best-portable-power-stations-for-home-backup' }
                    ]
                },
                generateItemList(
                    'Best Portable Power Stations for Home Backup',
                    products.slice(0, 10).map(p => `https://actual.fyi/specs/${p.slug}`)
                )
            ]
        };
    }, [products]);

    // Inclusion stats for hero
    const minCap = products.length > 0 ? Math.min(...products.map(p => Number(p.technical_specs?.storage_capacity_wh || p.technical_specs?.capacity_wh || 2000))) : 1500;

    return (
        <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            {/* Hero Section */}
            <header className="mb-20 text-center max-w-4xl mx-auto">
                <Link
                    href="/buying-guides"
                    className="inline-block bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 hover:bg-blue-100 transition-colors"
                >
                    ← Buying Guides
                </Link>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-8">
                    Home Backup <br />
                    <span className="text-blue-600">Buying Guide</span>
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed mb-12">
                    Not all "generators" can handle a home outage. We narrow the forensic database to units capable of high-draw motor starting and multi-hour appliance support.
                </p>

                {/* Tier jump nav */}
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                    <a
                        href="#tier-1"
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                        Essential Backup ↓
                    </a>
                    <a
                        href="#tier-2"
                        className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                        Extended Coverage ↓
                    </a>
                    <a
                        href="#tier-3"
                        className="bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                        High-Demand ↓
                    </a>
                </div>
            </header>

            {/* Decision Education Block */}
            <section className="mb-24 bg-slate-900 text-white rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-0.5 w-12 bg-blue-500"></div>
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-blue-500">What Matters for Home Backup?</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">1. Capacity</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Measured in Watt-hours (Wh). This determines your fuel tank size. Larger capacity allows for longer runtimes across essential appliances like refrigerators and medical devices.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">2. Continuous Output</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Measured in Watts (W). This determines what you can flip on. A fridge's compressor needs a high continuous rating to start and run without tripping the inverter.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">3. Expandability</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Modular systems allow you to add battery packs later. This is critical for adapting to longer outages or multi-day emergencies without buying a whole new generator.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">4. Verification Score</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Our audit verification score. It confirms that the manufacturer's performance claims align with technical forensic tests. High scores indicate high technical transparency.
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
                        tier={1}
                        title="Essential Home Backup"
                        description="Optimized for short outages. Focuses on critical essentials: Refrigerator (150W), Router (15W), and LED lighting."
                        products={tiers.t1}
                    />
                    <TierSection
                        tier={2}
                        title="Extended Outage Coverage"
                        description="Built for 24h+ outages. Supports multiple rooms, refrigerators + freezers, and primary health devices (CPAP)."
                        products={tiers.t2}
                    />
                    <TierSection
                        tier={3}
                        title="High-Demand / Semi-Whole Home"
                        description="Modular, high-capacity systems for multi-appliance support, high-draw pumps, and multi-day flexibility."
                        products={tiers.t3}
                    />
                </div>
            )}

            {/* Practical Runtime Context Footer */}
            {!loading && products.length > 0 && (
                <>
                    <section className="mt-24 bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6">Runtime Assumptions</h3>
                        <div className="grid sm:grid-cols-3 gap-8">
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Refrigerator (~150W avg)</div>
                                <p className="text-xs text-slate-500 leading-relaxed italic">Assumes a modern energy-efficient full-size model cycling throughout the day.</p>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">High Inverter Efficiency</div>
                                <p className="text-xs text-slate-500 leading-relaxed italic">Calculations factor in a conservative 85% real-world DC-to-AC conversion efficiency.</p>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Deterministic Logic</div>
                                <p className="text-xs text-slate-500 leading-relaxed italic">All runtimes are mathematically derived from verified audit capacity, not marketing brochures.</p>
                            </div>
                        </div>
                    </section>

                    {/* FAQ Section */}
                    <section className="mt-24">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="h-0.5 w-10 bg-blue-500"></div>
                            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-600">Frequently Asked Questions</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-4">What size power station is needed for home backup?</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    For critical essentials, a 2000Wh unit is the baseline. For multi-day outages or running heavy appliances like well pumps or space heaters, modular systems with 10kWh+ capacity are recommended.
                                </p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-4">Can a power station run a refrigerator during an outage?</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Yes. A standard 2000Wh unit can run a modern energy-efficient refrigerator for 12-15 hours. Larger expandable systems can extend this to several days.
                                </p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-4">Do I need a transfer switch for home backup?</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    For safe, whole-home circuit integration, a transfer switch or Smart Home Panel is recommended to avoid back-feeding and to simplify power distribution to hardwired appliances.
                                </p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-4">How many watts are needed for whole-home backup?</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    "Whole home" usually requires 5000W-7000W of continuous output to handle simultaneous loads like microwaves, coffee makers, and lighting, plus high-surge capacity for AC units.
                                </p>
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* Integrity Statement */}
            <footer className="pt-20 mt-20 border-t border-slate-200">
                <div className="max-w-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">Integrity Statement</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Inclusion on this page is strictly rule-based and derived from the Actual.fyi forensic database. No manufacturer can pay for placement or inclusion. Products are only surfaced if they meet the hard technical criteria (≥{minCap}Wh, ≥2000W) and pass our claim validation audit with a Verification Score of 80 or higher.
                    </p>
                </div>
            </footer>
        </main>
    );
}

export default function HomeBackupScenarioPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center text-slate-400 text-sm italic uppercase tracking-widest font-black">Aligning forensic tiers...</div>}>
            <HomeBackupScenarioContent />
        </Suspense>
    );
}
