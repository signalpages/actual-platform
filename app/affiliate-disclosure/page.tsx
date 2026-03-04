import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Affiliate Disclosure | Actual.fyi',
    description: 'Transparency regarding our integrity model, affiliate links, and sponsored audit policies.',
};

export default function AffiliateDisclosurePage() {
    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <header className="mb-20">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase mb-6">
                    Affiliate Disclosure
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 font-medium leading-relaxed">
                    Some links on this site may be affiliate links. This does not influence product scoring.
                </p>
                <div className="h-1 w-20 bg-blue-600 mt-10"></div>
            </header>

            <div className="space-y-16">
                {/* Integrity Model */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-4">
                        Integrity Model
                    </h2>
                    <ul className="space-y-4 text-sm text-slate-600">
                        <li className="flex items-start gap-3">
                            <span className="text-slate-300 mt-0.5">•</span>
                            <span><strong>Affiliate links appear only on audited products.</strong> We do not place commerce links on products that bypass our validation framework.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-slate-300 mt-0.5">•</span>
                            <span><strong>Truth Index gating ≥ 80%.</strong> We do not monetize products that fail to meet our minimum technical standards. Products scoring below 80% do not carry affiliate links.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-slate-300 mt-0.5">•</span>
                            <span><strong>No paid ranking placement.</strong> We do not accept payment to feature products higher on category pages or comparison lists.</span>
                        </li>
                    </ul>
                </section>

                {/* Sponsored Audit Policy */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-4">
                        Sponsored Audit Policy
                    </h2>
                    <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                        <p>
                            Manufacturers may request expedited processing for an upcoming product launch by sponsoring an audit.
                        </p>
                        <p>
                            <strong>Payment covers prioritization only.</strong> It moves the product to the front of the analysis queue. It does not alter the outcome, and it does not guarantee a positive Truth Index score or an affiliate link.
                        </p>
                        <p>
                            If a sponsored product inflates its claims or fails validation, those discrepancies will be published exactly the same as an unsponsored product.
                        </p>
                    </div>
                </section>

                {/* Data Independence */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-4">
                        Data Independence
                    </h2>
                    <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                        <p>
                            All verdicts are locked by deterministic logic. If the independent evidence contradicts the marketing claims, the score is penalized.
                        </p>
                        <p>
                            There are absolutely no post-hoc edits made to a Truth Index to appease advertisers or affiliate partners. The protocol is uniform across all brands.
                        </p>
                    </div>
                </section>
            </div>

            <footer className="mt-24 pt-8 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Last Updated: March 2026
                </p>
            </footer>
        </div>
    );
}
