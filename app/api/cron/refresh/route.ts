import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 180;

function sbAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Vercel Cron requests include: x-vercel-cron: 1
 * We also allow manual runs via Authorization: Bearer <CRON_SECRET>
 */
function isAuthorizedCron(req: NextRequest) {
  // 1) Vercel Cron
  const vercelCron = req.headers.get('x-vercel-cron');
  if (vercelCron === '1') return true;

  // 2) Manual secret (optional)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }

  return false;
}

function getBaseUrl(req: NextRequest) {
  // Preferred: explicitly set in Vercel env
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // Vercel provides VERCEL_URL (no scheme)
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, '');

  // Fallback: derive from the incoming request (works in prod)
  const host = req.headers.get('host');
  if (host) return `https://${host}`.replace(/\/$/, '');

  // Local fallback
  return 'http://localhost:3000';
}

/**
 * GET /api/cron/refresh
 * CRON-001: Picks stale audits and re-runs stage_2 → stage_3 → stage_4.
 * Guarded by Vercel Cron header OR Authorization: Bearer CRON_SECRET
 * Calls stage functions internally via HTTP (not inline) to keep this route
 * within its time budget and allow per-stage retries.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const sb = sbAdmin();
  const BATCH_SIZE = 10;
  const STALE_DAYS = 30;
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 86400 * 1000).toISOString();

  // NOTE: This assumes shadow_specs.updated_at exists.
  // If your schema uses created_at instead, swap updated_at -> created_at below.
  const { data: staleShadows, error } = await sb
    .from('shadow_specs')
    .select('product_id, updated_at')
    .lt('updated_at', staleThreshold)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[cron/refresh] DB error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: staleProducts, error: prodErr } = await sb
    .from('products')
    .select('id')
    .eq('spec_status', 'stale')
    .limit(BATCH_SIZE);

  if (prodErr) {
    console.error('[cron/refresh] products DB error:', prodErr);
    return NextResponse.json({ ok: false, error: prodErr.message }, { status: 500 });
  }

  const candidates = new Set<string>([
    ...(staleShadows || []).map((s) => s.product_id),
    ...(staleProducts || []).map((p) => p.id),
  ]);

  if (candidates.size === 0) {
    return NextResponse.json({ ok: true, message: 'No stale audits found.', count: 0 });
  }

  const baseUrl = getBaseUrl(req);

  // Optional: pass a secret header to internal stage routes (in case you guard them)
  const internalSecret = process.env.CRON_SECRET;
  const internalHeaders: Record<string, string> = { 'content-type': 'application/json' };
  if (internalSecret) internalHeaders['authorization'] = `Bearer ${internalSecret}`;

  const results: { productId: string; status: string }[] = [];

  for (const productId of candidates) {
    try {
      // stage_2
      const s2 = await fetch(`${baseUrl}/api/audit/stage2`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({ productId, forceRedo: true }),
      });
      if (!s2.ok) {
        const err = await s2.json().catch(() => ({}));
        results.push({ productId, status: `s2_failed: ${err.error || s2.status}` });
        continue;
      }

      // stage_3
      const s3 = await fetch(`${baseUrl}/api/audit/stage3`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({ productId, forceRedo: true }),
      });
      if (!s3.ok) {
        const err = await s3.json().catch(() => ({}));
        results.push({ productId, status: `s3_failed: ${err.error || s3.status}` });
        continue;
      }

      // stage_4
      const s4 = await fetch(`${baseUrl}/api/audit/stage4`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({ productId, forceRedo: true }),
      });
      const s4Body = await s4.json().catch(() => ({}));
      results.push({
        productId,
        status: s4.ok ? `refreshed (TI: ${s4Body.truth_index ?? 'n/a'})` : `s4_failed: ${s4Body.error || s4.status}`,
      });
    } catch (err: any) {
      results.push({ productId, status: `exception: ${err?.message || String(err)}` });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}