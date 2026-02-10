
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { listCategories, searchAssets, createProvisionalAsset } from '@/lib/dataBridge.client';
import { Asset, Category, ProductCategory } from '@/types';

export const AssetSelector: React.FC<{
  category: ProductCategory;
  onSelect: (asset: Asset) => void;
  placeholder?: string;
  className?: string;
}> = ({ category, onSelect, placeholder = "Search category assets", className = "" }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Asset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (query.length >= 0) { // Fix: Allow empty query (show all/recent)
        const matches = await searchAssets(query, category);
        setResults(matches);
      } else {
        setResults([]);
      }
    };
    search();
  }, [query, category]);

  const handleProvisional = async () => {
    setIsSubmitting(true);
    setError(null);
    const res = await createProvisionalAsset({ query, category });
    if (res.ok && res.asset) {
      onSelect(res.asset);
    } else {
      setError(res.error || "Failed to create provisional asset.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <input
        type="text"
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600 transition-all"
      />

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
          <div className="max-h-60 overflow-y-auto">
            {results.length > 0 ? (
              results.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onSelect(a);
                    setIsOpen(false);
                  }}
                  className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0 group"
                >
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mr-2">{a.brand}</span>
                    <span className="text-sm font-bold text-slate-900">{a.model_name}</span>
                  </div>
                  <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 uppercase group-hover:bg-emerald-500 group-hover:text-white transition-colors">Indexed</span>
                </button>
              ))
            ) : (
              <div className="p-4 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase italic">
                  {query.length > 1 ? "Asset not indexed." : "Browse available assets..."}
                </p>
              </div>
            )}
          </div>
          {query.length > 2 && (
            <button
              type="button"
              onClick={handleProvisional}
              disabled={isSubmitting}
              className="w-full p-3 bg-slate-50 border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-amber-50 hover:text-amber-600 transition-all text-center"
            >
              {isSubmitting ? 'Validating...' : '+ Add unverified asset'}
            </button>
          )}
          {error && <div className="p-2 text-[9px] font-bold text-red-500 bg-red-50 text-center uppercase">{error}</div>}
        </div>
      )}
    </div>
  );
};

const ComparisonPicker: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    setCategories(listCategories());
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(() => {
    // Check if window is defined (client-side)
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('actual_fyi_last_category') as ProductCategory) || 'portable_power_station';
    }
    return 'portable_power_station';
  });
  const router = useRouter();

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as ProductCategory;
    setSelectedCategory(val);
    sessionStorage.setItem('actual_fyi_last_category', val);
  };

  return (
    <section className="w-full max-w-2xl mx-auto px-4">
      <div className="p-8 md:p-12 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
        <h2 className="text-lg font-black uppercase tracking-tighter mb-8 text-slate-900 text-center">Initiate Forensic Audit</h2>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Domain</label>
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600 transition-all appearance-none"
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Asset</label>
            <AssetSelector
              category={selectedCategory}
              onSelect={(asset) => router.push(`/specs/${asset.slug}?autoRun=true`)}
              placeholder={`Search ${categories.find(c => c.id === selectedCategory)?.label}...`}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-6 mt-8">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Forensic Ledger Active
        </p>
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> Cross-Category Protection On
        </p>
      </div>
    </section>
  );
};

export default ComparisonPicker;
