import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAuditWorker } from '../../../lib/runAuditWorker';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const maxDuration = 300; // Allow 5 minutes for audit worker to complete

type StageStatus = 'pending' | 'running' | 'done' | 'error' | 'blocked';

// CANONICAL AUDIT RESULT SHAPE
interface AuditResult {
  claim_profile: any[];
  reality_ledger: any[];
  discrepancies: any[];
  verification_map: any;
  truth_index: number | null;
  strengths?: string[];
  limitations?: string[];
  practical_impact?: string[];
  stages?: any; // Kept for debugging/staging, but UI should prefer top-level fields
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { slug, forceRefresh, context = 'detail' } = body;

    if (!slug) {
      return NextResponse.json({
        ok: false,
        analysis: { status: 'failed', error: { code: 'BAD_REQUEST', message: 'Missing slug' } }
      }, { status: 400 });
    }

    // 1. Get Product ID
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, category, technical_specs')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      console.error("Product lookup failed:", productError);
      return NextResponse.json({
        ok: false,
        analysis: { status: 'failed', error: { code: 'NOT_FOUND', message: 'Product not found' } }
      }, { status: 404 });
    }

    // Helper: partial validation
    const validateAuditShape = (data: any) => {
      if (!data) return false;
      // Discrepancies MUST be an array (even if empty)
      if (!Array.isArray(data.red_flags) && !Array.isArray(data.discrepancies)) return false;
      return true;
    };

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

        // Strict Readiness: Stage 3 MUST be done AND VALID
        const isS3Done = s3?.status === 'done';
        const isS3Valid = isS3Done && s3?.data && validateAuditShape(s3.data);

        const isS4Done = s4?.status === 'done';
        const truthIndex = s4?.data?.truth_index;
        const hasTruthIndex = typeof truthIndex === 'number';

        // Verdict Ready: Needs S3 Valid AND S4 Done AND TI present
        const verdictReady = isS3Valid && isS4Done && hasTruthIndex;

        // If S3 is done but invalid -> FAIL IT
        // If S3 is done and valid -> READY (Forensic ready)
        if (isS3Done) {
          if (!isS3Valid) {
            console.warn(`[AuditAPI] Cache CORRUPTION for ${slug}: Stage 3 done but invalid shape.`);
            return NextResponse.json({
              ok: true,
              analysis: {
                status: 'failed',
                verdictReady: false,
                runId: 'cache-corruption',
                error: { code: 'INVALID_DATA', message: 'Audit data is structurally invalid.' }
              },
              audit: {
                claim_profile: cached.stages.stage_1?.data?.claim_profile || [],
                reality_ledger: [],
                discrepancies: [],
                verification_map: {},
                truth_index: null,
                stages: cached.stages
              },
              runId: 'cache-corruption'
            });
          }

          console.log(`[AuditAPI] Cache HIT for ${slug} (Context: ${context})`);

          // STRICT MAPPING: No fallbacks to root columns. Only use stages data.
          // NESTED 'audit' object as per Master Stabilization Plan.
          const auditData: AuditResult = {
            claim_profile: cached.stages.stage_1?.data?.claim_profile || [],
            reality_ledger: s3.data?.reality_ledger || s3.data?.entries || [],
            discrepancies: s3.data?.red_flags || [],
            verification_map: s3.data?.verification_map || {},
            truth_index: s4?.data?.truth_index ?? null,
            strengths: s4?.data?.strengths || [], // New for Verdict
            limitations: s4?.data?.limitations || [], // New for Verdict
            practical_impact: s4?.data?.practical_impact || [], // New for Verdict
            stages: cached.stages
          };

          return NextResponse.json({
            ok: true,
            analysis: {
              status: 'ready',
              verdictReady,
              runId: 'cache-hit',
              analyzedAt: cached.created_at
            },
            audit: auditData,
            runId: 'cache-hit'
          });
        } else {
          // SKELETON SUPPORT:
          // If we have PARTIAL data (e.g. Stage 1 done), return it with status 'pending'
          if (cached.stages?.stage_1?.status === 'done') {
            console.log(`[AuditAPI] Returning pending skeleton for ${slug}`);
            return NextResponse.json({
              ok: true,
              analysis: {
                status: 'pending',
                verdictReady: false,
                runId: `pending-${cached.id}`
              },
              audit: {
                claim_profile: cached.stages.stage_1.data.claim_profile || [],
                reality_ledger: [],
                discrepancies: [],
                verification_map: {},
                truth_index: null,
                stages: cached.stages
              },
              runId: `pending-${cached.id}`
            });
          }
        }
      }
    }

    // 3. Fallback: Trigger New Audit
    // We must create the audit_run entry first.

    // IDEMPOTENCY CHECK:
    // Before inserting, check if there's already an active run for this product.
    // Order by created_at DESC to get the most recent one.
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
            // FAIL SAFE RETURN
            return NextResponse.json({
              ok: true,
              analysis: { status: 'failed', error: { code: 'INIT_FAILED', message: 'Failed to initialize audit' } },
              audit: { claim_profile: [], reality_ledger: [], discrepancies: [], verification_map: {}, truth_index: null, stages: {} },
              runId: 'failed-init'
            }, { status: 500 });
          }
        } else if (newRun) {
          runId = newRun.id;
        } else {
          throw new Error("No data returned from insert");
        }
      } catch (e: any) {
        console.error("[AuditAPI] Unexpected error during run creation:", e);
        return NextResponse.json({
          ok: true,
          analysis: { status: 'failed', error: { code: 'INIT_EXCEPTION', message: e.message } },
          audit: { claim_profile: [], reality_ledger: [], discrepancies: [], verification_map: {}, truth_index: null, stages: {} },
          runId: 'failed-init'
        }, { status: 500 });
      }
    }

    if (!runId!) return NextResponse.json({
      ok: true, // Returning ok:true to prevent client crashing, but status: failed
      analysis: { status: 'failed', error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve audit run' } },
      audit: { claim_profile: [], reality_ledger: [], discrepancies: [], verification_map: {}, truth_index: null, stages: {} },
      runId: 'failed-id'
    }, { status: 500 });

    console.log(`[AuditAPI] Run ${runId} ready for ${slug}. executing worker in-process...`);

    // DIRECT WORKER CALL (No HTTP fetch)
    // This avoids Vercel Deployment Protection auth blocks.
    try {
      const result = await runAuditWorker({ runId, sb: supabase });

      // FETCH CANONICAL RESULT (Fresh)
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

        // RE-APPLY STRICT READINESS LOGIC FOR FRESH DATA
        const isS3Done = s3?.status === 'done';
        const isS3Valid = isS3Done && s3?.data && validateAuditShape(s3.data);
        const isS4Done = s4?.status === 'done';
        const truthIndex = s4?.data?.truth_index;
        const hasTruthIndex = typeof truthIndex === 'number';

        const verdictReady = isS3Valid && isS4Done && hasTruthIndex;

        // If fresh data invalid despite S3 Done -> Failed
        if (isS3Done && !isS3Valid) {
          return NextResponse.json({
            ok: true,
            analysis: {
              status: 'failed',
              verdictReady: false,
              runId: result.runId,
              error: { code: 'INVALID_FRESH_DATA', message: 'Worker produced invalid data structure.' }
            },
            audit: {
              claim_profile: [], reality_ledger: [], discrepancies: [], verification_map: {}, truth_index: null, stages: fresh.stages
            },
            runId: result.runId
          });
        }

        const auditData: AuditResult = {
          claim_profile: fresh.stages.stage_1?.data?.claim_profile || [],
          reality_ledger: s3?.data?.reality_ledger || s3?.data?.entries || [],
          discrepancies: s3?.data?.red_flags || [],
          verification_map: s3?.data?.verification_map || {},
          truth_index: s4?.data?.truth_index ?? null,
          strengths: s4?.data?.strengths || [],
          limitations: s4?.data?.limitations || [],
          practical_impact: s4?.data?.practical_impact || [],
          stages: fresh.stages
        };

        return NextResponse.json({
          ok: true,
          analysis: {
            status: 'ready',
            verdictReady, // Strict check
            runId: result.runId,
            analyzedAt: new Date().toISOString()
          },
          audit: auditData,
          runId: result.runId
        });
      }

      // Fallback (Rare: Stage 1 only done or something)
      return NextResponse.json({
        ok: true,
        analysis: { status: 'pending', verdictReady: false, runId },
        audit: result, // Fallback to worker result structure if canonical fetch fails
        runId
      });

    } catch (e: any) {
      console.error(`[AuditAPI] Worker execution failed:`, e);
      return NextResponse.json({
        ok: true, // Client handles status: failed better than ok: false often
        analysis: {
          status: 'failed',
          verdictReady: false,
          runId: runId,
          error: { code: 'WORKER_FAILED', message: e.message }
        },
        audit: { claim_profile: [], reality_ledger: [], discrepancies: [], verification_map: {}, truth_index: null },
        runId
      }, { status: 500 });
    }

  } catch (err: any) {
    console.error("[AuditAPI] Unexpected error:", err);
    return NextResponse.json({
      ok: false,
      analysis: { status: 'failed', error: { code: 'INTERNAL_ERROR', message: err.message } }
    }, { status: 500 });
  }
}
