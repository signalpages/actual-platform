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

    // READ: stages snapshot (handle missing column gracefully)
    const { data: existing, error: readError } = await supabase
        .from("shadow_specs")
        .select("stages")
        .eq("product_id", productId)
        .maybeSingle();

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

    // Initialize stages if not exist
    const currentStages = existing?.stages || {
        stage_1: { status: "pending", completed_at: null, ttl_days: 30, data: null },
        stage_2: { status: "pending", completed_at: null, ttl_days: 14, data: null },
        stage_3: { status: "pending", completed_at: null, ttl_days: 30, data: null },
        stage_4: { status: "pending", completed_at: null, ttl_days: 30, data: null }
    };

    // Merge stage data
    currentStages[stageName] = {
        ...currentStages[stageName],
        ...stageData
    };

    // WRITE: only write stages (do NOT write updated_at unless the column exists)
    const { error: writeError } = await supabase
        .from("shadow_specs")
        .update({ stages: currentStages })
        .eq("product_id", productId);

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

        console.error("Failed to update stage:", writeError);
        return false;
    }

    return true;
}

}
