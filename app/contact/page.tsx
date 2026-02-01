export const runtime = 'edge';

export default function ContactPage() {
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

                    <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                        Describe the discrepancy or tool missing from the ledger...
                    </p>

                    <div className="bg-slate-900 text-white rounded-xl p-4 text-center font-bold cursor-pointer hover:bg-slate-800 transition-colors">
                        SUBMIT CORRECTION
                    </div>

                    <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                        Use Cases: Broken links, outdated info, incorrect specs, or missing assets.
                    </p>
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
