"use client";

import React, { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <html>
            <body className="bg-white min-h-screen text-slate-900 p-8 font-sans">
                <div className="max-w-2xl mx-auto mt-20 p-10 border border-slate-200 rounded-3xl shadow-xl text-center">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-red-600 mb-4">Protocol Exception</h2>
                    <p className="text-slate-500 mb-8 font-medium">The forensic engine encountered a critical synthesis error.</p>

                    <div className="bg-slate-50 p-6 rounded-xl text-left mb-8 overflow-auto max-h-60 border border-slate-100">
                        <p className="text-xs font-mono text-slate-600 whitespace-pre-wrap">
                            {error?.message || "Unknown system failure"}
                            {error?.digest && `\n\nDigest: ${error.digest}`}
                        </p>
                    </div>

                    <button
                        onClick={() => reset()}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                    >
                        Retry Synthesis
                    </button>
                </div>
            </body>
        </html>
    );
}
