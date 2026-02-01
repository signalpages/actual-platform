'use client';

import { useState } from 'react';

export default function ContactPage() {
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) throw new Error('Submission failed');

            setSubmitted(true);
            setMessage('');
        } catch (err) {
            setError('Failed to submit. Please try again or email forensics@actual.fyi directly.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                Editorial Protocol
            </div>

            <h1 className="text-5xl font-black tracking-tightest mb-6">
                CONTACT
            </h1>

            <p className="text-lg text-slate-600 mb-12 max-w-2xl leading-relaxed">
                The most effective way to reach Actual.fyi is by contributing to the accuracy
                of the index. We prioritize corrections and technical reports that improve the
                forensic integrity of our Ledger.
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
                {/* Submit a Report */}
                <div className="bg-white border-2 border-slate-100 rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        <span className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                            SUBMIT A REPORT
                        </span>
                    </div>

                    {submitted ? (
                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                            <div className="text-green-600 font-bold mb-2">✓ Submission Received</div>
                            <p className="text-sm text-slate-600">
                                Your report has been queued for editorial review.
                            </p>
                            <button
                                onClick={() => setSubmitted(false)}
                                className="mt-4 text-sm text-blue-600 hover:underline"
                            >
                                Submit another report
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe the discrepancy or tool missing from the ledger..."
                                className="w-full h-32 p-4 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-blue-600 transition-colors mb-4"
                                required
                            />

                            <button
                                type="submit"
                                disabled={submitting || !message.trim()}
                                className="w-full bg-slate-900 text-white rounded-xl p-4 text-center font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'SUBMITTING...' : 'SUBMIT CORRECTION'}
                            </button>

                            {error && (
                                <p className="text-xs text-red-600 mt-3">{error}</p>
                            )}

                            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                                Use Cases: Broken links, outdated info, incorrect specs, or missing assets.
                            </p>
                        </form>
                    )}
                </div>

                {/* Submission Guidelines */}
                <div>
                    <div className="mb-8">
                        <h2 className="text-xl font-black tracking-tightest mb-3">
                            SUBMISSION GUIDELINES
                        </h2>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            To ensure precision, please include the specific page URL, a
                            detailed description of the discrepancy, and links to supporting
                            technical documentation where applicable.
                        </p>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xl font-black tracking-tightest mb-3">
                            COMMUNICATION EXPECTATIONS
                        </h2>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            All submissions are reviewed by our editorial team. Every report is
                            evaluated for its impact on the Ledger's overall reliability.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-black tracking-tightest mb-3">
                            EDITORIAL REGISTRY
                        </h2>
                        <a
                            href="mailto:forensics@actual.fyi"
                            className="text-sm font-bold text-blue-600 hover:underline"
                        >
                            forensics@actual.fyi
                        </a>
                    </div>
                </div>
            </div>

            {/* Return to Spec Ledger */}
            <div className="flex items-center justify-between pt-8 border-t border-slate-200">
                <p className="text-sm text-slate-400 italic">
                    Framework for information integrity and technical maintenance.
                </p>
                <a
                    href="/specs"
                    className="text-sm font-bold text-blue-600 hover:underline"
                >
                    RETURN TO SPEC LEDGER →
                </a>
            </div>
        </div>
    );
}
