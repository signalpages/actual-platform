"use client";

import React from 'react';
import { FieldNotesSnapshot } from '@/types';

interface FieldNotesViewProps {
    snapshot: FieldNotesSnapshot;
}

export const FieldNotesView: React.FC<FieldNotesViewProps> = ({ snapshot }) => {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Use the explicit contract from snapshot_json if available, fallback for safety
    const data = (snapshot.snapshot_json || snapshot) as any;

    // 1. Source Grouping Logic
    const ownerDiscussions = data.sources_owner || [];
    const referenceDocs = data.sources_reference || [];

    // 2. Language Guardrail for Friction
    const formatFriction = (text: string) => {
        const prefixes = ["Reports of", "Multiple discussions mention", "Some users note"];
        if (prefixes.some(p => text.startsWith(p))) return text;
        return `Reports of ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="border-b border-slate-100 pb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-2">
                    Field Notes
                </h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                    Long-term ownership patterns surfaced from owner discussions — distinct from the structured product audit. Field Notes are derived from unstructured forum posts and review commentary rather than the validation framework used for scoring, and do not influence the Verification Score. Field Notes are only available for select products where sufficient ownership discussions exist.
                    {data.disclaimer && ` ${data.disclaimer}`}
                </p>

                <div className="flex flex-wrap gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sources Surfaced</span>
                        <span className="text-xs font-bold text-slate-700">{(ownerDiscussions.length + referenceDocs.length) || snapshot.source_count || 0}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Refreshed from Discussions</span>
                        <span className="text-xs font-bold text-slate-700">{formatDate(snapshot.created_at)}</span>
                    </div>
                </div>
            </div>

            {/* Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Praise - capped at 7 */}
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                        <span className="text-base">👍</span> What Owners Like
                    </h3>
                    <ul className="space-y-3">
                        {(data.praise || []).slice(0, 7).map((item: any, i: number) => (
                            <li key={i} className="text-sm text-slate-700 font-medium flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Friction - capped at 7 with prefixing */}
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-4 flex items-center gap-2">
                        <span className="text-base">⚠️</span> Where Friction Appears
                    </h3>
                    <ul className="space-y-3">
                        {(data.friction || []).slice(0, 7).map((item: any, i: number) => (
                            <li key={i} className="text-sm text-slate-700 font-medium flex items-start gap-2">
                                <span className="text-amber-500 font-bold">•</span>
                                {formatFriction(item)}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Themes - capped at 6 */}
                <div className="md:col-span-2">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                        <span className="text-base">🔎</span> Long-Term Patterns
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                        {(data.themes || []).slice(0, 6).map((item: any, i: number) => (
                            <li key={i} className="text-sm text-slate-700 font-medium flex items-start gap-2 list-none">
                                <span className="text-slate-300 font-bold">•</span>
                                {item}
                            </li>
                        ))}
                    </div>
                </div>

                {/* Optional Delta Section */}
                {data.delta_summary && data.delta_summary.length > 0 && (
                    <div className="md:col-span-2 mt-4">
                        <details className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300">
                            <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900">
                                    What Changed Since Last Snapshot
                                </h3>
                                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="p-6 pt-0">
                                <ul className="space-y-3">
                                    {Array.isArray(data.delta_summary) ? data.delta_summary.slice(0, 3).map((item: any, i: number) => (
                                        <li key={i} className="text-sm text-slate-600 font-medium flex items-start gap-2">
                                            <span className="text-slate-400 font-bold">•</span>
                                            {item}
                                        </li>
                                    )) : (
                                        <li className="text-sm text-slate-600 font-medium flex items-start gap-2">
                                            <span className="text-slate-400 font-bold">•</span>
                                            {data.delta_summary}
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </details>
                    </div>
                )}
            </div>

            {/* 1. Sources Section Refinement */}
            <div className="pt-8 border-t border-slate-100">
                <div className="space-y-8">
                    {/* Owner Discussions */}
                    {ownerDiscussions.length > 0 && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <span className="text-xs">💬</span> Owner Discussions ({ownerDiscussions.length})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {ownerDiscussions.map((source: any, i: number) => {
                                    let domain = '';
                                    try {
                                        domain = new URL(source.url).hostname.replace('www.', '');
                                    } catch (e) { }

                                    return (
                                        <SourceCard key={i} source={source} domain={domain} />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Reference & Documentation */}
                    {referenceDocs.length > 0 && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <span className="text-xs">📖</span> Reference & Documentation ({referenceDocs.length})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {referenceDocs.map((source: any, i: number) => {
                                    let domain = '';
                                    try {
                                        domain = new URL(source.url).hostname.replace('www.', '');
                                    } catch (e) { }

                                    return (
                                        <SourceCard key={i} source={source} domain={domain} />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SourceCard: React.FC<{ source: any; domain: string }> = ({ source, domain }) => {
    const isLink = !!domain;
    const Wrapper = isLink ? 'a' : 'div';
    const wrapperProps = isLink ? {
        href: source.url,
        target: "_blank",
        rel: "noopener noreferrer"
    } : {};

    return (
        <Wrapper
            {...wrapperProps as any}
            className={`flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white transition-all ${isLink ? 'cursor-pointer hover:border-blue-200 hover:shadow-sm group' : ''}`}
        >
            <div className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-50 transition-colors ${isLink ? 'group-hover:bg-blue-50 group-hover:border-blue-100' : ''}`}>
                {domain ? (
                    <img
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                        alt=""
                        className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                ) : (
                    <svg className="w-4 h-4 opacity-40 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                )}
            </div>
            <div className="flex flex-col min-w-0">
                <span className={`text-xs font-bold text-slate-700 truncate transition-colors ${isLink ? 'group-hover:text-blue-600' : ''}`}>
                    {source.title}
                </span>
                {domain && (
                    <span className="text-[10px] font-medium text-slate-400 truncate uppercase tracking-tight">
                        {domain}
                    </span>
                )}
            </div>
        </Wrapper>
    );
};
