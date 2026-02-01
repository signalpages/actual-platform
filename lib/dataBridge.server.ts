import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Product, ShadowSpecs, AuditResult } from "../types";

// --- Server-Side V1 Pipeline Functions (Zero Side Effects) ---

/**
 * Lazy-initialize Supabase client from Server Env.
 * Throws if keys are missing.
 */
function getSupabase(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) throw new Error("Missing SUPABASE_URL in env");
    if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env");

    return createClient(url, key, {
        auth: { persistSession: false },
    });
}

/**
 * Resolve product by slug (Server V1).
 */
export const getProductBySlug = async (slug: string): Promise<Product | null> => {
    const supabase = getSupabase();
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
export const getAudit = async (productId: string): Promise<ShadowSpecs | null> => {
    const supabase = getSupabase();

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
export const saveAudit = async (productId: string, payload: Partial<ShadowSpecs>): Promise<ShadowSpecs | null> => {
    const supabase = getSupabase();

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
