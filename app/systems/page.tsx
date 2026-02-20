import React from 'react';
import Link from 'next/link';

export const runtime = 'edge';

export default function SystemsLanding() {
    return (
        <main className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-24 text-center bg-slate-50">
            <div className="max-w-xl mx-auto">
                <div className="inline-block bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 animate-pulse">
                    Coming Soon
                </div>

                <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-8">
                    Systems Are <br /><span className="text-slate-400">Coming.</span>
                </h1>

                <p className="text-lg text-slate-600 font-medium leading-relaxed mb-10">
                    Systems model how components work together (battery + inverter + panels + wiring) so comparisons reflect real-world setups, not just isolated spec dumps.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/specs" className="inline-block bg-slate-900 text-white px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-colors shadow-xl shadow-blue-900/10">
                        Browse Component Audits
                    </Link>
                </div>
            </div>
        </main>
    );
}
