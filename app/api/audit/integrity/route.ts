import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

function sbAdmin() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/audit/integrity
 * UX-001: Honest integrity check. No LLM calls.
 * Returns freshness, checksum, and whether a refresh is needed.
 * If stale (>30 days), flags for cron pickup — never triggers live compute.
 */
export async function POST(req: NextRequest) {
    try {
        const { slug } = await req.json();
        if (!slug) return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 });

        const sb = sbAdmin();

        // 1. Look up product
        const { data: product } = await sb
            .from('products')
            .select('id, brand, model_name')
            .eq('slug', slug)
            .maybeSingle();

        if (!product) {
            return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
        }

        // 2. Read canonical audit from shadow_specs
        const { data: shadow } = await sb
            .from('shadow_specs')
            .select('stages, updated_at, is_verified, truth_score')
            .eq('product_id', product.id)
            .maybeSingle();

        if (!shadow) {
            return NextResponse.json({
                ok: true,
                auditVersion: null,
                checksum: null,
                lastVerifiedAt: null,
                freshnessDays: null,
                needsRefresh: true,
                status: 'no_audit',
            });
        }

        // 3. Compute checksum of canonical stage outputs
        const stagesStr = JSON.stringify(shadow.stages || {});
        const checksum = crypto.createHash('sha256').update(stagesStr + (shadow.updated_at || '')).digest('hex').slice(0, 16);

        // 4. Freshness calculation
        const now = Date.now();
        const verifiedAt = shadow.updated_at ? new Date(shadow.updated_at).getTime() : 0;
        const freshnessDays = verifiedAt ? Math.floor((now - verifiedAt) / (1000 * 60 * 60 * 24)) : null;
        const needsRefresh = freshnessDays === null || freshnessDays > 30;

        // 5. If stale, flag for cron (set spec_status = 'stale' on products if available)
        if (needsRefresh) {
            await sb
                .from('products')
                .update({ spec_status: 'stale', spec_last_updated_at: shadow.updated_at })
                .eq('id', product.id);
        }

        // 6. Determine real status based on stage completeness
        const stages = shadow.stages || {};
        const doneStages = Object.values(stages).filter((s: any) => s?.status === 'done').length;
        const hasStage4 = (stages as any)?.stage_4?.status === 'done';

        // 'verified' = full pipeline completed (Stage 4 done = truth_index exists).
        // 'partial'  = has some stages done but not Stage 4 — still has data to show.
        // 'no_audit' = nothing useful in shadow_specs.
        const status = hasStage4 ? 'verified' : doneStages > 0 ? 'partial' : 'no_audit';

        return NextResponse.json({
            ok: true,
            auditVersion: `v${doneStages}.0`,
            checksum,
            lastVerifiedAt: shadow.updated_at ?? null,
            freshnessDays,
            needsRefresh,
            status,
            truthScore: shadow.truth_score ?? null,
        });
    } catch (err: any) {
        console.error('[integrity] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
