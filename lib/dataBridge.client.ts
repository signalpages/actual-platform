// lib/dataBridge.client.ts
"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Category, Asset, AuditResult } from "../types";
import { PRODUCT_CATEGORIES } from "./productCategories";

/**
 * Client-side DataBridge
 * - public, browser-safe Supabase reads (anon)
 * - audit queue + polling
 * - IMPORTANT: status endpoint may return { audit, stages, claim_profile, ... } as siblings
 *   so we merge sibling fields into audit before returning to UI.
 */

let _publicClient: SupabaseClient | null = null;

function getPublicClient(): SupabaseClient {
  if (_publicClient) return _publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.warn(
      "[DataBridge] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in client env"
    );
  }

  _publicClient = createClient(url || "", anon || "");
  return _publicClient;
}

import { CATEGORY_LABELS } from "../types";
import { CATEGORY_DESCRIPTIONS, getCategoryIcon, listCategories as listCategoriesShared } from "./productCategories";

export const listCategories = listCategoriesShared;

export const listManufacturers = async (): Promise<string[]> => {
  try {
    const client = getPublicClient();
    const { data, error } = await client.from("products").select("brand").not("brand", "is", null);

    if (error) throw error;

    const uniq = Array.from(new Set((data ?? []).map((r: any) => r.brand).filter(Boolean)));
    uniq.sort();
    return uniq;
  } catch (e) {
    console.warn("[DataBridge] listManufacturers failed:", e);
    return [];
  }
};

export const searchAssets = async (
  query: string,
  category: string = "all",
  brand: string = "all"
): Promise<Asset[]> => {
  try {
    const client = getPublicClient();

    // 1) Fetch Products
    let builder = client.from("products").select("*");

    if (category !== "all") builder = builder.eq("category", category);
    if (brand !== "all") builder = builder.eq("brand", brand);
    if (query && query.trim().length > 0) builder = builder.ilike("model_name", `%${query}%`);

    const { data: products, error: pErr } = await builder.limit(200);
    if (pErr) throw pErr;
    if (!products || products.length === 0) return [];

    // 2) Fetch Shadow Specs
    const productIds = products.map((p: any) => p.id);
    const { data: shadows, error: sErr } = await client
      .from("shadow_specs")
      .select("product_id, is_verified, truth_score, created_at, red_flags, actual_specs, claimed_specs")
      .in("product_id", productIds);

    if (sErr) throw sErr;

    // 3) Merge
    const shadowMap = new Map((shadows || []).map((s: any) => [s.product_id, s]));

    return products.map((p: any) => {
      const shadow = shadowMap.get(p.id);
      // Promote all seeded items to verified (if no shadow record exists) per user request
      const isVerified = shadow ? !!shadow.is_verified : true;
      const truthScore = shadow ? shadow.truth_score : null;

      return {
        ...p,
        verified: isVerified,
        verification_status: isVerified ? "verified" : "provisional",
        last_updated: shadow?.created_at || p.created_at,
        truth_score: truthScore,
        latest_discrepancies: shadow?.red_flags || [],
        latest_actual_specs: shadow?.actual_specs || [],
        latest_claimed_specs: shadow?.claimed_specs || []
      };
    }) as Asset[];
  } catch (e) {
    console.warn("[DataBridge] searchAssets failed:", e);
    return [];
  }
};

export const createProvisionalAsset = async (
  _payload: any
): Promise<{ ok: boolean; error?: string; asset?: Asset }> => {
  return { ok: false, error: "Asset creation is disabled in V1." };
};

export const getAssetBySlug = async (slug: string): Promise<Asset | null> => {
  try {
    const client = getPublicClient();
    const { data, error } = await client.from("products").select("*").eq("slug", slug).maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      verified: !!data.is_audited || !!data.is_verified,
      verification_status: (data.is_audited || data.is_verified) ? "verified" : "provisional",
    } as Asset;
  } catch (e) {
    console.warn("[DataBridge] getAssetBySlug failed:", e);
    return null;
  }
};

// -------------------- Audit Queue + Polling --------------------

type RunAuditPayload = string | { slug: string; forceRefresh?: boolean; asset?: Asset };

type AuditWithCache = AuditResult & { cache?: any };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ensure analysis.status is derived consistently (server may return provisional/verified etc)
import { normalizeAuditResult, CanonicalAuditResult } from "./auditNormalizer";

// ... existing imports ...

// Update return types
export const runAudit = async (payload: RunAuditPayload): Promise<CanonicalAuditResult & { cache?: any }> => {
  const slug = typeof payload === "string" ? payload : payload.slug;
  const forceRefresh = typeof payload === "object" ? !!payload.forceRefresh : false;
  const asset = typeof payload === "object" ? payload.asset : undefined;

  if (!slug) throw new Error("Missing slug for audit");

  // 1) Queue the audit
  const resp = await fetch("/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, forceRefresh }),
  });

  const data = await resp.json();

  if (!data?.ok) throw new Error(data?.error || "Failed to queue audit");

  // 2) Cached / immediate path (Normalized)
  if (data.audit || data.stages) {
    // If we have direct data, normalize it immediately
    // Use the raw data object as the source, merging top-level keys
    const rawForNormalization = {
      ...data.audit,
      stages: data.stages ?? data.audit?.stages,
      // Carry over top-level fields that might be siblings in the response
      claim_profile: data.claim_profile,
      reality_ledger: data.reality_ledger,
      discrepancies: data.discrepancies,
      truth_index: data.truth_index ?? data.truth_score,
      analysis: data.analysis
    };

    const normalized = normalizeAuditResult(rawForNormalization, asset);
    return { ...normalized, cache: data.cache };
  }

  // 3) Async path
  const runId = data.runId;
  if (!runId) throw new Error("No runId returned from queue");

  const result = await pollAuditStatus(runId, asset);
  if (data.cache) (result as any).cache = data.cache;
  return result;
};

// Promise-based deduplication - return same promise for duplicate requests
const pollPromises = new Map<string, Promise<CanonicalAuditResult & { cache?: any }>>();

async function pollAuditStatus(runId: string, asset?: Asset): Promise<CanonicalAuditResult & { cache?: any }> {
  const existing = pollPromises.get(runId);
  if (existing) return existing;

  const pollPromise = (async (): Promise<CanonicalAuditResult & { cache?: any }> => {
    const maxAttempts = 60; // Increased attempts to match new timeout
    const maxElapsedMs = 180_000; // 3 minutes client-side timeout
    const startTime = Date.now();

    console.log(`[Polling] Started for runId ${runId} with asset: ${asset ? 'YES' : 'NO'}`);

    try {
      for (let i = 0; i < maxAttempts; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > maxElapsedMs) throw new Error("Audit timed out. Please try again.");

        if (i > 0) {
          const delay = i < 10 ? 2000 : i < 20 ? 3000 : 5000;
          await sleep(delay);
        }


        const resp = await fetch(`/api/audit/status?runId=${encodeURIComponent(runId)}`, { cache: 'no-store' });
        const data = await resp.json();

        if (!data?.ok) {
          console.error(`[Polling] API Error for ${runId}:`, data?.error);
          throw new Error(data?.error || "Failed to get audit status");
        }

        // FIX: Check activeRun.status (source of truth), not top-level status field
        const run = data.activeRun ?? data.displayRun;
        console.log(`[Polling] Debug ${runId}: active=${data.activeRun?.status}, display=${data.displayRun?.status}, topStatus=${data.status}, progress=${run?.progress}`);
        const runStatus = (run?.status ?? "").toLowerCase();
        const progress = run?.progress ?? 0;

        // Terminal conditions: done, error, canceled, OR progress === 100
        const isTerminal =
          runStatus === "done" ||
          runStatus === "error" ||
          runStatus === "canceled" ||
          progress === 100;

        if (isTerminal) {
          // Create a composite object for normalization
          const rawForNormalization = {
            ...data.audit,
            stages: data.stages,
            claim_profile: data.claim_profile,
            reality_ledger: data.reality_ledger,
            discrepancies: data.discrepancies,
            truth_index: data.truth_index ?? data.truth_score,
            analysis: data.analysis
          };

          const normalized = normalizeAuditResult(rawForNormalization, asset);

          console.log(
            `[Polling] Completed for ${runId} after ${i + 1} attempts (${Date.now() - startTime}ms). Status: ${runStatus}`
          );

          // If error status, throw to trigger error handling
          if (runStatus === "error" || runStatus === "canceled") {
            throw new Error(run?.error || "Audit failed");
          }

          return normalized as CanonicalAuditResult & { cache?: any };
        }

        if (i % 5 === 0) {
          console.log(`[Polling] runId ${runId}: ${runStatus} (${progress}%) - Waiting...`);
        }
      }


      throw new Error("Audit timed out after too many attempts. Please try again.");
    } finally {
      pollPromises.delete(runId);
      console.log(`[Polling] Stopped for runId ${runId}`);
    }
  })();

  pollPromises.set(runId, pollPromise);
  return pollPromise;
}
