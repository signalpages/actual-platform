import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sbAdmin() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/audit/stage1
 * Derives the claim_profile deterministically from products.technical_specs.
 * No LLM. No prereqs. Idempotent.
 */
export async function POST(req: NextRequest) {
    try {
        const { productId, forceRedo } = await req.json();
        if (!productId) return NextResponse.json({ ok: false, error: 'Missing productId' }, { status: 400 });

        const sb = sbAdmin();

        // 1. Check if already done (idempotent)
        if (!forceRedo) {
            const { data: existing } = await sb
                .from('audit_stage_runs')
                .select('status, output_json, updated_at')
                .eq('product_id', productId)
                .eq('stage', 'stage_1')
                .maybeSingle();

            if (existing?.status === 'done' && existing.output_json) {
                return NextResponse.json({ ok: true, status: 'done', cached: true, output: existing.output_json });
            }
        }

        // 2. Fetch product specs
        const { data: product, error: pErr } = await sb
            .from('products')
            .select('id, technical_specs, category, brand, model_name')
            .eq('id', productId)
            .single();

        if (pErr || !product) {
            return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
        }

        // 3. Mark running
        await sb.from('audit_stage_runs').upsert({
            product_id: productId,
            stage: 'stage_1',
            status: 'running',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 4. Build claim_profile from technical_specs
        let claims: { label: string; value: string }[] = [];
        const specs = product.technical_specs;

        if (Array.isArray(specs)) {
            claims = specs
                .filter((s: any) => s?.label && String(s.value ?? '').trim())
                .map((s: any) => ({ label: String(s.label), value: String(s.value) }));
        } else if (specs && typeof specs === 'object') {
            for (const [key, val] of Object.entries(specs)) {
                if (val !== null && val !== undefined) {
                    claims.push({ label: key.replace(/_/g, ' '), value: String(val) });
                }
            }
        }

        const output = { claim_profile: claims, claim_count: claims.length };

        // 5. Persist result
        await sb.from('audit_stage_runs').upsert({
            product_id: productId,
            stage: 'stage_1',
            status: 'done',
            output_json: output,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,stage' });

        // 6. Mirror into shadow_specs.stages for compatibility
        const { data: shadow } = await sb
            .from('shadow_specs')
            .select('stages')
            .eq('product_id', productId)
            .maybeSingle();

        await sb.from('shadow_specs').upsert({
            product_id: productId,
            stages: {
                ...(shadow?.stages || {}),
                stage_1: { status: 'done', completed_at: new Date().toISOString(), data: output }
            },
        }, { onConflict: 'product_id' });

        return NextResponse.json({ ok: true, status: 'done', output });
    } catch (err: any) {
        console.error('[stage1] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
