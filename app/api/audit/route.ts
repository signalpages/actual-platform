import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// No worker imports needed as we trigger via fetch URL
// import { convertToCoreParams, runAuditWorker } from './worker/route';
// Assuming worker logic is importable or we call it via HTTP. 
// Actually, in this codebase, the pattern has been to use `runAudit` from `lib/dataBridge.client` on client, 
// but here we are IN the API. The previous file likely had a `runAudit` function or imported it.
// Let's check `app/api/audit/worker/route.ts` to see if it exports a handler or we invoke it.
// Usually we invoke via URL in Vercel/Next, but for this specific file, I'll assume we need to instantiate the worker logic directly or call the URL.
// IMPORTANT: The previous file `import { runAudit } from '@/lib/dataBridge.client'` is for CLIENT. 
// We are on server. We typically call the worker via `fetch` or direct import if refactored.
// Let's assume standard Supabase invoke or fetch pattern.
// However, looking at the history, `app/api/audit/route.ts` seemed to handle the request then trigger the worker.

// Let's standardize on a clean implementation.
// We'll use a direct Supabase client for the DB checks.
// For the fallback, we'll return a specific status that usually triggers the worker on the client side, 
// OR we trigger the worker asynchronously here.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

type StageStatus = 'pending' | 'running' | 'done' | 'error';

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

    // 2. Check Cache
    // We want the LATEST authoritative row.
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('shadow_specs')
        .select('stages, id, created_at')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!cacheError && cached && cached.stages) {
        const s3 = cached.stages.stage_3;
        const s4 = cached.stages.stage_4;

        const isS3Done = s3?.status === CONFIG.REQUIRED_STAGE_3_STATUS;
        const isS4Done = s4?.status === 'done';

        // Readiness Logic
        let isReady = false;
        let missReason = null;

        if (context === 'compare') {
          // Relaxed: Allow Stage 3 to be sufficient for a cache hit, even if S4 is pending.
          // This ensures we show "Cached" data instantly instead of forcing a reload.
          isReady = isS3Done;
          // We can still track S4 status if needed, but for "Display", S3 is enough (contains discrepancies/claims).
        } else {
          isReady = isS3Done;
          if (!isReady) missReason = 's3-pending-detail';
        }

        if (isReady) {
          console.log(`[AuditAPI] Cache HIT for ${slug} (Context: ${context})`);

          const auditResult: AuditResult = {
            claim_profile: cached.stages.stage_1?.data?.claim_profile || [],
            // FIX: Fallback to 'entries' if 'reality_ledger' is missing (per user feedback)
            reality_ledger: s3.data?.reality_ledger || s3.data?.entries || [],
            discrepancies: s3.data?.red_flags || [],
            verification_map: s3.data?.verification_map || {},
            truth_index: s4?.data?.truth_index ?? null,
            analysis: {
              status: 'ready',
              runId: `cache-${cached.id}`,
              analyzedAt: cached.created_at
            },
            stages: cached.stages
          };

          return NextResponse.json(auditResult);
        } else {
          console.log(`[AuditAPI] Cache MISS for ${slug} (${context}) - Reason: ${missReason}`);
        }
      }
    }

    // 3. Fallback: Trigger New Audit
    // We must create the audit_run entry first, as the worker expects a valid runId

    // IDEMPOTENCY CHECK:
    // Before inserting, check if there's already an active run for this product.
    // This handles the unique constraint violation (23505) and prevents duplicate work.
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
      // Wrap in try/catch to handle race condition 23505 if parallel requests hit exactly now
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
          // If we hit a unique constraint here, it means a race condition occurred.
          // We should ideally fetch the winner.
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
        // Double check if we recovered `runId` from the race catch block
        // logic above is a bit nested, let's simplify in next iteration if needed.
        // For now, if runId is set, we are good.
        console.error("[AuditAPI] Unexpected error during run creation:", e);
        return NextResponse.json({ error: 'Failed to initialize audit' }, { status: 500 });
      }
    }

    // Check if runId is definitely assigned (TS check)
    if (!runId!) return NextResponse.json({ error: 'Failed to resolve audit run' }, { status: 500 });

    console.log(`[AuditAPI] Run ${runId} ready for ${slug}. Triggering worker...`);

    // Helper to construct full URL for fetch
    const workerUrl = new URL('/api/audit/worker', req.url);

    // Secure Worker Call
    const secret = process.env.INTERNAL_WORKER_SECRET;
    if (!secret) console.warn("[AuditAPI] INTERNAL_WORKER_SECRET is not set! Worker auth may fail.");

    const workerResponse = await fetch(workerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-role': supabaseServiceKey, // secure the worker (legacy/supabase way)
        'x-internal-secret': secret || ''     // secure the worker (custom way)
      },
      body: JSON.stringify({ runId }) // Worker expects { runId }
    });

    if (!workerResponse.ok) {
      console.error(`[AuditAPI] Worker trigger failed: ${workerResponse.status} ${workerResponse.statusText}`);

      // Safely read response - might be HTML from Vercel 500/404 page
      const contentType = workerResponse.headers.get('content-type');
      let details = "Unknown worker error";

      try {
        const text = await workerResponse.text();
        // If HTML, truncate. If JSON, parse? No, just return text safely.
        if (contentType && contentType.includes('application/json')) {
          try {
            const json = JSON.parse(text);
            details = json.error || json.message || text;
          } catch {
            details = text.substring(0, 500);
          }
        } else {
          // Likely HTML
          details = `Non-JSON response (Status ${workerResponse.status}): ${text.substring(0, 200)}...`;
        }
      } catch (e) {
        details = "Could not read worker response body";
      }

      console.error(`[AuditAPI] Worker error details: ${details}`);
      return NextResponse.json({
        error: 'Audit trigger failed',
        details
      }, { status: 500 });
    }

    const workerData = await workerResponse.json();

    // Return the run info so the client can poll/subscribe
    return NextResponse.json({
      ...workerData,
      runId // Ensure runId is returned
    });

  } catch (err) {
    console.error("[AuditAPI] Unexpected error:", err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
