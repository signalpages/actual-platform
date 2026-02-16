/**
 * Spec Normalize Module
 * Parse units, validate ranges, and verify evidence anti-hallucination
 */

import { createClient } from '@supabase/supabase-js';
import type { RawSpecs, CanonicalSpecs, NormalizationResult, ExtractionResult } from './types.ts';
import { VALIDATION_RANGES, VALID_CHEMISTRIES, TOTAL_SPEC_FIELDS } from './types.ts';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Parse watt-hour values with unit conversion
 */
function parseWh(value: string | null): number | null {
    if (!value) return null;

    const cleaned = value.replace(/,/g, '').trim();

    // Match patterns like "3024Wh", "3024 Wh", "3.024kWh", "3.024 kWh"
    const whMatch = cleaned.match(/(\d+\.?\d*)\s*wh/i);
    if (whMatch) {
        return parseInt(whMatch[1]);
    }

    const kwhMatch = cleaned.match(/(\d+\.?\d*)\s*kwh/i);
    if (kwhMatch) {
        return Math.round(parseFloat(kwhMatch[1]) * 1000);
    }

    // Fallback: try to parse as number
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Parse watt values
 */
function parseW(value: string | null): number | null {
    if (!value) return null;

    const cleaned = value.replace(/,/g, '').trim();

    const match = cleaned.match(/(\d+\.?\d*)\s*w/i);
    if (match) {
        return parseInt(match[1]);
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Parse weight with unit conversion
 */
function parseWeight(value: string | null): number | null {
    if (!value) return null;

    const cleaned = value.replace(/,/g, '').trim();

    // kg
    const kgMatch = cleaned.match(/(\d+\.?\d*)\s*kg/i);
    if (kgMatch) {
        return parseFloat(kgMatch[1]);
    }

    // lbs to kg
    const lbsMatch = cleaned.match(/(\d+\.?\d*)\s*(lbs?|pounds?)/i);
    if (lbsMatch) {
        return parseFloat(lbsMatch[1]) * 0.453592;
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Parse cycle life
 */
function parseCycles(value: string | null): number | null {
    if (!value) return null;

    const cleaned = value.replace(/,/g, '').trim();
    const match = cleaned.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

/**
 * Map chemistry to canonical values
 */
function mapChemistry(value: string | null): typeof VALID_CHEMISTRIES[number] | null {
    if (!value) return null;

    const cleaned = value.trim();

    for (const valid of VALID_CHEMISTRIES) {
        if (cleaned.toLowerCase().includes(valid.toLowerCase())) {
            return valid;
        }
    }

    return 'Unknown';
}

/**
 * Verify evidence contains the normalized value (anti-hallucination)
 */
function verifyEvidence(normalized: number | string | null, evidence: string, fieldName: string): boolean {
    if (normalized === null) return true; // No value, no evidence needed

    const evidenceLower = evidence.toLowerCase();
    const normalizedStr = String(normalized);

    // Check if evidence contains the numeric value
    if (typeof normalized === 'number') {
        // For numbers, check if evidence contains the digits
        const digitsOnly = normalizedStr.replace(/\./g, '');
        if (evidenceLower.includes(digitsOnly)) {
            return true;
        }

        // Also check formatted version (e.g., "3,024")
        const formatted = normalized.toLocaleString();
        if (evidenceLower.includes(formatted.toLowerCase())) {
            return true;
        }
    } else {
        // For strings, check exact match
        if (evidenceLower.includes(normalizedStr.toLowerCase())) {
            return true;
        }
    }

    return false;
}

/**
 * Normalize and validate a single extraction result
 */
export async function normalizeExtraction(
    product_id: string,
    extraction: ExtractionResult
): Promise<NormalizationResult> {
    const { raw_json, url, domain, source_type } = extraction;
    const validation_errors: string[] = [];
    const normalized: Partial<CanonicalSpecs> = {};

    // Storage capacity
    const storage = parseWh(raw_json.storage_capacity_wh);
    if (storage !== null) {
        const evidence = raw_json.evidence?.storage_capacity_wh || '';
        if (!verifyEvidence(storage, evidence, 'storage_capacity_wh')) {
            validation_errors.push('storage_capacity_wh: evidence mismatch');
        } else if (storage < VALIDATION_RANGES.storage_capacity_wh.min || storage > VALIDATION_RANGES.storage_capacity_wh.max) {
            validation_errors.push(`storage_capacity_wh: ${storage} out of range`);
        } else {
            normalized.storage_capacity_wh = storage;
        }
    }

    // Continuous AC output
    const continuous = parseW(raw_json.continuous_ac_output_w);
    if (continuous !== null) {
        const evidence = raw_json.evidence?.continuous_ac_output_w || '';
        if (!verifyEvidence(continuous, evidence, 'continuous_ac_output_w')) {
            validation_errors.push('continuous_ac_output_w: evidence mismatch');
        } else if (continuous < VALIDATION_RANGES.continuous_ac_output_w.min || continuous > VALIDATION_RANGES.continuous_ac_output_w.max) {
            validation_errors.push(`continuous_ac_output_w: ${continuous} out of range`);
        } else {
            normalized.continuous_ac_output_w = continuous;
        }
    }

    // Peak surge output
    const peak = parseW(raw_json.peak_surge_output_w);
    if (peak !== null) {
        const evidence = raw_json.evidence?.peak_surge_output_w || '';
        if (!verifyEvidence(peak, evidence, 'peak_surge_output_w')) {
            validation_errors.push('peak_surge_output_w: evidence mismatch');
        } else if (peak < VALIDATION_RANGES.peak_surge_output_w.min || peak > VALIDATION_RANGES.peak_surge_output_w.max) {
            validation_errors.push(`peak_surge_output_w: ${peak} out of range`);
        } else {
            normalized.peak_surge_output_w = peak;
        }
    }

    // Cell chemistry
    const chemistry = mapChemistry(raw_json.cell_chemistry);
    if (chemistry) {
        normalized.cell_chemistry = chemistry;
    }

    // Cycle life
    const cycles = parseCycles(raw_json.cycle_life_cycles);
    if (cycles !== null) {
        const evidence = raw_json.evidence?.cycle_life_cycles || '';
        if (!verifyEvidence(cycles, evidence, 'cycle_life_cycles')) {
            validation_errors.push('cycle_life_cycles: evidence mismatch');
        } else if (cycles < VALIDATION_RANGES.cycle_life_cycles.min || cycles > VALIDATION_RANGES.cycle_life_cycles.max) {
            validation_errors.push(`cycle_life_cycles: ${cycles} out of range`);
        } else {
            normalized.cycle_life_cycles = cycles;
        }
    }

    // AC charging speed
    const acCharge = parseW(raw_json.ac_charging_speed_w);
    if (acCharge !== null) {
        const evidence = raw_json.evidence?.ac_charging_speed_w || '';
        if (!verifyEvidence(acCharge, evidence, 'ac_charging_speed_w')) {
            validation_errors.push('ac_charging_speed_w: evidence mismatch');
        } else if (acCharge < VALIDATION_RANGES.ac_charging_speed_w.min || acCharge > VALIDATION_RANGES.ac_charging_speed_w.max) {
            validation_errors.push(`ac_charging_speed_w: ${acCharge} out of range`);
        } else {
            normalized.ac_charging_speed_w = acCharge;
        }
    }

    // Solar input max
    const solar = parseW(raw_json.solar_input_max_w);
    if (solar !== null) {
        const evidence = raw_json.evidence?.solar_input_max_w || '';
        if (!verifyEvidence(solar, evidence, 'solar_input_max_w')) {
            validation_errors.push('solar_input_max_w: evidence mismatch');
        } else if (solar < VALIDATION_RANGES.solar_input_max_w.min || solar > VALIDATION_RANGES.solar_input_max_w.max) {
            validation_errors.push(`solar_input_max_w: ${solar} out of range`);
        } else {
            normalized.solar_input_max_w = solar;
        }
    }

    // Weight
    const weight = parseWeight(raw_json.weight_kg);
    if (weight !== null) {
        const evidence = raw_json.evidence?.weight_kg || '';
        if (!verifyEvidence(weight, evidence, 'weight_kg')) {
            validation_errors.push('weight_kg: evidence mismatch');
        } else if (weight < VALIDATION_RANGES.weight_kg.min || weight > VALIDATION_RANGES.weight_kg.max) {
            validation_errors.push(`weight_kg: ${weight} out of range`);
        } else {
            normalized.weight_kg = Math.round(weight * 10) / 10; // Round to 1 decimal
        }
    }

    // Expansion fields
    normalized.is_expandable = raw_json.is_expandable ?? null;
    if (raw_json.max_expansion_wh) {
        const maxExp = parseWh(raw_json.max_expansion_wh);
        if (maxExp !== null && maxExp >= VALIDATION_RANGES.max_expansion_wh.min && maxExp <= VALIDATION_RANGES.max_expansion_wh.max) {
            normalized.max_expansion_wh = maxExp;
        }
    }
    normalized.expansion_notes = raw_json.expansion_notes || null;

    // Compute coverage
    const coverage_fields = Object.values(normalized).filter(v => v !== null).length;
    const coverage_pct = Math.round((coverage_fields / TOTAL_SPEC_FIELDS) * 100);

    // Store in database
    const { data, error } = await supabase
        .from('product_spec_chunks')
        .insert({
            product_id,
            url,
            domain,
            source_type,
            raw_json,
            normalized_json: normalized,
            coverage_fields,
            coverage_pct,
            validation_error_count: validation_errors.length,
            validation_errors,
            extracted_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (error) {
        throw new Error(`Failed to store normalized chunk: ${error.message}`);
    }

    console.log(`      ✓ Normalized ${domain}: ${coverage_fields}/9 fields, ${validation_errors.length} errors`);

    return {
        chunk_id: data.id,
        normalized_json: normalized,
        coverage_fields,
        coverage_pct,
        validation_error_count: validation_errors.length,
        validation_errors,
    };
}

/**
 * Normalize all extraction results
 */
export async function normalizeAllExtractions(
    product_id: string,
    extractions: ExtractionResult[]
): Promise<NormalizationResult[]> {
    const results: NormalizationResult[] = [];

    for (const extraction of extractions) {
        try {
            const result = await normalizeExtraction(product_id, extraction);
            results.push(result);
        } catch (error) {
            console.error(`      ✗ Normalization failed for ${extraction.domain}:`, error);
            continue;
        }
    }

    return results;
}
