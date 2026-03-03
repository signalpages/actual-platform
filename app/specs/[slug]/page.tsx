import React from 'react';
import { getProductBySlug, getAudit, mapShadowToResult } from "@/lib/dataBridge.server";
import ProductDetailView from '@/components/ProductDetailView';
import { normalizeAuditResult } from "@/lib/auditNormalizer";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const slug = typeof resolvedParams.slug === 'string' ? resolvedParams.slug : Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : '';

    if (!slug) return {};

    const product = await getProductBySlug(slug);
    if (!product) return {};

    const productName = `${product.brand || ''} ${product.model_name || ''}`.trim() || 'Product';

    return {
        title: `${productName} Review & Performance Audit`,
        description: `Independent analysis of the ${productName} including real-world performance, specifications verification, and comparison insights.`,
        alternates: {
            canonical: `/specs/${slug}`,
        }
    };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    // In Next.js 15+, params is strictly async.
    const resolvedParams = await params;

    // Safety check for array slug (catch-all) vs string
    const slug = typeof resolvedParams.slug === 'string' ? resolvedParams.slug : Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : '';

    if (!slug) {
        return <ProductDetailView initialAsset={null} slug="" />;
    }

    try {
        const product = await getProductBySlug(slug);

        if (!product) {
            return <ProductDetailView initialAsset={null} slug={slug} />;
        }

        // Try to fetch initial audit if available (Server Side) to speed up load
        const auditShadow = await getAudit(product.id);
        const rawAudit = auditShadow ? mapShadowToResult(auditShadow) : null;
        const initialAudit = normalizeAuditResult(rawAudit, product);

        // Map Product (DB) to Asset (UI)
        const asset = {
            ...product,
            // products table has is_audited. Mapping to UI model:
            verified: (product as any).is_audited || (product as any).is_verified || false,
            verification_status: ((product as any).is_audited || (product as any).is_verified) ? 'verified' : 'provisional'
        };

        const productName = `${product.brand || ''} ${product.model_name || ''}`.trim();
        const baseUrl = 'https://actual.fyi';
        const pageUrl = `${baseUrl}/specs/${slug}`;

        // Map category slug to human-readable label
        const categoryLabel = product.category ? (product.category.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')) : 'Energy Product';

        const jsonLd: any = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            '@id': `${pageUrl}#product`,
            name: productName,
            brand: {
                '@type': 'Brand',
                name: product.brand || 'Unknown',
            },
            description: `Independent analysis and verified performance audit of the ${productName}.`,
            sku: slug, // Internal identifier
            category: categoryLabel,
            image: product.image_url ? [product.image_url] : [],
        };

        // Add Review data if truth index is available (Editorial Review approach)
        if (initialAudit && initialAudit.truth_index !== null) {
            const rawTruthIndex = initialAudit.truth_index;
            // Map 0-100 Truth Index to 1-5 scale for search result stars optimization
            const displayRating = (rawTruthIndex / 25) + 1;
            const normalizedRating = Number(Math.max(1, Math.min(5, displayRating)).toFixed(1));

            jsonLd.review = {
                '@type': 'Review',
                '@id': `${pageUrl}#review`,
                author: {
                    '@type': 'Organization',
                    name: 'Actual.fyi',
                },
                publisher: {
                    '@type': 'Organization',
                    name: 'Actual.fyi',
                },
                reviewRating: {
                    '@type': 'Rating',
                    ratingValue: normalizedRating,
                    bestRating: 5,
                    worstRating: 1,
                },
                itemReviewed: {
                    '@id': `${pageUrl}#product`,
                },
                datePublished: product.created_at ? new Date(product.created_at).toISOString() : new Date().toISOString(),
                reviewBody: `Technical audit results for ${productName}. Independent analysis yielded a Truth Index of ${rawTruthIndex}%. ${initialAudit.score_interpretation || ''}`,
            };
        }

        return (
            <React.Suspense fallback={<ProductDetailView initialAsset={null} slug={slug} />}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
                <ProductDetailView
                    initialAsset={asset as any} // Cast to any or strict Asset if type aligns
                    initialAudit={initialAudit}
                    slug={slug}
                />
            </React.Suspense>
        );

    } catch (e) {
        console.error("Server-side load error:", e);
        // Fallback to client-side load if server fails (rare)
        return <ProductDetailView initialAsset={null} slug={slug} />;
    }
}
