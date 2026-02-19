/**
 * Stage update helper - separated file for clean imports
 */

import { StageData } from '@/types';

interface UpdateStageParams {
    productId: string;
    stageName: 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4';
    stageData: Partial<StageData>;
    supabase: any;
}

export async function updateStageHelper({
    productId,
    stageName,
    stageData,
    supabase
}: UpdateStageParams): Promise<boolean> {

    // READ: Get current stages snapshot by product_id (canonical)
    // Use deterministic ordering to find the best row (avoid maybeSingle on duplicates)
    const { data: rows, error: readError } = await supabase
        .from("shadow_specs")
        .select("stages")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1);

    const existing = rows?.[0];

    // If stages column isn't in DB yet, don't crash the audit
    if (readError) {
        if (readError.code === "PGRST204" && String(readError.message || "").includes("stages")) {
            console.warn(`[StageStore] 'stages' column not found in shadow_specs - skipping stage update. Run migration: migrations/add_stages_column.sql`);
            console.warn("[StageStore] Audit will continue, but progressive loading will not work until column is added.");
            return true;
        }
        console.error("[StageStore] Failed to read stages:", readError);
        return false;
    }

    // MERGE: Preserve existing stages, only update the target stage
    const currentStages = existing?.stages || {};

    // Initialize missing stages with pending state (don't overwrite existing!)
    if (!currentStages.stage_1) {
        currentStages.stage_1 = { status: "pending", completed_at: null, ttl_days: 90, data: null };
    }
    if (!currentStages.stage_2) {
        currentStages.stage_2 = { status: "pending", completed_at: null, ttl_days: 30, data: null };
    }
    if (!currentStages.stage_3) {
        currentStages.stage_3 = { status: "pending", completed_at: null, ttl_days: 90, data: null };
    }
    if (!currentStages.stage_4) {
        currentStages.stage_4 = { status: "pending", completed_at: null, ttl_days: 90, data: null };
    }

    // Merge new stage data into existing stage (using shallow merge like worker)
    const currentStageState = currentStages[stageName] || {};
    currentStages[stageName] = {
        ...currentStageState,
        ...stageData,
        completed_at: (stageData.status === 'done' || stageData.status === 'partial')
            ? new Date().toISOString()
            : (stageData.completed_at || currentStageState.completed_at || null)
    };

    // WRITE: Atomic Upsert by product_id (canonical)
    // We use upsert to ensure we don't fail if the row was deleted/recreated or if we need to enforce uniqueness
    const { error: writeError } = await supabase
        .from("shadow_specs")
        .upsert({
            product_id: productId,
            stages: currentStages,
            updated_at: new Date().toISOString(),
            // We must provide at least one other field if we are inserting? 
            // Actually, if we upsert, we might need other required fields like claimed_specs if it's a new row.
            // But updateStageHelper is typically called on existing rows.
            // If it behaves as an INSERT, we might violate not-null constraints on other columns if they exist.
            // However, typical usage in audit is: row created at start, then updated.
            // If duplicates exist, we want to update the one we found (or the canonical one).
            // Since we use onConflict: product_id, we will update the existing row found/enforced by unique index.
        }, {
            onConflict: 'product_id'
        });

    if (writeError) {
        // Handle missing stages column gracefully (PGRST204)
        if (writeError.code === "PGRST204" && String(writeError.message || "").includes("stages")) {
            console.warn(`[StageStore] 'stages' column not found in shadow_specs - skipping stage update. Run migration: migrations/add_stages_column.sql`);
            console.warn("[StageStore] Audit will continue, but progressive loading will not work until column is added.");
            return true;
        }

        // If someone added updated_at to the payload elsewhere, catch it too
        if (writeError.code === "PGRST204" && String(writeError.message || "").includes("updated_at")) {
            console.warn(`[StageStore] 'updated_at' column not found in shadow_specs - remove it from updates or add migration.`);
            return true;
        }

        console.error("[StageStore] Failed to update stage:", writeError);
        return false;
    }

    console.log(`[StageStore] ✅ Updated ${stageName} for product ${productId}`);
    return true;
}
