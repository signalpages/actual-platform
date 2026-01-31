
import React from 'react';

interface SuccessProps {
  variant?: 1 | 2 | 3;
  onReset?: () => void;
}

const SubmissionSuccess: React.FC<SuccessProps> = ({ variant = 1, onReset }) => {
  const messages = {
    1: {
      title: "Contribution Received",
      body: "Your submission has been logged. Our editorial team will review the provided data points as part of our verification protocol. We prioritize technical accuracy over update speed."
    },
    2: {
      title: "Report Queued",
      body: "Thank you for the submission. We have added your report to our review queue. All information is clinically cross-referenced against multiple forensic sources before the Ledger is updated."
    },
    3: {
      title: "Data Logged",
      body: "Thank you. We have received your report. Our maintenance cycle includes a thorough review of all submitted signals to ensure the continued integrity of our technical index."
    }
  };

  const { title, body } = messages[variant];

  return (
    <div className="bg-white border border-slate-200 p-10 rounded-[2.5rem] shadow-sm animate-in fade-in zoom-in-95 duration-300">
      <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 mb-3">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-8">{body}</p>
      {onReset && (
        <button 
          onClick={onReset}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
        >
          ← Return to Form
        </button>
      )}
    </div>
  );
};

export default SubmissionSuccess;
