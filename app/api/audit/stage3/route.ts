import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeStage3 } from '@/lib/stageExecutors';
import { validateStage3 } from '@/lib/stageValidators';
import { normalizeStage3 } from '@/lib/normalizeStage3';

export const runtime = 'nodejs';
export const maxDuration = 180;

function sbAdmin() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/audit/stage3
 * Discrepancy verification. Prereq: stage_2 done.
 * Writes ONLY to stage_3 row. Never touches stage_4.
 */
export async function POST(req: NextRequest) {
    try {
        const { productId, forceRedo } = await req.json();
        if (!productId) return NextResponse.json({ ok: false, error: 'Missing productId' }, { status: 400 });

        const sb = sbAdmin();

        // 1. Verify prereqs
        const [{ data: s1 }, { data: s2 }] = await Promise.all([
            sb.from('audit_stage_runs').select('status, output_json').eq('product_id', productId).eq('stage', 'stage_1').maybeSingle(),
            sb.from('audit_stage_runs').select('status, output_json').eq('product_id', productId).eq('stage', 'stage_2').maybeSingle(),
        ]);

        if (!s1 || s1.status !== 'done') {
            return NextResponse.json({ ok: false, error: 'PREREQ_FAILED', reason: 'stage_1 not done' }, { status: 409 });
        }
        if (!s2 || s2.status !== 'done') {
            return NextResponse.json({ ok: false, error: 'PREREQ_FAILED', reason: 'stage_2 not done' }, { status: 409 });
        }

        // 2. Idempotency
        if (!forceRedo) {
            const { data: existing } = await sb
                .from('audit_stage_runs')
                .select('status, output_json')
                .eq('product_id', productId)
                .eq('stage', 'stage_3')
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
            product_id: productId, stage: 'stage_3', status: 'running',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 5. Execute
        const s1Data = s1.output_json as { claim_profile: any[] };
        const s2Data = s2.output_json as any;
        const stage2Input = { independent_signal: s2Data };

        const raw = await executeStage3(product, s1Data, stage2Input);
        const validation = validateStage3(raw);

        if (!validation.valid) {
            await sb.from('audit_stage_runs').upsert({
                product_id: productId, stage: 'stage_3', status: 'error',
                error: validation.error || 'Validation failed',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'product_id,stage' });

            // Signal stage_4 is blocked (DO NOT wipe existing stage_4 output_json)
            await sb.from('audit_stage_runs').upsert({
                product_id: productId, stage: 'stage_4', status: 'blocked',
                error: `stage_3_invalid: ${validation.error}`,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'product_id,stage' });

            return NextResponse.json({ ok: false, error: 'STAGE3_INVALID', detail: validation.error }, { status: 422 });
        }

        const normalized = normalizeStage3(raw);
        const output = {
            entries: normalized.entries,
            red_flags: normalized.entries,
            totalCount: normalized.totalCount,
            uniqueCount: normalized.uniqueCount,
        };

        // 6. Persist (only stage_3 row)
        await sb.from('audit_stage_runs').upsert({
            product_id: productId, stage: 'stage_3', status: 'done',
            output_json: output, updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 7. Mirror to shadow_specs
        const { data: shadow } = await sb.from('shadow_specs').select('stages').eq('product_id', productId).maybeSingle();
        await sb.from('shadow_specs').upsert({
            product_id: productId,
            stages: { ...(shadow?.stages || {}), stage_3: { status: 'done', completed_at: new Date().toISOString(), data: output } },
        }, { onConflict: 'product_id' });

        return NextResponse.json({ ok: true, status: 'done', uniqueCount: normalized.uniqueCount, output });
    } catch (err: any) {
        console.error('[stage3] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
