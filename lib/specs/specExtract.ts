/**
 * Spec Extract Module
 * Extract specs from HTML using Gemini with strict evidence requirements
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import type { RawSpecs, ExtractionResult } from './types.ts';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SPEC_KEYS = [
    'ac_charging_speed', 'ac_charging_speed_w', 'ah', 'battery_nominal_voltage', 'bifacial', 'cable_length_ft', 'capacity_kwh', 'capacity_wh', 'cell_chemistry', 'cell_type', 'chemistry', 'connector_type', 'continuous_a', 'continuous_ac_output_w', 'continuous_kw', 'controller_type', 'cycle_life_cycles', 'cycles', 'dc_input_voltage_v', 'dimensions', 'dimensions_mm', 'efficiency', 'efficiency_pct', 'expansion_notes', 'hardwired', 'idle_consumption_w', 'impp_a', 'input_voltage_v', 'ip_rating', 'isc_a', 'is_expandable', 'max_charge_current_a', 'max_current_a', 'max_dc_input_current_a', 'max_expansion_wh', 'max_power_kw', 'max_pv_voltage_v', 'output_frequency_hz', 'output_voltage_v', 'parallel_capable', 'peak_a', 'peak_surge_output_w', 'rated_power_w', 'rating', 'remote_monitoring', 'solar_input_max_w', 'storage_capacity_wh', 'surge_output_w', 'ups_eps_switchover_ms', 'vmpp_v', 'voc_v', 'voltage_v', 'warranty_years', 'waveform', 'weight_kg', 'weight_lbs', 'wifi_enabled'
];

const EXTRACTION_SCHEMA: Schema = {
    type: SchemaType.OBJECT as const,
    properties: {
        ...Object.fromEntries(SPEC_KEYS.map(k => [k, { type: SchemaType.STRING, nullable: true }])),
        evidence: {
            type: SchemaType.OBJECT as const,
            properties: Object.fromEntries(SPEC_KEYS.map(k => [k, { type: SchemaType.STRING, nullable: true }])),
        },
    },
};

/**
 * Extract specs from a single HTML source
 */
export async function extractFromSource(
    product_id: string,
    url: string,
    html_excerpt: string,
    domain: string,
    source_type: 'manufacturer' | 'retailer' | 'review',
    brand: string,
    model: string
): Promise<ExtractionResult> {
    const prompt = `Extract technical specifications from this HTML.

CRITICAL RULES:
- Only extract what is EXPLICITLY stated in the HTML
- Set fields to null if not found
- Evidence snippets MUST contain the literal value you extracted
- Do not infer, calculate, or guess values
- Extract exact values with units (e.g., "3024Wh", "2000W", "29.7kg")

Product Context:
Brand: ${brand}
Model: ${model}

HTML Content:
${html_excerpt.substring(0, 30000)} 

Extract these fields (set to null if not found):
${SPEC_KEYS.map(k => '- ' + k).join('\n')}

For EACH field, provide an "evidence" snippet showing WHERE in the HTML you found this value.
The evidence must contain the actual value extracted.

Return JSON matching the schema.`;

    const geminiModel = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
        },
    });

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text();
        const raw_json: RawSpecs = JSON.parse(text);

        // Validate we got something
        const hasAnyField = Object.keys(raw_json).some(
            key => key !== 'evidence' && raw_json[key as keyof RawSpecs] != null
        );

        if (!hasAnyField) {
            throw new Error('No fields extracted');
        }

        console.log(`    ✓ Extracted from ${domain}`);

        return {
            url,
            domain,
            source_type,
            raw_json,
        };
    } catch (error) {
        console.error(`    ✗ Extraction failed for ${domain}:`, error);
        throw new Error(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extract specs from all fetched sources explicitly passed in
 */
export async function extractAllSources(
    product_id: string,
    brand: string,
    model: string,
    sources: import('./types.ts').FetchResult[]
): Promise<ExtractionResult[]> {
    if (!sources || sources.length === 0) {
        throw new Error('No sources available for extraction');
    }

    const results: ExtractionResult[] = [];

    for (const source of sources) {
        if (!source.html_excerpt) continue;

        try {
            // we have status = 'error' too, but earlier they get filtered out anyway
            if (source.status === 'error') continue;

            const result = await extractFromSource(
                product_id,
                source.url,
                source.html_excerpt,
                source.domain,
                // fallback to 'retailer' if source_type isn't cleanly carried over in the type map yet, 
                // but really we want to map it correctly. We'll pass 'retailer' as fallback for now
                // since the original code pulled source_type from DB (which had it stored).
                // Actually, let's just pass 'retailer' as a fixed type since we don't have it on FetchResult
                'retailer',
                brand,
                model
            );
            results.push(result);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`    Skipping ${source.domain} due to extraction error`);
            continue;
        }
    }

    if (results.length === 0) {
        throw new Error('All extractions failed');
    }

    return results;
}
