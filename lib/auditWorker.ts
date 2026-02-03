import { getAuditRun, updateAuditRun, saveAudit } from './dataBridge.server';
import { getProductBySlug } from './dataBridge.server';
import { executeStage1, executeStage2, executeStage3, executeStage4 } from './stageExecutors';
import { updateStageHelper } from './updateStageHelper';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials");
    return createClient(url, key, { auth: { persistSession: false } });
};

/**
 * Background worker for executing audit in progressive stages
 * Triggered by waitUntil() from /api/audit
 */
export async function runAuditWorker(runId: string, product: any): Promise<void> {
    const supabase = getSupabase();

    try {
        // 1. Load run
        const run = await getAuditRun(runId);
        if (!run) {
            console.error(`Audit run ${runId} not found`);
            return;
        }

        // Validate status
        if (run.status !== 'pending' && run.status !== 'running') {
            console.log(`Audit run ${runId} already ${run.status}`);
            return;
        }

        // 2. Re-fetch product to ensure we have all JSONB fields (they may be lost in serialization)
        const freshProduct = await getProductBySlug(product.slug);
        if (!freshProduct) {
            await updateAuditRun(runId, {
                status: 'error',
                error: 'Product not found',
                finished_at: new Date().toISOString(),
            });
            return;
        }

        console.log('[Worker] Product loaded:', freshProduct.model_name);
        console.log('[Worker] technical_specs present:', !!freshProduct.technical_specs);

        // 3. Mark as running
        await updateAuditRun(runId, {
            status: 'running',
            progress: 5,
        });

        // STAGE 1: Claim Profile (fast, cached)
        console.log(`[Worker] Starting Stage 1 for ${product.model_name}`);
        await updateAuditRun(runId, { progress: 10 });

        const stage1Result = await executeStage1(freshProduct);
        await updateStageHelper({
            productId: freshProduct.id,
            stageName: 'stage_1',
            stageData: {
                status: 'done',
                data: stage1Result,
                completed_at: new Date().toISOString()
            },
            supabase
        });

        await updateAuditRun(runId, { progress: 25 });

        // STAGE 2: Independent Signal (search + synthesis)
        console.log(`[Worker] Starting Stage 2 for ${freshProduct.model_name}`);
        const stage2Result = await executeStage2(freshProduct, stage1Result);
        await updateStageHelper({
            productId: freshProduct.id,
            stageName: 'stage_2',
            stageData: {
                status: 'done',
                data: stage2Result,
                completed_at: new Date().toISOString()
            },
            supabase
        });

        await updateAuditRun(runId, { progress: 50 });

        // STAGE 3: Forensic Discrepancies
        console.log(`[Worker] Starting Stage 3 for ${freshProduct.model_name}`);
        const stage3Result = await executeStage3(freshProduct, stage1Result, stage2Result);
        await updateStageHelper({
            productId: freshProduct.id,
            stageName: 'stage_3',
            stageData: {
                status: 'done',
                data: stage3Result,
                completed_at: new Date().toISOString()
            },
            supabase
        });

        await updateAuditRun(runId, { progress: 75 });

        // STAGE 4: Verdict & Truth Index
        console.log(`[Worker] Starting Stage 4 for ${freshProduct.model_name}`);
        const stage4Result = await executeStage4(freshProduct, {
            stage1: stage1Result,
            stage2: stage2Result,
            stage3: stage3Result
        });
        await updateStageHelper({
            productId: freshProduct.id,
            stageName: 'stage_4',
            stageData: {
                status: 'done',
                data: stage4Result,
                completed_at: new Date().toISOString()
            },
            supabase
        });

        await updateAuditRun(runId, { progress: 90 });

        // 5. Save final consolidated audit result
        const fullAudit = {
            truth_index: stage4Result.truth_index,
            verification_status: stage4Result.truth_index > 85 ? 'verified' : 'provisional',
            last_updated: new Date().toISOString(),
            advertised_claims: stage1Result.claim_profile,
            reality_ledger: [], // Don't use claim_profile as reality (misleading)
            key_wins: stage2Result.independent_signal.most_praised.slice(0, 5).map(p => ({
                label: p.text.substring(0, 50),
                value: `${p.sources} sources`
            })),
            key_divergences: stage2Result.independent_signal.most_reported_issues.slice(0, 5).map(i => ({
                label: i.text.substring(0, 50),
                value: `${i.sources} sources`
            })),
            discrepancies: stage3Result.red_flags.map(flag => ({
                issue: flag.claim,
                description: `${flag.reality} (${flag.severity})`,
                severity: flag.severity
            })),
            metric_bars: stage4Result.metric_bars,
            score_interpretation: stage4Result.score_interpretation,
            strengths: stage4Result.strengths,
            limitations: stage4Result.limitations,
            practical_impact: stage4Result.practical_impact,
            good_fit: stage4Result.good_fit,
            consider_alternatives: stage4Result.consider_alternatives,
            data_confidence: stage4Result.data_confidence,
            // Add required database fields
            source_urls: [],  // Will be populated from search results in future
            is_verified: stage4Result.truth_index > 85
        };

        console.log('[Worker] Attempting to save audit for product:', freshProduct.id);
        console.log('[Worker] fullAudit keys:', Object.keys(fullAudit));
        console.log('[Worker] truth_index:', fullAudit.truth_index);
        console.log('[Worker] is_verified:', fullAudit.is_verified);

        const saved = await saveAudit(freshProduct.id, fullAudit);

        if (!saved) {
            await updateAuditRun(runId, {
                status: 'error',
                error: 'Failed to save audit result',
                finished_at: new Date().toISOString(),
            });
            return;
        }

        // 6. Mark as done
        await updateAuditRun(runId, {
            status: 'done',
            progress: 100,
            result_shadow_spec_id: saved.id,
            finished_at: new Date().toISOString(),
        });

        console.log(`[Worker] ✅ Audit complete for ${freshProduct.model_name}`);

    } catch (error) {
        console.error(`Audit worker error for run ${runId}:`, error);
        await updateAuditRun(runId, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            finished_at: new Date().toISOString(),
        });
    }
}
