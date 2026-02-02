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
        <div className="space-y-4">
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
                        <span className="font-black uppercase tracking-widest text-slate-600 text-[9px]">Ledger snapshot:</span>
                        <span className="font-bold text-slate-800 ml-2">{currentMonth}</span>
                    </div>
                    <div className="text-slate-500 text-[9px]">
                        Next refresh: ~14 days
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

            {/* Stage 2 - Pending (not implemented yet) */}
            <StageCard
                stageNumber={2}
                title=" Independent Signal"
                description="Community insights from Reddit, YouTube, forums"
                status="pending"
                estimatedTime="10-20s"
            />

            {/* Stage 3 - Locked (requires Stage 2) */}
            <StageCard
                stageNumber={3}
                title="Forensic Discrepancies"
                description="Cross-referencing claims with reality"
                status="pending"
                estimatedTime="20-30s"
            />

            {/* Stage 4 - Locked (requires Stage 3) */}
            <StageCard
                stageNumber={4}
                title="Verdict & Truth Index"
                description="Decision synthesis from all evidence"
                status="pending"
                estimatedTime="instant"
            />
        </div>
    );
}
