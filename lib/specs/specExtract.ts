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

const EXTRACTION_SCHEMA: Schema = {
    type: SchemaType.OBJECT as const,
    properties: {
        storage_capacity_wh: { type: SchemaType.STRING, nullable: true },
        continuous_ac_output_w: { type: SchemaType.STRING, nullable: true },
        peak_surge_output_w: { type: SchemaType.STRING, nullable: true },
        cell_chemistry: { type: SchemaType.STRING, nullable: true },
        cycle_life_cycles: { type: SchemaType.STRING, nullable: true },
        ac_charging_speed_w: { type: SchemaType.STRING, nullable: true },
        solar_input_max_w: { type: SchemaType.STRING, nullable: true },
        weight_kg: { type: SchemaType.STRING, nullable: true },
        is_expandable: { type: SchemaType.BOOLEAN, nullable: true },
        max_expansion_wh: { type: SchemaType.STRING, nullable: true },
        expansion_notes: { type: SchemaType.STRING, nullable: true },
        evidence: {
            type: SchemaType.OBJECT as const,
            properties: {
                storage_capacity_wh: { type: SchemaType.STRING },
                continuous_ac_output_w: { type: SchemaType.STRING },
                peak_surge_output_w: { type: SchemaType.STRING },
                cell_chemistry: { type: SchemaType.STRING },
                cycle_life_cycles: { type: SchemaType.STRING },
                ac_charging_speed_w: { type: SchemaType.STRING },
                solar_input_max_w: { type: SchemaType.STRING },
                weight_kg: { type: SchemaType.STRING },
                is_expandable: { type: SchemaType.STRING },
                max_expansion_wh: { type: SchemaType.STRING },
                expansion_notes: { type: SchemaType.STRING },
            },
            required: [],
        },
    },
    required: [],
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

Extract these fields:
- storage_capacity_wh: Battery capacity in Wh (e.g., "3024Wh" or "3.024kWh")
- continuous_ac_output_w: Continuous AC output in watts  
- peak_surge_output_w: Peak/surge output in watts
- cell_chemistry: Battery type (LiFePO4, NMC, Li-ion, etc.)
- cycle_life_cycles: Cycle life rating (e.g., "3500 cycles")
- ac_charging_speed_w: AC charging speed in watts
- solar_input_max_w: Maximum solar input in watts
- weight_kg: Weight in kg or lbs
- is_expandable: Boolean - can capacity be expanded?
- max_expansion_wh: Maximum expansion capacity if expandable
- expansion_notes: How expansion works (brief)

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
 * Extract specs from all fetched sources
 */
export async function extractAllSources(
    product_id: string,
    brand: string,
    model: string
): Promise<ExtractionResult[]> {
    // Fetch all sources for this product
    const { data: sources, error } = await supabase
        .from('product_sources')
        .select('url, domain, source_type, html_excerpt')
        .eq('product_id', product_id)
        .eq('status', 'ok')
        .not('html_excerpt', 'is', null);

    if (error) {
        throw new Error(`Failed to fetch sources: ${error.message}`);
    }

    if (!sources || sources.length === 0) {
        throw new Error('No sources available for extraction');
    }

    const results: ExtractionResult[] = [];

    for (const source of sources) {
        try {
            const result = await extractFromSource(
                product_id,
                source.url,
                source.html_excerpt,
                source.domain,
                source.source_type,
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
