import React from 'react';
import { getProductBySlug, getAudit, mapShadowToResult } from "@/lib/dataBridge.server";
import ProductDetailView from '@/components/ProductDetailView';
import { normalizeAuditResult } from "@/lib/auditNormalizer";
import { Product } from "@/types";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params;
    const slug = typeof resolvedParams.slug === 'string' ? resolvedParams.slug : Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : '';

    if (!slug) return {};

    const product = await getProductBySlug(slug);
    if (!product) return {};

    const audit = await getAudit(product.id);
    const rawTruthIndex = audit && typeof audit.truth_score === 'number' ? audit.truth_score : null;
    const productName = `${product.brand || ''} ${product.model_name || ''}`.trim() || 'Product';

    // High-tension CTR meta description
    let description = `Independent review and forensic audit of the ${productName} including real-world performance validation and Truth Index scoring.`;
    if (rawTruthIndex !== null) {
        description = `${rawTruthIndex}% Truth Index. Independent forensic audit of the ${productName}. Verified discrepancies, real-world performance validation, and evidence-backed findings.`;
    }

    return {
        title: `${productName} Review – Forensic Audit & Truth Index`,
        description,
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
        const asset = await getProductBySlug(slug);
        if (!asset) {
            return <ProductDetailView initialAsset={null} slug={slug} />;
        }
        const product = asset as Product;

        // Fetch audit using product.id, not slug
        const auditShadow = await getAudit(product.id);
        const rawAudit = auditShadow ? mapShadowToResult(auditShadow) : null;
        const initialAudit = normalizeAuditResult(rawAudit, product);

        // Map Product (DB) to Asset (UI)
        const uiAsset = {
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
            '@graph': [
                {
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
                }
            ]
        };

        // Add Review data if truth index is available (Editorial Review approach)
        if (initialAudit && initialAudit.truth_index !== null) {
            const rawTruthIndex = initialAudit.truth_index;
            // Map 0-100 Truth Index to 1-5 scale for search result stars optimization
            const displayRating = (rawTruthIndex / 25) + 1;
            const normalizedRating = Number(Math.max(1, Math.min(5, displayRating)).toFixed(1));

            const review = {
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

            // Add FAQPage for SERP real estate
            const faq = {
                '@type': 'FAQPage',
                'mainEntity': [
                    {
                        '@type': 'Question',
                        'name': `Is the ${productName} worth it?`,
                        'acceptedAnswer': {
                            '@type': 'Answer',
                            'text': `The ${productName} receives a ${rawTruthIndex}% Truth Index based on structured cross-source validation and forensic performance analysis. ${initialAudit.score_interpretation || ''}`
                        }
                    },
                    {
                        '@type': 'Question',
                        'name': `How was the ${productName} tested?`,
                        'acceptedAnswer': {
                            '@type': 'Answer',
                            'text': `Actual.fyi uses a structured four-stage audit process: Manufacturer Profile, Technical Deep Scan, Ledger Cross-Validation, and Delta Analysis to verify all performance claims.`
                        }
                    }
                ]
            };

            jsonLd['@graph'][0].review = review;
            jsonLd['@graph'].push(faq);
        }

        return (
            <React.Suspense fallback={<ProductDetailView initialAsset={null} slug={slug} />}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
                <ProductDetailView
                    initialAsset={uiAsset as any} // Cast to any or strict Asset if type aligns
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
