"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { getUiMode } from './uiMode';
import NavOptionA from './NavOptionA';
import NavOptionB from './NavOptionB';
import NavOptionC from './NavOptionC';
import Link from 'next/link';

// Default Nav (copied/adapted from Layout.tsx for fallback)
function DefaultNav() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const isDetailPage = false; // Simplified for MVP or pass as prop if needed

    return (
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                <Link href="/" className="text-xl font-black uppercase tracking-tighter hover:text-blue-600 transition-colors">
                    Actual<span className="text-blue-600">.</span>fyi
                </Link>
                <div className="flex items-center gap-4 md:gap-8">
                    <Link href="/specs?status=verified" className={`text-[10px] font-black uppercase tracking-widest transition-colors ${status === 'verified' || (!status) ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
                        Ledger
                    </Link>
                    <Link href="/specs?status=provisional" className={`text-[10px] font-black uppercase tracking-widest transition-colors ${status === 'provisional' ? 'text-amber-600' : 'text-slate-500 hover:text-amber-600'}`}>
                        Provisional
                    </Link>
                    <Link href="/contribute" className="text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 px-4 py-2 rounded-lg hover:bg-blue-600 transition-all shadow-sm">
                        Submit
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export default function NavSwitcher() {
    const searchParams = useSearchParams();
    const mode = getUiMode(searchParams);

    if (mode === 'a') return <NavOptionA mode={mode} />;
    if (mode === 'b') return <NavOptionB mode={mode} />;
    if (mode === 'c') return <NavOptionC mode={mode} />;

    return <DefaultNav />;
}
