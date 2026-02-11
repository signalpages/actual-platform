// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stage configurations
const STAGE_ORDER = ["discover", "fetch", "extract", "normalize", "assess"] as const;
const DISCOVER_MS = 20_000;
const FETCH_MS = 12_000;
const EXTRACT_MS = 10_000;
const NORMALIZE_MS = 8_000;
const ASSESS_MS = 20_000;
const MAX_RUN_MS = 150_000;
const HEARTBEAT_INTERVAL_MS = 10_000; // 10s heartbeat

Deno.serve(async (req) => {
    console.error(`[AuditRunner] Received ${req.method} request`);

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const runId = body.runId ?? body.run_id;

        console.error(`[AuditRunner] Parsed runId: ${runId}`);

        if (!runId) {
            throw new Error("Missing runId");
        }

        const sb = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        console.error(`[AuditRunner] Starting worker for ${runId}...`);

        await runAuditWorker(sb, runId);

        console.error(`[AuditRunner] Worker completed for ${runId}`);

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error(`[AuditRunner] Error:`, error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});

async function runAuditWorker(sb: any, runId: string) {
    let heartbeatTimer: any = null;
    try {
        // Start background heartbeat loop
        console.error(`Starting heartbeat loop for ${runId}`);
        heartbeatTimer = setInterval(async () => {
            console.error(`Heartbeat tick for ${runId}`);
            await sb.from("audit_runs").update({
                last_heartbeat: new Date().toISOString()
            }).eq("id", runId);
        }, HEARTBEAT_INTERVAL_MS);

        await withTimeout(runAuditWorkerImpl(sb, runId), MAX_RUN_MS, "run");
    } catch (e: any) {
        console.error(`Audit failed: ${e?.message}`);
        await markFailed(sb, runId, e?.message ?? String(e));
    } finally {
        if (heartbeatTimer !== null) {
            clearInterval(heartbeatTimer);
            console.error(`Stopped heartbeat loop for ${runId}`);
        }
    }
}

async function runAuditWorkerImpl(sb: any, runId: string): Promise<void> {
    // 0. Resolve product ID from run
    const { data: runData, error: runErr } = await sb
        .from("audit_runs")
        .select("product_id")
        .eq("id", runId)
        .single();

    if (runErr || !runData) throw new Error("Audit run not found");
    const productId = runData.product_id;

    // Fetch product data for discovery
    const { data: product } = await sb.from("products").select("*").eq("id", productId).single();
    if (!product) throw new Error("Product not found");

    // Define mock data upfront (used in stage data later)
    const mockSpec = {
        claim_profile: [
            { label: "Storage Capacity", value: "2560Wh", source: "spec" },
            { label: "AC Output", value: "3000W continuous (6000W surge)", source: "spec" },
            { label: "Cell Chemistry", value: "LiFePO4 (LFP)", source: "spec" },
            { label: "Cycle Life Rating", value: "3500+ cycles to 80%", source: "spec" },
            { label: "AC Charging Speed", value: "1800W Fast Charge", source: "spec" },
            { label: "Solar Input (Max)", value: "1200W", source: "spec" },
            { label: "UPS/EPS Protocol", value: "<20ms switchover", source: "spec" },
            { label: "Expansion Capacity", value: "Up to 8kWh with battery packs", source: "spec" },
            { label: "Thermal Operating Range", value: "-10°C to 45°C", source: "spec" },
            { label: "Weight", value: "28.5 kg (62.8 lbs)", source: "spec" }
        ],
        reality_ledger: [
            { label: "Storage Capacity", value: "2480Wh (Verified, 97% of claim)", source: "lab" },
            { label: "Inverter Efficiency", value: "91% @ 1500W load", source: "lab" },
            { label: "AC Output", value: "2900W sustained verified; surge tested to 5800W", source: "lab" },
            { label: "Cycle Life", value: "3200+ cycles confirmed in accelerated testing", source: "lab" }
        ],
        discrepancies: [],
        red_flags: []
    };

    // STAGE 1: Discovery
    // Note: Background heartbeat keeps alive during awaits
    await setStage(sb, runId, "discover", "running", { last_tick: new Date().toISOString() });

    // Simulate discovery
    await new Promise(r => setTimeout(r, 2000));

    await setStage(sb, runId, "discover", "done", { source_count: 3 });

    // STAGE 2: Fetch
    await setStage(sb, runId, "fetch", "running");

    // Simulate work that might stall without background heartbeat
    for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1000));
    }
    await setStage(sb, runId, "fetch", "done", { fetched: 3 });

    // STAGE 3: Extract
    await setStage(sb, runId, "extract", "running");
    await new Promise(r => setTimeout(r, 1000));
    await setStage(sb, runId, "extract", "done");

    // STAGE 4: Normalize
    await setStage(sb, runId, "normalize", "running");
    await new Promise(r => setTimeout(r, 1000));
    await setStage(sb, runId, "normalize", "done");

    // STAGE 5: Assess
    await setStage(sb, runId, "assess", "running");
    await new Promise(r => setTimeout(r, 1000));

    // STAGE 5: Finalize with COMPLETE DATA for all stages
    await setStage(sb, runId, "assess", "running");

    // Complete Stage Data (full, not truncated)
    const completeStages = {
        stage_1: {
            status: "done",
            completed_at: new Date().toISOString(),
            ttl_days: 90,
            data: {
                claim_profile: mockSpec.claim_profile,
                reality_ledger: mockSpec.reality_ledger,
                source_count: 3
            }
        },
        stage_2: {
            status: "done",
            completed_at: new Date().toISOString(),
            ttl_days: 30,
            data: {
                most_praised: [
                    { text: "Exceptional surge handling - ran circular saw without issues", sentiment: "positive" },
                    { text: "Fast charging speed saves time on job sites", sentiment: "positive" },
                    { text: "LFP chemistry provides peace of mind for indoor use", sentiment: "positive" },
                    { text: "Expansion battery works seamlessly", sentiment: "positive" },
                    { text: "UPS mode transition is imperceptible", sentiment: "positive" }
                ],
                most_reported_issues: [
                    { text: "Weight makes it less portable than advertised", sentiment: "negative" },
                    { text: "Fan noise under heavy load is noticeable", sentiment: "negative" },
                    { text: "Solar charging slower than expected in partial shade", sentiment: "neutral" }
                ],
                source_summary: "Analyzed 247 owner reports, 18 technical reviews, 5 teardown videos"
            }
        },
        stage_3: {
            status: "done",
            completed_at: new Date().toISOString(),
            ttl_days: 90,
            data: {
                discrepancies: [],
                red_flags: [
                    {
                        claim: "Weight: 28.5 kg (62.8 lbs)",
                        reality: "Measured 29.1 kg (64.2 lbs)",
                        severity: "minor",
                        impact: "Slightly heavier than spec, but within tolerance"
                    }
                ],
                verified_claims: 8,
                flagged_claims: 1
            }
        },
        stage_4: {
            status: "done",
            completed_at: new Date().toISOString(),
            ttl_days: 90,
            data: {
                truth_index: 95,
                metric_bars: [
                    { label: "Capacity Accuracy", value: 97 },
                    { label: "Output Performance", value: 95 },
                    { label: "Cycle Life", value: 92 },
                    { label: "Charging Speed", value: 94 }
                ],
                score_interpretation: "Excellent - Claims are well-supported by independent testing",
                strengths: [
                    "Verified high-efficiency inverter performance",
                    "LFP chemistry confirmed with proper BMS protection",
                    "Surge capacity exceeds typical use cases",
                    "Fast charging verified under various conditions"
                ],
                limitations: [
                    "Weight exceeds specification by ~2%",
                    "Fan noise under sustained high load",
                    "Solar efficiency drops significantly in shade"
                ],
                practical_impact: [
                    "Ideal for home backup and off-grid applications",
                    "Excellent for power tools and high-draw appliances",
                    "Long-term reliability supported by LFP chemistry"
                ],
                good_fit: [
                    "Home emergency backup",
                    "Off-grid workshops",
                    "RV/Van life with roof solar",
                    "Construction job sites"
                ],
                consider_alternatives: [
                    "Ultra-portable camping (weight consideration)",
                    "Noise-sensitive environments under heavy load"
                ],
                data_confidence: "High - Multiple independent sources confirm key claims"
            }
        }
    };

    // Update run with complete stage data
    await sb.from("audit_runs").update({
        stages: completeStages,
        progress: 100
    }).eq("id", runId);

    await setStage(sb, runId, "assess", "done");

    // Mark run as complete


    // 1. Update Shadow Spec (V1 Persistence) - UPSERT to avoid duplicate key errors
    console.error(`Writing shadow_spec for ${productId}`);
    try {
        const { error: shadowErr } = await sb.from("shadow_specs").upsert({
            product_id: productId,
            canonical_spec_json: mockSpec,
            stages: completeStages,
            is_verified: true,
            truth_score: 95,
            source_urls: ["https://example.com/manual.pdf"],
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'product_id' // UPSERT on product_id conflict
        });
        if (shadowErr) throw shadowErr;
        console.error("Shadow spec written successfully");
    } catch (e: any) {
        console.error(`Shadow write failed: ${e.message}`);
    }

    // 2. Write Assessment - Match actual schema (only audit_run_id + assessment_json)
    console.error(`Writing assessment for run ${runId}`);
    try {
        const { error: assessErr } = await sb.from("audit_assessments").insert({
            audit_run_id: runId,
            assessment_json: {
                verdict: "Verified Performance",
                truth_index: 95,
                bms_analysis: { notes: "BMS prevents deep discharge below 5%" },
                safety_analysis: { notes: "UL certified, thermal monitoring active" },
                c_rate_analysis: { notes: "1C discharge verified" }
            }
        });
        if (assessErr) throw assessErr;
        console.error("Assessment written successfully");
    } catch (e: any) {
        console.error(`Assessment write failed: ${e.message} (details: ${JSON.stringify(e)})`);
    }

    // 3. Write Sources - Remove product_id if column doesn't exist
    console.error(`Writing sources for run ${runId}`);
    try {
        const { error: sourceErr } = await sb.from("audit_sources").insert({
            audit_run_id: runId,
            url: "https://example.com/manual.pdf",
            type: "manual",
            status: "active"
        });
        if (sourceErr) throw sourceErr;
        console.error("Sources written successfully");
    } catch (e: any) {
        console.error(`Source write failed: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 1000));

    // Finalize
    await setStage(sb, runId, "assess", "done");
    await markComplete(sb, runId);
}

// Helpers
async function setStage(sb: any, runId: string, stage: string, status: string, meta: any = {}) {
    const now = new Date().toISOString();

    // Fetch current to merge
    const { data } = await sb.from("audit_runs").select("stage_state, progress").eq("id", runId).single();
    const current = data?.stage_state ?? { stages: {} };

    const merged = {
        current: stage,
        stages: {
            ...(current.stages ?? {}),
            [stage]: {
                ...(current.stages?.[stage] ?? {}),
                status,
                updated_at: now,
                meta: { ...(current.stages?.[stage]?.meta ?? {}), ...meta },
            },
        },
    };

    const STAGE_ORDER = ["discover", "fetch", "extract", "normalize", "assess"];
    const doneCount = STAGE_ORDER.filter((s) => merged.stages[s]?.status === "done").length;
    const progress = Math.round((doneCount / STAGE_ORDER.length) * 100);

    const { error: updateErr } = await sb.from("audit_runs").update({
        status: status === "error" ? "error" : "running",
        progress,
        stage_state: merged,
        last_heartbeat: now
    }).eq("id", runId);

    if (updateErr) console.error(`setStage failed for ${stage}: ${updateErr.message}`);
}

async function markComplete(sb: any, runId: string) {
    console.error(`Marking run ${runId} as DONE`);
    const { error } = await sb.from("audit_runs").update({
        status: "done",
        progress: 100,
        finished_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
    }).eq("id", runId);

    if (error) console.error(`markComplete failed: ${error.message} (${error.details})`);
    else console.error(`Run ${runId} marked DONE successfully`);
}

async function markFailed(sb: any, runId: string, errorMsg: string) {
    console.error(`Marking run ${runId} as FAILED: ${errorMsg}`);
    const { error } = await sb.from("audit_runs").update({
        status: "error",
        error: errorMsg,
        finished_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
    }).eq("id", runId);

    if (error) console.error(`markFailed failed: ${error.message}`);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`TIMEOUT:${label}:${ms}ms`)), ms);
        p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
    });
}
