"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { UiMode, withUi } from './uiMode';

interface NavOptionCProps {
    mode: UiMode;
}

export default function NavOptionC({ mode }: NavOptionCProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href={withUi('/', mode)} className="text-xl font-black uppercase tracking-tighter hover:text-blue-600 transition-colors">
                        Actual<span className="text-blue-600">.</span>fyi <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded ml-1 align-middle">Beta C</span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">

                        <Link href={withUi('/start', mode)} className="text-[11px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors shadow-sm">
                            Start Planning
                        </Link>

                        {/* Reuse Systems Dropdown logic from Option A (Simplified for C) */}
                        <div className="relative group">
                            <button className="text-[11px] font-black uppercase tracking-widest text-slate-600 group-hover:text-emerald-600 py-4 flex items-center gap-1">
                                Systems
                                <svg className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <div className="absolute left-0 mt-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 duration-200 z-50 overflow-hidden">
                                <div className="p-2">
                                    <Link href={withUi('/specs?category=portable_power_station', mode)} className="block px-4 py-3 hover:bg-slate-50 rounded-lg">
                                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-900">Portable Power Stations</div>
                                    </Link>
                                    <Link href={withUi('/specs?category=home_backup_system', mode)} className="block px-4 py-3 hover:bg-slate-50 rounded-lg">
                                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-900">Home Backup Batteries</div>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <button className="text-[11px] font-black uppercase tracking-widest text-slate-600 group-hover:text-emerald-600 py-4 flex items-center gap-1">
                                Components
                                <svg className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <div className="absolute left-1/2 -translate-x-1/2 mt-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 duration-200 z-50 overflow-hidden">
                                <div className="p-2">
                                    <Link href={withUi('/specs?category=solar_panel', mode)} className="block px-4 py-2 hover:bg-slate-50 rounded-lg font-bold text-xs text-slate-800">Solar Panels</Link>
                                    <Link href={withUi('/specs?category=inverter', mode)} className="block px-4 py-2 hover:bg-slate-50 rounded-lg font-bold text-xs text-slate-800">Inverters</Link>
                                    <Link href={withUi('/specs?category=charge_controller', mode)} className="block px-4 py-2 hover:bg-slate-50 rounded-lg font-bold text-xs text-slate-800">Charge Controllers</Link>
                                    <Link href={withUi('/specs?category=ev_charger', mode)} className="block px-4 py-2 hover:bg-slate-50 rounded-lg font-bold text-xs text-slate-800">EV Chargers</Link>
                                </div>
                            </div>
                        </div>


                        <Link href={withUi('/compare', mode)} className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 transition-colors">
                            Compare
                        </Link>

                        <Link href={withUi('/learn', mode)} className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 transition-colors">
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
                    <Link href={withUi('/start', mode)} className="block text-center text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 px-4 py-3 rounded-lg">Start Planning</Link>
                    <div className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Systems</div>
                        <Link href={withUi('/specs?category=portable_power_station', mode)} className="block text-sm font-bold text-slate-800 pl-4">Portable Power Stations</Link>
                        <Link href={withUi('/specs?category=home_backup_system', mode)} className="block text-sm font-bold text-slate-800 pl-4">Home Backup</Link>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Components</div>
                        <Link href={withUi('/specs?category=solar_panel', mode)} className="block text-sm font-bold text-slate-800 pl-4">Solar Panels</Link>
                        <Link href={withUi('/specs?category=inverter', mode)} className="block text-sm font-bold text-slate-800 pl-4">Inverters</Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
