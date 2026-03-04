"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export const runtime = 'edge';

type Comparison = {
    slug: string;
    label: string;
    description: string;
    badge: string;
    badgeColor: string;
    capacity: string; // 'under-500' | '500-1000' | '1000-2000' | '2000-plus'
};

const ALL_COMPARISONS: Comparison[] = [
    // Under 500Wh
    {
        slug: 'bluetti-eb70s-vs-ecoflow-river-2-pro',
        label: 'BLUETTI EB70S vs EcoFlow RIVER 2 Pro',
        description: 'Sub-1000Wh ultra-portable mobility battle.',
        badge: 'Portable Class',
        badgeColor: 'bg-slate-800 text-white',
        capacity: 'under-500',
    },
    {
        slug: 'jackery-explorer-1000-pro-vs-bluetti-eb70s',
        label: 'Jackery Explorer 1000 Pro vs BLUETTI EB70S',
        description: 'Camping-optimized power station head-to-head.',
        badge: 'Portable Class',
        badgeColor: 'bg-slate-800 text-white',
        capacity: 'under-500',
    },
    // 500–1000Wh
    {
        slug: 'jackery-explorer-1000-pro-vs-ecoflow-river-2-pro',
        label: 'Jackery Explorer 1000 Pro vs EcoFlow RIVER 2 Pro',
        description: 'Overlanding and vanlife workhorses compared.',
        badge: 'Mid-Range',
        badgeColor: 'bg-slate-600 text-white',
        capacity: '500-1000',
    },
    // 1000–2000Wh
    {
        slug: 'bluetti-ac200max-vs-ecoflow-delta-2-max',
        label: 'BLUETTI AC200MAX vs EcoFlow DELTA 2 Max',
        description: 'The 2kWh sweet spot for RVs and emergency power.',
        badge: 'Recently Updated',
        badgeColor: 'bg-blue-600 text-white',
        capacity: '1000-2000',
    },
    {
        slug: 'bluetti-ac200max-vs-zendure-superbase-v6400-portable-power-station',
        label: 'BLUETTI AC200MAX vs Zendure SuperBase V6400',
        description: 'Expandable vs fixed capacity for serious off-grid setups.',
        badge: '1000–2000Wh Class',
        badgeColor: 'bg-slate-600 text-white',
        capacity: '1000-2000',
    },
    // 2000Wh+
    {
        slug: 'bluetti-ep500pro-vs-ecoflow-delta-pro',
        label: 'BLUETTI EP500Pro vs EcoFlow DELTA Pro',
        description: 'Heavyweight 3kWh+ home backup showdown.',
        badge: 'Most Viewed',
        badgeColor: 'bg-red-500 text-white',
        capacity: '2000-plus',
    },
    {
        slug: 'bluetti-ep500pro-vs-yeti-pro-4000-portable-power-station',
        label: 'BLUETTI EP500Pro vs Goal Zero Yeti PRO 4000',
        description: 'High-end home backup giants with different ecosystems.',
        badge: '2000Wh+ Class',
        badgeColor: 'bg-slate-600 text-white',
        capacity: '2000-plus',
    },
    {
        slug: 'ecoflow-delta-pro-vs-ecoflow-delta-pro-ultra',
        label: 'EcoFlow DELTA Pro vs DELTA Pro Ultra',
        description: 'Within-brand upgrade path: is the Ultra worth it?',
        badge: '2000Wh+ Class',
        badgeColor: 'bg-slate-600 text-white',
        capacity: '2000-plus',
    },
];

const CAPACITY_CLASSES = [
    { key: 'under-500', label: 'Under 500Wh', description: 'Weekend camping, CPAP, laptops' },
    { key: '500-1000', label: '500–1000Wh', description: 'Overlanding, basecamps, fridges' },
    { key: '1000-2000', label: '1000–2000Wh', description: 'Vanlife, robust outage protection' },
    { key: '2000-plus', label: '2000Wh+', description: 'Home backup, off-grid cabins, heavy duty' },
];

function CompareIndexContent() {
    const searchParams = useSearchParams();
    const capacityFilter = searchParams.get('capacity') || null;

    const activeClass = capacityFilter
        ? CAPACITY_CLASSES.find((c) => c.key === capacityFilter)
        : null;

    const filteredComparisons = capacityFilter
        ? ALL_COMPARISONS.filter((c) => c.capacity === capacityFilter)
        : ALL_COMPARISONS.filter((_, i) => [5, 3, 0].includes(i)); // Featured defaults: Most Viewed, Recently Updated, Portable Class

    return (
        <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
            <header className="mb-20 text-center max-w-3xl mx-auto">
                <div className="inline-block bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                    Structured Face-Offs
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-6">
                    Compare <span className="text-blue-600">Hardware</span><br />
                    Side-by-Side
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed">
                    Select two products to see a direct forensic comparison of their verified technical specifications, real-world performance, and limitations.
                </p>
            </header>

            <div className="space-y-24">
                {/* Capacity Class Nav */}
                <section>
                    <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Browse by Capacity Class</h2>
                        {capacityFilter && (
                            <Link
                                href="/compare"
                                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                            >
                                ← All Comparisons
                            </Link>
                        )}
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {CAPACITY_CLASSES.map((cls) => {
                            const isActive = capacityFilter === cls.key;
                            return (
                                <Link
                                    key={cls.key}
                                    href={isActive ? '/compare' : `/compare?capacity=${cls.key}`}
                                    className={`flex items-center justify-between p-5 border rounded-xl transition-colors group ${isActive
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <div>
                                        <div className={`text-sm font-black uppercase ${isActive ? 'text-blue-700' : 'text-slate-900'}`}>
                                            {cls.label}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">{cls.description}</div>
                                    </div>
                                    <span className={`transition-colors ${isActive ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-600'}`}>
                                        {isActive ? '✓' : '→'}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                {/* Scenario Decision Surfaces — teaser */}
                <section>
                    <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Scenario Decision Surfaces</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rule-Based Filtering</span>
                    </div>
                    <div className="flex items-center justify-between p-6 border border-slate-200 rounded-xl bg-slate-50/50">
                        <div>
                            <div className="text-base font-black uppercase text-slate-900 mb-1">Find the right unit for your use case</div>
                            <p className="text-xs text-slate-500 max-w-md">
                                Scenario-guided filters for Home Backup, RV Power, and more — each applying deterministic criteria to the forensic database.
                            </p>
                        </div>
                        <Link
                            href="/decision-surfaces"
                            className="flex-shrink-0 ml-6 inline-flex items-center gap-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-blue-600 transition-all"
                        >
                            Browse Decision Surfaces <span>→</span>
                        </Link>
                    </div>
                </section>

                {/* Comparisons Grid + CTA */}
                <div className="grid md:grid-cols-12 gap-12">
                    {/* Comparisons */}
                    <section className="md:col-span-8">
                        <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                                {activeClass ? `${activeClass.label} Comparisons` : 'Featured Comparisons'}
                            </h2>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {activeClass ? activeClass.description : 'High Intent'}
                            </span>
                        </div>
                        {filteredComparisons.length === 0 ? (
                            <div className="py-16 border border-dashed border-slate-200 rounded-xl text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    No comparisons available for this class yet.
                                </p>
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 gap-5">
                                {filteredComparisons.map((c) => (
                                    <Link
                                        key={c.slug}
                                        href={`/compare/${c.slug}`}
                                        className="group block border border-slate-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg transition-all bg-white relative overflow-hidden"
                                    >
                                        <div className={`absolute top-0 left-0 w-full h-1 ${c.badgeColor.replace('text-white', '').replace('bg-', 'bg-')}`}></div>
                                        <div className={`inline-block text-[9px] font-black uppercase tracking-widest mb-4 px-2 py-0.5 rounded-full ${c.badgeColor}`}>
                                            {c.badge}
                                        </div>
                                        <h3 className="text-base font-black text-slate-900 leading-tight mb-2">
                                            {c.label.split(' vs ').map((part, i, arr) => (
                                                <span key={i}>
                                                    {part}
                                                    {i < arr.length - 1 && (
                                                        <span className="text-slate-400 font-normal italic mx-1.5">vs</span>
                                                    )}
                                                </span>
                                            ))}
                                        </h3>
                                        <p className="text-xs text-slate-500">{c.description}</p>
                                        <div className="mt-5 flex items-center text-[10px] font-bold text-blue-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                            View Audit →
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Custom CTA */}
                    <section className="md:col-span-4">
                        <div className="bg-slate-900 text-white p-8 rounded-2xl h-full flex flex-col justify-between relative overflow-hidden group hover:shadow-2xl transition-shadow">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg className="w-32 h-32 transform group-hover:scale-110 transition-transform duration-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 22h20L12 2zm0 4.1L18.4 19H5.6L12 6.1z" />
                                </svg>
                            </div>
                            <div className="relative z-10 mb-8">
                                <h3 className="text-2xl font-black uppercase tracking-tight mb-4">Build Custom<br />Matchup</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Can't find the exact matchup you are looking for? Select any two products from our verified hardware ledger to run a new structured forensic comparison.
                                </p>
                            </div>
                            <Link
                                href="/specs"
                                className="relative z-10 block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-600/20"
                            >
                                Open Builder
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

export default function CompareIndexPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center text-slate-400 text-sm">Loading comparisons...</div>}>
            <CompareIndexContent />
        </Suspense>
    );
}
