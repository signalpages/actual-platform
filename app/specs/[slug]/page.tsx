import React from 'react';
import { getProductBySlug, getAudit } from "@/lib/dataBridge.server";
import { mapShadowToResult } from "@/lib/dataBridge.server";
import ProductDetailView from '@/components/ProductDetailView';

export const runtime = 'edge';

export default async function Page({ params }: { params: { slug: string } }) {
    // In Next.js 15+, params is strictly async or sync depending on config,
    // but standard App Router [slug] usage:
    // params.slug is the slug string.

    // Safety check for array slug (catch-all) vs string
    const slug = typeof params.slug === 'string' ? params.slug : Array.isArray(params.slug) ? params.slug[0] : '';

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
        const initialAudit = auditShadow ? mapShadowToResult(auditShadow) : null;

        return (
            <ProductDetailView
                initialAsset={product}
                initialAudit={initialAudit}
                slug={slug}
            />
        );

    } catch (e) {
        console.error("Server-side load error:", e);
        // Fallback to client-side load if server fails (rare)
        return <ProductDetailView initialAsset={null} slug={slug} />;
    }
}
