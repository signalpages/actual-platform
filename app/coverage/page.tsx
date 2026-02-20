import { getLedgerStats } from '@/lib/dataBridge.server';

export const runtime = 'edge';

export default async function CoveragePage() {
    const stats = await getLedgerStats();

    return (
        <div className="max-w-4xl mx-auto px-6 py-16">
            <h1 className="text-5xl font-black tracking-tightest mb-4 uppercase">
                COVERAGE
            </h1>

            <p className="text-lg text-slate-600 mb-12 max-w-2xl">
                Actual.fyi prioritizes information integrity over inventory volume. We maintain
                a curated index where every data point is weighted by its source reliability.
            </p>

            <div className="mb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
                    <h2 className="text-3xl font-black tracking-tightest uppercase">
                        INDEX SNAPSHOT
                    </h2>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Last checked: {new Date(stats.lastChecked).toLocaleTimeString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Latest ledger activity: {new Date(stats.ledgerUpdatedAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            Total Assets
                        </div>
                        <div className="text-4xl font-black tracking-tightest">
                            {stats.totalAssets}
                        </div>
                    </div>

                    <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">
                            Verified Assets
                        </div>
                        <div className="text-4xl font-black tracking-tightest text-blue-600">
                            {stats.verifiedAssets}
                        </div>
                    </div>

                    <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Provisional
                        </div>
                        <div className="text-4xl font-black tracking-tightest text-slate-500">
                            {stats.provisionalAssets}
                        </div>
                    </div>

                    <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
                        <div className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">
                            Pending Audit
                        </div>
                        <div className="text-4xl font-black tracking-tightest text-orange-600">
                            {stats.pendingAudits}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">

                {/* Verification Logic */}
                <div className="bg-slate-900 text-white rounded-2xl p-8">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                        Verification Logic
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex items-start gap-3 mb-2">
                                <span className="text-2xl font-black text-blue-500">01</span>
                                <div className="flex-1">
                                    <div className="font-bold mb-1">Source Triangulation</div>
                                    <div className="text-sm text-slate-300 leading-relaxed">
                                        We combine official FCC filings with independent community discharge tests to identify claim variance.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl font-black text-blue-500">02</span>
                                <div className="flex-1">
                                    <div className="font-bold mb-1">Signal Thresholds</div>
                                    <div className="text-sm text-slate-300 leading-relaxed">
                                        Assets remain "Provisional" until a minimum of three high-friction data points are resolved.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Why Is Some Data Missing */}
            <div className="mb-12">
                <h2 className="text-3xl font-black tracking-tightest mb-4">
                    WHY IS SOME DATA MISSING?
                </h2>
                <p className="text-slate-600 leading-relaxed">
                    Empty fields in the Truth Ledger are intentional. If a manufacturer claim cannot be verified through technical
                    documentation or peer-reviewed testing, we mark it as "Pending Verification" rather than displaying potentially
                    inaccurate marketing copy. We prioritize technical reality over consumer hype cycles.
                </p>
            </div>

            {/* The Provisional State */}
            <div className="mb-12">
                <h2 className="text-3xl font-black tracking-tightest mb-4">
                    THE PROVISIONAL STATE
                </h2>
                <p className="text-slate-600 leading-relaxed">
                    When you add an "Unverified Asset," our forensic engine performs a live synthesis of available community signals.
                    This state is neutral; it indicates that the asset exists within the energy domain but has not yet undergone our full
                    72-point verification protocol.
                </p>
            </div>

            {/* Contribute CTA */}
            <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-8">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-2xl font-black tracking-tightest mb-2">
                            CONTRIBUTE TO THE INDEX
                        </h3>
                        <p className="text-slate-600 mb-4">
                            Help us expand the ledger by submitting high-friction data points or new asset signatures.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <a
                            href="/contribute"
                            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            SUBMIT ASSET
                        </a>
                        <a
                            href="/specs"
                            className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors"
                        >
                            BROWSE LEDGER
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
