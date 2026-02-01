"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

function NavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const isDetailPage = pathname.startsWith('/specs/') && pathname.split('/').length > 2;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-black uppercase tracking-tighter hover:text-blue-600 transition-colors">
          Actual<span className="text-blue-600">.</span>fyi
        </Link>
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/specs?status=verified" className={`text-[10px] font-black uppercase tracking-widest transition-colors ${status === 'verified' || (!status && !pathname.includes('status')) ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
            Ledger
          </Link>
          <Link href="/specs?status=provisional" className={`text-[10px] font-black uppercase tracking-widest transition-colors ${status === 'provisional' ? 'text-amber-600' : 'text-slate-500 hover:text-amber-600'}`}>
            Provisional
          </Link>
          {isDetailPage ? (
            <Link href="/contribute" className="hidden md:block text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
              New Audit
            </Link>
          ) : (
            <Link href="/contribute" className="text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 px-4 py-2 rounded-lg hover:bg-blue-600 transition-all shadow-sm">
              Submit
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={<div className="h-16 border-b border-slate-200" />}>
        <NavContent />
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
              <Link href="/diagnostics" className="text-[10px] text-slate-300 hover:text-emerald-600 font-bold uppercase tracking-widest transition-colors">System Diagnostics</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
