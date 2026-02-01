import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Product, AuditResult, Category, Asset } from "../types";

// --- Client-Side Helpers (Browser/UI) ---

// Lazy-init singleton for client to avoid top-level side effects during server build
let _publicClient: SupabaseClient | null = null;

function getPublicClient() {
    if (_publicClient) return _publicClient;

    // STRICT ENV ACCESS: Use NEXT_PUBLIC_ for client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.warn("Missing Supabase Client Env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Inventory will be empty.");
        // We throw to fail fast if config is wrong, as per previous requirement
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }

    _publicClient = createClient(url, key);
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

export const searchAssets = async (query: string, category: string = "all", brand: string = "all"): Promise<Asset[]> => {
    try {
        const client = getPublicClient();
        let builder = client.from('products').select('*');

        if (category !== "all") {
            builder = builder.eq('category', category);
        }

        if (brand !== "all") {
            builder = builder.eq('brand', brand);
        }

        if (query && query.trim().length > 0) {
            builder = builder.ilike('model_name', `%${query}%`);
        }

        const { data } = await builder.limit(200);

        if (!data) return [];

        return data.map(d => ({
            ...d,
            verified: d.is_audited,
            verification_status: d.is_audited ? 'verified' : 'provisional'
        })) as Asset[];
    } catch (e) {
        console.warn("Supabase search failed:", e);
        return [];
    }
};

export const createProvisionalAsset = async (payload: any): Promise<{ ok: boolean; error?: string; asset?: Asset }> => {
    return { ok: false, error: "Asset creation is disabled in V1." };
};

export const getAssetBySlug = async (slug: string): Promise<Asset | null> => {
    try {
        const client = getPublicClient();
        const { data } = await client
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
    } catch (e) {
        console.warn("Supabase fetch failed:", e);
        return null;
    }
};

export const getAllAssets = async (): Promise<Asset[]> => {
    try {
        const client = getPublicClient();
        const { data } = await client
            .from('products')
            .select('*')
            .limit(200);

        if (!data) return [];

        return data.map(d => ({
            ...d,
            verified: d.is_audited,
            verification_status: d.is_audited ? 'verified' : 'provisional'
        })) as Asset[];
    } catch (e) {
        console.warn("Supabase fetch failed:", e);
        return [];
    }
};

export const runAudit = async (payload: string | { slug: string, depth?: number, forceRefresh?: boolean }): Promise<AuditResult> => {
    const slug = typeof payload === "string" ? payload : payload.slug;
    const forceRefresh = typeof payload === "object" ? payload.forceRefresh : false;

    if (!slug) throw new Error("Missing slug for audit");

    const resp = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, forceRefresh }),
    });

    const data = await resp.json();
    if (!data.ok || !data.audit) {
        throw new Error(data.error || "Audit failed");
    }
    return data.audit;
};
