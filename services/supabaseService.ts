import { createClient } from "@supabase/supabase-js";
import { Product, AuditResult, Asset } from "../types";
import { mapToCanonicalSpec } from "../lib/specMapping";

const getEnv = (key: string) => {
  // @ts-ignore
  const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  // @ts-ignore
  const procEnv = typeof process !== "undefined" ? process.env : {};
  return viteEnv[`VITE_${key}`] || procEnv[key];
};

const supabaseUrl = getEnv("SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_ANON_KEY");

export const isSupabaseConfigured = !!(supabaseUrl && supabaseUrl.startsWith("http") && supabaseKey);

const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseKey : "placeholder"
);

/** --- Canonical → UI adapter (V1 safety layer) */
const toAuditItems = (rows: any[]): any[] => {
  return (rows || []).map((r) => ({
    label: r.key,
    value: r.value,
    conditions: r.conditions,
    evidence: r.evidence,
    confidence: r.confidence,
    status: r.status,
  }));
};

/** Fallback: legacy map/object -> AuditItem[] */
const mapObjectToAuditItems = (obj: any): any[] => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([label, value]) => ({
    label,
    value: value == null ? "—" : String(value),
    status: value == null ? "missing" : "ok",
  }));
};

export const supabaseFetchAll = async (): Promise<Asset[]> => {
  const { data, error } = await supabase.from("products").select("*");
  if (error || !data) return [];

  return (data as Product[]).map((p) => ({
    ...p,
    verified: p.is_audited,
    verification_status: p.is_audited ? "verified" : "provisional",
  }));
};

export const supabaseFetchBySlug = async (slug: string): Promise<Asset | null> => {
  const { data, error } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;

  const p = data as Product;
  return {
    ...p,
    verified: p.is_audited,
    verification_status: p.is_audited ? "verified" : "provisional",
  };
};

export const supabaseCreateAsset = async (asset: Partial<Asset>): Promise<Asset | null> => {
  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        brand: asset.brand,
        model_name: asset.model_name,
        category: asset.category,
        signature: asset.signature,
        slug: asset.slug,
        is_audited: false,
      },
    ])
    .select()
    .single();

  if (error || !data) return null;

  const p = data as Product;
  return {
    ...p,
    verified: p.is_audited,
    verification_status: p.is_audited ? "verified" : "provisional",
  };
};

export const supabaseFetchAuditByAsset = async (assetId: string): Promise<AuditResult | null> => {
  const { data, error } = await supabase.from("shadow_specs").select("*").eq("product_id", assetId).maybeSingle();
  if (error || !data) return null;

  const canonical = (data as any).canonical_spec_json;

  const claim_profile = canonical?.claim_profile_rows
    ? toAuditItems(canonical.claim_profile_rows)
    : Array.isArray((data as any).claimed_specs)
      ? (data as any).claimed_specs
      : mapObjectToAuditItems((data as any).claimed_specs);

  const reality_ledger = canonical?.reality_ledger_rows
    ? toAuditItems(canonical.reality_ledger_rows)
    : Array.isArray((data as any).actual_specs)
      ? (data as any).actual_specs
      : mapObjectToAuditItems((data as any).actual_specs);

  return {
    assetId: (data as any).product_id,
    analysis: { status: "ready", last_run_at: (data as any).created_at },

    claim_profile,
    reality_ledger,

    discrepancies: (data as any).red_flags,
    truth_index: (data as any).truth_score,
  };
};

export const supabaseSaveAudit = async (audit: AuditResult): Promise<boolean> => {
  // Build canonical rows from whatever we have (even if partial)
  const canonical_spec = mapToCanonicalSpec({
    claim_profile: audit.claim_profile,
    reality_ledger: audit.reality_ledger,
    discrepancies: audit.discrepancies,
    truth_index: audit.truth_index,
  });

  const payload: any = {
    product_id: audit.assetId,
    truth_score: audit.truth_index,
    claimed_specs: audit.claim_profile,
    actual_specs: audit.reality_ledger,
    red_flags: audit.discrepancies,
    is_verified: (audit.truth_index || 0) > 80,
    source_urls: [],
    canonical_spec_json: canonical_spec, // ✅ THE WHOLE POINT
  };

  const { error: auditError } = await supabase.from("shadow_specs").upsert(payload, { onConflict: "product_id" });

  if (auditError) {
    console.error("supabaseSaveAudit upsert failed:", auditError);
    return false;
  }

  const { error: prodErr } = await supabase.from("products").update({ is_audited: true }).eq("id", audit.assetId);
  if (prodErr) console.warn("products update failed:", prodErr);

  return true;
};

export const getSupabaseHealthReport = async () => {
  let products: any[] = [];
  let shadowSpecs: any[] = [];
  let errorState: any = null;

  if (isSupabaseConfigured) {
    const pRes = await supabase.from("products").select("id, is_audited");
    const sRes = await supabase.from("shadow_specs").select("product_id");
    products = pRes.data || [];
    shadowSpecs = sRes.data || [];
    errorState = pRes.error;
  }

  return {
    ok: !errorState && isSupabaseConfigured,
    env: { host: isSupabaseConfigured ? new URL(supabaseUrl!).hostname : "mock", configured: isSupabaseConfigured },
    checks: {
      total_products: products.length,
      active_products: products.filter((p) => p.is_audited).length,
      products_with_specs: shadowSpecs.length,
      products_without_specs: Math.max(0, products.length - shadowSpecs.length),
    },
    warnings: !isSupabaseConfigured ? ["Running in mock mode."] : [],
  };
};
