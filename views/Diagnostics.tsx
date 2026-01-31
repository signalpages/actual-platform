
import React, { useState, useEffect } from 'react';
import { getSupabaseHealthReport } from '../services/supabaseService';
import { Link } from 'react-router-dom';

const Diagnostics: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const data = await getSupabaseHealthReport();
      setReport(data);
      setLoading(false);
    };
    run();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Running Route Validation Harness...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-2">System Diagnostics</h1>
          <p className="text-slate-500 font-medium">Verification of Supabase routing and inventory integrity.</p>
        </div>
        <Link to="/" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
          Exit Labs →
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connection Status</h2>
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${report.ok ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {report.ok ? 'HEALTHY' : 'DEGRADED'}
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Resolved Host</p>
              <p className="text-sm font-black text-slate-900 break-all">{report.env.host}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Config Mode</p>
              <p className="text-sm font-black text-slate-900">{report.env.configured ? 'Production Environment' : 'Mock Data Fallback'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Inventory Audit</h2>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Total Assets</p>
              <p className="text-2xl font-black text-slate-900">{report.checks.total_products}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Active Ledger</p>
              <p className="text-2xl font-black text-blue-600">{report.checks.active_products}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Verified Specs</p>
              <p className="text-sm font-black text-emerald-600">{report.checks.products_with_specs}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Pending Audit</p>
              <p className="text-sm font-black text-orange-500">{report.checks.products_without_specs}</p>
            </div>
          </div>
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="mt-8 bg-red-50 border border-red-100 p-8 rounded-[2rem]">
          <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4">Critical Warnings</h3>
          <ul className="space-y-3">
            {report.warnings.map((w: string, i: number) => (
              <li key={i} className="text-xs font-bold text-red-900 flex items-start gap-2">
                <span className="shrink-0 text-lg leading-none">!</span>
                <span className="italic leading-relaxed">"{w}"</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-12 p-10 bg-slate-900 rounded-[2rem] text-center border border-slate-800 shadow-2xl">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 animate-pulse">Integrity Check Cycle Completed</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-slate-900 px-8 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-xl active:scale-95"
          >
            Rerun Validation Protocol
          </button>
          <Link 
            to="/specs"
            className="bg-slate-800 text-slate-400 px-8 py-3 rounded-xl text-[10px] font-black uppercase hover:text-white transition-all border border-slate-700"
          >
            Review Ledger
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Diagnostics;
