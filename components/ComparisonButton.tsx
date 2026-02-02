'use client';

import { useState } from 'react';

interface ComparisonButtonProps {
    productSlug?: string;
    variant?: 'primary' | 'secondary';
    className?: string;
}

export function ComparisonButton({ productSlug, variant = 'primary', className = '' }: ComparisonButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleClick = () => {
        // TODO: Wire to existing comparison logic
        // This should open the comparison asset selector
        console.log('Open comparison selector for:', productSlug);
        setIsOpen(true);
    };

    if (variant === 'primary') {
        return (
            <button
                onClick={handleClick}
                className={`w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${className}`}
            >
                <span className="text-blue-400 text-lg">+</span>
                Add Side-by-Side Comparison Asset
            </button>
        );
    }

    // Secondary (sticky)
    return (
        <button
            onClick={handleClick}
            className={`fixed bottom-6 right-6 bg-white hover:bg-slate-50 text-slate-700 px-4 py-3 rounded-full shadow-lg border border-slate-200 text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 z-50 ${className}`}
        >
            <span className="text-blue-500 text-base">+</span>
            Compare
        </button>
    );
}
