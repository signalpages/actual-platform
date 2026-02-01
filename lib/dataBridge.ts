import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { Product, ShadowSpecs, AuditResult, Category, Asset } from "../types";

// --- Types ---

export type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  GOOGLE_AI_STUDIO_KEY?: string;
  [key: string]: any;
};

// --- Server-Side V1 Pipeline Functions (Zero Side Effects) ---

/**
 * Lazy-initialize Supabase client from Cloudflare Env.
 * Throws if keys are missing.
 */
function getSupabase(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL in env");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env");

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Resolve product by slug (Server V1).
 */
export const getProductBySlug = async (env: Env, slug: string): Promise<Product | null> => {
  const supabase = getSupabase(env);
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
export const getAudit = async (env: Env, productId: string): Promise<ShadowSpecs | null> => {
  const supabase = getSupabase(env);

  // Try to find a verified one first
  const { data: verified } = await supabase
    .from("shadow_specs")
    .select("*")
    .eq("product_id", productId)
    .eq("is_verified", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verified) return verified as ShadowSpecs;

  // Fallback to latest
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
export const saveAudit = async (env: Env, productId: string, payload: Partial<ShadowSpecs>): Promise<ShadowSpecs | null> => {
  const supabase = getSupabase(env);

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

// --- Client-Side Helpers (Browser/UI) ---

// Helper to get client env (strictly import.meta.env for Vite)
const getClientEnv = (key: string) => {
  // @ts-ignore
  return typeof import.meta !== "undefined" && import.meta.env ? import.meta.env[`VITE_${key}`] : undefined;
};

// Lazy-init singleton for client to avoid top-level side effects during server build
let _publicClient: SupabaseClient | null = null;

function getPublicClient() {
  if (_publicClient) return _publicClient;

  const url = getClientEnv("SUPABASE_URL");
  const key = getClientEnv("SUPABASE_ANON_KEY");

  if (!url || !key) {
    // Return a dummy client or throw? 
    // If we throw here, site crashes if env missing.
    // Better to create it, but requests will fail.
    console.warn("Missing Supabase Client Env");
  }

  _publicClient = createClient(url || "", key || "");
  return _publicClient;
}

export const listCategories = (): Category[] => [
  { id: 'portable_power_station', label: 'Portable Power Stations' },
  { id: 'solar_generator_kit', label: 'Solar Generator Kits' },
  { id: 'solar_panel', label: 'Solar Panels' },
  { id: 'inverter', label: 'Inverters' },
  { id: 'battery', label: 'Batteries' },
  { id: 'charge_controller', label: 'Charge Controllers' },
];

export const searchAssets = async (query: string, category: string): Promise<Product[]> => {
  const { data } = await getPublicClient()
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
  const { data } = await getPublicClient()
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    verified: data.is_audited,
    verification_status: data.is_audited ? 'verified' : 'provisional'
  } as Asset;
};

export const getAllAssets = async (): Promise<Asset[]> => {
  const { data } = await getPublicClient()
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
