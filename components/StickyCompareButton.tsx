import React, { useEffect, useState } from 'react';
import { AssetSelector } from './ComparisonPicker';
import { useRouter } from 'next/navigation';

import { ProductCategory } from '@/types';

interface StickyCompareButtonProps {
    productSlug: string;
    category: ProductCategory;
    brand: string;
}

export function StickyCompareButton({ productSlug, category, brand }: StickyCompareButtonProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling past header (approx 400px)
            setIsVisible(window.scrollY > 400);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <div className="mb-4 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-72 animate-in slide-in-from-bottom-5 fade-in">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compare vs...</span>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <AssetSelector
                        category={category}
                        placeholder="Search competitor..."
                        onSelect={(target) => router.push(`/compare/${productSlug}-vs-${target.slug}`)}
                    />
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-slate-900 text-white shadow-xl hover:bg-blue-600 transition-all rounded-full px-6 py-3 flex items-center gap-3 font-black uppercase tracking-widest text-xs"
            >
                <span>Scale Assets</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">VS</span>
            </button>
        </div>
    );
}
