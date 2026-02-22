import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeStage2 } from '@/lib/stageExecutors';

export const runtime = 'nodejs';
export const maxDuration = 120;

function sbAdmin() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/audit/stage2
 * Community signal gathering. Prereq: stage_1 done.
 * Can be rerun independently without touching stage_3 or stage_4.
 */
export async function POST(req: NextRequest) {
    try {
        const { productId, forceRedo } = await req.json();
        if (!productId) return NextResponse.json({ ok: false, error: 'Missing productId' }, { status: 400 });

        const sb = sbAdmin();

        // 1. Check prereq: stage_1 must be done
        const { data: s1 } = await sb
            .from('audit_stage_runs')
            .select('status, output_json')
            .eq('product_id', productId)
            .eq('stage', 'stage_1')
            .maybeSingle();

        if (!s1 || s1.status !== 'done') {
            return NextResponse.json({ ok: false, error: 'PREREQ_FAILED', reason: 'stage_1 not done' }, { status: 409 });
        }

        // 2. Idempotency check
        if (!forceRedo) {
            const { data: existing } = await sb
                .from('audit_stage_runs')
                .select('status, output_json')
                .eq('product_id', productId)
                .eq('stage', 'stage_2')
                .maybeSingle();

            if (existing?.status === 'done' && existing.output_json) {
                return NextResponse.json({ ok: true, status: 'done', cached: true, output: existing.output_json });
            }
        }

        // 3. Fetch product
        const { data: product, error: pErr } = await sb
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (pErr || !product) return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });

        // 4. Mark running
        await sb.from('audit_stage_runs').upsert({
            product_id: productId,
            stage: 'stage_2',
            status: 'running',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 5. Execute
        const stage1Data = s1.output_json as { claim_profile: any[] };
        const result = await executeStage2(product, stage1Data);

        const output = {
            most_praised: result.independent_signal?.most_praised || [],
            most_reported_issues: result.independent_signal?.most_reported_issues || [],
        };

        // 6. Persist (only stage_2 row — does NOT touch stage_3 or stage_4)
        await sb.from('audit_stage_runs').upsert({
            product_id: productId,
            stage: 'stage_2',
            status: 'done',
            output_json: output,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 7. Mirror to shadow_specs for compatibility
        const { data: shadow } = await sb
            .from('shadow_specs')
            .select('stages')
            .eq('product_id', productId)
            .maybeSingle();

        await sb.from('shadow_specs').upsert({
            product_id: productId,
            stages: {
                ...(shadow?.stages || {}),
                stage_2: { status: 'done', completed_at: new Date().toISOString(), data: output }
            },
        }, { onConflict: 'product_id' });

        return NextResponse.json({ ok: true, status: 'done', output });
    } catch (err: any) {
        console.error('[stage2] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
