import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug, getAudit, mapShadowToResult, getActiveAuditRun, createAuditRun } from "@/lib/dataBridge.server";
import { waitUntil } from "@vercel/functions";
import { runAuditWorker } from "@/lib/auditWorker";

export const runtime = "nodejs";
export const maxDuration = 120; // Extended for multi-stage audit

export async function POST(req: NextRequest) {
    try {
        // 1. Env Check
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { ok: false, error: "SERVER_CONFIG_ERROR" },
                { status: 500 }
            );
        }

        // 2. Parse Input
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ ok: false, error: "BAD_JSON" }, { status: 400 });
        }

        const slug = String(body?.slug || "").trim();
        const forceRefresh = body?.forceRefresh === true;

        if (!slug) {
            return NextResponse.json({ ok: false, error: "MISSING_SLUG" }, { status: 400 });
        }

        // 3. Resolve Product
        const product = await getProductBySlug(slug);
        if (!product) {
            return NextResponse.json({ ok: false, error: "ASSET_NOT_FOUND", slug }, { status: 404 });
        }

        // 4. Check for cached completed audit (cache-first serving)
        const FRESHNESS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
        const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

        const cached = await getAudit(product.id);

        if (cached && cached.claimed_specs && cached.claimed_specs.length > 0) {
            const lastRunAt = new Date(cached.last_run_at || cached.created_at).getTime();
            const now = Date.now();
            const age = now - lastRunAt;
            const isFresh = age < FRESHNESS_WINDOW_MS;

            // Calculate cache metadata
            const cacheMetadata = {
                hit: true,
                last_synced_at: cached.last_run_at || cached.created_at,
                age_days: Math.floor(age / (24 * 60 * 60 * 1000)),
                refresh_available_at: new Date(lastRunAt + COOLDOWN_MS).toISOString(),
                sources_count: cached.source_urls?.length || 0
            };

            // If fresh and not forcing refresh, return cached
            if (isFresh && !forceRefresh) {
                return NextResponse.json({
                    ok: true,
                    cached: true,
                    audit: mapShadowToResult(cached),
                    cache: cacheMetadata
                });
            }

            // If forcing refresh, check cooldown
            if (forceRefresh) {
                const cooldownRemaining = COOLDOWN_MS - age;
                if (cooldownRemaining > 0) {
                    // Still in cooldown, return cached
                    return NextResponse.json({
                        ok: true,
                        cached: true,
                        audit: mapShadowToResult(cached),
                        cache: {
                            ...cacheMetadata,
                            cooldown_remaining_ms: cooldownRemaining
                        }
                    });
                }
                // Cooldown expired, allow refresh to proceed
            }
        }

        // 5. Check for active run
        const activeRun = await getActiveAuditRun(product.id);
        if (activeRun) {
            return NextResponse.json({
                ok: true,
                runId: activeRun.id,
                status: activeRun.status,
                progress: activeRun.progress
            });
        }

        // 6. Create new audit run
        const newRun = await createAuditRun(product.id);
        if (!newRun) {
            return NextResponse.json(
                { ok: false, error: "FAILED_TO_CREATE_RUN" },
                { status: 500 }
            );
        }

        // 7. Trigger background worker
        waitUntil(runAuditWorker(newRun.id, product));

        // 8. Return immediately
        return NextResponse.json({
            ok: true,
            runId: newRun.id,
            status: 'pending',
            progress: 0
        });

    } catch (err: any) {
        console.error("Queue endpoint error:", err);
        return NextResponse.json(
            {
                ok: false,
                error: "QUEUE_EXCEPTION",
                message: err?.message ?? String(err)
            },
            { status: 500 }
        );
    }
}
