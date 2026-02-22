// lib/dataBridge.client.ts
"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Category, Asset, AuditResult } from "../types";
import { PRODUCT_CATEGORIES } from "./productCategories";
import { normalizeAuditResult, CanonicalAuditResult } from "./auditNormalizer";
import { sanitizeAuditPayload } from "./schemas/auditResponse";

/**
 * Client-side DataBridge
 * - public, browser-safe Supabase reads (anon)
 * - audit queue + polling
 * - IMPORTANT: Implements strict Deep Merge to prevent overwriting valid data with undefined.
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

// HELPER: Deep Merge Defined
// Only merges values that are NOT undefined/null (unless explicit null is intended, but mostly we want to avoid clobbering)
function deepMergeDefined(target: any, source: any) {
  if (!source) return target;
  if (!target) return source;

  Object.keys(source).forEach(key => {
    const sVal = source[key];

    if (sVal === undefined) return; // SKIP undefined

    if (sVal && typeof sVal === 'object' && !Array.isArray(sVal)) {
      target[key] = deepMergeDefined(target[key] || {}, sVal);
    } else {
      target[key] = sVal;
    }
  });

  return target;
}

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

  if (!data?.ok) {
    // Explicit error handling from API contract
    const errCode = data?.analysis?.error?.code || 'UNKNOWN_ERROR';
    const errMsg = data?.analysis?.error?.message || data?.error || "Failed to queue audit";
    throw new Error(`[${errCode}] ${errMsg}`);
  }

  // 2) Cached / Immediate (Normalized)
  // New Contract: data.audit contains the payload.
  if (data.audit || data.stages) {
    // CACHE-001: sanitize before normalizing — no undefined fields allowed
    const rawAudit = sanitizeAuditPayload(data.audit || {});

    // Normalize
    const normalized = normalizeAuditResult(rawAudit, asset);

    // Merge analysis metadata strictly
    normalized.analysis = deepMergeDefined(normalized.analysis, data.analysis);

    // Ensure runId is propagated
    if (data.runId) normalized.analysis.runId = data.runId;

    return { ...normalized, cache: data.cache };
  }

  // 3) Async path (Polling)
  const runId = data.runId;
  if (!runId) throw new Error("No runId returned from queue");

  return await pollAuditStatus(runId, asset);
};

// Promise-based deduplication - return same promise for duplicate requests
const pollPromises = new Map<string, Promise<CanonicalAuditResult & { cache?: any }>>();

async function pollAuditStatus(runId: string, asset?: Asset): Promise<CanonicalAuditResult & { cache?: any }> {
  const existing = pollPromises.get(runId);
  if (existing) return existing;

  const pollPromise = (async (): Promise<CanonicalAuditResult & { cache?: any }> => {
    const maxAttempts = 60;
    const maxElapsedMs = 180_000;
    const startTime = Date.now();

    console.log(`[Polling] Started for runId ${runId}`);

    try {
      for (let i = 0; i < maxAttempts; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > maxElapsedMs) throw new Error("Audit timed out.");

        if (i > 0) await new Promise(r => setTimeout(r, i < 10 ? 2000 : 4000));

        const resp = await fetch(`/api/audit?slug=${asset?.slug}&forceRefresh=false`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug: asset?.slug }) // Polling via idempotent POST to get fresh canonical state
        });

        const data = await resp.json();

        if (!data?.ok) {
          // Allow transient errors, but fail on explicit fatal
          if (data?.analysis?.error?.code === 'WORKER_FAILED') throw new Error(data.analysis.error.message);
          console.warn(`[Polling] Transient error or pending:`, data?.error);
          continue;
        }

        const status = data.analysis?.status;

        if (status === 'ready') {
          console.log(`[Polling] Completed for ${runId} (Status: ready)`);
          const rawAudit = data.audit || {};
          const normalized = normalizeAuditResult(rawAudit, asset);
          normalized.analysis = deepMergeDefined(normalized.analysis, data.analysis);
          return normalized;
        }

        if (status === 'failed') {
          throw new Error(data.analysis?.error?.message || "Audit failed during processing");
        }

        if (i % 5 === 0) console.log(`[Polling] ${runId}: ${status} - Waiting...`);
      }

      throw new Error("Audit timed out.");
    } finally {
      pollPromises.delete(runId);
    }
  })();

  pollPromises.set(runId, pollPromise);
  return pollPromise;
}
