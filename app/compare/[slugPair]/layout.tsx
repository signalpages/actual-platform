import { getProductBySlug } from "@/lib/dataBridge.server";

export async function generateMetadata({ params }: { params: Promise<{ slugPair: string }> }) {
    const resolvedParams = await params;

    // Safety check for catch-all arrays
    const rawPairs = typeof resolvedParams.slugPair === 'string'
        ? resolvedParams.slugPair
        : Array.isArray(resolvedParams.slugPair)
            ? resolvedParams.slugPair[0]
            : '';

    if (!rawPairs || !rawPairs.includes('-vs-')) return {};

    const [slugA, slugB] = rawPairs.split("-vs-");

    if (!slugA || !slugB) return {};

    const productA = await getProductBySlug(slugA);
    const productB = await getProductBySlug(slugB);

    if (!productA || !productB) return {};

    const nameA = `${productA.brand || ''} ${productA.model_name || ''}`.trim() || slugA;
    const nameB = `${productB.brand || ''} ${productB.model_name || ''}`.trim() || slugB;

    return {
        title: `${nameA} vs ${nameB} Comparison`,
        description: `Side-by-side performance comparison and forensic audit of ${nameA} vs ${nameB}. Verification backed by unbiased performance data.`,
        alternates: {
            canonical: `/compare/${rawPairs}`,
        }
    };
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
