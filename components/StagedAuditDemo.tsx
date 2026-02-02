'use client';

/**
 * Simple Staged Audit Demo Component
 * Demonstrates progressive loading UI
 */

import { StageCard } from './StageCard';
import { Asset } from '@/types';
import { ComparisonButton } from './ComparisonButton';
import { useEffect, useState } from 'react';

interface StagedAuditDemoProps {
    product?: Asset;
}

export function StagedAuditDemo({ product }: StagedAuditDemoProps) {
    const [showStickyCompare, setShowStickyCompare] = useState(false);

    // Show sticky comparison button after Stage 1 is in view
    useEffect(() => {
        const handleScroll = () => {
            const stage1Element = document.getElementById('stage-1');
            if (stage1Element) {
                const rect = stage1Element.getBoundingClientRect();
                // Show sticky when Stage 1 is past the top of viewport
                setShowStickyCompare(rect.top < 0);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Use real product data if available, otherwise use demo data
    const claimProfile = product?.technical_specs?.length ?
        product.technical_specs.map(spec => ({
            label: spec.label || spec.name,
            value: spec.value
        })) : [
            { label: "Battery Capacity", value: "2048Wh (2000W·h)" },
            { label: "AC Output", value: "2000W continuous (4000W surge)" },
            { label: "Battery Chemistry", value: "LiFePO4 (LFP)" },
            { label: "Cycle Life", value: "3000+ cycles to 80%" },
            { label: "Recharge Time", value: "1.5 hrs (AC + Solar)" },
            { label: "Weight", value: "61.9 lbs (28.1 kg)" },
            { label: "Dimensions", value: "16.5 × 11.0 × 14.1 in" },
            { label: "Operating Temperature", value: "-4°F to 104°F" }
        ];

    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return (
        <div className="p-6 space-y-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 mb-6">
            {/* Header with Product Name and Truth Index */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-black uppercase tracking-wider text-slate-900">
                        ✨ Progressive Audit (Demo)
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-white px-3 py-1 rounded-full inline-block mt-2">
                        NEW
                    </span>
                </div>

                {/* Truth Index Score - Top Right */}
                <div className="text-right">
                    <div className="text-5xl font-black text-blue-600 leading-none">
                        92%
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                        Truth Index
                    </div>
                </div>
            </div>

            {/* PRIMARY COMPARISON CTA - Always visible */}
            <ComparisonButton variant="primary" productSlug={product?.slug} />

            {/* CONDITIONAL STICKY COMPARISON CTA */}
            {showStickyCompare && (
                <ComparisonButton
                    variant="secondary"
                    productSlug={product?.slug}
                />
            )}

            {/* Ledger Snapshot Timestamp */}
            <div className="bg-white/70 border border-blue-300 rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="font-black text-slate-600 uppercase tracking-wider">Ledger snapshot:</span>
                        <span className="ml-2 font-bold text-slate-900">{currentMonth}</span>
                    </div>
                    <div className="text-right">
                        <span className="font-medium text-slate-500">Next scheduled refresh:</span>
                        <span className="ml-2 font-bold text-blue-600">~14 days</span>
                    </div>
                </div>
            </div>

            {/* Stage 1 - Completed with claim profile */}
            <div id="stage-1">
                <StageCard
                    stageNumber={1}
                    title="Claim Profile"
                    description="Manufacturer's claimed specifications"
                    status="done"
                    data={{ claim_profile: claimProfile }}
                    estimatedTime="1-3s"
                />
            </div>

            {/* Stage 2 - Completed with sample community data */}
            <StageCard
                stageNumber={2}
                title="Independent Signal"
                description="Community insights from Reddit, YouTube, forums"
                status="done"
                data={{
                    independent_signal: {
                        most_praised: [
                            "Fast charging capability (1.5hr full charge)",
                            "Reliable LiFePO4 battery chemistry with long lifespan",
                            "Clean sine wave output suitable for sensitive electronics",
                            "Excellent build quality and battery management system",
                            "Multiple charging options (AC, solar, car)"
                        ],
                        most_reported_issues: [
                            "Fan noise above ~50% load (measured at 45dB)",
                            "Usable capacity typically 10-15% below rated spec",
                            "App connectivity drops occasionally on WiFi",
                            "Weight makes portability challenging (62+ lbs)"
                        ]
                    }
                }}
                estimatedTime="5-15s"
            />

            {/* Stage 3 - Completed with sample discrepancies */}
            <StageCard
                stageNumber={3}
                title="Forensic Discrepancies"
                description="Cross-referencing claims with reality"
                status="done"
                data={{
                    red_flags: [
                        {
                            claim: "2048Wh capacity",
                            reality: "Actual tested: ~1780-1840Wh usable (87-90% efficiency)",
                            severity: "minor",
                            impact: "10-13% lower than advertised"
                        },
                        {
                            claim: "Silent operation",
                            reality: "Fan activates at 50%+ load (~45dB measured)",
                            severity: "minor",
                            impact: "Marketing claim overstated for high-load scenarios"
                        },
                        {
                            claim: "1.5 hour recharge time",
                            reality: "Typical range: 1.6-2.0hrs depending on temperature",
                            severity: "minor",
                            impact: "Optimal conditions required for advertised speed"
                        }
                    ]
                }}
                estimatedTime="20-30s"
            />

            {/* Stage 4 - Completed with comprehensive decision synthesis */}
            <StageCard
                stageNumber={4}
                title="Verdict & Truth Index"
                description="Decision synthesis from all evidence"
                status="done"
                data={{
                    truth_index: "92",
                    verification_status: "verified",

                    // Visual metric bars
                    metric_bars: [
                        { label: "Claims Accuracy", rating: "High", percentage: 92 },
                        { label: "Real-World Fit", rating: "High", percentage: 88 },
                        { label: "Operational Noise", rating: "Moderate", percentage: 65 }
                    ],

                    // Score interpretation
                    score_interpretation: "This product meets most of its published claims under typical usage. Discrepancies are present but limited in scope and operational impact.",

                    // Score drivers
                    strengths: [
                        "Capacity and cycle-life claims verified across independent testing",
                        "Inverter performance stable under sustained loads",
                        "LiFePO4 chemistry delivers on longevity expectations",
                        "Recharge speed competitive for capacity class"
                    ],
                    limitations: [
                        "Observed: Usable energy lower than rated due to expected efficiency losses",
                        "Verified: Audible fan noise under higher loads",
                        "Observed: Recharge time temperature-dependent"
                    ],

                    // Practical impact
                    practical_impact: [
                        "Expect ~10–13% less usable energy than headline capacity",
                        "Fan noise becomes noticeable above ~50% sustained load",
                        "Recharge time varies meaningfully with ambient temperature",
                        "Portability challenged by weight (62+ lbs)"
                    ],

                    // Fit guidance
                    good_fit: [
                        "Reliable sustained output",
                        "Fast recharge relative to capacity class",
                        "Long-life LFP chemistry",
                        "Clean sine wave for sensitive electronics"
                    ],
                    consider_alternatives: [
                        "Silent operation under high load",
                        "Maximum usable capacity per pound",
                        "Ultra-fast recharge in cold environments",
                        "Sub-60lb portability requirement"
                    ],

                    // Data confidence footer
                    data_confidence: "Data confidence: High · Sources: manufacturer docs, independent testing, long-term user reports · Ledger snapshot: Feb 2026 · Refresh cadence: ~14 days"
                }}
                estimatedTime="instant"
            />

            <p className="text-xs text-slate-500 italic text-center pt-2">
                This is a demo of the new staged audit system. Data loads progressively instead of all at once.
            </p>
        </div>
    );
}
