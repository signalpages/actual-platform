/**
 * Spec Discovery Module
 * Find 3-5 high-quality source URLs with domain enforcement
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ProductForSpecs, DiscoveryResult } from './types.ts';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Domain allowlist
const MANUFACTURER_PATTERNS = []; // Dynamically matched
const RETAILER_DOMAINS = [
    'amazon.com',
    'walmart.com',
    'homedepot.com',
    'bestbuy.com',
    'lowes.com',
    'costco.com',
    'target.com',
];
const REVIEW_DOMAINS = [
    'wirecutter.com',
    'rtings.com',
    'techradar.com',
    'cnet.com',
];

function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return '';
    }
}

function classifySourceType(url: string, brand: string): 'manufacturer' | 'retailer' | 'review' {
    const domain = extractDomain(url);
    const brandSlug = brand.toLowerCase().replace(/\s+/g, '');

    // Check if manufacturer domain (brand name in domain)
    if (domain.includes(brandSlug)) {
        return 'manufacturer';
    }

    // Check retailer list
    if (RETAILER_DOMAINS.some(d => domain.includes(d))) {
        return 'retailer';
    }

    // Check review site list
    if (REVIEW_DOMAINS.some(d => domain.includes(d))) {
        return 'review';
    }

    // Default to retailer for unknown domains
    return 'retailer';
}

function filterUrls(urls: string[], brand: string): DiscoveryResult {
    const filtered: string[] = [];
    const source_types: Record<string, 'manufacturer' | 'retailer' | 'review'> = {};
    const domains: Record<string, string> = {};
    const domainCount: Record<string, number> = {};

    for (const url of urls) {
        // Reject PDFs
        if (url.toLowerCase().endsWith('.pdf')) {
            continue;
        }

        const domain = extractDomain(url);
        if (!domain) continue;

        // Max 2 per domain
        if (domainCount[domain] >= 2) {
            continue;
        }

        // Prefer pages with "spec" or "specifications" in path
        const hasSpecInPath = url.toLowerCase().includes('spec');

        const source_type = classifySourceType(url, brand);

        filtered.push(url);
        source_types[url] = source_type;
        domains[url] = domain;
        domainCount[domain] = (domainCount[domain] || 0) + 1;

        // Stop at 5 URLs
        if (filtered.length >= 5) {
            break;
        }
    }

    // Sort: manufacturer first, then by has-spec-in-path, then original order
    filtered.sort((a, b) => {
        const typeA = source_types[a];
        const typeB = source_types[b];
        const specA = a.toLowerCase().includes('spec') ? 1 : 0;
        const specB = b.toLowerCase().includes('spec') ? 1 : 0;

        if (typeA === 'manufacturer' && typeB !== 'manufacturer') return -1;
        if (typeA !== 'manufacturer' && typeB === 'manufacturer') return 1;

        return specB - specA;
    });

    return {
        urls: filtered.slice(0, 5),
        source_types,
        domains,
    };
}

/**
 * Discover 3-5 authoritative source URLs for product specs
 */
export async function discoverSpecSources(product: ProductForSpecs): Promise<DiscoveryResult> {
    const prompt = `Use Google Search to find 3-5 authoritative web pages with detailed technical specifications for this product:

Brand: ${product.brand}
Model: ${product.model}
Category: ${product.category_slug.replace(/_/g, ' ')}

REQUIREMENTS:
- Use the googleSearch tool to find current URLs
- Prioritize the manufacturer's official product page
- Include major retailers (Amazon, Walmart, Home Depot, Best Buy)
- Include review sites if available (Wirecutter, RTINGS, CNET)
- Pages must contain detailed technical specifications or spec sheets
- Return ONLY URLs, one per line
- Return 5-8 URLs (I will filter to best 5)

Return URLs only, one per line:`;

    const geminiModel = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        tools: [{ googleSearch: {} }],
    });

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text();

        // Parse URLs from response
        const urls = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('http'))
            .map(line => line.replace(/^[-*]\s*/, '')) // Remove bullet points
            .slice(0, 8); // Take max 8 for filtering

        if (urls.length === 0) {
            throw new Error('No URLs found in discovery response');
        }

        // Filter and classify
        const filtered = filterUrls(urls, product.brand);

        if (filtered.urls.length === 0) {
            throw new Error('All discovered URLs were filtered out');
        }

        console.log(`✓ Discovered ${filtered.urls.length} sources for ${product.slug}`);

        return filtered;
    } catch (error) {
        console.error(`✗ Discovery failed for ${product.slug}:`, error);
        throw new Error(`Spec discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
