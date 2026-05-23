"use client";

import React, { useState, useEffect } from 'react';

interface ForensicAnalyzerWrapperProps {
    children: React.ReactNode;
    modelA: string;
    modelB: string;
}

interface LogEntry {
    time: string;
    prefix: string;
    text: string;
    status: 'pending' | 'success' | 'warning' | 'info';
}

export function ForensicAnalyzerWrapper({ children, modelA, modelB }: ForensicAnalyzerWrapperProps) {
    const [loading, setLoading] = useState(true);
    const [animationDone, setAnimationDone] = useState(false);
    const [activeStage, setActiveStage] = useState(1);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        // Initialize logs
        const initialLogs: LogEntry[] = [
            { time: '0.00s', prefix: 'CONNECT', text: 'Initializing secure forensic comparison bridge...', status: 'info' }
        ];
        setLogs(initialLogs);

        // Timeline of events for a snappy but immersive 2.2-second sequence
        const sequence = [
            {
                time: 300,
                run: () => {
                    setActiveStage(1);
                    setProgress(25);
                    setLogs(prev => [
                        ...prev,
                        { time: '0.30s', prefix: 'STAGE 1', text: `Reconstructing claims profile for ${modelA}...`, status: 'info' },
                        { time: '0.45s', prefix: 'STAGE 1', text: `Reconstructing claims profile for ${modelB}...`, status: 'info' }
                    ]);
                }
            },
            {
                time: 650,
                run: () => {
                    setProgress(40);
                    setLogs(prev => [
                        ...prev,
                        { time: '0.65s', prefix: 'STATUS', text: 'Claims successfully compiled and structured in cache.', status: 'success' },
                        { time: '0.80s', prefix: 'STAGE 2', text: 'Retrieving independent signal: forums, YouTube transcripts & database indices...', status: 'info' }
                    ]);
                }
            },
            {
                time: 1100,
                run: () => {
                    setActiveStage(2);
                    setProgress(60);
                    setLogs(prev => [
                        ...prev,
                        { time: '1.10s', prefix: 'STATUS', text: 'Sentiment vectors and third-party test data aggregated.', status: 'success' },
                        { time: '1.25s', prefix: 'STAGE 3', text: 'Running discrepancy engine: cross-referencing actual vs claimed specs...', status: 'info' }
                    ]);
                }
            },
            {
                time: 1550,
                run: () => {
                    setActiveStage(3);
                    setProgress(80);
                    setLogs(prev => [
                        ...prev,
                        { time: '1.55s', prefix: 'WARNING', text: 'Discrepancy detected between advertised and forensic values.', status: 'warning' },
                        { time: '1.70s', prefix: 'STAGE 4', text: 'Calibrating Truth Index & compiling final verdict protocol...', status: 'info' }
                    ]);
                }
            },
            {
                time: 2000,
                run: () => {
                    setActiveStage(4);
                    setProgress(100);
                    setLogs(prev => [
                        ...prev,
                        { time: '2.00s', prefix: 'VERDICT', text: 'Forensic evaluation and decision criteria finalized.', status: 'success' },
                        { time: '2.15s', prefix: 'CONNECT', text: 'Securing report signature and loading dashboard...', status: 'success' }
                    ]);
                }
            },
            {
                time: 2400,
                run: () => {
                    setAnimationDone(true);
                }
            },
            {
                time: 2750,
                run: () => {
                    setLoading(false);
                }
            }
        ];

        const timers = sequence.map(event => setTimeout(event.run, event.time));

        return () => {
            timers.forEach(t => clearTimeout(t));
        };
    }, [modelA, modelB]);

    const handleSkip = () => {
        setAnimationDone(true);
        setLoading(false);
    };

    if (!loading) {
        return (
            <>
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in {
                        animation: fadeIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                `}} />
                <div className="animate-fade-in">{children}</div>
            </>
        );
    }

    return (
        <div className={`fixed inset-0 z-50 bg-[#0B0F19] text-white flex flex-col justify-between p-6 md:p-12 font-mono transition-opacity duration-300 ${animationDone ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}} />
            {/* Tech grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_center,rgba(37,99,235,0.06),transparent)] pointer-events-none"></div>

            {/* Header */}
            <header className="flex justify-between items-center border-b border-slate-800 pb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded">
                        Verdict Protocol Active
                    </span>
                </div>
                <div className="text-[10px] text-slate-500 tracking-wider font-bold">
                    SECURE_PORT: F-409_VER
                </div>
            </header>

            {/* Main Interactive Diagnostic Analyzer */}
            <main className="max-w-3xl w-full mx-auto my-auto flex flex-col gap-10 relative z-10 py-10">
                <div className="text-center">
                    <h2 className="text-xs font-bold text-blue-400 uppercase tracking-[0.3em] mb-3">Forensic Showdown</h2>
                    <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mb-2 leading-tight">
                        {modelA} <span className="text-slate-500 font-normal lowercase italic mx-1.5">vs</span> {modelB}
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cross-examining hardware spec ledgers</p>
                </div>

                {/* Concentric Glowing Radar/Scanner UI */}
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                    {/* Ring 1 */}
                    <div className="absolute inset-0 rounded-full border border-blue-500/10 animate-[spin_12s_linear_infinite]"></div>
                    {/* Ring 2 */}
                    <div className="absolute inset-2 rounded-full border border-dashed border-blue-500/20 animate-[spin_8s_linear_infinite_reverse]"></div>
                    {/* Ring 3 */}
                    <div className="absolute inset-6 rounded-full border border-blue-500/30 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                    {/* Pulse core */}
                    <div className="relative w-16 h-16 bg-blue-500/10 border-2 border-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-sm font-black text-blue-400">{progress}%</span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-full h-2 p-0.5 overflow-hidden">
                    <div 
                        className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>

                {/* Stages List */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto w-full border-t border-b border-slate-800 py-6">
                    {[
                        { num: 1, label: 'Claim Profile', desc: 'Stage 1' },
                        { num: 2, label: 'Independent Signal', desc: 'Stage 2' },
                        { num: 3, label: 'Forensic Discrepancy', desc: 'Stage 3' },
                        { num: 4, label: 'Verdict Protocol', desc: 'Stage 4' }
                    ].map(stage => {
                        const isDone = activeStage > stage.num || progress === 100;
                        const isCurrent = activeStage === stage.num && progress < 100;
                        
                        return (
                            <div key={stage.num} className={`p-3 border rounded-xl transition-all ${
                                isDone 
                                    ? 'border-emerald-500/20 bg-emerald-500/5' 
                                    : isCurrent 
                                        ? 'border-blue-500/40 bg-blue-500/5 shadow-md shadow-blue-500/5' 
                                        : 'border-slate-800 bg-slate-950/20'
                            }`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{stage.desc}</span>
                                    {isDone && <span className="text-xs text-emerald-400 font-black">✓</span>}
                                    {isCurrent && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>}
                                </div>
                                <div className={`text-[10px] font-black uppercase tracking-tight ${
                                    isDone ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-slate-400'
                                }`}>
                                    {stage.label}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Log Output Console */}
                <div className="w-full max-w-lg mx-auto bg-slate-950/80 border border-slate-800 rounded-xl p-4 h-36 overflow-y-auto flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {logs.map((log, i) => (
                        <div key={i} className="text-[10px] leading-normal flex items-start gap-2 animate-fade-in font-mono">
                            <span className="text-slate-500 flex-shrink-0">[{log.time}]</span>
                            <span className={`font-bold flex-shrink-0 uppercase px-1 rounded ${
                                log.status === 'success' 
                                    ? 'text-emerald-400 bg-emerald-500/10' 
                                    : log.status === 'warning' 
                                        ? 'text-amber-400 bg-amber-500/10' 
                                        : log.status === 'info' 
                                            ? 'text-blue-400 bg-blue-500/10' 
                                            : 'text-slate-400'
                            }`}>
                                {log.prefix}
                            </span>
                            <span className={
                                log.status === 'success' 
                                    ? 'text-slate-200' 
                                    : log.status === 'warning' 
                                        ? 'text-amber-300' 
                                        : 'text-slate-300'
                            }>
                                {log.text}
                            </span>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer with Skip Option */}
            <footer className="flex justify-between items-center border-t border-slate-800 pt-4 relative z-10 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                <div>© {new Date().getFullYear()} Actual.fyi Engine</div>
                <button 
                    onClick={handleSkip}
                    className="hover:text-blue-400 hover:underline transition-colors flex items-center gap-1 cursor-pointer font-bold"
                >
                    Skip Scan →
                </button>
            </footer>
        </div>
    );
}
