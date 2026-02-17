import Link from 'next/link';

export default function SystemsPage() {
    return (
        <main className="max-w-4xl mx-auto px-6 py-24">
            <header className="mb-16 text-center">
                <div className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                    Educational Context
                </div>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-6">
                    System Architecture
                </h1>
                <p className="text-slate-500 text-xl max-w-2xl mx-auto leading-relaxed">
                    Understand how verified components connect to form a reliable off-grid energy system.
                </p>
            </header>

            <div className="space-y-24">
                {/* Generation */}
                <section className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="order-2 md:order-1">
                        <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100">
                            <div className="text-6xl mb-4">☀️</div>
                            <h3 className="text-2xl font-black text-amber-900 uppercase tracking-tight mb-2">Generation</h3>
                            <p className="text-amber-800/80 mb-6">
                                The foundation of your system. Solar panels capture energy, but their actual output rarely matches their rated wattage due to thermal losses and efficiency curves.
                            </p>
                            <Link href="/specs?category=solar_panel" className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all inline-block">
                                Browse Verified Panels →
                            </Link>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-4">Energy Capture</h2>
                        <p className="text-slate-500 leading-relaxed mb-6">
                            Solar panels are the fuel source. We audit them to determine their <strong>Real-World STC Score</strong>—the actual wattage you can expect under standard test conditions, separate from optimistic marketing labels.
                        </p>
                    </div>
                </section>

                {/* Storage */}
                <section className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-4">Energy Storage</h2>
                        <p className="text-slate-500 leading-relaxed mb-6">
                            Batteries are the tank. Manufacturer capacity claims are often total theoretical capacity, not usable capacity. Our discharge tests reveal the <strong>Usable Wh</strong> you actually get before the BMS cuts off.
                        </p>
                    </div>
                    <div>
                        <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100">
                            <div className="text-6xl mb-4">🔋</div>
                            <h3 className="text-2xl font-black text-emerald-900 uppercase tracking-tight mb-2">Storage</h3>
                            <p className="text-emerald-800/80 mb-6">
                                Lithium Iron Phosphate (LFP) is the standard. We verify cycle life claims and discharge efficiency to ensure you aren't buying dead weight.
                            </p>
                            <Link href="/specs?category=home_backup_system" className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all inline-block">
                                Browse Verified Batteries →
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Conversion */}
                <section className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="order-2 md:order-1">
                        <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100">
                            <div className="text-6xl mb-4">⚡</div>
                            <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tight mb-2">Conversion</h3>
                            <p className="text-blue-800/80 mb-6">
                                Inverters turn DC battery power into AC household power. Efficiency matters—a poor inverter burns 15% of your battery energy just as heat.
                            </p>
                            <Link href="/specs?category=inverter" className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all inline-block">
                                Browse Verified Inverters →
                            </Link>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-4">Power Delivery</h2>
                        <p className="text-slate-500 leading-relaxed mb-6">
                            The inverter is the gateway to your appliances. We stress-test them to verify their <strong>Continuous Output</strong> matches the rating without overheating or voltage sag.
                        </p>
                    </div>
                </section>

                <div className="text-center pt-12 border-t border-slate-200">
                    <Link href="/compare" className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg">
                        Compare Components
                    </Link>
                </div>
            </div>
        </main>
    );
}
