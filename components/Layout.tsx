
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isDetailPage = location.pathname.startsWith('/specs/') && location.pathname.split('/').length > 2;

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-black uppercase tracking-tighter hover:text-blue-600 transition-colors">
            Actual<span className="text-blue-600">.</span>fyi
          </Link>
          <div className="flex items-center gap-4 md:gap-8">
            <Link to="/specs?status=verified" className={`text-[10px] font-black uppercase tracking-widest transition-colors ${location.search.includes('status=verified') ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
              Ledger
            </Link>
            <Link to="/specs?status=provisional" className={`text-[10px] font-black uppercase tracking-widest transition-colors ${location.search.includes('status=provisional') ? 'text-amber-600' : 'text-slate-500 hover:text-amber-600'}`}>
              Provisional
            </Link>
            {isDetailPage ? (
              <Link to="/contribute" className="hidden md:block text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                New Audit
              </Link>
            ) : (
              <Link to="/contribute" className="text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 px-4 py-2 rounded-lg hover:bg-blue-600 transition-all shadow-sm">
                Submit
              </Link>
            )}
          </div>
        </div>
      </nav>

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
              <Link to="/coverage" className="text-[10px] text-slate-300 hover:text-blue-600 font-bold uppercase tracking-widest transition-colors underline decoration-slate-200 underline-offset-4">Coverage</Link>
              <Link to="/contact" className="text-[10px] text-slate-300 hover:text-blue-600 font-bold uppercase tracking-widest transition-colors underline decoration-slate-200 underline-offset-4">Contact</Link>
              <Link to="/diagnostics" className="text-[10px] text-slate-300 hover:text-emerald-600 font-bold uppercase tracking-widest transition-colors">System Diagnostics</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
