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
    // Get existing audit
    const { data: existing } = await supabase
        .from("shadow_specs")
        .select("stages")
        .eq("product_id", productId)
        .maybeSingle();

    // Initialize stages if not exist
    const currentStages = existing?.stages || {
        stage_1: { status: 'pending', completed_at: null, ttl_days: 30, data: null },
        stage_2: { status: 'pending', completed_at: null, ttl_days: 14, data: null },
        stage_3: { status: 'pending', completed_at: null, ttl_days: 30, data: null },
        stage_4: { status: 'pending', completed_at: null, ttl_days: 30, data: null }
    };

    // Merge stage data
    currentStages[stageName] = {
        ...currentStages[stageName],
        ...stageData
    };

    // Update database
    const { error } = await supabase
        .from("shadow_specs")
        .update({
            stages: currentStages,
            updated_at: new Date().toISOString()
        })
        .eq("product_id", productId);

    if (error) {
        console.error("Failed to update stage:", error);
        return false;
    }

    return true;
}
