import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug, getAudit, mapShadowToResult, getActiveAuditRun, createAuditRun } from "@/lib/dataBridge.server";
import { waitUntil } from "@vercel/functions";
import { runAuditWorker } from "@/lib/auditWorker";

export const runtime = "nodejs";
export const maxDuration = 60;

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

        // 4. Check for cached completed audit
        if (!forceRefresh) {
            const cached = await getAudit(product.id);
            if (cached) {
                // Only return if it's a successful audit
                const isCachedSuccess = cached.claimed_specs && cached.claimed_specs.length > 0;
                if (isCachedSuccess) {
                    return NextResponse.json({
                        ok: true,
                        audit: mapShadowToResult(cached),
                        cached: true
                    });
                }
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
