"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function AuditNav() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="text-xl font-black uppercase tracking-tighter hover:text-blue-600 transition-colors">
                        Actual<span className="text-blue-600">.</span>fyi
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">

                        {/* Audits Dropdown */}
                        <div className="relative group">
                            <button className="text-[11px] font-black uppercase tracking-widest text-slate-900 group-hover:text-blue-600 py-4 flex items-center gap-1">
                                Audits
                                <svg className="w-3 h-3 text-slate-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <div className="absolute left-0 mt-0 w-56 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 duration-200 z-50 overflow-hidden">
                                <div className="p-2">
                                    <div className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">Browse Categories</div>
                                    <Link href="/specs?category=solar_panel" className="block px-4 py-2 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-800">Solar Panels</Link>
                                    <Link href="/specs?category=inverter" className="block px-4 py-2 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-800">Inverters</Link>
                                    <Link href="/specs?category=home_backup_system" className="block px-4 py-2 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-800">Batteries</Link>
                                    <Link href="/specs?category=charge_controller" className="block px-4 py-2 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-800">Charge Controllers</Link>
                                    <Link href="/specs?category=ev_charger" className="block px-4 py-2 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-800">EV Chargers</Link>
                                </div>
                            </div>
                        </div>

                        <Link href="/compare" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 transition-colors">
                            Compare
                        </Link>

                        {/* Systems Dropdown (Secondary) */}
                        <div className="relative group">
                            <button className="text-[11px] font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-600 py-4 flex items-center gap-1">
                                Systems
                                <svg className="w-3 h-3 text-slate-300 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <div className="absolute left-0 mt-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 duration-200 z-50 overflow-hidden">
                                <div className="p-2">
                                    <Link href="/systems" className="block px-4 py-3 hover:bg-slate-50 rounded-lg">
                                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-900">Ready-Made Systems</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">Portable Power Stations</div>
                                    </Link>
                                    <Link href="/systems" className="block px-4 py-3 hover:bg-slate-50 rounded-lg">
                                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-900">System Context</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">How components fit together</div>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <Link href="/learn" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 transition-colors">
                            Learn
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-900 p-2">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-4">
                    <div className="space-y-2">
                        <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Audits</div>
                        <Link href="/specs?category=solar_panel" className="block text-sm font-bold text-slate-800 pl-4">Solar Panels</Link>
                        <Link href="/specs?category=inverter" className="block text-sm font-bold text-slate-800 pl-4">Inverters</Link>
                        <Link href="/specs?category=home_backup_system" className="block text-sm font-bold text-slate-800 pl-4">Batteries</Link>
                        <Link href="/specs?category=ev_charger" className="block text-sm font-bold text-slate-800 pl-4">EV Chargers</Link>
                    </div>
                    <Link href="/compare" className="block text-[10px] font-black uppercase tracking-widest text-slate-600">Compare</Link>
                    <div className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Systems</div>
                        <Link href="/systems" className="block text-sm font-bold text-slate-800 pl-4">Ready-Made Systems</Link>
                        <Link href="/systems" className="block text-sm font-bold text-slate-800 pl-4">System Context</Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
