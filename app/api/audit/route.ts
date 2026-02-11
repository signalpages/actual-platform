import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function initialStageState() {
  return {
    current: "discover",
    stages: {
      discover: { status: "pending" },
      fetch: { status: "pending" },
      extract: { status: "pending" },
      normalize: { status: "pending" },
      assess: { status: "pending" },
    },
  };
}

function normalizeProduct(body: any) {
  const p = body?.product ?? body ?? {};
  return {
    product_id: p.id ?? p.product_id ?? p.productId ?? null,
    brand: p.brand ?? null,
    model_name: p.model_name ?? p.model ?? p.name ?? null,
    category: p.category ?? null,
    raw: p,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const product = normalizeProduct(body);

    const sb = supabaseAdmin();
    let productId = product.product_id;

    // 🔁 Fallback: resolve product_id from slug
    if (!productId) {
      const slug = product.raw?.slug ?? body?.slug ?? body?.product?.slug ?? null;

      if (slug) {
        const { data: row, error: lookupErr } = await sb
          .from("products")
          .select("id")
          .eq("slug", slug)
          .single();

        if (lookupErr) console.error("Product lookup by slug failed:", lookupErr);
        if (row?.id) productId = row.id;
      }
    }

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    // ✅ insert audit run (Idempotent: check active first)
    // Fix: STALE CHECK. If an active run exists but is stale (no heartbeat for > 2 mins),
    // mark it as failed and proceed to create a new one.
    const { data: existingRun, error: existingErr } = await sb
      .from("audit_runs")
      .select("id, status, last_heartbeat, created_at")
      .eq("product_id", productId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) console.error("Active run lookup failed:", existingErr);

    if (existingRun?.id) {
      const now = Date.now();
      const heartbeatTime = existingRun.last_heartbeat ? new Date(existingRun.last_heartbeat).getTime() : 0;
      const createdTime = new Date(existingRun.created_at).getTime();

      const hbAge = now - heartbeatTime;
      const createAge = now - createdTime;

      console.log(`[AuditAPI] Found active run ${existingRun.id}. Status: ${existingRun.status}. HB Age: ${hbAge}ms. Create Age: ${createAge}ms.`);

      // Thresholds: 2 mins (running), 5 mins (pending)
      const isRunningStale = existingRun.status === 'running' && (hbAge > 120_000);
      const isPendingStale = existingRun.status === 'pending' && (createAge > 300_000);

      if (isRunningStale || isPendingStale) {
        console.warn(`[AuditAPI] KILLING STALE RUN ${existingRun.id}`);
        const { error: updateErr } = await sb.from("audit_runs").update({
          status: 'error',
          error: 'Stale run detected by API (Supervisor)',
          finished_at: new Date().toISOString()
        }).eq('id', existingRun.id);

        if (updateErr) console.error("Failed to kill stale run:", updateErr);
        // Fall through to create new run
      } else {
        console.log(`[AuditAPI] Returning existing active run ${existingRun.id}`);
        // It's active and healthy, return it
        return NextResponse.json({
          ok: true,
          runId: existingRun.id,
          status: existingRun.status,
        });
      }
    } else {
      console.log(`[AuditAPI] No active run found. Creating new one.`);
    }

    // 1) No active run → create a new one 'pending'
    // Stage state is initialized to pending, waited for runner to pickup
    const { data, error } = await sb
      .from("audit_runs")
      .insert({
        product_id: productId,
        status: "pending",
        progress: 0,
        started_at: null, // Will be set by runner
        finished_at: null,
        error: null,
        result_shadow_spec_id: null,
        stage_state: initialStageState(),
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("Failed to insert run:", error);
      const msg = error?.message ?? "Failed to create audit_run";

      // Race condition check logic
      if (msg.includes("idx_audit_runs_active_product")) {
        const { data: rerun } = await sb
          .from("audit_runs")
          .select("id, status")
          .eq("product_id", productId)
          .in("status", ["pending", "running"])
          .limit(1)
          .maybeSingle();

        if (rerun?.id) {
          return NextResponse.json({ ok: true, runId: rerun.id, status: rerun.status });
        }
      }
      throw new Error(msg);
    }

    // 2) TRIGGER AUDIT WORKER (Next.js/Vercel)
    console.log(`[AuditAPI] Triggering audit worker for ${data.id}...`);

    // Fire-and-forget: invoke worker in background
    const workerUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/audit/worker`
      : `${req.nextUrl.origin}/api/audit/worker`;

    fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: data.id })
    }).catch((err) => {
      console.error(`[AuditAPI] Failed to invoke worker:`, err);
      // Don't await - fire and forget
    });

    console.log(`[AuditAPI] Worker invocation sent (fire-and-forget).`);

    return NextResponse.json({ ok: true, runId: data.id, status: "pending" });
  } catch (err: any) {
    console.error("POST /api/audit failed:", err);
    return NextResponse.json(
      { ok: false, error: "AUDIT_START_FAILED", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

