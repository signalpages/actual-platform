import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Verification Score Methodology | Actual.fyi',
    description: 'A structured scoring model measuring the accuracy of product claims against independently validated evidence.',
};

export default function MethodologyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            {/* 1. Overview */}
            <header className="mb-20">
                <Link href="/how-we-audit" className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors mb-8">
                    ← Back to How We Audit
                </Link>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase mb-6">
                    Verification Score Methodology
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 font-medium leading-relaxed max-w-3xl">
                    A structured scoring model measuring the accuracy of product claims against independently validated evidence.
                </p>
                <div className="h-1 w-20 bg-blue-600 mt-10"></div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
                {/* 2. Gating Requirements */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-4">
                        Gating Requirements
                    </h2>
                    <ul className="space-y-4 text-sm text-slate-600">
                        <li className="flex items-start gap-3">
                            <span className="text-slate-300 mt-0.5">•</span>
                            <span><strong>Minimum 3 independent validation signals required.</strong> We do not score products based on a single review or manufacturer-provided data alone.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-slate-300 mt-0.5">•</span>
                            <span><strong>No score issued if evidence payload incomplete.</strong> If we cannot verify core specifications, the product receives no score ("Insufficient Forensic Depth").</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-slate-300 mt-0.5">•</span>
                            <span><strong>Conditional claims handled separately.</strong> Claims that only apply under specific, unrealistic ideal conditions are flagged.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-slate-300 mt-0.5">•</span>
                            <span><strong>Integer-only scoring.</strong> No fractional drama. Scores are whole numbers representing technical reality.</span>
                        </li>
                    </ul>

                    <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-sm text-slate-700 italic font-medium">
                            A 100% Verification Score means no claim inflation was detected. It does not imply the product is superior in price, ecosystem, or use-case fit.
                        </p>
                    </div>
                </section>

                {/* 3. Scoring Principles */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-4">
                        Scoring Principles
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-1">Rewards</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Verified claims directly increase the base score. When independent reality aligns with manufacturer marketing, the product gains trust.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-1">Deductions</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Unsupported claims reduce the score. If a manufacturer makes a claim that real-world usage cannot verify, it negatively impacts their baseline.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-1">Penalties</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Overstated claims are heavily penalized. Marketing physics-defying wattage or intentionally obscuring usable battery capacity triggers severe score reductions.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-1">Confidence Weights</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Missing or conflicting data across multiple sources reduces the overall confidence multiplier of the final score.
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            {/* 4. Deterministic Pipeline */}
            <section className="mb-24">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">
                    Deterministic Pipeline
                </h2>

                <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-slate-200 rounded-lg px-6 py-4 mb-10 text-[10px] font-black uppercase tracking-widest text-slate-500 overflow-x-auto">
                    <div className="flex items-center gap-2 whitespace-nowrap min-w-max">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">1</span>
                        <span>Claim Extraction</span>
                    </div>
                    <svg className="w-3 h-3 text-slate-300 mx-2 hidden sm:block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <div className="flex items-center gap-2 whitespace-nowrap min-w-max mt-3 sm:mt-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">2</span>
                        <span>Evidence Aggregation</span>
                    </div>
                    <svg className="w-3 h-3 text-slate-300 mx-2 hidden sm:block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <div className="flex items-center gap-2 whitespace-nowrap min-w-max mt-3 sm:mt-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">3</span>
                        <span>Normalization</span>
                    </div>
                    <svg className="w-3 h-3 text-slate-300 mx-2 hidden sm:block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <div className="flex items-center gap-2 whitespace-nowrap min-w-max mt-3 sm:mt-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">4</span>
                        <span>Scoring</span>
                    </div>
                    <svg className="w-3 h-3 text-slate-300 mx-2 hidden sm:block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <div className="flex items-center gap-2 whitespace-nowrap min-w-max mt-3 sm:mt-0 text-slate-900">
                        <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">5</span>
                        <span>Verdict Lock</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600">
                    <div className="border border-slate-200 rounded-lg p-6">
                        <h4 className="font-bold text-slate-900 mb-2">No Manual Overrides</h4>
                        <p>The system calculates the score based purely on the evidence inputs. Editors cannot tweak the final integer to match subject preferences.</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-6">
                        <h4 className="font-bold text-slate-900 mb-2">No Editorial Adjustments</h4>
                        <p>Scores are not curved or adjusted to ensure brand variety. If every product in a category inflates their specs, they will all score poorly.</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-6">
                        <h4 className="font-bold text-slate-900 mb-2">No Paid Influence</h4>
                        <p>We do not accept payment to change verdicts, expedite audits, or alter the weights of the scoring algorithm for any manufacturer.</p>
                    </div>
                </div>
            </section>

            {/* 5. Why We Avoid "Top 10" Rankings */}
            <section className="bg-slate-900 text-white rounded-[2rem] p-10 md:p-14">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">
                    Philosophy
                </h2>
                <h3 className="text-2xl md:text-3xl font-black mb-6 tracking-tight">
                    Why We Avoid "Top 10" Rankings
                </h3>
                <div className="space-y-6 text-slate-300 leading-relaxed font-medium">
                    <p>
                        We do not publish "Best Solar Generator" or "Top 10" lists.
                    </p>
                    <p>
                        Many products score high on the Verification Score simply because they do not inflate their technical specifications. A high score means the product is exactly what the manufacturer claims it is—it does not mean it is the best value, or the most powerful in its class.
                    </p>
                    <p>
                        Price-to-value, ecosystem compatibility, and specific use-case fitness are completely separate dimensions from technical honesty. Traditional rankings distort these separate dimensions into a single list, leading to poor purchasing decisions.
                    </p>
                    <p>
                        Our role is to verify reality. It is your role to decide which reality fits your needs.
                    </p>
                </div>
            </section>
        </div>
    );
}
