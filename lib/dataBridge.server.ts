import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Product, Asset, ShadowSpecs, AuditResult } from "@/types";
import { isValidCategory } from "@/lib/categorizeProduct";

// --- Server-Side V1 Pipeline Functions (Zero Side Effects) ---

/**
 * Lazy-initialize Supabase client from Server Env.
 * Throws if keys are missing.
 */
/**
 * Lazy-initialize Supabase client from Server Env.
 * Throws if keys are missing.
 */
async function getSupabase(): Promise<SupabaseClient> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) throw new Error("Missing SUPABASE_URL in env");
    if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env");

    const { createClient } = await import("@supabase/supabase-js");

    return createClient(url, key, {
        auth: { persistSession: false },
    });
}

/**
 * Resolve product by slug (Server V1).
 */
export const getProductBySlug = async (slug: string): Promise<Product | null> => {
    const supabase = await getSupabase();
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
    const supabase = await getSupabase();

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
    const supabase = await getSupabase();

    // Map progressive audit format to database schema
    // Store new fields in actual_specs as a temporary solution until migration
    // Map progressive audit format to database schema

    // Extract Stage 4 fields (strengths, limitations, etc.)
    const stage4Fields = {
        strengths: (payload as any).strengths || [],
        limitations: (payload as any).limitations || [],
        practical_impact: (payload as any).practical_impact || [],
        good_fit: (payload as any).good_fit || [],
        consider_alternatives: (payload as any).consider_alternatives || [],
        metric_bars: (payload as any).metric_bars || [],
        score_interpretation: (payload as any).score_interpretation || '',
        data_confidence: (payload as any).data_confidence || ''
    };

    // Explicit field mapping as requested
    const truthScore =
        typeof (payload as any).truth_score === 'number' ? (payload as any).truth_score :
            typeof (payload as any).truth_index === 'number' ? (payload as any).truth_index :
                0;

    const claimed =
        (payload as any).claimed_specs ??
        (payload as any).advertised_claims ??
        (payload as any).claim_profile ??
        [];

    const redFlags =
        (payload as any).red_flags ??
        (payload as any).discrepancies ??
        [];

    const sourceUrls = (payload as any).source_urls ?? [];

    // Merge reality_ledger with Stage 4 fields into actual_specs JSONB
    const realityLedger = (payload as any).actual_specs ?? (payload as any).reality_ledger ?? [];
    const actualSpecsCombined = {
        ...stage4Fields,
        reality_ledger: realityLedger // Keep strictly as array inside if needed later
    };

    const auditData = {
        product_id: productId,
        claimed_specs: claimed,
        actual_specs: actualSpecsCombined, // Stores both Stage 4 data and reality ledger
        red_flags: redFlags,
        truth_score: truthScore,
        source_urls: sourceUrls,
        is_verified: !!payload.is_verified,
        updated_at: new Date().toISOString(),
        // Persist stages if provided in payload (redundancy for safety)
        ...((payload as any).stages ? { stages: (payload as any).stages } : {})
    };

    // UPSERT: insert or update on conflict with product_id unique constraint
    const { data, error } = await supabase
        .from("shadow_specs")
        .upsert(auditData, {
            onConflict: 'product_id',
            ignoreDuplicates: false // Always update on conflict
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to save audit:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        return null;
    }

    console.log(`[Server] Audit saved successfully for product ${productId}:`, {
        id: data.id,
        truth_score: data.truth_score,
        is_verified: data.is_verified,
        items_count: claimed.length
    });

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

    // Extract Stage 4 fields from actual_specs if they exist
    const stage4Data = typeof specs.actual_specs === 'object' && specs.actual_specs !== null
        ? specs.actual_specs as any
        : {};

    // Helper to pick first non-empty array
    const pickNonEmpty = (arr: any) => (Array.isArray(arr) && arr.length > 0 ? arr : null);

    // Robust Reality Ledger Extraction
    // Priority: Stage 4 (Final) -> Stage 3 (Source) -> Stage 1 (Shim) -> Empty
    const reality_ledger =
        pickNonEmpty(stage4Data.reality_ledger) ??
        pickNonEmpty(specs.stages?.stage_3?.data?.reality_ledger) ??
        pickNonEmpty(specs.stages?.stage_1?.data?.reality_ledger) ??
        [];
    return {
        assetId: specs.product_id,
        analysis: {
            status,
            last_run_at: specs.created_at,
        },
        claim_profile: Array.isArray(specs.claimed_specs) ? specs.claimed_specs : [],
        reality_ledger,
        discrepancies: Array.isArray(specs.red_flags) ? specs.red_flags : [],
        truth_index: specs.truth_score,
        // Include Stage 4 fields
        strengths: stage4Data.strengths || [],
        limitations: stage4Data.limitations || [],
        practical_impact: stage4Data.practical_impact || [],
        good_fit: stage4Data.good_fit || [],
        consider_alternatives: stage4Data.consider_alternatives || [],
        metric_bars: stage4Data.metric_bars || [],
        score_interpretation: stage4Data.score_interpretation || '',
        data_confidence: stage4Data.data_confidence || ''
    };
};

// ============ Audit Run (Async Queue) Helpers ============

import { AuditRun } from '@/types';

/**
 * Create a new audit run job
 */
export const createAuditRun = async (productId: string): Promise<AuditRun | null> => {
    const supabase = await getSupabase();

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
    const supabase = await getSupabase();

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
    const supabase = await getSupabase();

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
    const supabase = await getSupabase();

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

/**
 * Get aggregate statistics for the ledger (Server V1).
 * Returns real-time counts for Coverage page.
 * Assumes DB unique constraint on shadow_specs(product_id).
 */
export const getLedgerStats = async () => {
    try {
        const supabase = await getSupabase();
        const now = new Date();

        // 1. Total Assets
        const { count: totalAssets, error: totalError } = await supabase
            .from("products")
            .select("*", { count: 'exact', head: true });

        // 2. Verified Assets
        // Fetch only what's needed to reduce payload size
        const { data: allSpecs, error: specsError } = await supabase
            .from("shadow_specs")
            .select("truth_score, claimed_specs, stages, created_at");

        let verifiedCount = 0;
        let maxCreatedAt: string | null = null;

        if (allSpecs) {
            for (const spec of allSpecs) {
                // Defensive checks for stages object
                const stages = spec.stages && typeof spec.stages === 'object' ? spec.stages as any : {};
                const s3 = stages.stage_3?.status === 'done';
                const s4 = stages.stage_4?.status === 'done';
                const score = (spec.truth_score ?? 0) >= 80;
                const claimsCount = Array.isArray(spec.claimed_specs) ? spec.claimed_specs.length : 0;
                const claimsGate = claimsCount >= 3;

                if (s3 && s4 && score && claimsGate) {
                    verifiedCount++;
                }

                if (spec.created_at && (!maxCreatedAt || spec.created_at > maxCreatedAt)) {
                    maxCreatedAt = spec.created_at;
                }
            }
        }

        // 3. Pending Audits (Unfiltered per prod-safe policy)
        const { count: pendingAudits, error: pendingError } = await supabase
            .from("audit_runs")
            .select("*", { count: 'exact', head: true })
            .in("status", ["pending", "running"]);

        if (totalError || specsError || pendingError) {
            console.error("Supabase error in getLedgerStats:", { totalError, specsError, pendingError });
        }

        return {
            totalAssets: totalAssets || 0,
            verifiedAssets: verifiedCount,
            provisionalAssets: Math.max(0, (totalAssets || 0) - verifiedCount),
            pendingAudits: pendingAudits || 0,
            lastChecked: now.toISOString(),
            ledgerUpdatedAt: maxCreatedAt || now.toISOString()
        };
    } catch (err) {
        console.error("Critical error in getLedgerStats:", err);
        return {
            totalAssets: 0,
            verifiedAssets: 0,
            provisionalAssets: 0,
            pendingAudits: 0,
            lastChecked: new Date().toISOString(),
            ledgerUpdatedAt: new Date().toISOString()
        };
    }
};
