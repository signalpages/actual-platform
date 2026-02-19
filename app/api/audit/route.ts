import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAuditWorker } from '../../../lib/runAuditWorker';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const maxDuration = 300; // Allow 5 minutes for audit worker to complete

type StageStatus = 'pending' | 'running' | 'done' | 'error' | 'blocked';

interface AuditResult {
  claim_profile: any[];
  reality_ledger: any[];
  discrepancies: any[];
  verification_map: any;
  truth_index: number | null;
  analysis: {
    status: 'ready' | 'pending';
    runId?: string;
    analyzedAt?: string;
  };
  stages?: any;
}

const CONFIG = {
  REQUIRED_STAGE_3_STATUS: 'done' as StageStatus,
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { slug, forceRefresh, context = 'detail' } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    // 1. Get Product ID
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, category, technical_specs')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      console.error("Product lookup failed:", productError);
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 2. Check Cache (Canonical & Deterministic)
    // We want the LATEST authoritative row.
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('shadow_specs')
        .select('stages, id, created_at')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(1) // Deterministic: Get the single best row
        .single();

      if (!cacheError && cached && cached.stages) {
        const s3 = cached.stages.stage_3;
        const s4 = cached.stages.stage_4;

        // Strict Readiness: Stage 3 MUST be done.
        const isS3Done = s3?.status === 'done';
        const isS4Done = s4?.status === 'done';

        let isReady = false;
        let missReason = null;

        if (context === 'compare') {
          // Compare context requires Truth Index (Stage 4) usually, but we accept S3 for "partial" views if designed.
          // User Requirement: "S3 done required, S4 done for truth index"
          // Let's require S3. If S4 is missing, we can still show discrepancies.
          // However, for a "Available for Comparison" check, usually we want S3.
          isReady = isS3Done;
          if (!isReady) missReason = 's3-pending-compare';
        } else {
          // Detail view: S3 is sufficient for specific-level forensic data.
          isReady = isS3Done;
          if (!isReady) missReason = 's3-pending-detail';
        }

        if (isReady) {
          console.log(`[AuditAPI] Cache HIT for ${slug} (Context: ${context})`);

          // STRICT MAPPING: No fallbacks to root columns. Only use stages data.
          // This ensures we show exactly what was audited.
          const auditResult: AuditResult = {
            claim_profile: cached.stages.stage_1?.data?.claim_profile || [],
            // FIX: Fallback to 'entries' if 'reality_ledger' is missing (per user feedback)
            reality_ledger: s3.data?.reality_ledger || s3.data?.entries || [],
            discrepancies: s3.data?.red_flags || [],
            verification_map: s3.data?.verification_map || {},
            truth_index: s4?.data?.truth_index ?? null,
            analysis: {
              status: 'ready',
              runId: `cache-hit`, // Explicitly mark as cache hit
              analyzedAt: cached.created_at
            },
            stages: cached.stages
          };

          return NextResponse.json({ ok: true, ...auditResult });
        } else {
          console.log(`[AuditAPI] Cache MISS for ${slug} (${context}) - Reason: ${missReason}`);

          // SKELETON SUPPORT:
          // If we have PARTIAL data (e.g. Stage 1 done), we should return it 
          // so the UI can render the skeleton instead of a spinner/error.
          if (cached.stages?.stage_1?.status === 'done') {
            console.log(`[AuditAPI] Returning pending payload with Stage 1 data for ${slug}`);
            return NextResponse.json({
              ok: true,
              claim_profile: cached.stages.stage_1.data.claim_profile || [],
              reality_ledger: [],
              discrepancies: [],
              verification_map: {},
              truth_index: null,
              analysis: {
                status: 'pending',
                runId: `pending-${cached.id}`
              },
              stages: cached.stages
            });
          }
        }
      }
    }

    // 3. Fallback: Trigger New Audit
    // We must create the audit_run entry first.

    // IDEMPOTENCY CHECK:
    // Before inserting, check if there's already an active run for this product.
    const { data: existingRun } = await supabase
      .from('audit_runs')
      .select('id, status')
      .eq('product_id', product.id)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let runId: string;

    if (existingRun) {
      console.log(`[AuditAPI] Found existing active run ${existingRun.id} for ${slug}`);
      runId = existingRun.id;
    } else {
      // Create new run
      try {
        const { data: newRun, error: createError } = await supabase
          .from('audit_runs')
          .insert({
            product_id: product.id,
            status: 'pending',
            progress: 0,
            started_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError) {
          if (createError.code === '23505') {
            console.warn(`[AuditAPI] Race condition detected for ${slug} (23505). Fetching active run.`);
            const { data: winner } = await supabase.from('audit_runs').select('id').eq('product_id', product.id).in('status', ['pending', 'running']).limit(1).single();
            if (winner) {
              runId = winner.id;
            } else {
              throw createError; // Should not happen if constraint fired
            }
          } else {
            console.error("[AuditAPI] Failed to create audit run:", createError);
            return NextResponse.json({ error: 'Failed to initialize audit' }, { status: 500 });
          }
        } else if (newRun) {
          runId = newRun.id;
        } else {
          throw new Error("No data returned from insert");
        }
      } catch (e: any) {
        console.error("[AuditAPI] Unexpected error during run creation:", e);
        return NextResponse.json({ error: 'Failed to initialize audit' }, { status: 500 });
      }
    }

    if (!runId!) return NextResponse.json({ error: 'Failed to resolve audit run' }, { status: 500 });

    console.log(`[AuditAPI] Run ${runId} ready for ${slug}. executing worker in-process...`);

    // DIRECT WORKER CALL (No HTTP fetch)
    // This avoids Vercel Deployment Protection auth blocks.
    // DIRECT WORKER CALL (No HTTP fetch)
    // This avoids Vercel Deployment Protection auth blocks.
    try {
      const result = await runAuditWorker({ runId, sb: supabase });

      // FETCH CANONICAL RESULT
      // Now that worker is done, we fetch the fresh shadow_spec to return the full payload
      // matching the structure of a Cache Hit.
      const { data: fresh, error: freshError } = await supabase
        .from('shadow_specs')
        .select('stages, id, created_at')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fresh && fresh.stages) {
        const s3 = fresh.stages.stage_3;
        const s4 = fresh.stages.stage_4;

        const auditResult: AuditResult = {
          claim_profile: fresh.stages.stage_1?.data?.claim_profile || [],
          reality_ledger: s3?.data?.reality_ledger || s3?.data?.entries || [],
          discrepancies: s3?.data?.red_flags || [],
          verification_map: s3?.data?.verification_map || {},
          truth_index: s4?.data?.truth_index ?? null,
          analysis: {
            status: 'ready',
            runId: result.runId, // Use the actual runId we just finished
            analyzedAt: new Date().toISOString()
          },
          stages: fresh.stages
        };
        return NextResponse.json({ ok: true, ...auditResult });
      }

      // Fallback if shadow_spec fetch fails (shouldn't happen if worker succeeded)
      return NextResponse.json({ ok: true, ...result });

    } catch (e: any) {
      console.error(`[AuditAPI] Worker execution failed:`, e);
      return NextResponse.json({
        error: 'Audit execution failed',
        details: e.message
      }, { status: 500 });
    }

  } catch (err) {
    console.error("[AuditAPI] Unexpected error:", err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

