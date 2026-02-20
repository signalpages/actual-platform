"use strict";
import React from 'react';
import { ProductAudit } from '@/types';

interface ProofModalProps {
    isOpen: boolean;
    onClose: () => void;
    audit: ProductAudit | null;
}

export function ProofModal({ isOpen, onClose, audit }: ProofModalProps) {
    if (!isOpen || !audit) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">
                            Discrepancy Detected
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">
                            {audit.field_name}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="flex gap-8">
                        <div className="flex-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                Manufacturer Claim
                            </label>
                            <div className="text-lg line-through decoration-red-400 text-slate-400 font-medium">
                                {audit.claimed_value}
                            </div>
                        </div>
                        <div className="px-4 border-l border-slate-100 flex-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-2">
                                Verified Reality
                            </label>
                            <div className="text-2xl font-black text-slate-900">
                                {audit.found_value}
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">🧐</span>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-amber-700 block mb-1">
                                    Forensic Proof
                                </label>
                                <p className="text-sm text-amber-900 italic font-medium leading-relaxed">
                                    "{audit.proof}"
                                </p>
                                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600/70">
                                    <span>Page {audit.page}</span>
                                    <span>•</span>
                                    <span>Official Manual</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl uppercase tracking-widest text-xs hover:bg-blue-600 transition-colors"
                    >
                        Acknowledge Correction
                    </button>
                </div>
            </div>
        </div>
    );
}
