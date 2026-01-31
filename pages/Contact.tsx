
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SubmissionSuccess from '../components/SubmissionSuccess';

const Contact: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-16">
        <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-500 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest mb-6">Editorial Protocol</div>
        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-tight mb-4">Contact</h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl">
          The most effective way to reach Actual.fyi is by contributing to the accuracy of the index. We prioritize corrections and technical reports that improve the forensic integrity of our Ledger.
        </p>
      </header>

      {submitted ? (
        <div className="max-w-xl">
          <SubmissionSuccess variant={2} onReset={() => setSubmitted(false)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
            <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
              Submit a Report
            </h2>
            <div className="space-y-4">
              <textarea 
                placeholder="Describe the discrepancy or tool missing from the ledger..." 
                className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 transition-all resize-none"
              ></textarea>
              <button 
                onClick={() => setSubmitted(true)}
                className="w-full bg-slate-900 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
              >
                Submit Correction
              </button>
            </div>
            <p className="text-[9px] text-slate-400 mt-6 leading-relaxed italic">
              Use cases: Broken links, outdated info, incorrect specs, or missing assets.
            </p>
          </section>

          <section className="space-y-8">
            <div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Submission Guidelines</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                To ensure precision, please include the specific page URL, a detailed description of the discrepancy, and links to supporting technical documentation where applicable.
              </p>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Communication Expectations</h3>
              <p className="text-sm text-slate-500 leading-relaxed italic">
                All submissions are reviewed by our editorial team. Every report is evaluated for its impact on the Ledger's overall reliability.
              </p>
            </div>

            <div className="pt-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Editorial Registry</p>
              <p className="text-sm font-bold text-slate-900">forensics@actual.fyi</p>
            </div>
          </section>
        </div>
      )}

      <div className="border-t border-slate-100 pt-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-xs font-medium text-slate-400 italic">
          Framework for information integrity and technical maintenance.
        </p>
        <Link to="/specs" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-slate-900 transition-colors">
          Return to Spec Ledger →
        </Link>
      </div>
    </div>
  );
};

export default Contact;
