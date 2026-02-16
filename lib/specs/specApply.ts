/**
 * Spec Apply Module
 * Select best chunk and merge to products.technical_specs
 */

import { createClient } from '@supabase/supabase-js';
import type { CanonicalSpecs, SpecSource, TechnicalSpecs, ApplyResult } from './types.ts';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChunkRow {
    id: string;
    url: string;
    domain: string;
    source_type: 'manufacturer' | 'retailer' | 'review';
    normalized_json: Partial<CanonicalSpecs>;
    coverage_fields: number;
    coverage_pct: number;
    validation_error_count: number;
    extracted_at: string;
}

/**
 * Select the best chunk using deterministic ranking
 */
async function selectBestChunk(product_id: string): Promise<ChunkRow | null> {
    const { data, error } = await supabase
        .from('product_spec_chunks')
        .select('id, url, domain, source_type, normalized_json, coverage_fields, coverage_pct, validation_error_count, extracted_at')
        .eq('product_id', product_id)
        .order('source_type', { ascending: true }) // manufacturer first (alphabetically)
        .order('coverage_fields', { ascending: false })
        .order('validation_error_count', { ascending: true })
        .order('extracted_at', { ascending: false })
        .limit(1);

    if (error) {
        throw new Error(`Failed to select chunk: ${error.message}`);
    }

    if (!data || data.length === 0) {
        return null;
    }

    // Re-rank with explicit manufacturer priority
    const ranked = data.sort((a, b) => {
        if (a.source_type === 'manufacturer' && b.source_type !== 'manufacturer') return -1;
        if (a.source_type !== 'manufacturer' && b.source_type === 'manufacturer') return 1;
        if (a.coverage_fields !== b.coverage_fields) return b.coverage_fields - a.coverage_fields;
        if (a.validation_error_count !== b.validation_error_count) return a.validation_error_count - b.validation_error_count;
        return new Date(b.extracted_at).getTime() - new Date(a.extracted_at).getTime();
    });

    return ranked[0];
}

/**
 * Get all source metadata for spec_sources array
 */
async function getSourceMetadata(product_id: string): Promise<SpecSource[]> {
    const { data, error } = await supabase
        .from('product_sources')
        .select('url, domain, source_type, fetched_at, content_hash')
        .eq('product_id', product_id)
        .eq('status', 'ok');

    if (error) {
        throw new Error(`Failed to get sources: ${error.message}`);
    }

    // Get chunks to know which fields came from which source
    const { data: chunks } = await supabase
        .from('product_spec_chunks')
        .select('url, normalized_json')
        .eq('product_id', product_id);

    const chunksByUrl = new Map(chunks?.map(c => [c.url, c.normalized_json]) || []);

    return (data || []).map(source => {
        const normalized = chunksByUrl.get(source.url) || {};
        const fields_present = Object.keys(normalized).filter(k => normalized[k as keyof typeof normalized] !== null);

        return {
            url: source.url,
            domain: source.domain,
            source_type: source.source_type,
            fetched_at: source.fetched_at,
            content_hash: source.content_hash,
            fields_present,
        };
    });
}

/**
 * Determine spec_status based on coverage
 */
function determineStatus(coverage_fields: number): 'empty' | 'partial' | 'complete' | 'needs_review' {
    if (coverage_fields >= 7) return 'complete';
    if (coverage_fields >= 4) return 'partial';
    if (coverage_fields > 0) return 'partial';
    return 'needs_review';
}

/**
 * Apply best spec chunk to products.technical_specs
 */
export async function applyBestChunk(product_id: string, slug: string): Promise<ApplyResult> {
    // Select best chunk
    const best = await selectBestChunk(product_id);

    if (!best) {
        throw new Error('No chunks available to apply');
    }

    // Get all source metadata
    const spec_sources = await getSourceMetadata(product_id);

    // Build technical_specs
    const technical_specs: TechnicalSpecs = {
        ...best.normalized_json,
        spec_sources,
    };

    const spec_status = determineStatus(best.coverage_fields);

    // Update products table
    const { error: updateError } = await supabase
        .from('products')
        .update({
            technical_specs,
            spec_status,
            spec_last_updated_at: new Date().toISOString(),
        })
        .eq('id', product_id);

    if (updateError) {
        throw new Error(`Failed to update product: ${updateError.message}`);
    }

    // Mark chunk as accepted
    await supabase
        .from('product_spec_chunks')
        .update({ accepted: true })
        .eq('id', best.id);

    console.log(`    ✓ Applied best chunk from ${best.domain} (${best.source_type})`);

    return {
        product_id,
        slug,
        coverage_fields: best.coverage_fields,
        coverage_pct: best.coverage_pct,
        spec_status,
        technical_specs,
    };
}

/**
 * Mark product as needing review due to errors
 */
export async function markNeedsReview(product_id: string, error: Error): Promise<void> {
    await supabase
        .from('products')
        .update({
            spec_status: 'needs_review',
            spec_last_updated_at: new Date().toISOString(),
        })
        .eq('id', product_id);
}
