import React from 'react';
import Link from 'next/link';
import { getUiMode, withUi } from '@/components/nav/uiMode';

export default async function StartPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedParams = await searchParams;
    const params = new URLSearchParams();
    Object.entries(resolvedParams).forEach(([key, value]) => {
        if (typeof value === 'string') params.set(key, value);
    });

    const mode = getUiMode(params);

    return (
        <main className="max-w-5xl mx-auto px-6 py-24">
            <header className="mb-16 text-center">
                <div className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                    Beta Mode C
                </div>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-6">
                    Start Your Energy Plan
                </h1>
                <p className="text-slate-500 text-xl max-w-2xl mx-auto">
                    Choose the path that best fits your technical expertise and project requirements.
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Path 1: Ready-Made */}
                <Link href={withUi('/specs?category=portable_power_station', mode)} className="group bg-white border border-slate-200 rounded-[2.5rem] p-10 hover:shadow-2xl transition-all hover:-translate-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-32 h-32 text-slate-900" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="relative z-10">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4">Path 1</div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-4">Ready-Made Systems</h2>
                        <p className="text-slate-500 leading-relaxed mb-8">
                            I want an all-in-one solution that works out of the box. Ideal for backup power, camping, and simple off-grid needs.
                        </p>
                        <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-6 py-3 rounded-xl group-hover:bg-blue-600 transition-colors">
                            Browse Systems →
                        </span>
                    </div>
                </Link>

                {/* Path 2: DIY / Custom */}
                <Link href={withUi('/build', mode)} className="group bg-white border border-slate-200 rounded-[2.5rem] p-10 hover:shadow-2xl transition-all hover:-translate-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-32 h-32 text-slate-900" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                    </div>
                    <div className="relative z-10">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-4">Path 2</div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-4">Build Your Own</h2>
                        <p className="text-slate-500 leading-relaxed mb-8">
                            I want to design a custom systems with separate components. Best for vans, cabins, and whole-home solar installs.
                        </p>
                        <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] bg-white border-2 border-slate-200 text-slate-900 px-6 py-3 rounded-xl group-hover:border-emerald-600 group-hover:text-emerald-600 transition-colors">
                            Open Stack Builder →
                        </span>
                    </div>
                </Link>
            </div>
        </main>
    );
}
