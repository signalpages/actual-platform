'use client';

import { useState } from 'react';

export default function ContributePage() {
    const [manufacturer, setManufacturer] = useState('');
    const [model, setModel] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manufacturer,
                    model,
                    category: 'Portable Power Station'
                })
            });

            if (!response.ok) throw new Error('Submission failed');

            setSubmitted(true);
            setManufacturer('');
            setModel('');
        } catch (err) {
            setError('Failed to initiate audit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="inline-block px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded mb-8">
                Ledger Expansion Protocol
            </div>

            <h1 className="text-6xl font-black tracking-tightest mb-6">
                REGISTER NEW ASSET
            </h1>

            <p className="text-lg text-slate-600 mb-12 max-w-2xl leading-relaxed">
                Add an unverified entry to the global energy ledger. Once registered, the
                forensic engine will attempt to cross-reference technical claims against real-world datasets.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Technical Signature Definition */}
                <div className="bg-white border-2 border-slate-100 rounded-2xl p-8">
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-6">
                        Technical Signature Definition
                    </div>

                    {submitted ? (
                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                            <div className="text-green-600 font-bold mb-2">✓ Asset Registered</div>
                            <p className="text-sm text-slate-600 mb-4">
                                Forensic audit initiated. Status: <span className="font-bold">Provisional</span>
                            </p>
                            <button
                                onClick={() => setSubmitted(false)}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Register another asset
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Manufacturer
                                </label>
                                <input
                                    type="text"
                                    value={manufacturer}
                                    onChange={(e) => setManufacturer(e.target.value)}
                                    placeholder="e.g. EcoFlow, Jackery"
                                    className="w-full p-4 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-colors"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Model / Signature
                                </label>
                                <input
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    placeholder="e.g. Delta Pro Ultra"
                                    className="w-full p-4 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-colors"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Asset Category
                                </label>
                                <div className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold">
                                    Portable Power Station
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !manufacturer.trim() || !model.trim()}
                                className="w-full bg-slate-900 text-white rounded-xl p-4 text-center font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'INITIATING AUDIT...' : 'INITIATE FORENSIC AUDIT'}
                            </button>

                            {error && (
                                <p className="text-xs text-red-600 mt-3">{error}</p>
                            )}
                        </form>
                    )}
                </div>

                {/* Entry Constraints & Verification */}
                <div>
                    <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-8 mb-6">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                            Entry Constraints
                        </div>
                        <div className="space-y-3 text-sm text-slate-600">
                            <div className="flex items-start gap-2">
                                <span className="italic text-blue-600 mt-0.5">/</span>
                                <p>Direct entry is restricted to Power & Energy domains only.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="italic text-blue-600 mt-0.5">/</span>
                                <p>Duplicate signatures are merged into the existing audit history.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="italic text-blue-600 mt-0.5">/</span>
                                <p>Verification status is "Provisional" until 3 high-friction sources are logged.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-8">
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">
                            Verification Active
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            By submitting an asset, you initiate a live forensic scan. The engine will
                            query FCC databases, Reddit technical logs, and official manuals to synthesize
                            a Truth Index.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
