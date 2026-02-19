import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAuditWorker } from "@/lib/runAuditWorker";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

function supabaseAdmin() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) {
        throw new Error("Missing Supabase credentials in environment variables");
    }
    return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
    try {
        // AUTH CHECK
        const secret = req.headers.get("x-internal-worker-secret");
        const expectedSecret = process.env.INTERNAL_WORKER_SECRET;

        if (expectedSecret && secret !== expectedSecret) {
            return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
        }

        const { runId } = await req.json();

        if (!runId) {
            return NextResponse.json({ ok: false, error: "MISSING_RUN_ID" }, { status: 400 });
        }

        const sb = supabaseAdmin();
        const result = await runAuditWorker({ runId, sb });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("[WorkerRoute] Error:", error);
        return NextResponse.json({
            ok: false,
            error: "WORKER_FAILED",
            message: error.message
        }, { status: 500 });
    }
}

