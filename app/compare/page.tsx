import React from 'react';
import Link from 'next/link';

export const runtime = 'edge';

export default function CompareLanding() {
    return (
        <main className="max-w-6xl mx-auto px-6 py-24">
            <header className="mb-16 text-center max-w-3xl mx-auto">
                <div className="inline-block bg-blue-900/10 text-blue-600 border border-blue-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                    Forensic Showdown
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-6">
                    Compare <span className="text-blue-600">Hardware</span><br />
                    Side-by-Side
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed mb-8">
                    Select two products to see a direct forensic comparison of their verified technical specifications, real-world performance, and limitations.
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Manual Selection CTA */}
                <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-10 text-center hover:bg-white hover:shadow-xl transition-all group">
                    <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-6 text-2xl group-hover:scale-110 transition-transform">
                        🔍
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Browse Ledger</h3>
                    <p className="text-xs text-slate-500 mb-6">
                        Find products in the audit ledger to start a comparison.
                    </p>
                    <Link href="/specs" className="inline-block bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-colors">
                        Go to Ledger
                    </Link>
                </div>

                {/* Example Comparison CTAs */}
                <div className="bg-blue-600 text-white rounded-[2.5rem] p-10 text-center shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-blue-500/50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl border border-blue-400/50">
                            ⚡
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">Popular Matchups</h3>
                        <p className="text-xs text-blue-100 mb-6">
                            See what others are comparing right now.
                        </p>
                        <div className="space-y-3">
                            <span className="block text-[10px] font-black uppercase tracking-widest opacity-50">Examples Coming Soon</span>
                            {/* 
                            <Link href="/compare/anker-c1000-vs-delta-2" className="block bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-[10px] font-bold transition-colors">
                                Anker C1000 vs EcoFlow Delta 2
                            </Link>
                            */}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
