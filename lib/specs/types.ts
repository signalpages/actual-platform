/**
 * Types for Specs Harvest Pipeline
 * Evidence-backed spec extraction with anti-hallucination validation
 */

// Canonical spec fields (9 total)
export interface CanonicalSpecs {
    storage_capacity_wh: number | null;
    continuous_ac_output_w: number | null;
    peak_surge_output_w: number | null;
    cell_chemistry: 'LiFePO4' | 'NMC' | 'Li-ion' | 'Unknown' | null;
    cycle_life_cycles: number | null;
    ac_charging_speed_w: number | null;
    solar_input_max_w: number | null;
    weight_kg: number | null;
    is_expandable: boolean | null;
    max_expansion_wh: number | null;
    expansion_notes: string | null;
}

// Raw extraction output from LLM (before normalization)
export interface RawSpecs {
    storage_capacity_wh: string | null;
    continuous_ac_output_w: string | null;
    peak_surge_output_w: string | null;
    cell_chemistry: string | null;
    cycle_life_cycles: string | null;
    ac_charging_speed_w: string | null;
    solar_input_max_w: string | null;
    weight_kg: string | null;
    is_expandable: boolean | null;
    max_expansion_wh: string | null;
    expansion_notes: string | null;
    evidence: {
        storage_capacity_wh: string;
        continuous_ac_output_w: string;
        peak_surge_output_w: string;
        cell_chemistry: string;
        cycle_life_cycles: string;
        ac_charging_speed_w: string;
        solar_input_max_w: string;
        weight_kg: string;
        is_expandable: string;
        max_expansion_wh: string;
        expansion_notes: string;
    };
}

// Source metadata
export interface SpecSource {
    url: string;
    domain: string;
    source_type: 'manufacturer' | 'retailer' | 'review';
    fetched_at: string;
    content_hash: string;
    fields_present: string[];
}

// Complete technical specs with sources
export interface TechnicalSpecs extends Partial<CanonicalSpecs> {
    spec_sources: SpecSource[];
}

// Product query result
export interface ProductForSpecs {
    id: string;
    slug: string;
    brand: string;
    model: string;
    category_slug: string;
}

// Discovery result
export interface DiscoveryResult {
    urls: string[];
    source_types: Record<string, 'manufacturer' | 'retailer' | 'review'>;
    domains: Record<string, string>;
}

// Fetch result
export interface FetchResult {
    url: string;
    domain: string;
    http_status: number;
    content_hash: string;
    html_excerpt: string;
    storage_ref: string | null;
    status: 'ok' | 'error';
    error?: string;
}

// Extraction result
export interface ExtractionResult {
    url: string;
    domain: string;
    source_type: 'manufacturer' | 'retailer' | 'review';
    raw_json: RawSpecs;
}

// Normalization result
export interface NormalizationResult {
    chunk_id: string;
    normalized_json: Partial<CanonicalSpecs>;
    coverage_fields: number;
    coverage_pct: number;
    validation_error_count: number;
    validation_errors: string[];
}

// Apply result
export interface ApplyResult {
    product_id: string;
    slug: string;
    coverage_fields: number;
    coverage_pct: number;
    spec_status: 'empty' | 'partial' | 'complete' | 'needs_review';
    technical_specs: TechnicalSpecs;
}

// Validation ranges
export const VALIDATION_RANGES = {
    storage_capacity_wh: { min: 50, max: 200000 },
    continuous_ac_output_w: { min: 50, max: 30000 },
    peak_surge_output_w: { min: 50, max: 60000 },
    weight_kg: { min: 0.5, max: 300 },
    cycle_life_cycles: { min: 500, max: 10000 },
    ac_charging_speed_w: { min: 50, max: 5000 },
    solar_input_max_w: { min: 50, max: 3000 },
    max_expansion_wh: { min: 500, max: 500000 },
} as const;

// Valid chemistry values
export const VALID_CHEMISTRIES = ['LiFePO4', 'NMC', 'Li-ion', 'Unknown'] as const;

// Domain allowlist with priorities
export const DOMAIN_ALLOWLIST = {
    // Manufacturer domains (priority 1) - will be dynamically detected
    manufacturer: {
        priority: 1,
        patterns: [], // Empty - dynamically matched from brand website
    },
    // Major retailers (priority 2)
    retailers: {
        priority: 2,
        domains: [
            'amazon.com',
            'walmart.com',
            'homedepot.com',
            'bestbuy.com',
            'lowes.com',
            'costco.com',
            'target.com',
        ],
    },
    // Review sites (priority 3)
    reviews: {
        priority: 3,
        domains: [
            'wirecutter.com',
            'rtings.com',
            'techradar.com',
            'cnet.com',
        ],
    },
} as const;

// Total number of spec fields for coverage calculation
export const TOTAL_SPEC_FIELDS = 9;
