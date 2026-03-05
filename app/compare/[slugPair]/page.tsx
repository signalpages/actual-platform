// app/compare/[slugPair]/page.tsx
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySlug, getAudit, mapShadowToResult } from '@/lib/dataBridge.server';
import { DecisionSummary } from '@/components/DecisionSummary';
import { FullAuditPanel } from '@/components/FullAuditPanel';
import { deriveVerdict } from '@/lib/compare/deriveVerdict';
import { formatCategoryLabel } from '@/lib/categoryFormatter';
import { composeClaimProfile } from '@/lib/claimProfileComposer';

export const runtime = "edge";

interface PageProps {
    params: Promise<{ slugPair: string }>;
}

export default async function ComparisonPage({ params }: PageProps) {
    const resolvedParams = await params;
    const slugPair = resolvedParams.slugPair;

    if (!slugPair || !slugPair.includes('-vs-')) {
        return notFound();
    }

    const [slugA, slugB] = slugPair.split('-vs-');

    // 1. Fetch data on the server
    const [productA, productB] = await Promise.all([
        getProductBySlug(slugA),
        getProductBySlug(slugB)
    ]);

    if (!productA || !productB) {
        return notFound();
    }

    const [shadowA, shadowB] = await Promise.all([
        getAudit(productA.id),
        getAudit(productB.id)
    ]);

    // Ticket requirement: "Only generate comparisons when... both have completed audits"
    // We check if both have a truth score and are verified/provisional
    const auditA = shadowA ? mapShadowToResult(shadowA) : null;
    const auditB = shadowB ? mapShadowToResult(shadowB) : null;

    const isCompleteA = auditA?.analysis?.status === 'ready' || auditA?.analysis?.status === 'provisional';
    const isCompleteB = auditB?.analysis?.status === 'ready' || auditB?.analysis?.status === 'provisional';

    if (!isCompleteA || !isCompleteB) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-24 text-center">
                <div className="inline-block bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                    Comparison Pending
                </div>
                <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-6">
                    Audit Synchronization in Progress
                </h1>
                <p className="text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">
                    One or both of these products are still undergoing forensic verification. Comparison pages are only generated once both units have completed the 4-stage audit protocol.
                </p>
                <Link href="/compare" className="text-blue-600 font-bold uppercase tracking-widest text-[11px] hover:underline">
                    ← Back to Comparison Hub
                </Link>
            </div>
        );
    }

    // 2. Derive Verdict
    const verdictResult = deriveVerdict(
        { id: productA.id, model_name: productA.model_name, audit: auditA! },
        { id: productB.id, model_name: productB.model_name, audit: auditB! }
    );

    const verdict = verdictResult.ok ? verdictResult.verdict : null;

    // 3. Prepare Comparison Specs
    const getSpec = (product: any, key: string) => {
        const claims = composeClaimProfile(product.technical_specs, product.category);

        // Aliases for loose matching
        const aliases: Record<string, string[]> = {
            capacity: ['capacity', 'battery', 'energy', 'wh', 'kwh', 'size'],
            output: ['output', 'inverter', 'ac continuous', 'power', 'watts', 'w', 'rated'],
            solar: ['solar', 'mppt', 'pv input', 'charge rate', 'solar input', 'dc input'],
            weight: ['weight', 'mass', 'kg', 'lb', 'lbs'],
            expansion: ['expansion', 'modular', 'extra battery', 'add-on', 'expandable'],
        };

        const searchTerms = aliases[key] || [key];

        // Find match in composed claims (which already handles unit formatting and schema mapping)
        const match = claims.find(c => {
            const labelLower = (c.label || '').toLowerCase();
            return searchTerms.some(term => labelLower.includes(term));
        });

        return match ? match.value : 'N/A';
    };

    const specComparison = [
        { label: 'Battery Capacity', key: 'capacity' },
        { label: 'Inverter Output', key: 'output' },
        { label: 'Solar Input', key: 'solar' },
        { label: 'Weight', key: 'weight' },
        { label: 'Expansion Support', key: 'expansion' },
    ];

    const baseUrl = 'https://actual.fyi';
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Product",
                "@id": `${baseUrl}/specs/${productA.slug}#product`,
                "name": `${productA.brand} ${productA.model_name}`,
                "brand": { "@type": "Brand", "name": productA.brand },
                "description": `Forensic performance audit and technical verification of the ${productA.model_name}.`,
                "sku": productA.slug,
                "image": productA.image_url ? [productA.image_url] : [],
                "offers": {
                    "@type": "Offer",
                    "url": `${baseUrl}/specs/${productA.slug}`,
                    "availability": "https://schema.org/InStock",
                    "priceCurrency": "USD",
                    "price": productA.msrp_usd || "0"
                }
            },
            {
                "@type": "Product",
                "@id": `${baseUrl}/specs/${productB.slug}#product`,
                "name": `${productB.brand} ${productB.model_name}`,
                "brand": { "@type": "Brand", "name": productB.brand },
                "description": `Forensic performance audit and technical verification of the ${productB.model_name}.`,
                "sku": productB.slug,
                "image": productB.image_url ? [productB.image_url] : [],
                "offers": {
                    "@type": "Offer",
                    "url": `${baseUrl}/specs/${productB.slug}`,
                    "availability": "https://schema.org/InStock",
                    "priceCurrency": "USD",
                    "price": productB.msrp_usd || "0"
                }
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl },
                    { "@type": "ListItem", "position": 2, "name": "Compare", "item": `${baseUrl}/compare` },
                    { "@type": "ListItem", "position": 3, "name": `${productA.model_name} vs ${productB.model_name}`, "item": `${baseUrl}/compare/${slugPair}` }
                ]
            },
            {
                "@type": "ItemList",
                "name": `${productA.model_name} vs ${productB.model_name} Comparison`,
                "numberOfItems": 2,
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "item": { "@id": `${baseUrl}/specs/${productA.slug}#product` } },
                    { "@type": "ListItem", "position": 2, "item": { "@id": `${baseUrl}/specs/${productB.slug}#product` } }
                ]
            }
        ]
    };

    return (
        <main className="max-w-7xl mx-auto px-6 py-12 md:py-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* 1️⃣ Comparison Header */}
            <header className="mb-16 text-center">
                <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest mb-6">
                    Forensic Showdown Protocol
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9] mb-4">
                    {productA.brand} {productA.model_name} <br />
                    <span className="text-slate-300 font-light italic text-2xl md:text-4xl lowercase mx-2">vs</span> <br />
                    {productB.brand} {productB.model_name}
                </h1>
                <p className="text-slate-500 font-medium mt-6 max-w-2xl mx-auto">
                    A direct head-to-head comparison of two {formatCategoryLabel(productA.category)} models based on verified technical data and Verification Scoring.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative mb-24">
                {/* VS Badge */}
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-900 text-white rounded-full items-center justify-center font-black text-sm z-20 shadow-2xl border-4 border-white">VS</div>

                {/* Left Product */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                    <FullAuditPanel product={productA as any} audit={auditA as any} />
                </div>

                {/* Right Product */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                    <FullAuditPanel product={productB as any} audit={auditB as any} />
                </div>
            </div>

            {/* 2️⃣ Specification Comparison Table */}
            <section className="mb-24">
                <div className="flex items-center gap-4 mb-10">
                    <div className="h-0.5 w-10 bg-blue-600"></div>
                    <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-600">Technical Spec Comparison</h2>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Specification</th>
                                <th className="p-6 text-sm font-black text-slate-900">{productA.model_name}</th>
                                <th className="p-6 text-sm font-black text-slate-900">{productB.model_name}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {specComparison.map((spec) => (
                                <tr key={spec.key} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wide">{spec.label}</td>
                                    <td className="p-6 text-sm font-bold text-slate-900">{getSpec(productA, spec.key)}</td>
                                    <td className="p-6 text-sm font-bold text-slate-900">{getSpec(productB, spec.key)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 3️⃣ Verification Score & Discrepancies Comparison is already inside FullAuditPanel, 
                but we can add a summary section if needed. The DecisionSummary covers the verdict. */}

            {/* 4️⃣ Verdict Summary */}
            {verdict && (
                <section>
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-0.5 w-10 bg-slate-900"></div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Actual Verdict</h2>
                    </div>
                    <DecisionSummary
                        verdict={verdict}
                        assets={[productA as any, productB as any]}
                        audits={[auditA as any, auditB as any]}
                    />
                </section>
            )}

            {/* Bottom Navigation */}
            <footer className="mt-32 pt-12 border-t border-slate-100 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <Link href="/compare" className="text-slate-400 hover:text-blue-600 transition-colors">← All Comparisons</Link>
                <div className="text-slate-300">Audited by Actual.fyi Forensic Team</div>
            </footer>
        </main>
    );
}
