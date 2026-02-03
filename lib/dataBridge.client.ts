// lib/dataBridge.client.ts
"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Category, Asset, AuditResult } from "../types";
import { PRODUCT_CATEGORIES } from "./productCategories";

/**
 * Client-side DataBridge
 * - public, browser-safe Supabase reads (anon)
 * - audit queue + polling
 * - IMPORTANT: status endpoint returns { audit, stages } as siblings
 *   so we merge stages into audit before returning to UI.
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

export const listCategories = (): Category[] => {
  return PRODUCT_CATEGORIES.map((cat) => ({ id: cat, label: cat }));
};

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
      .select("product_id, is_verified, truth_score, updated_at")
      .in("product_id", productIds);

    if (sErr) throw sErr;

    // 3) Merge
    const shadowMap = new Map((shadows || []).map((s: any) => [s.product_id, s]));

    return products.map((p: any) => {
      const shadow = shadowMap.get(p.id);
      const isVerified = shadow ? !!shadow.is_verified : !!p.is_audited;
      const truthScore = shadow ? shadow.truth_score : null;

      return {
        ...p,
        verified: isVerified,
        verification_status: isVerified ? "verified" : "provisional",
        last_updated: shadow?.updated_at || p.created_at,
        truth_score: truthScore,
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
      verified: !!data.is_audited,
      verification_status: data.is_audited ? "verified" : "provisional",
    } as Asset;
  } catch (e) {
    console.warn("[DataBridge] getAssetBySlug failed:", e);
    return null;
  }
};

// -------------------- Audit Queue + Polling --------------------

type RunAuditPayload = string | { slug: string; depth?: number; forceRefresh?: boolean };
type AuditWithCache = AuditResult & { cache?: any; stages?: any };

export const runAudit = async (payload: RunAuditPayload): Promise<AuditWithCache> => {
  const slug = typeof payload === "string" ? payload : payload.slug;
  const forceRefresh = typeof payload === "object" ? !!payload.forceRefresh : false;

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
    const audit = data.audit || {};
    // Option A: Normalize stages (sibling takes precedence)
    const normalized = {
      ...audit,
      stages: data.stages ?? audit.stages
    };

    normalizeAnalysisStatus(normalized);
    return { ...normalized, cache: data.cache };
  }

  // 3) Async path
  const runId = data.runId;
  if (!runId) throw new Error("No runId returned from queue");

  const result = await pollAuditStatus(runId);
  if (data.cache) (result as any).cache = data.cache;
  return result;
};

// Promise-based deduplication - return same promise for duplicate requests
const pollPromises = new Map<string, Promise<AuditWithCache>>();

async function pollAuditStatus(runId: string): Promise<AuditWithCache> {
  const existing = pollPromises.get(runId);
  if (existing) return existing;

  const pollPromise = (async (): Promise<AuditWithCache> => {
    const maxAttempts = 30;
    const maxElapsedMs = 90_000;
    const startTime = Date.now();

    console.log(`[Polling] Started for runId ${runId}`);

    try {
      for (let i = 0; i < maxAttempts; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > maxElapsedMs) throw new Error("Audit timed out. Please try again.");

        if (i > 0) {
          const delay = i < 10 ? 2000 : i < 20 ? 3000 : 5000;
          await sleep(delay);
        }

        const resp = await fetch(`/api/audit/status?runId=${encodeURIComponent(runId)}`);
        const data = await resp.json();

        if (!data?.ok) throw new Error(data?.error || "Failed to get audit status");

        if (data.status === "done") {
          const audit = data.audit || {};
          // Option A: Normalize stages (sibling takes precedence)
          const normalized = {
            ...audit,
            stages: data.stages ?? audit.stages
          };

          normalizeAnalysisStatus(normalized);

          console.log(
            `[Polling] Completed for ${runId} after ${i + 1} attempts (${Date.now() - startTime}ms)`
          );
          return normalized as AuditWithCache;
        }

        if (data.status === "error") throw new Error(data?.error || "Audit failed");

        if (i % 5 === 0) console.log(`[Polling] runId ${runId}: ${data.status} (${data.progress || 0}%)`);
      }

      throw new Error("Audit timed out after maximum polling attempts. Please try again.");
    } finally {
      pollPromises.delete(runId);
      console.log(`[Polling] Stopped for runId ${runId}`);
    }
  })();

  pollPromises.set(runId, pollPromise);
  return pollPromise;
}

function normalizeAnalysisStatus(audit: any) {
  // Ensure stages object exists
  if (!audit.stages) audit.stages = {};

  const s4Done = audit.stages.stage_4?.status === "done";
  if (!audit.analysis) audit.analysis = {};

  // FORCE OVERRIDE: If Stage 4 is done, the audit is done. 
  // This prevents UI deadlocks if root status is 'failed' or 'pending' but data exists.
  if (s4Done) {
    audit.analysis.status = "done";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
