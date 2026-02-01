import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { Product, ShadowSpecs, AuditResult, Category, Asset } from "../types";

// Helper for generic env access
export const getEnv = (key: string) => {
  // @ts-ignore
  const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  // @ts-ignore
  const procEnv = typeof process !== "undefined" ? process.env : {};
  return viteEnv[`VITE_${key}`] || procEnv[key];
};

// --- Server-Side V1 Pipeline Functions (Require 'supabase' injection) ---

/**
 * Resolve product by slug (Server V1).
 */
export const getProductBySlug = async (supabase: SupabaseClient, slug: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as Product;
};

/**
 * Get latest audit (Server V1).
 */
export const getAudit = async (supabase: SupabaseClient, productId: string): Promise<ShadowSpecs | null> => {
  const { data: verified } = await supabase
    .from("shadow_specs")
    .select("*")
    .eq("product_id", productId)
    .eq("is_verified", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verified) return verified as ShadowSpecs;

  const { data: latest } = await supabase
    .from("shadow_specs")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latest as ShadowSpecs) || null;
};

/**
 * Persist audit (Server V1).
 */
export const saveAudit = async (supabase: SupabaseClient, productId: string, payload: Partial<ShadowSpecs>): Promise<ShadowSpecs | null> => {
  const { data, error } = await supabase
    .from("shadow_specs")
    .upsert(
      {
        product_id: productId,
        claimed_specs: payload.claimed_specs || {},
        actual_specs: payload.actual_specs || {},
        red_flags: payload.red_flags || [],
        truth_score: payload.truth_score,
        source_urls: payload.source_urls || [],
        is_verified: !!payload.is_verified,
      },
      { onConflict: "product_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to save audit:", error);
    return null;
  }
  return data as ShadowSpecs;
};

// Helper: Convert ShadowSpecs -> App-Level AuditResult
export const mapShadowToResult = (specs: ShadowSpecs): AuditResult => {
  return {
    assetId: specs.product_id,
    analysis: {
      status: specs.is_verified ? "ready" : "failed",
      last_run_at: specs.created_at,
    },
    claim_profile: Array.isArray(specs.claimed_specs) ? specs.claimed_specs : [],
    reality_ledger: Array.isArray(specs.actual_specs) ? specs.actual_specs : [],
    discrepancies: Array.isArray(specs.red_flags) ? specs.red_flags : [],
    truth_index: specs.truth_score,
  };
};

// --- Client-Side Helpers (Restored for UI Compatibility) ---

const publicClient = createClient(getEnv("SUPABASE_URL") || "", getEnv("SUPABASE_ANON_KEY") || "");

export const listCategories = (): Category[] => [
  { id: 'portable_power_station', label: 'Portable Power Stations' },
  { id: 'solar_generator_kit', label: 'Solar Generator Kits' },
  { id: 'solar_panel', label: 'Solar Panels' },
  { id: 'inverter', label: 'Inverters' },
  { id: 'battery', label: 'Batteries' },
  { id: 'charge_controller', label: 'Charge Controllers' },
];

export const searchAssets = async (query: string, category: string): Promise<Product[]> => {
  const { data } = await publicClient
    .from('products')
    .select('*')
    .eq('category', category)
    .ilike('model_name', `%${query}%`)
    .limit(20);
  return (data as Product[]) || [];
};

export const createProvisionalAsset = async (payload: any) => {
  return { ok: false, error: "Asset creation is disabled in V1." };
};

export const getAssetBySlug = async (slug: string): Promise<Asset | null> => {
  const { data } = await publicClient
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return null;

  // Cast to Legacy Asset Type
  return {
    ...data,
    verified: data.is_audited,
    verification_status: data.is_audited ? 'verified' : 'provisional'
  } as Asset;
};

export const runAudit = async (slug: string): Promise<AuditResult> => {
  const resp = await fetch("/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });

  const data = await resp.json();
  if (!data.ok || !data.audit) {
    throw new Error(data.error || "Audit failed");
  }
  return data.audit;
};

export const getAllAssets = async (): Promise<Asset[]> => {
  const { data } = await publicClient
    .from('products')
    .select('*')
    .limit(200);

  if (!data) return [];

  return data.map(d => ({
    ...d,
    verified: d.is_audited,
    verification_status: d.is_audited ? 'verified' : 'provisional'
  })) as Asset[];
};
