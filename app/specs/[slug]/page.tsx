import React from 'react';
import { getProductBySlug, getAudit } from "@/lib/dataBridge.server";
import { mapShadowToResult } from "@/lib/dataBridge.server";
import ProductDetailView from '@/components/ProductDetailView';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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
        const initialAudit = auditShadow ? mapShadowToResult(auditShadow) : null;

        // Map Product (DB) to Asset (UI)
        const asset = {
            ...product,
            // products table has is_audited. Mapping to UI model:
            verified: (product as any).is_audited || false,
            verification_status: (product as any).is_audited ? 'verified' : 'provisional'
        };

        return (
            <React.Suspense fallback={<ProductDetailView initialAsset={null} slug={slug} />}>
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
