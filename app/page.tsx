import Link from 'next/link';
import { getCategories } from '@/lib/productCategories';
import { CATEGORY_LABELS, ProductCategory } from '@/types';

export const runtime = 'edge';

export default async function Home() {
    const categories = getCategories();
    // Categories are already filtered by the source constant
    const validCategories = categories;

    return (
        <main>
            {/* Hero Section */}
            <section className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <div className="inline-block bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            Verified Hardware Intelligence
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white leading-[0.9] mb-6">
                            Independent <br />
                            <span className="text-blue-500">Hardware Audits</span> <br />
                            for DIY Solar
                        </h1>
                        <p className="text-slate-400 text-lg md:text-xl leading-relaxed mb-8 max-w-lg">
                            Structured, normalized, marketing-free product intelligence. We verify technical reality so you can build with confidence.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link href="/specs?category=portable_power_station" className="inline-flex justify-center items-center bg-blue-600 text-white px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all shadow-lg hover:shadow-blue-900/50">
                                Browse Audits
                            </Link>
                            <Link href="/compare" className="inline-flex justify-center items-center bg-slate-800 text-slate-300 border border-slate-700 px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-700 hover:text-white transition-all">
                                Compare Products
                            </Link>
                        </div>
                    </div>
                    <div className="relative hidden md:block">
                        {/* Audit Terminal Visualization */}
                        <div className="bg-slate-900 rounded-lg border border-slate-700 p-0 overflow-hidden shadow-2xl relative">
                            {/* Terminal Header */}
                            <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
                                <div className="flex gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                                    AUDIT_ID: 0X-29A4
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="p-6 font-mono text-xs">
                                <div className="flex justify-between items-end mb-6 border-b border-slate-700 pb-4">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Audited Asset</div>
                                        <div className="text-white font-bold text-sm tracking-wide">Solar Panel – 400W</div>
                                    </div>
                                    <div className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-widest border border-emerald-500/20">
                                        Status: Verified
                                    </div>
                                </div>

                                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 mb-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                    <div>Metric</div>
                                    <div className="text-right">Claimed</div>
                                    <div className="text-right">Real</div>
                                    <div className="text-right">Delta</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 py-2 border-b border-slate-800 items-center">
                                        <div className="text-slate-300">STC Power</div>
                                        <div className="text-right text-slate-400">400W</div>
                                        <div className="text-right text-amber-400 font-bold">392W</div>
                                        <div className="text-right text-amber-500">-2.0%</div>
                                    </div>
                                    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 py-2 border-b border-slate-800 items-center">
                                        <div className="text-slate-300">Module Eff.</div>
                                        <div className="text-right text-slate-400">22.5%</div>
                                        <div className="text-right text-slate-300">21.8%</div>
                                        <div className="text-right text-amber-500">-3.1%</div>
                                    </div>
                                    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 py-2 border-b border-slate-800 items-center">
                                        <div className="text-slate-300">VOC</div>
                                        <div className="text-right text-slate-400">37.2V</div>
                                        <div className="text-right text-emerald-400 font-bold">37.4V</div>
                                        <div className="text-right text-emerald-500">+0.5%</div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-between items-center bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                                        Composite Score
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full w-[82%] bg-blue-500"></div>
                                        </div>
                                        <div className="text-lg font-bold text-white">82<span className="text-slate-500 text-xs font-normal">/100</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Audit Categories */}
            <section className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-4">Audit Categories</h2>
                        <p className="text-slate-500 max-w-2xl mx-auto">
                            Comprehensive technical specifications and performance verification for core system components.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {validCategories.map(cat => (
                            <Link key={cat.id} href={`/specs?category=${cat.id}`} className="group bg-slate-50 border border-slate-200 p-8 rounded-3xl hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="h-12 w-12 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                        {cat.icon}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-blue-600 transition-colors">
                                        View Audits →
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{cat.label}</h3>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    {cat.description}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Systems Secondary */}
            <section className="py-24 bg-slate-50 border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-400 mb-4">Build a Complete System</h2>
                    <p className="text-slate-500 mb-8 max-w-lg mx-auto">
                        Use verified components to design a compatible energy setup. Learn how these parts work together.
                    </p>
                    <Link href="/systems" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors border-b-2 border-transparent hover:border-slate-900 pb-1">
                        Explore System Context →
                    </Link>
                </div>
            </section>
        </main>
    );
}
