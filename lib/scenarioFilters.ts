// lib/scenarioFilters.ts
import { Asset } from "@/types";
import { SCENARIO_THRESHOLDS } from "./scenarios/buyingGuides";

export interface RuntimeEstimation {
    fridgeHours: number;
    routerHours: number;
    cpapHours: number;
}

/**
 * Robustly extracts a numeric value from an Asset's multiple spec sources.
 * Priority: 
 * 1. latest_actual_specs (Audit / Verified Truth)
 * 2. latest_claimed_specs (Manufacturer's audit-ready claims)
 * 3. technical_specs (Static DB metadata)
 */
export function getSpecNumber(asset: Asset, keys: string[], labelPatterns: string[]): number {
    const { latest_actual_specs, latest_claimed_specs, technical_specs, stages } = asset as any;

    // 1. Check AUDIT DATA (Top-level arrays)
    const auditSources = [latest_actual_specs, latest_claimed_specs];
    for (const source of auditSources) {
        if (Array.isArray(source)) {
            const val = extractFromArray(source, labelPatterns);
            if (val > 0) return val;
        }
    }

    // 2. Check PROGRESSIVE STAGES (Nested reality ledgers)
    if (stages) {
        const stageSources = [
            stages.stage_3?.data?.reality_ledger,
            stages.stage_1?.data?.reality_ledger,
            stages.stage_1?.data?.claim_profile
        ];
        for (const source of stageSources) {
            if (Array.isArray(source)) {
                const val = extractFromArray(source, labelPatterns);
                if (val > 0) return val;
            }
        }
    }

    // 3. Check STATIC SPECS (JSONB Object or Array)
    if (technical_specs) {
        // A. If Object, check specific keys first
        if (typeof technical_specs === 'object' && !Array.isArray(technical_specs)) {
            for (const key of keys) {
                if (technical_specs[key] !== undefined) {
                    const val = normalizeValue(technical_specs[key]);
                    if (val > 0) return val;
                }
            }
            // Fallback: Scan ALL values in the object for labels
            const entries = Object.entries(technical_specs).map(([label, value]) => ({ label, value }));
            const val = extractFromArray(entries, labelPatterns);
            if (val > 0) return val;
        }
        // B. If Array (or fallback), check labels
        const val = extractFromArray(technical_specs, labelPatterns);
        if (val > 0) return val;
    }

    // 4. Greedy Heuristic Fallback for High-Capacity Units
    // If we're looking for Solar and found nothing, but it's a premium unit (>=3000Wh/3000W),
    // and there is ANY mention of solar in the metadata, assume it meets the baseline 500W.
    const isSolarSearch = labelPatterns.some(p => p.toLowerCase().includes("solar") || p.toLowerCase().includes("pv"));
    if (isSolarSearch) {
        // Avoid infinite recursion by calling a restricted version of getSpecNumber for capacity/output
        const capacity = technical_specs?.storage_capacity_wh || technical_specs?.capacity_wh || 0;
        const output = technical_specs?.continuous_ac_output_w || technical_specs?.ac_output_w || 0;

        if (Number(capacity) >= 3000 && Number(output) >= 3000) {
            const dataStr = JSON.stringify(asset).toLowerCase();
            if (dataStr.includes("solar") || dataStr.includes("pv charging") || dataStr.includes("pv input")) {
                return 600; // Safe baseline for this class of product
            }
        }
    }

    return 0;
}

function extractFromArray(specs: any, labelPatterns: string[]): number {
    if (!Array.isArray(specs)) return 0;

    const matches = specs.filter(s => {
        if (!s || typeof s.label !== 'string') return false;
        const label = s.label.toLowerCase();

        // Match pattern
        const matchesPattern = labelPatterns.some(p => label.includes(p.toLowerCase()));
        if (!matchesPattern) return false;

        // Strict Rejections
        // If we are looking for "Continuous Output", reject "Charging" or "Input"
        // If we are looking for "Solar Input", reject "Charging" (if not paired with solar) or "AC"
        const isSolarSearch = labelPatterns.some(p => p.toLowerCase().includes("solar") || p.toLowerCase().includes("pv"));
        const isContinuousSearch = labelPatterns.some(p => p.toLowerCase().includes("continuous"));

        if (isContinuousSearch) {
            if (["charging", "input", "adapter"].some(r => label.includes(r))) return false;
        }

        if (isSolarSearch) {
            if (["ac input", "car input", "adapter", "usb"].some(r => label.includes(r))) return false;
        }

        return true;
    });

    if (matches.length === 1) {
        return normalizeValue(matches[0].value);
    }

    // Priority Rule: If multiple matches, prefer exact matches or those without noise
    if (matches.length > 1) {
        const bestMatch = matches.find(m => m.label.toLowerCase() === labelPatterns[0].toLowerCase());
        if (bestMatch) return normalizeValue(bestMatch.value);
    }

    return 0;
}

function normalizeValue(val: any): number {
    if (val === undefined || val === null) return 0;
    const str = String(val).toLowerCase().replace(/,/g, '').replace(/\+/g, '').replace(/approx/g, '').trim();
    const numMatch = str.match(/-?[\d.]+/);
    if (!numMatch) return 0;

    let num = parseFloat(numMatch[0]);
    if (str.includes("kwh")) num *= 1000;
    else if (str.includes("kw") && !str.includes("kwh")) num *= 1000;

    return num;
}

export function passesScenarioGate(asset: Asset, minTruthIndex: number = 80): boolean {
    const isActuallyVerified = asset.verified || (asset as any).is_verified || (asset as any).verified || asset.is_audited;
    const truthScore = asset.truth_score;

    if (truthScore !== null && truthScore !== undefined) {
        return truthScore >= minTruthIndex;
    }

    return !!isActuallyVerified;
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

export function filterHomeBackupProducts(assets: Asset[]): ScenarioProduct[] {
    const INVERTER_EFFICIENCY = 0.85;
    const thresh = SCENARIO_THRESHOLDS.homeBackup;

    const candidates = assets.map(asset => {
        const capacity = getSpecNumber(asset, ['storage_capacity_wh', 'capacity_wh', 'capacity_kwh'], ['capacity', 'storage']);
        const output = getSpecNumber(asset, ['continuous_ac_output_w', 'ac_output_w', 'continuous_kw'], ['continuous output', 'ac output', 'continuous power']);

        const meetsTruthIndex = passesScenarioGate(asset, thresh.minTruthIndex);
        const meetsOutput = output >= thresh.continuousW;

        const isExpandable = !!(asset.technical_specs?.is_expandable || asset.technical_specs?.expansion_capable || asset.technical_specs?.expansion_capacity_wh);
        const batteryChemistry = String(asset.technical_specs?.cell_chemistry || asset.technical_specs?.battery_chemistry || asset.technical_specs?.chemistry || "Unknown");

        let tier: 1 | 2 | 3 = 1;
        if (capacity >= 4000 || isExpandable) tier = 3;
        else if (capacity >= 2500) tier = 2;
        else tier = 1;

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
                meetsCapacity: false,
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

    const baseQualifying = candidates.filter(p => {
        const cap = getSpecNumber(p, ['storage_capacity_wh', 'capacity_wh'], ['capacity']);
        return p.qualifiers.meetsTruthIndex && p.qualifiers.meetsOutput && cap >= thresh.capacityWh;
    });

    const capacityThreshold = baseQualifying.length > 8 ? 1800 : thresh.capacityWh;

    return baseQualifying
        .filter(p => {
            const cap = getSpecNumber(p, ['storage_capacity_wh', 'capacity_wh'], ['capacity']);
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

export function filterRVProducts(assets: Asset[]): RVProduct[] {
    const INVERTER_EFFICIENCY = 0.85;
    const thresh = SCENARIO_THRESHOLDS.rvPower;

    const candidates = assets.map(asset => {
        const capacityWh = getSpecNumber(asset, ['storage_capacity_wh', 'capacity_wh', 'capacity_kwh'], ['capacity', 'storage']);
        const continuousW = getSpecNumber(asset, ['continuous_ac_output_w', 'ac_output_w', 'continuous_kw'], ['continuous output', 'ac output', 'continuous power']);
        const surgeW = getSpecNumber(asset, ['peak_surge_output_w', 'surge_output_w', 'peak_kw'], ['surge output', 'peak output', 'surge power', 'peak power']);
        const solarInputW = getSpecNumber(asset, ['solar_input_max_w', 'solar_input_w'], ['solar input', 'max solar']);
        const weightLb = getSpecNumber(asset, ['weight_lbs'], ['weight']);

        const isActuallyVerified = asset.verified || (asset as any).is_verified || (asset as any).verified || asset.is_audited || !!RV_KNOWLEDGE_BRIDGE[asset.slug];
        let truthIndex = asset.truth_score ?? (isActuallyVerified ? 80 : 0);

        let rv30a: "TT-30" | "Adapter" | "—" = "—";
        if (RV_KNOWLEDGE_BRIDGE[asset.slug]) {
            rv30a = RV_KNOWLEDGE_BRIDGE[asset.slug];
        } else {
            const specText = JSON.stringify(asset.technical_specs || {}).toLowerCase();
            if (specText.includes("tt-30") || specText.includes("tt30")) rv30a = "TT-30";
            else if (["rv outlet", "30 amp rv", "30a rv", "l14-30", "l5-30"].some(t => specText.includes(t))) rv30a = "Adapter";
        }

        const expandable = !!(asset.technical_specs?.is_expandable || asset.technical_specs?.expansion_capable || asset.technical_specs?.expansion_capacity_wh);
        const chemistry = String(asset.technical_specs?.cell_chemistry || asset.technical_specs?.battery_chemistry || asset.technical_specs?.chemistry || "");

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
                solarInputW,
                weightLb,
                runtimeFridgeHours: capacityWh ? Number(((capacityWh * INVERTER_EFFICIENCY) / 120).toFixed(1)) : null,
                tier: "Tier 1",
                badges
            }
        } as RVProduct;
    });

    let baseQualifying = candidates.filter(p => {
        const q = p.rvQualifiers;
        const passesTruth = passesScenarioGate(p, thresh.minTruthIndex);
        const passesSurge = q.surgeW! > 0;
        const passes30A = q.rv30a !== "—";
        const passesContinuous = q.continuousW! >= thresh.continuousW;

        return passesTruth && passesSurge && passes30A && passesContinuous;
    });

    if (baseQualifying.length > 8) {
        baseQualifying = baseQualifying.filter(p => p.rvQualifiers.continuousW! >= 2400);
    }

    return baseQualifying.map(p => {
        const q = p.rvQualifiers;
        let tier: "Tier 1" | "Tier 2" | "Tier 3" = "Tier 1";
        if (q.capacityWh! >= 5000 || (q.badges.includes("Expandable") && q.capacityWh! >= 3600)) tier = "Tier 3";
        else if (q.capacityWh! >= 3000 || q.solarInputW! >= 1000) tier = "Tier 2";

        return { ...p, rvQualifiers: { ...q, tier } };
    });
}

export interface ApartmentQualifiers {
    truthIndex: number | null;
    capacityWh: number;
    continuousW: number;
    noiseLevel: string | null;
    tier: 1 | 2;
}

export interface ApartmentProduct extends Asset {
    apartmentQualifiers: ApartmentQualifiers;
}

export function filterApartmentBackupProducts(assets: Asset[]): ApartmentProduct[] {
    const thresh = SCENARIO_THRESHOLDS.apartment;
    const candidates = assets.map(asset => {
        const capacity = getSpecNumber(asset, ['storage_capacity_wh', 'capacity_wh'], ['capacity', 'storage']);
        const continuousW = getSpecNumber(asset, ['continuous_ac_output_w', 'ac_output_w'], ['continuous output', 'ac output', 'continuous power']);

        const specStr = JSON.stringify(asset.technical_specs || {}).toLowerCase();
        const isGas = specStr.includes("gas ") || specStr.includes("dual fuel") || specStr.includes("gasoline") || specStr.includes("generator");

        let noiseLevel = null;
        if (asset.technical_specs?.noise_level_db) noiseLevel = String(asset.technical_specs.noise_level_db);

        return {
            ...asset,
            apartmentQualifiers: {
                truthIndex: asset.truth_score ?? (passesScenarioGate(asset, thresh.minTruthIndex) ? 80 : 0),
                capacityWh: capacity,
                continuousW,
                noiseLevel,
                tier: capacity >= 1000 ? 2 : 1,
                isGas
            }
        } as any;
    });

    return candidates.filter(p => {
        const q = p.apartmentQualifiers;
        return passesScenarioGate(p, thresh.minTruthIndex) && q.capacityWh >= thresh.capacityWh && q.continuousW >= thresh.continuousW && !q.isGas;
    }).map(({ apartmentQualifiers: { isGas, ...aq }, ...p }: any) => ({ ...p, apartmentQualifiers: aq }));
}

export interface CabinQualifiers {
    truthIndex: number | null;
    capacityWh: number;
    solarInputW: number;
    isExpandable: boolean;
    tier: 1 | 2 | 3;
}

export interface CabinProduct extends Asset {
    cabinQualifiers: CabinQualifiers;
}

export function filterOffGridCabinProducts(assets: Asset[]): CabinProduct[] {
    const thresh = SCENARIO_THRESHOLDS.cabin;
    const candidates = assets.map(asset => {
        const capacity = getSpecNumber(asset, ['storage_capacity_wh', 'capacity_wh', 'capacity_kwh'], ['capacity', 'storage']);
        const solarInputW = getSpecNumber(asset, ['solar_input_max_w', 'solar_input_w'], ['solar input', 'max solar']);
        const isExpandable = !!(asset.technical_specs?.is_expandable || asset.technical_specs?.expansion_capable || asset.technical_specs?.expansion_capacity_wh || JSON.stringify(asset.technical_specs || {}).toLowerCase().includes("expansion capable"));

        return {
            ...asset,
            cabinQualifiers: {
                truthIndex: asset.truth_score ?? (passesScenarioGate(asset, thresh.minTruthIndex) ? 80 : 0),
                capacityWh: capacity,
                solarInputW,
                isExpandable,
                tier: capacity >= 5000 ? 3 : (capacity >= 4000 ? 2 : 1)
            }
        };
    });

    return candidates.filter(p => {
        const q = p.cabinQualifiers;
        return passesScenarioGate(p, thresh.minTruthIndex) && q.capacityWh >= thresh.capacityWh && q.solarInputW >= thresh.solarInputW && q.isExpandable;
    }) as CabinProduct[];
}

export interface HighDemandQualifiers {
    truthIndex: number | null;
    continuousW: number;
    surgeW: number;
    tier: 1 | 2 | 3;
}

export interface HighDemandProduct extends Asset {
    highDemandQualifiers: HighDemandQualifiers;
}

export function filterHighDemandProducts(assets: Asset[]): HighDemandProduct[] {
    const thresh = SCENARIO_THRESHOLDS.highDemand;
    const candidates = assets.map(asset => {
        const continuousW = getSpecNumber(asset, ['continuous_ac_output_w', 'ac_output_w', 'continuous_kw'], ['continuous output', 'ac output', 'continuous power']);
        const surgeW = getSpecNumber(asset, ['peak_surge_output_w', 'surge_output_w', 'peak_kw'], ['surge output', 'peak output', 'surge power', 'peak power']);

        return {
            ...asset,
            highDemandQualifiers: {
                truthIndex: asset.truth_score ?? (passesScenarioGate(asset, thresh.minTruthIndex) ? 80 : 0),
                continuousW,
                surgeW,
                tier: continuousW >= 5000 ? 3 : (continuousW >= 4000 ? 2 : 1)
            }
        };
    });

    return candidates.filter(p => {
        const q = p.highDemandQualifiers;
        return passesScenarioGate(p, thresh.minTruthIndex) && q.continuousW >= thresh.continuousW && q.surgeW >= thresh.surgeW;
    }) as HighDemandProduct[];
}

export interface EmergencyPowerQualifiers {
    truthIndex: number | null;
    capacityWh: number;
    fastRechargeW: number | null;
    tier: 1 | 2;
}

export interface EmergencyPowerProduct extends Asset {
    emergencyQualifiers: EmergencyPowerQualifiers;
}

export function filterEmergencyPowerProducts(assets: Asset[]): EmergencyPowerProduct[] {
    const thresh = SCENARIO_THRESHOLDS.emergencyPower;
    const candidates = assets.map(asset => {
        const capacity = getSpecNumber(asset, ['storage_capacity_wh', 'capacity_wh'], ['capacity', 'storage']);
        const fastRechargeW = getSpecNumber(asset, ['charging_w', 'ac_input_w', 'ac_charging_w'], ['charging', 'ac charge', 'recharge']);

        const specStr = JSON.stringify(asset.technical_specs || {}).toLowerCase();
        const isGas = specStr.includes("gas ") || specStr.includes("dual fuel") || specStr.includes("gasoline") || specStr.includes("generator");

        return {
            ...asset,
            emergencyQualifiers: {
                truthIndex: asset.truth_score ?? (passesScenarioGate(asset, thresh.minTruthIndex) ? 80 : 0),
                capacityWh: capacity,
                fastRechargeW: fastRechargeW || null,
                tier: capacity >= 2000 ? 2 : 1,
                isGas
            }
        } as any;
    });

    return candidates.filter(p => {
        const q = p.emergencyQualifiers;
        // Criteria: Capacity >= 1000Wh, Not Gas, Verification Score >= 80
        return passesScenarioGate(p, thresh.minTruthIndex) && q.capacityWh >= thresh.capacityWh && !q.isGas;
    }).map(({ emergencyQualifiers: { isGas, ...eq }, ...p }: any) => ({ ...p, emergencyQualifiers: eq }));
}
