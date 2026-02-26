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
 * Apply best spec chunk to products.technical_specs in-memory instead of DB
 */
export async function applyBestChunk(
    product_id: string,
    slug: string,
    normalizedChunks: (import('./types.ts').NormalizationResult & { source?: import('./types.ts').ExtractionResult })[]
): Promise<ApplyResult> {

    if (!normalizedChunks || normalizedChunks.length === 0) {
        throw new Error('No chunks available to apply');
    }

    // Sort to find the best chunk:
    // 1. manufacturer source (if available)
    // 2. max coverage fields
    // 3. lowest validation error count
    const ranked = [...normalizedChunks].sort((a, b) => {
        const sourceA = a.source?.source_type || 'retailer';
        const sourceB = b.source?.source_type || 'retailer';

        if (sourceA === 'manufacturer' && sourceB !== 'manufacturer') return -1;
        if (sourceA !== 'manufacturer' && sourceB === 'manufacturer') return 1;
        if (a.coverage_fields !== b.coverage_fields) return b.coverage_fields - a.coverage_fields;

        return a.validation_error_count - b.validation_error_count;
    });

    const best = ranked[0];

    // Build the spec_sources array from all available chunks
    const spec_sources: SpecSource[] = normalizedChunks.map(chunk => {
        const sourceUrl = chunk.source?.url || '';
        const sourceDomain = chunk.source?.domain || '';
        const sourceType = chunk.source?.source_type || 'retailer';

        // fields present
        const normalized = chunk.normalized_json || {};
        const fields_present = Object.keys(normalized).filter(k => normalized[k as keyof typeof normalized] !== null);

        return {
            url: sourceUrl,
            domain: sourceDomain,
            source_type: sourceType,
            fetched_at: new Date().toISOString(),
            content_hash: 'in_memory_hash',
            fields_present,
        };
    }).filter(s => s.url); // filter out empty ones just in case

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

    const domain = best.source?.domain || 'unknown';
    const sourceType = best.source?.source_type || 'retailer';
    console.log(`    ✓ Applied best chunk from ${domain} (${sourceType})`);

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
