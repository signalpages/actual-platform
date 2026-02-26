'use client';

import { useState, useEffect } from 'react';

export default function ContributePage() {
    const [manufacturer, setManufacturer] = useState('');
    const [model, setModel] = useState('');
    const [productUrl, setProductUrl] = useState('');
    const [category, setCategory] = useState('portable_power_station');

    // Honeypot fields
    const [companyWebsite, setCompanyWebsite] = useState('');
    const [formLoadedAt, setFormLoadedAt] = useState<string>('');

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Set honeypot timer
        setFormLoadedAt(Date.now().toString());
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manufacturer,
                    model,
                    category,
                    url: productUrl,
                    company_website: companyWebsite,
                    form_loaded_at: formLoadedAt
                })
            });

            if (!response.ok) throw new Error('Submission failed');

            setSubmitted(true);
        } catch (err) {
            setError('Failed to submit coverage request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="max-w-5xl mx-auto px-6 py-16">
            <div className="inline-block px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-8">
                Coverage Intelligence
            </div>

            <h1 className="text-6xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-4">
                Influence the Truth Index Rankings
            </h1>

            <p className="text-lg text-slate-600 mb-12 max-w-2xl leading-relaxed">
                Help us prioritize future forensic audits. High-demand products are reviewed first.
            </p>

            <div className="grid lg:grid-cols-2 gap-12">
                {/* LEFT: Simple Form */}
                <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6">
                        Product Details
                    </div>

                    {submitted ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                            <div className="text-emerald-500 font-bold mb-2">Request Logged ✓</div>
                            <p className="text-sm text-emerald-800 mb-6 font-medium">
                                Thank you. Your product request has been added to our coverage queue.
                            </p>

                            <button
                                onClick={() => {
                                    setSubmitted(false);
                                    setManufacturer('');
                                    setModel('');
                                    setProductUrl('');
                                    setFormLoadedAt(Date.now().toString());
                                }}
                                className="text-xs font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900 transition-colors"
                            >
                                + Submit Another
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {/* Hidden field for spam bots */}
                            <input
                                type="text"
                                name="company_website"
                                value={companyWebsite}
                                onChange={(e) => setCompanyWebsite(e.target.value)}
                                className="hidden"
                                tabIndex={-1}
                                autoComplete="off"
                            />

                            <div className="space-y-6 mb-8">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        Manufacturer
                                    </label>
                                    <input
                                        type="text"
                                        value={manufacturer}
                                        onChange={(e) => setManufacturer(e.target.value)}
                                        placeholder="e.g. EcoFlow, Jackery"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                                        required
                                        maxLength={120}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        Model
                                    </label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        placeholder="e.g. Delta Pro Ultra"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                                        required
                                        maxLength={120}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        Category
                                    </label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none"
                                    >
                                        <option value="portable_power_station">Portable Power Station</option>
                                        <option value="solar_panel">Solar Panel</option>
                                        <option value="inverter">Inverter</option>
                                        <option value="charge_controller">Charge Controller</option>
                                        <option value="deep_cycle_battery">Deep Cycle Battery</option>
                                        <option value="home_backup_system">Home Backup System</option>
                                        <option value="ev_charger">EV Charger</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        Product URL <span className="text-slate-300 font-normal">(Optional)</span>
                                    </label>
                                    <input
                                        type="url"
                                        value={productUrl}
                                        onChange={(e) => setProductUrl(e.target.value)}
                                        placeholder="https://"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                                        maxLength={800}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !manufacturer.trim() || !model.trim()}
                                className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 shadow-lg shadow-blue-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Submitting...' : 'Submit Coverage Request'}
                            </button>

                            {error && (
                                <p className="text-xs font-medium text-red-500 mt-4 text-center">{error}</p>
                            )}
                        </form>
                    )}
                </div>

                {/* RIGHT: Transparent Process & Leaderboard */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                            How Coverage Works
                        </div>
                        <ul className="space-y-4 text-sm font-medium text-slate-600">
                            <li className="flex gap-3">
                                <span className="text-blue-500">01</span>
                                Submissions are logged and deduplicated.
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-500">02</span>
                                Products are prioritized based on request volume and market relevance.
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-500">03</span>
                                Our forensic review team performs a structured audit.
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-500">04</span>
                                Verified results are added to the Truth Index rankings.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
