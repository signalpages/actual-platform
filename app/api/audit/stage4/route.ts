import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeStage4 } from '@/lib/stageExecutors';
import { validateStage4 } from '@/lib/stageValidators';
import { computeBaseScores, buildMetricBars } from '@/lib/normalizeStage3';
import { computeTruthIndex } from '@/lib/computeTruthIndex';

export const runtime = 'nodejs';
export const maxDuration = 180;

function sbAdmin() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/audit/stage4
 * Verdict + truth index. Prereq: stage_3 done AND valid.
 * The ONLY stage that writes to shadow_specs canonical snapshot.
 * Never runs if stage_3 invalid. Never wipes prior verdict on failure.
 */
export async function POST(req: NextRequest) {
    try {
        const { productId, forceRedo } = await req.json();
        if (!productId) return NextResponse.json({ ok: false, error: 'Missing productId' }, { status: 400 });

        const sb = sbAdmin();

        // 1. Strict prereq check: stage_3 must be done and valid
        const [{ data: s1 }, { data: s2 }, { data: s3 }] = await Promise.all([
            sb.from('audit_stage_runs').select('status, output_json').eq('product_id', productId).eq('stage', 'stage_1').maybeSingle(),
            sb.from('audit_stage_runs').select('status, output_json').eq('product_id', productId).eq('stage', 'stage_2').maybeSingle(),
            sb.from('audit_stage_runs').select('status, output_json').eq('product_id', productId).eq('stage', 'stage_3').maybeSingle(),
        ]);

        if (!s3 || s3.status !== 'done') {
            return NextResponse.json({ ok: false, error: 'PREREQ_FAILED', reason: 'stage_3 not done or invalid' }, { status: 409 });
        }
        if (!s3.output_json || !(s3.output_json as any).entries?.length) {
            return NextResponse.json({ ok: false, error: 'PREREQ_FAILED', reason: 'stage_3 has no entries' }, { status: 409 });
        }

        // 2. Idempotency
        if (!forceRedo) {
            const { data: existing } = await sb
                .from('audit_stage_runs')
                .select('status, output_json')
                .eq('product_id', productId)
                .eq('stage', 'stage_4')
                .maybeSingle();

            if (existing?.status === 'done' && existing.output_json) {
                return NextResponse.json({ ok: true, status: 'done', cached: true, output: existing.output_json });
            }
        }

        // 3. Fetch product
        const { data: product, error: pErr } = await sb.from('products').select('*').eq('id', productId).single();
        if (pErr || !product) return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });

        // 4. Mark running
        await sb.from('audit_stage_runs').upsert({
            product_id: productId, stage: 'stage_4', status: 'running',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 5. Build intermediates
        const s1Data = s1?.output_json as { claim_profile: any[] } | null;
        const s2Data = s2?.output_json as any | null;
        const s3Data = s3.output_json as { entries: any[]; red_flags: any[] };

        const baseScores = computeBaseScores(s3Data.entries);
        const metricBars = buildMetricBars(baseScores);
        const truthBreakdown = computeTruthIndex(s3Data.entries, baseScores);

        // 6. Execute
        const result = await executeStage4(product, {
            stage1: s1Data || { claim_profile: [] },
            stage2: s2Data ? { independent_signal: s2Data } : { independent_signal: { most_praised: [], most_reported_issues: [] } },
            stage3: { red_flags: s3Data.entries, reality_ledger: [] }
        }, { baseScores, metricBars, truthBreakdown });

        const validation = validateStage4(result);
        if (!validation.valid) {
            // CRITICAL: on failure, mark error but do NOT wipe prior output_json
            await sb.from('audit_stage_runs').upsert({
                product_id: productId, stage: 'stage_4', status: 'error',
                error: validation.error || 'Stage 4 invalid output',
                // intentionally NOT setting output_json — preserve prior good output
                updated_at: new Date().toISOString(),
            }, { onConflict: 'product_id,stage' });

            return NextResponse.json({ ok: false, error: 'STAGE4_INVALID', detail: validation.error }, { status: 422 });
        }

        // 7. Persist stage_4 row
        await sb.from('audit_stage_runs').upsert({
            product_id: productId, stage: 'stage_4', status: 'done',
            output_json: result, updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 8. CANONICAL WRITE: Stage 4 is the only stage that writes the full shadow_spec snapshot
        const now = new Date().toISOString();
        const { data: shadow } = await sb.from('shadow_specs').select('stages').eq('product_id', productId).maybeSingle();

        await sb.from('shadow_specs').upsert({
            product_id: productId,
            is_verified: true,
            truth_score: result.truth_index ?? null,
            claimed_specs: s1Data?.claim_profile || [],
            red_flags: s3Data.entries,
            stages: {
                ...(shadow?.stages || {}),
                stage_4: { status: 'done', completed_at: now, data: result }
            },
            updated_at: now,
        }, { onConflict: 'product_id' });

        return NextResponse.json({ ok: true, status: 'done', truth_index: result.truth_index, output: result });
    } catch (err: any) {
        console.error('[stage4] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
