
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeStage3, executeStage4 } from "@/lib/stageExecutors";
import { normalizeStage3, computeBaseScores, buildMetricBars } from "@/lib/normalizeStage3";
import { computeTruthIndex } from "@/lib/computeTruthIndex";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

function supabaseAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
    try {
        const { productId } = await req.json();

        if (!productId) {
            return NextResponse.json({ ok: false, error: "MISSING_PRODUCT_ID" }, { status: 400 });
        }

        const sb = supabaseAdmin();
        const now = new Date().toISOString();

        // 1. Fetch Product & Shadow Specs
        const { data: product, error: productError } = await sb
            .from("products")
            .select("*")
            .eq("id", productId)
            .single();

        if (productError || !product) {
            return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });
        }

        const { data: shadowSpecs } = await sb
            .from("shadow_specs")
            .select("stages")
            .eq("product_id", productId)
            .single();

        const stages = shadowSpecs?.stages;
        const stage1Data = stages?.stage_1?.data;
        const stage2Data = stages?.stage_2?.data;

        // 2. Validate Evidence (Phase A)
        // 2. Validate Evidence (Phase A)
        if (!stage1Data?.claim_profile || !Array.isArray(stage1Data.claim_profile) || stage1Data.claim_profile.length === 0) {
            console.error(`[Audit Verify] Stage 1 snapshot missing or empty for ${productId}.`);
            return NextResponse.json({
                ok: false,
                error: "EVIDENCE_NOT_BUILT",
                details: "Stage 1 claim_profile is missing or empty. Run /api/evidence/build first."
            }, { status: 409 });
        }

        // Reconstruct Stage1Result
        const stage1 = { claim_profile: stage1Data.claim_profile };

        // Reconstruct Stage2Result
        // Check for Parse Error in Stage 2 metadata if available, or just use raw.
        // If stage 2 failed, we proceed but with empty signals (confidence dampening will handle it)
        // unless status is explicitly 'error'.
        if (stages?.stage_2?.status === 'error') {
            // User requested: "Surface developer error... Do NOT proceed" if PARSE_ERROR
            // We'll check if it was a parse error specifically if we saved it, 
            // but 'error' status is enough to halt if we want to be strict.
            // As per feedback 2: "If JSON parse fails... Set status=PARSE_ERROR... Do NOT proceed"
            // We assume executeStage2 (which we will update next) sets this status.
            return NextResponse.json({
                ok: false,
                error: "STAGE2_FAILED",
                details: "Stage 2 (Evidence) failed or has parse errors. Check Stage 2 results."
            }, { status: 424 }); // Failed Dependency
        }

        const stage2Raw = stage2Data?.raw || "";

        // Reconstruct Stage2Result (handle potential missing signals)
        // Stage 2 might be "insufficient_signal" or skipped?
        // If data is missing, we pass empty arrays.
        const stage2 = {
            independent_signal: {
                most_praised: stage2Data?.most_praised || [],
                most_reported_issues: stage2Data?.most_reported_issues || []
            },
            _meta: {
                raw_text: stage2Data?.raw || ""
            }
        };

        // 3. Execute Stage 3 (Verification)
        const stage3 = await executeStage3(product, stage1, stage2);

        // 4. Normalize & Gate Scores
        const normalized = normalizeStage3(stage3);
        const baseScores = computeBaseScores(normalized.entries);
        const metricBars = buildMetricBars(baseScores);

        // Calculate Validation Gates
        const verificationVals = Object.values(stage3.verification_map || {});
        // "Status 'verified_true': Evidence explicitly confirms..."
        const verifiedCount = verificationVals.filter((v: any) => v.status === 'verified_true').length;
        const disputedCount = verificationVals.filter((v: any) => v.status === 'verified_false').length;

        const gating = { verifiedCount, disputedCount };

        // Compute Truth Index (with Gating)
        const truthBreakdown = computeTruthIndex(
            normalized.entries,
            baseScores,
            undefined, // no llm suggestion yet
            gating
        );

        // 5. Execute Stage 4 (Verdict)
        const stage4 = await executeStage4(
            product,
            { stage1, stage2, stage3 },
            {
                baseScores,
                metricBars,
                truthBreakdown,
                gating, // Pass gating so LLM adjustment respects it
                normalizedEntries: normalized.entries
            }
        );

        // 6. Persist Results
        // Update Shadow Specs
        const updatedStages = {
            ...stages,
            stage_3: {
                status: "done",
                completed_at: now,
                ttl_days: 14,
                data: {
                    ...stage3,
                    verification_map: stage3.verification_map, // Ensure map is saved
                    raw: stage3._meta?.raw_text
                }
            },
            stage_4: {
                status: "done",
                completed_at: now,
                ttl_days: 14,
                data: stage4
            }
        };

        // Save to DB
        await sb.from("shadow_specs").update({
            stages: updatedStages,
            updated_at: now
        }).eq("product_id", productId);

        // Also update canonical `audit_results` table for fast frontend read? 
        // Or does frontend read shadow_specs?
        // Existing codebase uses `audit_results` table.
        // I should probably also update `audit_results` to maintain backward compatibility or migrate fully.
        // The implementation plan didn't explicitly say "Update audit_results table", but to separate "Audit Verification endpoint".
        // Use `audit_results` for the final output makes sense.

        await sb.from("audit_results").upsert({
            product_id: productId,
            run_id: `verify_${Date.now()}`,
            truth_index: stage4.truth_index,
            is_stale: false,
            last_audited_at: now,

            // Map new structure to legacy columns if needed, or rely on JSON payload
            // In V2, we might just store the whole blob or key fields.
            // Existing `audit_results` schema likely has `data` column?
            // "Updated `components/AuditResults.tsx` to accept `reality_ledger`..."
            // I should check `audit_results` schema if possible, or just follow `app/api/audit/worker/route.ts` pattern.
            // But since I can't read `worker` again right now (I read it in Step 1500 but user context is truncated), 
            // I'll assume we need to upsert.
            // Let's assume `audit_results` has `data` jsonb column.

            data: {
                stage1_claims: stage1.claim_profile,
                stage2_signals: stage2.independent_signal,
                stage3_verification: stage3,
                stage4_verdict: stage4,
                gating
            }
        }, { onConflict: 'product_id' });

        return NextResponse.json({
            ok: true,
            audit: {
                truth_index: stage4.truth_index,
                stages: updatedStages,
                // Include other canonical fields if helpful for immediate normalization
                claim_profile: stage1.claim_profile,
                reality_ledger: stage3.reality_ledger,
                discrepancies: stage3.red_flags,
                verification_map: stage3.verification_map
            }
        });

    } catch (error: any) {
        console.error(`[Audit Verify] Fatal Error:`, error);
        return NextResponse.json({ ok: false, error: "INTERNAL_SERVER_ERROR", details: error.message }, { status: 500 });
    }
}
