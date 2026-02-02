/**
 * Stage execution helpers for progressive audit loading
 * 
 * Stage 0: Ledger Check (silent, server-side)
 * Stage 1: Claim Profile (1-3s, cached)
 * Stage 2: Independent Signal (5-15s, Reddit/YouTube/forums)
 * Stage 3: Forensic Discrepancies (20-30s, Gemini synthesis)
 * Stage 4: Verdict & Truth Index (instant after stage 3)
 */

import { Product } from '@/types';
import { createClient } from "@supabase/supabase-js";
import { updateStageHelper } from './updateStageHelper';

const getSupabase = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials");
    return createClient(url, key, { auth: { persistSession: false } });
};

// Wrapper for updateStage
async function updateStage(
    productId: string,
    stageName: 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4',
    stageData: any
) {
    const supabase = getSupabase();
    return updateStageHelper({ productId, stageName, stageData, supabase });
}

/**
 * Stage 1: Extract claimed specifications from manufacturer
 * TTL: 30 days
 */
export async function runStage1_ClaimProfile(productId: string, product: Product) {
    console.log(`[Stage 1] Starting claim profile extraction for ${product.model_name}`);

    await updateStage(productId, 'stage_1', { status: 'running' });

    try {
        // TODO: Implement manufacturer page scraping
        // For now, use existing product technical_specs
        const claimProfile = product.technical_specs || [];

        await updateStage(productId, 'stage_1', {
            status: 'done',
            data: { claim_profile: claimProfile },
            completed_at: new Date().toISOString()
        });

        console.log(`[Stage 1] ✅ Completed for ${product.model_name}`);
        return { claim_profile: claimProfile };
    } catch (error: any) {
        console.error(`[Stage 1] ❌ Failed:`, error);
        await updateStage(productId, 'stage_1', {
            status: 'error',
            error: error.message
        });
        throw error;
    }
}

/**
 * Stage 2: Aggregate independent signal from community sources
 * TTL: 14 days
 */
export async function runStage2_IndependentSignal(productId: string, product: Product) {
    console.log(`[Stage 2] Starting independent signal aggregation for ${product.model_name}`);

    await updateStage(productId, 'stage_2', { status: 'running' });

    try {
        const query = `${product.brand} ${product.model_name}`;

        // TODO: Implement Reddit/YouTube/Forum scraping
        // Placeholder for now
        const independentSignal = {
            most_reported_issues: [],
            most_praised: [],
            sources: []
        };

        await updateStage(productId, 'stage_2', {
            status: 'done',
            data: { independent_signal: independentSignal },
            completed_at: new Date().toISOString()
        });

        console.log(`[Stage 2] ✅ Completed for ${product.model_name}`);
        return { independent_signal: independentSignal };
    } catch (error: any) {
        console.error(`[Stage 2] ❌ Failed:`, error);
        await updateStage(productId, 'stage_2', {
            status: 'error',
            error: error.message
        });
        throw error;
    }
}

/**
 * Stage 3: Forensic discrepancy detection via Gemini synthesis
 * TTL: 30 days
 */
export async function runStage3_ForensicDiscrepancies(productId: string, stage1Data: any, stage2Data: any) {
    console.log(`[Stage 3] Starting forensic analysis`);

    await updateStage(productId, 'stage_3', { status: 'running' });

    try {
        // TODO: Implement Gemini synthesis to compare claims vs. reality
        // Placeholder for now
        const redFlags = [];

        await updateStage(productId, 'stage_3', {
            status: 'done',
            data: { red_flags: redFlags },
            completed_at: new Date().toISOString()
        });

        console.log(`[Stage 3] ✅ Completed`);
        return { red_flags: redFlags };
    } catch (error: any) {
        console.error(`[Stage 3] ❌ Failed:`, error);
        await updateStage(productId, 'stage_3', {
            status: 'error',
            error: error.message
        });
        throw error;
    }
}

/**
 * Stage 4: Calculate truth index and generate verdict
 * TTL: 30 days
 */
export async function runStage4_Verdict(productId: string, allStages: any) {
    console.log(`[Stage 4] Calculating verdict`);

    await updateStage(productId, 'stage_4', { status: 'running' });

    try {
        const redFlags = allStages.stage_3?.data?.red_flags || [];
        const truthIndex = Math.max(0, 100 - (redFlags.length * 5)); // Simple calculation
        const verificationStatus = redFlags.length < 3 ? 'verified' : 'provisional';

        const verdict = redFlags.length === 0
            ? 'Claims are accurate and well-supported.'
            : `${redFlags.length} discrepancies found. Review carefully.`;

        await updateStage(productId, 'stage_4', {
            status: 'done',
            data: {
                truth_index: truthIndex,
                verification_status: verificationStatus,
                last_updated: new Date().toISOString(),
                verdict
            },
            completed_at: new Date().toISOString()
        });

        console.log(`[Stage 4] ✅ Completed - Truth Index: ${truthIndex}`);
        return { truth_index: truthIndex, verification_status: verificationStatus, verdict };
    } catch (error: any) {
        console.error(`[Stage 4] ❌ Failed:`, error);
        await updateStage(productId, 'stage_4', {
            status: 'error',
            error: error.message
        });
        throw error;
    }
}

/**
 * Check if a stage is fresh based on TTL
 */
export function isStageFresh(stageData: any, ttlDays: number): boolean {
    if (!stageData || stageData.status !== 'done' || !stageData.completed_at) {
        return false;
    }

    const completedAt = new Date(stageData.completed_at);
    const now = new Date();
    const ageMs = now.getTime() - completedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return ageDays < ttlDays;
}
