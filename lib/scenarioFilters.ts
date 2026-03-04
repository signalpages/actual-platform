// lib/scenarioFilters.ts
import { Asset } from "@/types";

export interface RuntimeEstimation {
    fridgeHours: number;
    routerHours: number;
    cpapHours: number;
}

export interface HomeBackupQualifiers {
    meetsCapacity: boolean;
    meetsOutput: boolean;
    meetsTruthIndex: boolean;
    isExpandable: boolean;
    batteryChemistry: string;
    dollarsPerWh: number | null;
    tier: 1 | 2 | 3;
    runtime: RuntimeEstimation;
}

export interface ScenarioProduct extends Asset {
    qualifiers: HomeBackupQualifiers;
}

export function filterHomeBackupProducts(assets: Asset[]): ScenarioProduct[] {
    const INVERTER_EFFICIENCY = 0.85;

    // First, map all assets to their potential backup metadata
    const candidates = assets.map(asset => {
        const specs = asset.technical_specs || {};

        // Extract numeric values safely
        const capacity = Number(specs.storage_capacity_wh || specs.capacity_wh || 0);
        const output = Number(specs.continuous_ac_output_w || specs.ac_output_w || 0);
        const truthScore = asset.truth_score ?? (asset.is_audited ? 100 : 0);

        const meetsTruthIndex = truthScore >= 80;
        const meetsOutput = output >= 2000;

        const isExpandable = !!(specs.is_expandable || specs.expansion_capable || specs.expansion_capacity_wh);
        const batteryChemistry = String(specs.cell_chemistry || specs.battery_chemistry || specs.chemistry || "Unknown");

        // Determine Tier based on capacity
        let tier: 1 | 2 | 3 = 1;
        if (capacity >= 4000 || isExpandable) tier = 3;
        else if (capacity >= 2500) tier = 2;
        else tier = 1;

        // Runtime estimations
        const runtime: RuntimeEstimation = {
            fridgeHours: Number(((capacity * INVERTER_EFFICIENCY) / 150).toFixed(1)),
            routerHours: Number(((capacity * INVERTER_EFFICIENCY) / 15).toFixed(1)),
            cpapHours: Number(((capacity * INVERTER_EFFICIENCY) / 40).toFixed(1))
        };

        let dollarsPerWh = null;
        if (asset.msrp_usd && capacity > 0) {
            dollarsPerWh = asset.msrp_usd / capacity;
        }

        return {
            ...asset,
            qualifiers: {
                meetsCapacity: false, // will set below
                meetsOutput,
                meetsTruthIndex,
                isExpandable,
                batteryChemistry,
                dollarsPerWh,
                tier,
                runtime
            }
        } as ScenarioProduct;
    });

    // Determine dynamic capacity threshold
    // Stricter criteria: Capacity >= 1500Wh
    // If more than ~8 models qualify, raise minimum capacity to 1800Wh.
    const baseQualifying = candidates.filter(p => {
        const cap = Number(p.technical_specs?.storage_capacity_wh || p.technical_specs?.capacity_wh || 0);
        return p.qualifiers.meetsTruthIndex && p.qualifiers.meetsOutput && cap >= 1500;
    });

    const capacityThreshold = baseQualifying.length > 8 ? 1800 : 1500;

    return baseQualifying
        .filter(p => {
            const cap = Number(p.technical_specs?.storage_capacity_wh || p.technical_specs?.capacity_wh || 0);
            return cap >= capacityThreshold;
        })
        .map(p => ({
            ...p,
            qualifiers: {
                ...p.qualifiers,
                meetsCapacity: true
            }
        }));
}
