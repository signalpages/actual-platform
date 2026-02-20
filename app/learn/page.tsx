import React from 'react';
import Link from 'next/link';

export const runtime = 'edge';

export default function LearnLanding() {
    return (
        <main className="max-w-4xl mx-auto px-6 py-24">
            <header className="mb-16">
                <div className="inline-block bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                    Methodology
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-8">
                    METHODOLOGY
                </h1>
                <p className="text-slate-500 text-xl leading-relaxed font-medium">
                    Our verification engine, scoring logic, and Truth Index explained.
                </p>
            </header>

            <div className="space-y-12">
                <section>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-4 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm">1</span>
                        Forensic Extraction
                    </h2>
                    <div className="pl-11 border-l-2 border-slate-100 ml-4 pb-8">
                        <p className="text-slate-600 leading-relaxed">
                            We aggregate raw technical data from user manuals, regulatory filings (FCC), and discharge test logs. This creates a "Shadow Spec"—the theoretical maximum performance based on components used.
                        </p>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-4 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm">2</span>
                        Discharge Verification
                    </h2>
                    <div className="pl-11 border-l-2 border-slate-100 ml-4 pb-8">
                        <p className="text-slate-600 leading-relaxed">
                            We compare manufacturer claims against real-world physics. If a battery claims 1000Wh but discharge tests consistently show 850Wh, we flag the discrepancy.
                        </p>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-4 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm">3</span>
                        The Truth Index
                    </h2>
                    <div className="pl-11 border-l-2 border-slate-100 ml-4">
                        <p className="text-slate-600 leading-relaxed mb-6">
                            Every product gets a single verified score (0-100%).
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                90-100%: Accurate claims, honest marketing.
                            </li>
                            <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                80-89%: Minor variances, typical efficiency losses.
                            </li>
                            <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                                &lt;80%: Significant exaggerations or missing specs.
                            </li>
                        </ul>
                    </div>
                </section>
            </div>

            <div className="mt-20 pt-10 border-t border-slate-200">
                <Link href="/specs" className="inline-block bg-slate-900 text-white px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-colors">
                    Explore the Ledger
                </Link>
            </div>
        </main>
    );
}
