
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { searchAssets, listCategories } from '../lib/dataBridge';
import { Asset, Category } from '../types';

const SpecLedger: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialStatus = (searchParams.get('status') as 'verified' | 'provisional') || 'verified';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories] = useState<Category[]>(listCategories());
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<'verified' | 'provisional'>(initialStatus);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await searchAssets('', 'all', 'all');
      setAssets(data);
      setLoading(false);
    };
    load();
  }, []);

  const brands = Array.from(new Set(assets.map(a => a.brand))).sort();

  const filteredAssets = assets.filter(a => {
    const matchesBrand = brandFilter === 'all' || a.brand === brandFilter;
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    const matchesStatus = a.verification_status === statusTab;
    return matchesBrand && matchesCategory && matchesStatus;
  });

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <header className="mb-12">
        <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-[0.2em] mb-4">
          Solar & Backup Power Vertical
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-4">
          Technical Inventory
        </h1>
        <div className="flex gap-4 border-b border-slate-200">
          <button 
            onClick={() => setStatusTab('verified')}
            className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${statusTab === 'verified' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Verified Ledger
            {statusTab === 'verified' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full"></div>}
          </button>
          <button 
            onClick={() => setStatusTab('provisional')}
            className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${statusTab === 'provisional' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Provisional Index
            {statusTab === 'provisional' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600 rounded-full"></div>}
          </button>
        </div>
      </header>

      <div className="mb-12 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <label htmlFor="catFilter" className="text-[9px] font-black uppercase tracking-widest text-slate-400">Category</label>
          <select 
            id="catFilter" 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)} 
            className="p-3 pr-8 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 bg-white focus:border-blue-600 outline-none transition-all"
          >
            <option value="all">All Domains</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="brandFilter" className="text-[9px] font-black uppercase tracking-widest text-slate-400">Brand</label>
          <select 
            id="brandFilter" 
            value={brandFilter} 
            onChange={(e) => setBrandFilter(e.target.value)} 
            className="p-3 pr-8 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 bg-white focus:border-blue-600 outline-none transition-all"
          >
            <option value="all">All Manufacturers</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        
        <div className="ml-auto text-[10px] font-black text-slate-300 uppercase tracking-widest">
          Results: {filteredAssets.length}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-white border border-slate-200 rounded-3xl animate-pulse" />)}
        </div>
      ) : (
        <div id="productGrid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <div key={asset.id} className={`group bg-white border p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all flex flex-col justify-between min-h-[240px] ${asset.verification_status === 'verified' ? 'border-slate-200' : 'border-amber-100'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">{asset.brand}</p>
                  {asset.verification_status === 'provisional' ? (
                    <span className="flex items-center gap-1.5 text-[8px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-200 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                      Provisional
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-200 uppercase tracking-widest">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-1 leading-tight uppercase tracking-tight">{asset.model_name}</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{asset.category.replace(/_/g, ' ')}</p>
              </div>
              <Link to={`/specs/${asset.slug}`} className={`mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${asset.verification_status === 'verified' ? 'text-slate-400 group-hover:text-blue-600' : 'text-amber-500 group-hover:text-amber-700'}`}>
                Forensic Audit <span className="text-sm font-normal">→</span>
              </Link>
            </div>
          ))}
          {filteredAssets.length === 0 && (
            <div className="col-span-full py-24 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">No assets detected in current status filter.</p>
              {statusTab === 'provisional' && (
                <Link to="/contribute" className="mt-4 inline-block text-[10px] font-black uppercase text-blue-600 underline">Add unverified asset →</Link>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default SpecLedger;
