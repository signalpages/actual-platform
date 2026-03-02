import React from 'react';

interface PurchaseLink {
    label: string;
    url: string;
}

interface PurchaseOptionsProps {
    links: PurchaseLink[];
}

export const PurchaseOptions: React.FC<PurchaseOptionsProps> = ({ links }) => {
    if (!links || links.length === 0) return null;

    return (
        <div className="mt-8 pt-8 border-t border-slate-100">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                Purchase Options
            </h3>

            <div className="flex flex-wrap gap-3">
                {links.map((link, idx) => (
                    <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="nofollow sponsored"
                        className="inline-flex items-center bg-slate-50 border border-slate-200 hover:border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 transition-all group"
                    >
                        {link.label}
                        <span className="ml-2 text-slate-300 group-hover:text-blue-400 transition-colors">↗</span>
                    </a>
                ))}
            </div>

            <p className="mt-4 text-[9px] text-slate-400 font-medium italic">
                Actual.fyi may earn an affiliate commission from purchases made through these links.
            </p>
        </div>
    );
};
