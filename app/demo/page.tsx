'use client';

import { StagedAuditDemo } from '@/components/StagedAuditDemo';

export default function DemoPage() {
    // Sample product data for demo
    const sampleProduct = {
        id: 1,
        name: "DELTA 2 MAX Portable Power Station",
        slug: "delta-2-max",
        technical_specs: [
            { label: "Battery Capacity", value: "2048Wh (2000W·h)" },
            { label: "AC Output", value: "2000W continuous (4000W surge)" },
            { label: "Battery Chemistry", value: "LiFePO4 (LFP)" },
            { label: "Cycle Life", value: "3000+ cycles to 80%" },
            { label: "Recharge Time", value: "1.5 hrs (AC + Solar)" },
            { label: "Weight", value: "61.9 lbs (28.1 kg)" },
            { label: "Dimensions", value: "16.5 × 11.0 × 14.1 in" },
            { label: "Operating Temperature", value: "-4°F to 104°F" }
        ]
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-slate-900 mb-2">
                        Progressive Audit Demo
                    </h1>
                    <p className="text-sm text-slate-600">
                        New staged loading experience with trust-building UX improvements
                    </p>
                </div>

                <StagedAuditDemo product={sampleProduct as any} />

                <div className="mt-8 text-center">
                    <a
                        href="/"
                        className="text-sm text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider"
                    >
                        ← Back to Home
                    </a>
                </div>
            </div>
        </div>
    );
}
