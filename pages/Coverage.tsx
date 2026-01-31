
import React, { useState, useEffect } from 'react';
import { getAllAssets, listCategories } from '../lib/dataBridge';
import { Link } from 'react-router-dom';
import { Asset } from '../types';

const Coverage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Fixed: Added await because getAllAssets returns a Promise<Asset[]>
      const data = await getAllAssets();
      setAssets(data);
      setLoading(false);
    };
    load();
  }, []);

  const verifiedCount = assets.filter(a => a.verification_status === 'verified').length;
  const provisionalCount = assets.filter(a => a.verification_status === 'provisional').length;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Syncing Coverage Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-16">
        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest mb-6">Transparency Protocol V1.0</div>
        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-tight mb-4">Coverage &<br/>Verification Status</h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl">
          Actual.fyi prioritizes information integrity over inventory volume. We maintain a curated index where every data point is weighted by its source reliability.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Index Composition</h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Verified Assets</p>
              <p className="text-4xl font-black text-blue-600">{verifiedCount}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-2 leading-relaxed">Technical claims forensicly matched against real-world datasets.</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Provisional</p>
              <p className="text-4xl font-black text-slate-900">{provisionalCount}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-2 leading-relaxed">Emerging signatures currently undergoing signal cross-referencing.</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-xl">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Verification Logic</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <span className="text-blue-500 font-black">01</span>
              <p className="text-xs font-medium text-slate-300 leading-relaxed">
                <span className="text-white font-bold block mb-1">Source Triangulation</span>
                We combine official FCC filings with independent community discharge tests to identify claim variance.
              </p>
            </div>
            <div className="flex gap-4">
              <span className="text-blue-500 font-black">02</span>
              <p className="text-xs font-medium text-slate-300 leading-relaxed">
                <span className="text-white font-bold block mb-1">Signal Thresholds</span>
                Assets remain 'Provisional' until a minimum of three high-friction data points are resolved.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-12 mb-16">
        <section>
          <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 mb-4">Why is some data missing?</h3>
          <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
            Empty fields in the Truth Ledger are intentional. If a manufacturer claim cannot be verified through technical documentation or peer-reviewed testing, we mark it as "Pending Verification" rather than displaying potentially inaccurate marketing copy. We prioritize technical reality over consumer hype cycles.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 mb-4">The Provisional State</h3>
          <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
            When you add an "Unverified Asset," our forensic engine performs a live synthesis of available community signals. This state is neutral; it indicates that the asset exists within the energy domain but has not yet undergone our full 72-point verification protocol.
          </p>
        </section>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="max-w-md">
          <h4 className="text-blue-900 font-black uppercase tracking-tight text-xl mb-2">Contribute to the Index</h4>
          <p className="text-blue-700/70 text-sm font-medium">Help us expand the ledger by submitting high-friction data points or new asset signatures.</p>
        </div>
        <div className="flex gap-4">
          <Link to="/contribute" className="bg-blue-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md whitespace-nowrap">
            Submit Asset
          </Link>
          <Link to="/specs" className="bg-white text-blue-600 border border-blue-200 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all whitespace-nowrap">
            Browse Ledger
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Coverage;
