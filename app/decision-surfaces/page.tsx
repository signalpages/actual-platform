import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DECISION_SURFACES, DecisionSurface } from '@/lib/scenarios/decisionSurfaces';

export const runtime = 'edge';

export const metadata: Metadata = {
    title: 'Power Station Buying Guides — Find the Right Generator for Your Situation',
    description: 'Which portable power station is right for you? Buying guides for home backup, RV power, off-grid cabins, and more — based on verified specs, not marketing claims.',
    alternates: { canonical: '/decision-surfaces' },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
        {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': 'https://actual.fyi'
        },
        {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Buying Guides',
            'item': 'https://actual.fyi/decision-surfaces'
        }
    ]
};

function SurfaceCard({ surface }: { surface: DecisionSurface }) {
    const isLive = surface.status === 'live';

    const iconColors: Record<string, string> = {
        'H': 'bg-blue-600',
        'R': 'bg-emerald-600',
        'A': 'bg-slate-400',
        'C': 'bg-slate-400',
        'D': 'bg-slate-400',
    };
    const iconBg = iconColors[surface.icon] ?? 'bg-slate-400';

    const cardContent = (
        <div
            className={`group relative flex flex-col h-full border rounded-2xl p-8 transition-all duration-200
                ${isLive
                    ? 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer'
                    : 'border-slate-100 bg-slate-50/50 cursor-default opacity-70'
                }`}
        >
            {/* Status badge */}
            <div className="flex items-start justify-between mb-6">
                <div className={`w-12 h-12 ${iconBg} text-white rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0`}>
                    {surface.icon}
                </div>
                <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border
                        ${isLive
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                >
                    {isLive ? 'Live' : 'Coming Soon'}
                </span>
            </div>

            {/* Title + subtitle */}
            <div className="mb-6 flex-1">
                <h2 className={`text-xl font-black uppercase tracking-tight mb-2 ${isLive ? 'text-slate-900' : 'text-slate-500'}`}>
                    {surface.title}
                    <span className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isLive ? 'text-slate-400' : 'text-slate-300'}`}>
                        Guide
                    </span>
                </h2>
                <p className="text-slate-500 text-xs leading-relaxed">
                    {surface.subtitle}
                </p>
            </div>

            {/* Criteria chips */}
            <div className="flex flex-wrap gap-2 mb-6">
                {surface.baselineCriteria.map((chip) => (
                    <span
                        key={chip}
                        className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border
                            ${isLive
                                ? 'bg-slate-50 text-slate-600 border-slate-200'
                                : 'bg-slate-50 text-slate-400 border-slate-100'
                            }`}
                    >
                        {chip}
                    </span>
                ))}
            </div>

            {/* CTA */}
            <div
                className={`text-center py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${isLive
                        ? 'bg-slate-900 text-white group-hover:bg-blue-600'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
            >
                {surface.ctaLabel}
                {isLive && <span className="ml-1.5">→</span>}
            </div>
        </div>
    );

    if (isLive && surface.slug) {
        return (
            <Link href={surface.slug} className="flex h-full">
                {cardContent}
            </Link>
        );
    }

    return <div className="flex h-full">{cardContent}</div>;
}

export default function DecisionSurfacesPage() {
    const liveSurfaces = DECISION_SURFACES.filter(s => s.status === 'live');
    const upcomingSurfaces = DECISION_SURFACES.filter(s => s.status === 'coming_soon');

    return (
        <main>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Hero */}
            <section className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
                    <div className="max-w-3xl">
                        <div className="inline-block bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            Buying Guides
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white leading-[0.9] mb-6">
                            Which Power Station <br />
                            <span className="text-blue-500">Is Right for You?</span>
                        </h1>
                        <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-xl">
                            Every guide below filters the verified hardware database down to units that actually qualify for a specific use case. Hard criteria only — no paid placements, no editorial guesswork.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <div className="bg-slate-800 border border-slate-700 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                                {liveSurfaces.length} Live Now
                            </div>
                            <div className="bg-slate-800 border border-slate-700 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {upcomingSurfaces.length} Coming Soon
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Live Surfaces */}
            <section className="py-20 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-0.5 w-10 bg-emerald-500"></div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600">Available Now</h2>
                    </div>

                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                        {liveSurfaces.map(surface => (
                            <SurfaceCard key={surface.id} surface={surface} />
                        ))}
                    </div>
                </div>
            </section>

            {/* Coming Soon */}
            <section className="py-20 bg-slate-50 border-t border-slate-100">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-0.5 w-10 bg-slate-300"></div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Coming Soon</h2>
                    </div>

                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {upcomingSurfaces.map(surface => (
                            <SurfaceCard key={surface.id} surface={surface} />
                        ))}
                    </div>

                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-10">
                        These guides are in development. Criteria are preliminary.
                    </p>
                </div>
            </section>

            {/* Methodology note */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="max-w-2xl">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">How these guides work</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Each guide runs a fixed set of technical checks against the Actual.fyi verified hardware database. A product only appears if it clears every requirement — capacity, output, surge rating, and Truth Index score. Nothing is ranked by popularity or sponsored placement. If a product qualifies, it shows up. If it doesn't, it doesn't.
                        </p>
                        <Link
                            href="/learn"
                            className="inline-flex items-center gap-2 mt-6 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            Read our methodology →
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
