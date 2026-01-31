
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProvisionalAsset, listCategories } from '../lib/dataBridge';
import { ProductCategory } from '../types';

const Contribute: React.FC = () => {
  const navigate = useNavigate();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<ProductCategory>('portable_power_station');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = listCategories();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !model) {
      setError("Asset brand and model are mandatory fields.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const query = `${brand} ${model}`;
    const result = await createProvisionalAsset({ query, category });

    if (result.ok && result.asset) {
      // Small delay to simulate system registration
      setTimeout(() => {
        navigate(`/specs/${result.asset!.slug}?autoRun=true`);
      }, 800);
    } else {
      setError(result.error || "Forensic engine rejected entry. Out of domain scope.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-16">
        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest mb-6">Ledger Expansion Protocol</div>
        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-tight mb-4">Register New Asset</h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl">
          Add an unverified entry to the global energy ledger. Once registered, the forensic engine will attempt to cross-reference technical claims against real-world datasets.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
        <div className="md:col-span-3">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm space-y-8">
            <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Technical Signature Definition</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Manufacturer</label>
                <input 
                  type="text" 
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. EcoFlow, Jackery" 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Model / Signature</label>
                <input 
                  type="text" 
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. Delta Pro Ultra" 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 transition-all appearance-none"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black text-red-600 uppercase tracking-widest">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${isSubmitting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}
            >
              {isSubmitting ? 'Registering Signal...' : 'Initiate Forensic Audit'}
            </button>
          </form>
        </div>

        <div className="md:col-span-2 space-y-8">
          <section className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-10">
            <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6">Entry Constraints</h2>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="text-blue-600 font-black text-xs">/</span>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">Direct entry is restricted to Power & Energy domains only.</p>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-600 font-black text-xs">/</span>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">Duplicate signatures are merged into the existing audit history.</p>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-600 font-black text-xs">/</span>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">Verification status is 'Provisional' until 3 high-friction sources are logged.</p>
              </li>
            </ul>
          </section>

          <div className="p-10 bg-blue-50/50 border border-blue-100 rounded-[2.5rem]">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Verification Active</h3>
            <p className="text-xs text-blue-800/70 leading-relaxed font-medium">
              By submitting an asset, you initiate a live forensic scan. The engine will query FCC databases, Reddit technical logs, and official manuals to synthesize a Truth Index.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contribute;
