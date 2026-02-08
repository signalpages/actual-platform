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
    product_id: p.id ?? p.product_id ?? null,
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
    const { data: existingRun, error: existingErr } = await sb
      .from("audit_runs")
      .select("id, status")
      .eq("product_id", productId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) console.error("Active run lookup failed:", existingErr);

    if (existingRun?.id) {
      return NextResponse.json({
        ok: true,
        runId: existingRun.id,
        status: existingRun.status,
      });
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

    return NextResponse.json({ ok: true, runId: data.id, status: "pending" });
  } catch (err: any) {
    console.error("POST /api/audit failed:", err);
    return NextResponse.json(
      { ok: false, error: "AUDIT_START_FAILED", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

