"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { searchAssets } from '@/lib/dataBridge.client';
import { Asset } from '@/types';
import { filterEmergencyPowerProducts, EmergencyPowerProduct } from '@/lib/scenarioFilters';
import { organizationJsonLd, generateItemList } from '@/lib/seo/jsonld';

function RelatedGuides() {
    return (
        <section className="mt-32 pt-20 border-t border-slate-100">
            <div className="text-center mb-12">
                <div className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                    SEO Cluster
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Explore Other Buying Guides</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Apartments', href: '/best-portable-power-stations-for-apartments' },
                    { label: 'Home Backup', href: '/best-portable-power-stations-for-home-backup' },
                    { label: 'RV Power', href: '/best-portable-power-stations-for-rv' },
                    { label: 'Off-Grid Cabin', href: '/best-portable-power-stations-for-off-grid-cabin' },
                    { label: 'High-Demand', href: '/best-portable-power-stations-for-high-demand' }
                ].map((guide) => (
                    <Link
                        key={guide.href}
                        href={guide.href}
                        className="p-4 border border-slate-200 rounded-xl text-center hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">
                            {guide.label}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

function TierSection({
    tier,
    title,
    description,
    products
}: {
    tier: number,
    title: string,
    description: string,
    products: EmergencyPowerProduct[]
}) {
    if (products.length === 0) return null;

    const tierColor = tier === 1 ? 'blue' : 'emerald';
    const tierIcon = tier === 1 ? 'E' : 'S';

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
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Fast Recharge</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Capacity</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Audit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map((p) => {
                            return (
                                <tr key={p.id} className="hover:bg-slate-50/20 transition-colors group">
                                    <td className="px-6 py-6 max-w-[300px]">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{p.brand}</div>
                                        <div className="text-sm font-black text-slate-900 uppercase mb-2">{p.model_name}</div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.emergencyQualifiers.capacityWh}Wh</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className={`text-xl font-black ${p.emergencyQualifiers.truthIndex && p.emergencyQualifiers.truthIndex >= 90 ? 'text-emerald-500' : 'text-blue-500'}`}>
                                            {p.emergencyQualifiers.truthIndex || 80}%
                                        </div>
                                        <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">Accuracy Score</div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className="text-sm font-black text-slate-900">{p.emergencyQualifiers.fastRechargeW ? `${p.emergencyQualifiers.fastRechargeW}W` : 'Yes'}</div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <div className="text-sm font-black text-slate-900">{p.emergencyQualifiers.capacityWh}Wh</div>
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <Link href={`/specs/${p.slug}`} className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">
                                            View Audit
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default function EmergencyPowerScenarioPage() {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<EmergencyPowerProduct[]>([]);

    useEffect(() => {
        async function fetchProducts() {
            setLoading(true);
            try {
                const results = await searchAssets("", "all");
                const valid = filterEmergencyPowerProducts(results);
                valid.sort((a, b) => b.emergencyQualifiers.capacityWh - a.emergencyQualifiers.capacityWh);
                setProducts(valid);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchProducts();
    }, []);

    const tiers = useMemo(() => {
        return {
            t1: products.filter(p => p.emergencyQualifiers.tier === 1),
            t2: products.filter(p => p.emergencyQualifiers.tier === 2),
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
                        { '@type': 'ListItem', 'position': 3, 'name': 'Emergency Power Buying Guide', 'item': 'https://actual.fyi/best-portable-power-stations-for-emergency-power' }
                    ]
                },
                generateItemList(
                    'Best Portable Power Stations for Emergency Power',
                    products.slice(0, 10).map(p => `https://actual.fyi/specs/${p.slug}`)
                )
            ]
        };
    }, [products]);

    return (
        <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <header className="mb-20 text-center max-w-4xl mx-auto">
                <Link
                    href="/buying-guides"
                    className="inline-block bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 hover:bg-blue-100 transition-colors"
                >
                    ← Buying Guides
                </Link>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-8">
                    Emergency Power <br />
                    <span className="text-blue-600">Buying Guide</span>
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed mb-12">
                    Emergency power stations provide short-term electricity during grid outages. This guide filters verified portable power systems capable of running essential appliances like refrigerators, lights, and communication devices during blackouts.
                </p>

                {products.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mb-12">
                        <a href="#tier-1" className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors cursor-pointer">
                            Standard Power ↓
                        </a>
                        <a href="#tier-2" className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors cursor-pointer">
                            Extended Storage ↓
                        </a>
                    </div>
                )}
            </header>

            {/* Decision Education Block */}
            <section className="mb-24 bg-slate-900 text-white rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-0.5 w-12 bg-blue-500"></div>
                        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-blue-500">What Matters for Emergency Power?</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">1. Fast AC Recharge</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Grid outages can be unpredictable. We prioritize units that can recharge from 0-80% in under 90 minutes when the power flickers back on.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">2. Indoor-Safe Inverter</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Clean, quiet power. Unlike gas generators, these units produce no CO and are safe for indoor operation during storms or emergencies.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">3. Critical Load Support</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                We filter for units with high energy density that can sustain essential loads like refrigerators (150W avg) and communication gear for 24+ hours.
                            </p>
                        </div>
                        <div>
                            <div className="text-lg font-black uppercase mb-4 text-white">4. Verification Score</div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Reliability matters most in an emergency. We only list products where the claimed capacity and discharge rates match our forensic audit results.
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
                <div className="py-24 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] max-w-3xl mx-auto px-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Strict Forensic Threshold unmet by current inventory.</p>
                    <p className="text-sm text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">We could not find any models in our database that verified against the rigorous criteria for Emergency Power. Check out our general power stations or comparison tool instead.</p>
                    <div className="flex justify-center gap-4">
                        <Link href="/portable-power-stations" className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors">View All Audits</Link>
                        <Link href="/compare" className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">Compare Tools</Link>
                    </div>
                </div>
            ) : (
                <div className="space-y-12">
                    <TierSection
                        tier={1}
                        title="Standard Power"
                        description="Ideal for short blackouts to keep communications and lighting online."
                        products={tiers.t1}
                    />
                    <TierSection
                        tier={2}
                        title="Extended Storage"
                        description="High-capacity units designed to keep full-size refrigerators running for 24-48 hours."
                        products={tiers.t2}
                    />
                </div>
            )}

            <RelatedGuides />
        </main>
    );
}
