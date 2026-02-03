// lib/dataBridge.client.ts
"use client";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export type InventoryAsset = {
  id: string;
  slug: string;
  brand: string | null;
  model_name: string;
  category: string;
  affiliate_link?: string | null;
  verification_status: "verified" | "provisional";
  truth_score?: number | null;
  is_verified?: boolean | null;
  updated_at?: string | null;
};

export async function listCategories(): Promise<string[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .not("category", "is", null);

  if (error) throw error;

  const uniq = Array.from(new Set((data ?? []).map((r) => r.category).filter(Boolean)));
  uniq.sort();
  return uniq;
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

export async function searchAssets(params: {
  q: string;
  category: string; // "all" or actual category
  manufacturer: string; // "all" or actual brand
}): Promise<InventoryAsset[]> {
  const supabase = getClient();

  let query = supabase
    .from("products")
    .select("id,slug,brand,model_name,category,affiliate_link")
    .order("created_at", { ascending: false });

  if (params.q?.trim()) query = query.ilike("model_name", `%${params.q.trim()}%`);
  if (params.category !== "all") query = query.eq("category", params.category);
  if (params.manufacturer !== "all") query = query.eq("brand", params.manufacturer);

  const { data: products, error: pErr } = await query;
  if (pErr) throw pErr;

  if (!products?.length) return [];

  const ids = products.map((p) => p.id);
  const { data: shadows, error: sErr } = await supabase
    .from("shadow_specs")
    .select("product_id, truth_score, is_verified, updated_at")
    .in("product_id", ids);

  if (sErr) throw sErr;

  const shadowByProduct = new Map((shadows ?? []).map((s) => [s.product_id, s]));

  return products.map((p) => {
    const s = shadowByProduct.get(p.id);
    const isVerified = !!s?.is_verified;

    return {
      ...p,
      verification_status: isVerified ? "verified" : "provisional",
      truth_score: s?.truth_score ?? null,
      is_verified: s?.is_verified ?? null,
      updated_at: s?.updated_at ?? null,
    };
  });
}
