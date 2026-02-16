/** 
 * Spec Fetch Module
 * Fetch and render HTML with Playwright, store excerpts
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { FetchResult } from './types.ts';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return 'unknown';
    }
}

function stripHtml(html: string): string {
    // Remove scripts, styles, nav, and other non-content elements
    let cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
        .replace(/<!--.*?-->/gs, ''); // Comments

    // Cap at ~50kb
    if (cleaned.length > 50000) {
        cleaned = cleaned.substring(0, 50000);
    }

    return cleaned;
}

function computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * Fetch HTML for a single URL using Playwright
 * Reuse existing browser automation if available
 */
async function fetchWithPlaywright(url: string): Promise<{ html: string; status: number }> {
    // For MVP, use simple fetch
    // TODO: Replace with Playwright rendering for SPA support
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        const html = await response.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : 'No title';
        console.log(`    Fetched ${html.length} chars, title: "${title.substring(0, 50)}..."`);

        return {
            html,
            status: response.status,
        };
    } catch (error) {
        throw new Error(`Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Fetch and store HTML source for spec extraction
 */
export async function fetchSpecSource(
    product_id: string,
    url: string,
    source_type: 'manufacturer' | 'retailer' | 'review'
): Promise<FetchResult> {
    const domain = extractDomain(url);

    try {
        // Check if already fetched
        const { data: existing } = await supabase
            .from('product_sources')
            .select('content_hash, status')
            .eq('product_id', product_id)
            .eq('url', url)
            .single();

        if (existing && existing.status === 'ok') {
            console.log(`  ↻ Skipping ${domain} (already fetched)`);
            return {
                url,
                domain,
                http_status: 200,
                content_hash: existing.content_hash,
                html_excerpt: '', // Not returned for existing
                storage_ref: null,
                status: 'ok',
            };
        }

        // Fetch HTML
        console.log(`  ↓ Fetching ${domain}...`);
        const { html, status: http_status } = await fetchWithPlaywright(url);

        if (http_status !== 200) {
            throw new Error(`HTTP ${http_status}`);
        }

        // Strip and hash
        const html_excerpt = stripHtml(html);
        const content_hash = computeHash(html_excerpt);

        // Store in database
        const { error: upsertError } = await supabase
            .from('product_sources')
            .upsert({
                product_id,
                url,
                domain,
                source_type,
                http_status,
                content_hash,
                html_excerpt,
                storage_ref: null, // V1: Use excerpt, V2: Upload to storage
                status: 'ok',
                error: null,
                fetched_at: new Date().toISOString(),
            }, {
                onConflict: 'product_id,url',
            });

        if (upsertError) {
            throw new Error(`Database error: ${upsertError.message}`);
        }

        console.log(`  ✓ Fetched ${domain}`);

        return {
            url,
            domain,
            http_status,
            content_hash,
            html_excerpt,
            storage_ref: null,
            status: 'ok',
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Store error in database
        await supabase
            .from('product_sources')
            .upsert({
                product_id,
                url,
                domain,
                source_type,
                http_status: 0,
                content_hash: null,
                html_excerpt: null,
                storage_ref: null,
                status: 'error',
                error: errorMessage,
                fetched_at: new Date().toISOString(),
            }, {
                onConflict: 'product_id,url',
            });

        console.error(`  ✗ Failed to fetch ${domain}: ${errorMessage}`);

        return {
            url,
            domain,
            http_status: 0,
            content_hash: '',
            html_excerpt: '',
            storage_ref: null,
            status: 'error',
            error: errorMessage,
        };
    }
}

/**
 * Fetch all discovered sources for a product
 */
export async function fetchAllSources(
    product_id: string,
    urls: string[],
    source_types: Record<string, 'manufacturer' | 'retailer' | 'review'>
): Promise<FetchResult[]> {
    const results: FetchResult[] = [];

    for (const url of urls) {
        const result = await fetchSpecSource(product_id, url, source_types[url]);
        results.push(result);

        // Rate limiting: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results.filter(r => r.status === 'ok');
}
