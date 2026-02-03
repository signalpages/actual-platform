// lib/dataBridge.client.ts
"use client";

import { createClient } from "@supabase/supabase-js";
import { Asset } from "@/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Re-export or use from types.ts to avoid duplication/mismatch
// Defining local type if types.ts Asset is too strict, but usually we want to match.
// For now, let's use the local definition if it matches what was there, but ensure compatibility.
// Actually, better to return Asset[] to match components.

export async function listCategories(): Promise<{ id: string; label: string }[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .not("category", "is", null);

  if (error) throw error;

  const uniq = Array.from(new Set((data ?? []).map((r) => r.category).filter(Boolean)));
  uniq.sort();
  // Map to object format expected by UI {id, label}
  return uniq.map(cat => ({ id: cat, label: cat.replace(/_/g, ' ') }));
}

export async function listManufacturers(): Promise<string[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("products")
    .select("brand")
    .not("brand", "is", null);

  if (error) throw error;

  const uniq = Array.from(new Set((data ?? []).map((r) => r.brand).filter(Boolean)));
  uniq.sort();
  return uniq;
}

export async function searchAssets(query: string, category: string = "all", brand: string = "all"): Promise<Asset[]> {
  const supabase = getClient();

  let builder = supabase
    .from("products")
    .select("*") // Select all fields to populate Asset
    .order("created_at", { ascending: false });

  if (query?.trim()) builder = builder.ilike("model_name", `%${query.trim()}%`);
  if (category !== "all") builder = builder.eq("category", category);
  if (brand !== "all") builder = builder.eq("brand", brand);

  const { data: products, error: pErr } = await builder;
  if (pErr) {
    console.warn("Search assets failed:", pErr);
    return [];
  }

  if (!products?.length) return [];

  const ids = products.map((p) => p.id);
  const { data: shadows, error: sErr } = await supabase
    .from("shadow_specs")
    .select("product_id, truth_score, is_verified, updated_at")
    .in("product_id", ids);

  const shadowByProduct = new Map((shadows ?? []).map((s) => [s.product_id, s]));

  return products.map((p) => {
    const s = shadowByProduct.get(p.id);
    // Use shadow specs fields if available, otherwise fallback/default
    const isVerified = !!s?.is_verified;

    return {
      ...p,
      verified: isVerified,
      verification_status: isVerified ? "verified" : "provisional",
      truth_score: s?.truth_score ?? null,
      is_verified: s?.is_verified ?? null,
      updated_at: s?.updated_at ?? p.created_at,
    } as Asset;
  }).filter(a => a.truth_score !== null && a.truth_score !== undefined);
}

export async function getAssetBySlug(slug: string): Promise<Asset | null> {
  const supabase = getClient();
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !product) {
    if (error) console.warn("getAssetBySlug failed:", error);
    return null;
  }

  // Fetch shadow spec for verification status
  const { data: shadow } = await supabase
    .from('shadow_specs')
    .select('truth_score, is_verified, updated_at')
    .eq('product_id', product.id)
    .maybeSingle();

  const isVerified = !!shadow?.is_verified;

  return {
    ...product,
    verified: isVerified,
    verification_status: isVerified ? 'verified' : 'provisional',
    truth_score: shadow?.truth_score ?? null,
    is_verified: shadow?.is_verified ?? null,
    updated_at: shadow?.updated_at || product.created_at
  } as Asset;
}

export async function runAudit(params: { slug: string; forceRefresh?: boolean }): Promise<any> {
  const response = await fetch('/api/audit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audit failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export async function createProvisionalAsset(payload: any): Promise<{ ok: boolean; error?: string; asset?: Asset }> {
  // V1: Creation disabled
  return { ok: false, error: "Asset creation is disabled in V1." };
}
