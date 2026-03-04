import { Metadata } from 'next';
import Link from 'next/link';
import { getProductsByCategoryWithAudits } from '@/lib/dataBridge.server';

export const metadata: Metadata = {
    title: 'Portable Power Station Audits & Reviews – Actual.fyi',
    description: 'Independent forensic audits of portable power stations. Verified specifications, Truth Index scoring, and side-by-side comparisons of top solar generators.',
};

export default async function PortablePowerStationsHub() {
    const products = await getProductsByCategoryWithAudits('portable_power_station');

    // Sort by truth score descending
    const sortedProducts = products.sort((a, b) => {
        const scoreA = a.truth_score || 0;
        const scoreB = b.truth_score || 0;
        return scoreB - scoreA;
    });

    return (
        <main className="bg-white min-h-screen">
            {/* Hero Section */}
            <section className="bg-slate-900 border-b border-slate-800 pt-24 pb-16 px-6">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="inline-block bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                        Category Hub
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-6">
                        Portable Power Station Audits
                    </h1>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        Independent forensic audits of portable power stations using a four-stage validation framework. We strip away marketing claims to find the technical reality.
                    </p>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-16 px-6">
                <div className="max-w-5xl mx-auto space-y-16">

                    {/* Truth Index Table */}
                    <div>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Truth Index Rankings</h2>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">{sortedProducts.length} Models Verified</span>
                        </div>

                        {sortedProducts.length === 0 ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
                                <span className="text-4xl mb-4 block">📡</span>
                                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 mb-2">Coverage Expanding</h3>
                                <p className="text-slate-500 text-sm max-w-md mx-auto">
                                    We are currently processing the baseline audits for this category. Check back soon for verified Truth Index scores.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-1/4">Model</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-1/6">Truth Index</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-1/4">Key Strength</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-1/4">Key Limitation</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-auto text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {sortedProducts.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-4 focus-within:bg-blue-50/50">
                                                    <Link href={`/specs/${p.slug}`} className="block">
                                                        <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{p.brand} {p.model_name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">{p.slug}</div>
                                                    </Link>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-sm font-black ${p.truth_score && p.truth_score >= 80 ? 'text-emerald-600' :
                                                                p.truth_score && p.truth_score >= 60 ? 'text-amber-500' :
                                                                    'text-red-500'
                                                            }`}>
                                                            {p.truth_score ? `${p.truth_score}%` : 'TBD'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-xs text-slate-700 font-medium leading-snug">
                                                    {p.key_strength}
                                                </td>
                                                <td className="p-4 text-xs text-slate-600 leading-snug">
                                                    {p.key_limitation}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Link href={`/compare?p1=${p.slug}`} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors">
                                                        Compare →
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Category Method Note */}
                    <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl max-w-3xl">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Category Methodology</h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            In the Portable Power Station category, marketing often exaggerates surge capacities, theoretical solar input limits, and battery cycle life under ideal conditions.
                            Our audits validate the actual nominal continuous AC output, structural limitations of the MPPT controllers, and the reality of manufacturer warranties.
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            A high Truth Index score means the unit reliably delivers its advertised specifications under normal operating stress, without hidden caveats in the manual or regulatory filings.
                        </p>
                    </div>

                    {/* Internal Links */}
                    <div className="grid md:grid-cols-3 gap-6 pt-8 border-t border-slate-100">
                        <Link href="/compare" className="group p-6 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">Compare Models</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">Line up portable power stations side-by-side to expose specification differences.</p>
                        </Link>
                        <Link href="/methodology" className="group p-6 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">Our Methodology</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">Read about the four-stage validation framework used to calculate the Truth Index.</p>
                        </Link>
                        <Link href="/specs" className="group p-6 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">All Audits</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">Browse the complete reality ledger across all tested hardware categories.</p>
                        </Link>
                    </div>

                </div>
            </section>
        </main>
    );
}
