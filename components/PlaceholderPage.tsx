import React from 'react';
import Link from 'next/link';

export const runtime = 'edge';

export default function PlaceholderPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-4">Under Construction</h1>
            <p className="text-slate-500 font-medium mb-8">This module is currently being calibrated in the lab.</p>
            <Link href="/" className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
                Return to Dashboard
            </Link>
        </div>
    );
}
