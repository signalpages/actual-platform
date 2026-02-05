import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@supabase/supabase-js";
import { runAuditWorker } from "@/lib/auditWorker";

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
      discover: { status: "running" }, // ✅ start immediately
      fetch: { status: "queued" },
      extract: { status: "queued" },
      normalize: { status: "queued" },
      assess: { status: "queued" },
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

    // ✅ declare ONCE, before any fallback logic
    const sb = supabaseAdmin();

    let productId = product.product_id;

    // 🔁 Fallback: resolve product_id from slug
    if (!productId) {
      const slug =
        product.raw?.slug ??
        body?.slug ??
        body?.product?.slug ??
        null;

      if (slug) {
        const { data: row, error: lookupErr } = await sb
          .from("products")
          .select("id, brand, model_name, category")
          .eq("slug", slug)
          .single();

        if (lookupErr) {
          console.error("Product lookup by slug failed:", lookupErr);
        }

        if (row?.id) {
          productId = row.id;
          product.brand ??= row.brand;
          product.model_name ??= row.model_name;
          product.category ??= row.category;
        }
      }
    }

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    // ✅ insert audit run
    const { data, error } = await sb
      .from("audit_runs")
      .insert({
        product_id: productId,
        status: "running",
        progress: 0,
        started_at: new Date().toISOString(),
        finished_at: null,
        error: null,
        result_shadow_spec_id: null,
        stage_state: initialStageState(),
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message ?? "Failed to create audit_run");
    }

    const runId = data.id;

    // ✅ pass the RESOLVED productId to the worker
    waitUntil(
      runAuditWorker(runId, {
        product_id: productId,
        brand: product.brand,
        model_name: product.model_name,
        category: product.category,
        raw: product.raw,
      })
    );

    return NextResponse.json({ ok: true, runId, status: "running" });
  } catch (err: any) {
    console.error("POST /api/audit failed:", err);
    return NextResponse.json(
      { ok: false, error: "AUDIT_START_FAILED", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
