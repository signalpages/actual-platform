import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'How We Audit | Actual.fyi',
    description: 'A four-stage forensic validation process designed to separate marketing claims from technical reality.',
};

export default function HowWeAuditPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            {/* 1. Hero Section */}
            <header className="mb-20">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase mb-6">
                    How We Audit Products
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 font-medium leading-relaxed max-w-3xl">
                    A four-stage forensic validation process designed to separate marketing claims from technical reality.
                </p>
                <div className="h-1 w-20 bg-blue-600 mt-10"></div>
            </header>

            {/* Strategic Framing */}
            <section className="mb-16 max-w-3xl">
                <p className="text-xl text-slate-700 font-medium leading-relaxed mb-4">
                    Most product reviews repeat manufacturer claims. We treat marketing claims as hypotheses.
                </p>
                <p className="text-xl text-slate-700 font-medium leading-relaxed mb-4">
                    Audits are based on publicly available manufacturer specifications and independently verifiable long-term usage evidence.
                </p>
                <p className="text-xl text-slate-900 font-bold">
                    No score is better than a weak score.
                </p>
            </section>

            {/* 2. Stage Breakdown */}
            <section className="mb-24">
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-slate-200 rounded-lg px-6 py-4 mb-16 text-xs font-black uppercase tracking-widest text-slate-500">
                    <div className="flex items-center gap-3 mb-4 sm:mb-0">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">1</span>
                        <span>Claims</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <div className="flex items-center gap-3 mb-4 sm:mb-0">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">2</span>
                        <span>Evidence</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <div className="flex items-center gap-3 mb-4 sm:mb-0">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">3</span>
                        <span>Validation</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <div className="flex items-center gap-3 text-slate-900">
                        <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">4</span>
                        <span>Verdict</span>
                    </div>
                </div>

                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">
                    The Protocol
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                    {/* Stage 1 */}
                    <div className="bg-white p-8">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Stage 1</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Claim Extraction</h3>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Marketing claims parsed</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Structured into standardized claim cards</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>No judgment or scoring applied at this stage</span>
                            </li>
                        </ul>
                    </div>

                    {/* Stage 2 */}
                    <div className="bg-white p-8">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Stage 2</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Evidence Aggregation</h3>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Independent long-term usage sources gathered</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Minimum of 3 independent signals required</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Community & technical validation combination</span>
                            </li>
                        </ul>
                    </div>

                    {/* Stage 3 */}
                    <div className="bg-white p-8">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Stage 3</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Discrepancy Analysis</h3>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Claim vs. observed reality compared</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Rigorous overstatement detection applied</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Flags categorized as conditional or verified</span>
                            </li>
                        </ul>
                    </div>

                    {/* Stage 4 */}
                    <div className="bg-white p-8">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Stage 4</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Verification Score Calculation</h3>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Deterministic, integer-only scoring generated</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Strictly gated by minimum signal requirements</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-slate-300 mt-0.5">•</span>
                                <span>Final verdict locked to the reality ledger</span>
                            </li>
                        </ul>
                        <div className="mt-6 pt-5 border-t border-slate-100">
                            <Link href="/truth-index-methodology" className="inline-flex items-center text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest transition-colors">
                                Read Scoring Methodology →
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
                {/* 3. Insufficient Forensic Depth */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">
                        Data Triggers
                    </h2>

                    <div className="h-full flex flex-col">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">
                            What "Insufficient Forensic Depth" Means
                        </h3>
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed flex-grow">
                            <p>
                                A Verification Score is only issued when sufficient independent validation exists. When you see a notice for <strong>Insufficient Forensic Depth</strong>, it indicates one or both of the following:
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <span className="text-slate-300 mt-1">•</span>
                                    <span><strong>Missing independent sources</strong>: The product is too new, or not enough independent third-party data exists to verify the manufacturer&apos;s claims.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-slate-300 mt-1">•</span>
                                    <span><strong>Incomplete evidence payload</strong>: The data we have collected fails to meet the minimum threshold required by our deterministic scoring model.</span>
                                </li>
                            </ul>
                            <p className="pt-2 font-medium text-slate-800">
                                By withholding a score in these cases, we prevent confusion and ensure that every Verification Score on our platform is backed by hard, undeniable data.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. Disqualification Criteria */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">
                        Disqualifications
                    </h2>

                    <div className="h-full flex flex-col">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">
                            What Disqualifies a Product
                        </h3>
                        <p className="text-sm text-slate-600 mb-6">
                            A product will fail our audit and be flagged or disqualified under the following conditions:
                        </p>
                        <div className="space-y-0 border-t border-l border-slate-200">
                            <div className="border-r border-b border-slate-200 p-4">
                                <h4 className="font-bold text-slate-900 text-sm mb-1">Inflated wattage claims</h4>
                                <p className="text-xs text-slate-600">Representing peak output as sustained continuous output.</p>
                            </div>
                            <div className="border-r border-b border-slate-200 p-4">
                                <h4 className="font-bold text-slate-900 text-sm mb-1">Non-independent validation</h4>
                                <p className="text-xs text-slate-600">Presenting sponsored or controlled reviews as independent objective data.</p>
                            </div>
                            <div className="border-r border-b border-slate-200 p-4">
                                <h4 className="font-bold text-slate-900 text-sm mb-1">Missing battery spec transparency</h4>
                                <p className="text-xs text-slate-600">Obfuscating cycle life, chemistry, or usable capacity vs nameplate capacity.</p>
                            </div>
                            <div className="border-r border-b border-slate-200 p-4 bg-slate-50">
                                <h4 className="font-bold text-slate-900 text-sm mb-1">Failure to meet minimum evidence threshold</h4>
                                <p className="text-xs text-slate-600">Inability to gather enough independent validation signals across major parameters.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* 5. Closing Statement */}
            <footer className="border-t-4 border-slate-900 pt-12 text-center max-w-2xl mx-auto">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                    Closing Statement
                </h2>
                <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">
                    We do not accept payment to change verdicts.
                </h3>
                <p className="text-slate-600 font-medium text-lg leading-relaxed mb-12">
                    Products are scored using deterministic logic applied uniformly to all available data.
                </p>
                <div className="pt-8 border-t border-slate-200 max-w-xl mx-auto">
                    <p className="text-sm text-slate-500 italic">
                        A 100% Verification Score means no claim inflation was detected. It does not mean the product is the best choice for every use case.
                    </p>
                </div>
            </footer>
        </div>
    );
}
