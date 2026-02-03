'use client';

/**
 * Simple Staged Audit Demo Component
 * Demonstrates progressive loading UI
 */



import { StageCard } from './StageCard';
import { Asset, AuditResult } from '@/types';
import { ComparisonButton } from './ComparisonButton';
import { StickyCompareButton } from './StickyCompareButton';
import { useEffect, useState } from 'react';

interface StagedAuditDemoProps {
    product: Asset;
    audit?: AuditResult | null;
}

export function StagedAuditDemo({ product, audit }: StagedAuditDemoProps) {
    // Fallback claim profile from product specs if audit not ready
    const claimProfile = audit?.claim_profile?.length
        ? audit.claim_profile
        : product?.technical_specs?.length
            ? product.technical_specs.map((spec: any) => ({
                label: spec.label || spec.name,
                value: spec.value
            }))
            : [];

    // Extract Stage Data from Audit
    // We expect the audit object to be populated recursively from the backend
    const stages = (audit as any)?.stages || {};

    // Helper to get stage status safely
    const getStatus = (key: string) => stages[key]?.status || 'pending';
    const getData = (key: string) => stages[key]?.data;

    return (
        <div className="space-y-4 relative">
            {/* Top Comparison CTA */}
            <div className="mb-8">
                <ComparisonButton variant="primary" productSlug={product.slug} />
            </div>

            {/* Sticky CTA */}
            <StickyCompareButton
                productSlug={product.slug}
                category={product.category}
                brand={product.brand}
            />

            {/* Stage 1: Claims */}
            <div id="stage-1">
                <StageCard
                    stageNumber={1}
                    title="Claim Profile"
                    description="Manufacturer's claimed specifications"
                    status={getStatus('stage_1') === 'pending' && claimProfile.length > 0 ? 'done' : getStatus('stage_1')}
                    data={{ claim_profile: claimProfile }}
                    estimatedTime="1-3s"
                />
            </div>

            {/* Stage 2: Independent Signal */}
            <StageCard
                stageNumber={2}
                title="Independent Signal"
                description="Community insights from Reddit, YouTube, forums"
                status={getStatus('stage_2')}
                data={getData('stage_2')}
                estimatedTime="10-20s"
            />

            {/* Stage 3: Discrepancies */}
            <StageCard
                stageNumber={3}
                title="Forensic Discrepancies"
                description="Cross-referencing claims with reality"
                status={getStatus('stage_3')}
                data={getData('stage_3')}
                estimatedTime="20-30s"
            />

            {/* Stage 4: Verdict (Includes Metric Bars via StageCard internal rendering) */}
            <StageCard
                stageNumber={4}
                title="Verdict & Truth Index"
                description="Decision synthesis from all evidence"
                status={getStatus('stage_4')}
                data={getData('stage_4')}
                estimatedTime="instant"
            />

            <div className="text-center pt-8 text-xs text-slate-400">
                <p>Audit Ledger ID: {audit?.assetId || '---'}</p>
                <p className="mt-1">Snapshot: {new Date(audit?.analysis?.last_run_at || Date.now()).toLocaleDateString()}</p>
            </div>
        </div>
    );
}
