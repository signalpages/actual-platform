
import React from 'react';
import ComparisonPicker from '../components/ComparisonPicker';

const Home: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full mb-6">
           <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Forensic Power Station Audit V1.0</p>
        </div>
        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter text-slate-900 leading-[0.85] mb-8">
          The Watts They<br />
          <span className="text-slate-400">Quietly Normalize.</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
          Actual.fyi preserves technical integrity by cross-referencing portable power station claims 
          against real-world discharge tests, owner troubleshooting logs, and FCC technical filings.
        </p>
      </div>

      <ComparisonPicker />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 border-t border-slate-100 pt-20">
        <div className="group p-2 rounded-[2.2rem] hover:bg-slate-900 transition-all duration-500">
          <div className="bg-white border border-slate-200 p-10 rounded-[2rem] shadow-sm group-hover:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 group-hover:text-blue-500 transition-colors">Integrity Node 01</p>
            <p className="text-4xl font-black text-slate-900 mb-4">Indexed</p>
            <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
              "Power station assets undergo a 72-point forensic normalization before being listed as 'Verified' in our ledger."
            </p>
          </div>
        </div>
        <div className="group p-2 rounded-[2.2rem] hover:bg-slate-900 transition-all duration-500">
          <div className="bg-white border border-slate-200 p-10 rounded-[2rem] shadow-sm group-hover:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 group-hover:text-blue-500 transition-colors">Integrity Node 02</p>
            <p className="text-4xl font-black text-blue-600 mb-4">Synthesized</p>
            <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
              "Unverified assets are synthesized live from community signals. High variance is expected until peer review is complete."
            </p>
          </div>
        </div>
        <div className="group p-2 rounded-[2.2rem] hover:bg-slate-900 transition-all duration-500">
          <div className="bg-white border border-slate-200 p-10 rounded-[2rem] shadow-sm group-hover:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 group-hover:text-blue-500 transition-colors">Integrity Node 03</p>
            <p className="text-4xl font-black text-slate-900 mb-4">Forensic</p>
            <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
              "Default to curated truth; allow explicit uncertainty. We prioritize technical reality over consumer hype cycles."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
