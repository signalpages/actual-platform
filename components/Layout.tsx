"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

import AuditNav from '@/components/nav/AuditNav';

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={<div className="h-16 border-b border-slate-200" />}>
        <AuditNav />
      </Suspense>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="mt-20 border-t border-slate-200 bg-white py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Transparency Disclosure</p>
          <p className="text-xs text-slate-400 leading-relaxed italic">
            Independent technical audits. We prioritize technical reality over manufacturer marketing.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
            <p className="text-[10px] text-slate-300 font-bold uppercase">&copy; 2026 Actual.fyi</p>
            <div className="flex items-center gap-6">
              <Link href="/coverage" className="text-[10px] text-slate-300 hover:text-blue-600 font-bold uppercase tracking-widest transition-colors underline decoration-slate-200 underline-offset-4">Coverage</Link>
              <Link href="/contact" className="text-[10px] text-slate-300 hover:text-blue-600 font-bold uppercase tracking-widest transition-colors underline decoration-slate-200 underline-offset-4">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
