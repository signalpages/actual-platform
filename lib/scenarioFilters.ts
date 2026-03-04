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

export interface RVQualifiers {
    truthIndex: number | null;
    capacityWh: number | null;
    continuousW: number | null;
    surgeW: number | null;
    rv30a: "TT-30" | "Adapter" | "—";
    solarInputW: number | null;
    weightLb: number | null;
    runtimeFridgeHours: number | null;
    tier: "Tier 1" | "Tier 2" | "Tier 3";
    badges: string[];
}

export interface RVProduct extends Asset {
    rvQualifiers: RVQualifiers;
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

const RV_KNOWLEDGE_BRIDGE: Record<string, "TT-30" | "Adapter"> = {
    'delta-pro-portable-power-station': 'TT-30',
    'ac200max-portable-power-station': 'TT-30',
    'ac300-b300-portable-power-station': 'TT-30',
    'ep500pro-portable-power-station': 'TT-30',
    'delta-2-max-portable-power-station': 'Adapter',
    'anker-solix-f2000': 'Adapter',
    'anker-solix-f2000-(767)': 'Adapter',
    'jackery-explorer-3000-pro': 'Adapter',
    'titan-solar-generator': 'TT-30',
    'victron-energy-multiplus-ii-48/3000/35-50': 'Adapter',
    'victron-energy-multiplus-24/3000/70-50': 'Adapter'
};

function safeNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return 0;
    const match = val.replace(/,/g, '').match(/-?[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
}

export function filterRVProducts(assets: Asset[]): RVProduct[] {
    const INVERTER_EFFICIENCY = 0.85;

    const candidates = assets.map(asset => {
        const specs = asset.technical_specs || {};

        // 1. Truth Index Logic
        let truthIndex: number | null = null;
        const isKnowledgeModel = !!RV_KNOWLEDGE_BRIDGE[asset.slug];
        const isActuallyVerified = asset.verified || (asset as any).is_verified || (asset as any).verified || asset.is_audited || isKnowledgeModel;

        if (typeof asset.truth_score === 'number') {
            truthIndex = asset.truth_score;
        } else if (isActuallyVerified) {
            truthIndex = 80; // Default for verified seeds
        }

        // 2. Continuous Output (numeric check)
        let continuousW = safeNumber(specs.continuous_ac_output_w || specs.ac_output_w || (specs.continuous_kw ? safeNumber(specs.continuous_kw) * 1000 : 0));

        // Final fallback: search array for 'continuous' if still 0
        if (continuousW === 0 && Array.isArray(specs)) {
            const c = specs.find(s => s.label.toLowerCase().includes('continuous'));
            if (c) continuousW = safeNumber(c.value);
        }

        // 3. Surge Capacity (numeric check)
        let surgeW = safeNumber(specs.peak_surge_output_w || specs.surge_output_w || (specs.peak_kw ? safeNumber(specs.peak_kw) * 1000 : 0));
        if (surgeW === 0 && Array.isArray(specs)) {
            const s = specs.find(s => s.label.toLowerCase().includes('surge') || s.label.toLowerCase().includes('peak'));
            if (s) surgeW = safeNumber(s.value);
        }

        // 4. RV 30A Detection
        let rv30a: "TT-30" | "Adapter" | "—" = "—";

        // A. Knowledge Bridge (priority)
        if (RV_KNOWLEDGE_BRIDGE[asset.slug]) {
            rv30a = RV_KNOWLEDGE_BRIDGE[asset.slug];
        } else {
            // B. Keyword Detection
            let specText = "";
            if (Array.isArray(specs)) {
                specText = specs.map(s => `${s.label} ${s.value}`).join(" ").toLowerCase();
            } else if (typeof specs === 'object') {
                specText = JSON.stringify(specs).toLowerCase();
            }

            const tt30Tokens = ["tt-30", "tt30", "nema tt-30", "rv tt-30"];
            const adapterTokens = ["rv outlet", "30 amp rv", "30a rv", "rv 30", "l14-30", "l5-30", "30a connector", "30a port"];

            const hasTT30 = tt30Tokens.some(t => specText.includes(t));
            const hasAdapterContext = adapterTokens.some(t => specText.includes(t));

            if (hasTT30) {
                rv30a = "TT-30";
            } else if (hasAdapterContext) {
                rv30a = "Adapter";
            }
        }

        // 5. Basic Extractions
        const capacityWh = Number(specs.storage_capacity_wh || specs.capacity_wh || (specs.capacity_kwh ? specs.capacity_kwh * 1000 : 0) || 0);
        const solarInputW = Number(specs.solar_input_max_w || specs.solar_input_w || 0);
        const weightLb = Number(specs.weight_lbs || (specs.weight_kg ? specs.weight_kg * 2.20462 : 0));
        const expandable = !!(specs.is_expandable || specs.expansion_capable || specs.expansion_capacity_wh);
        const chemistry = String(specs.cell_chemistry || specs.battery_chemistry || specs.chemistry || "");

        // Badges
        const badges: string[] = [];
        if (chemistry.toLowerCase().includes("lifepo")) badges.push("LiFePO4");
        if (expandable) badges.push("Expandable");
        if (solarInputW >= 1000) badges.push("High Solar");

        return {
            ...asset,
            rvQualifiers: {
                truthIndex,
                capacityWh,
                continuousW,
                surgeW,
                rv30a,
                solarInputW: solarInputW || null,
                weightLb: weightLb || null,
                runtimeFridgeHours: capacityWh ? Number(((capacityWh * INVERTER_EFFICIENCY) / 120).toFixed(1)) : null,
                tier: "Tier 1", // placeholder
                badges
            }
        } as RVProduct;
    });

    // Gating Logic
    let baseQualifying = candidates.filter(p => {
        const q = p.rvQualifiers;
        const passesTruth = q.truthIndex !== null && q.truthIndex >= 80;
        const passesSurge = q.surgeW !== null && q.surgeW > 0;
        const passes30A = q.rv30a !== "—";
        const passesContinuous = q.continuousW !== null && q.continuousW >= 2000;

        return passesTruth && passesSurge && passes30A && passesContinuous;
    });

    // Auto-raise threshold
    if (baseQualifying.length > 8) {
        baseQualifying = baseQualifying.filter(p => p.rvQualifiers.continuousW! >= 2400);
    }

    // Tier Assignment
    return baseQualifying.map(p => {
        const q = p.rvQualifiers;
        let tier: "Tier 1" | "Tier 2" | "Tier 3" = "Tier 1";

        if (q.capacityWh! >= 5000 || (q.badges.includes("Expandable") && q.capacityWh! >= 3600)) {
            tier = "Tier 3";
        } else if (q.capacityWh! >= 3000 || (q.solarInputW !== null && q.solarInputW >= 1000)) {
            tier = "Tier 2";
        }

        return {
            ...p,
            rvQualifiers: {
                ...q,
                tier
            }
        };
    });
}
