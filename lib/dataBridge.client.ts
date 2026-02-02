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

export const runAudit = async (payload: string | { slug: string, depth?: number, forceRefresh?: boolean }): Promise<AuditResult & { cache?: any }> => {
    const slug = typeof payload === "string" ? payload : payload.slug;
    const forceRefresh = typeof payload === "object" ? payload.forceRefresh : false;

    if (!slug) throw new Error("Missing slug for audit");

    // 1. Queue the audit
    const resp = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, forceRefresh }),
    });

    const data = await resp.json();

    if (!data.ok) {
        throw new Error(data.error || "Failed to queue audit");
    }

    // 2. If audit returned immediately (cached), return it with metadata
    if (data.audit) {
        return {
            ...data.audit,
            cache: data.cache // Include cache metadata
        };
    }

    // 3. Otherwise poll for completion
    const runId = data.runId;
    if (!runId) {
        throw new Error("No runId returned from queue");
    }

    return await pollAuditStatus(runId);
};

// Promise-based deduplication - return same promise for duplicate requests
const pollPromises = new Map<string, Promise<AuditResult>>();

/**
 * Poll audit status until completion
 * CRITICAL: Deduplicates by runId, returns existing promise if already polling
 */
async function pollAuditStatus(runId: string): Promise<AuditResult> {
    // Check for existing poll promise
    const existing = pollPromises.get(runId);
    if (existing) {
        console.log(`[Polling] Reusing existing poll for runId ${runId}`);
        return existing;
    }

    // Create new poll promise
    const pollPromise = (async (): Promise<AuditResult> => {
        const maxAttempts = 30; // Reduced from 40
        const maxElapsedMs = 90000; // 90 seconds (buffer under Vercel's 60s worker timeout)
        const startTime = Date.now();

        console.log(`[Polling] Started for runId ${runId}`);

        try {
            for (let i = 0; i < maxAttempts; i++) {
                // Check elapsed time
                const elapsed = Date.now() - startTime;
                if (elapsed > maxElapsedMs) {
                    console.warn(`[Polling] Max time exceeded for ${runId} (${elapsed}ms)`);
                    throw new Error('Audit timed out. The analysis took too long to complete. Please try again or contact support if this persists.');
                }

                // Wait before polling (except first attempt)
                if (i > 0) {
                    // Backoff strategy: 2s → 3s → 5s
                    const delay = i < 10 ? 2000 : i < 20 ? 3000 : 5000;
                    await sleep(delay);
                }

                const resp = await fetch(`/api/audit/status?runId=${runId}`);
                const data = await resp.json();

                if (!data.ok) {
                    console.error(`[Polling] Error response for ${runId}:`, data.error);
                    throw new Error(data.error || "Failed to get audit status");
                }

                // CRITICAL: Terminal state check - stop immediately
                if (data.status === 'done') {
                    if (data.audit) {
                        console.log(`[Polling] Completed for ${runId} after ${i + 1} attempts (${Date.now() - startTime}ms)`);
                        return data.audit;
                    } else {
                        console.warn(`[Polling] Status=done but no audit data for ${runId}`);
                        throw new Error('Audit completed but no data returned');
                    }
                }

                if (data.status === 'error') {
                    console.error(`[Polling] Failed for ${runId}:`, data.error);
                    throw new Error(data.error || 'Audit failed');
                }

                // Log progress
                if (i % 5 === 0) {
                    console.log(`[Polling] runId ${runId}: ${data.status} (${data.progress || 0}%)`);
                }

                // Continue polling for pending/running
            }

            // Max attempts exceeded
            console.warn(`[Polling] Max attempts exceeded for ${runId}`);
            throw new Error('Audit timed out after maximum polling attempts. Please try again.');

        } finally {
            // CRITICAL: Always cleanup promise tracking
            pollPromises.delete(runId);
            console.log(`[Polling] Stopped for runId ${runId}`);
        }
    })();

    // Store promise before returning
    pollPromises.set(runId, pollPromise);
    return pollPromise;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
