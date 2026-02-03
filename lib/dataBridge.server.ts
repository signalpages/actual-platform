import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Product, Asset, ShadowSpecs, AuditResult } from "@/types";
import { isValidCategory } from "@/lib/categorizeProduct";

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

    // Check if audit already exists for this product
    const { data: existing } = await supabase
        .from("shadow_specs")
        .select("id")
        .eq("product_id", productId)
        .maybeSingle();

    // Map progressive audit format to database schema
    const auditData = {
        product_id: productId,
        // Handle both old and new field names
        claimed_specs: (payload as any).advertised_claims || payload.claimed_specs || [],
        actual_specs: (payload as any).reality_ledger || payload.actual_specs || [],
        red_flags: (payload as any).discrepancies || payload.red_flags || [],
        truth_score: (payload as any).truth_index ?? payload.truth_score ?? 0,
        source_urls: payload.source_urls || [],
        is_verified: !!payload.is_verified,
        last_run_at: new Date().toISOString(),
        // Include progressive stage data if present
        ...(payload.stages ? { stages: payload.stages } : {})
    };

    let data, error;

    if (existing) {
        // Update existing audit
        const result = await supabase
            .from("shadow_specs")
            .update(auditData)
            .eq("id", existing.id)
            .select()
            .single();
        data = result.data;
        error = result.error;
    } else {
        // Insert new audit
        const result = await supabase
            .from("shadow_specs")
            .insert(auditData)
            .select()
            .single();
        data = result.data;
        error = result.error;
    }

    if (error) {
        console.error("Failed to save audit:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Payload keys:", Object.keys(payload));
        return null;
    }
    return data as ShadowSpecs;
};

// Helper: Convert ShadowSpecs -> App-Level AuditResult
export const mapShadowToResult = (specs: ShadowSpecs): AuditResult => {
    // Derive status from truth_score
    let status: "ready" | "provisional" | "failed" = "failed";
    if (specs.is_verified && specs.truth_score && specs.truth_score >= 80) {
        status = "ready";
    } else if (specs.truth_score && specs.truth_score >= 40) {
        status = "provisional";
    }

    return {
        assetId: specs.product_id,
        analysis: {
            status,
            last_run_at: specs.created_at,
        },
        claim_profile: Array.isArray(specs.claimed_specs) ? specs.claimed_specs : [],
        reality_ledger: Array.isArray(specs.actual_specs) ? specs.actual_specs : [],
        discrepancies: Array.isArray(specs.red_flags) ? specs.red_flags : [],
        truth_index: specs.truth_score,
    };
};

// ============ Audit Run (Async Queue) Helpers ============

import { AuditRun } from '@/types';

/**
 * Create a new audit run job
 */
export const createAuditRun = async (productId: string): Promise<AuditRun | null> => {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("audit_runs")
        .insert({
            product_id: productId,
            status: 'pending',
            progress: 0,
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to create audit run:", error);
        return null;
    }

    return data as AuditRun;
};

/**
 * Get audit run by ID
 */
export const getAuditRun = async (runId: string): Promise<AuditRun | null> => {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("audit_runs")
        .select("*")
        .eq("id", runId)
        .single();

    if (error) {
        console.error("Failed to get audit run:", error);
        return null;
    }

    return data as AuditRun;
};

/**
 * Get active audit run for a product
 */
export const getActiveAuditRun = async (productId: string): Promise<AuditRun | null> => {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("audit_runs")
        .select("*")
        .eq("product_id", productId)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Failed to get active audit run:", error);
        return null;
    }

    return data as AuditRun | null;
};

/**
 * Update audit run status
 */
export const updateAuditRun = async (
    runId: string,
    updates: Partial<AuditRun>
): Promise<boolean> => {
    const supabase = getSupabase();

    const { error } = await supabase
        .from("audit_runs")
        .update(updates)
        .eq("id", runId);

    if (error) {
        console.error("Failed to update audit run:", error);
        return false;
    }

    return true;
};
