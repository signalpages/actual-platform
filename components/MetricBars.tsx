import React from 'react';

interface MetricBarProps {
    label: string;
    rating: string;
    percentage: number;
}

interface MetricBarsProps {
    metrics: MetricBarProps[];
}

export function MetricBars({ metrics }: MetricBarsProps) {
    if (!metrics || metrics.length === 0) return null;

    return (
        <div className="space-y-3 pb-4 border-b border-slate-200">
            {metrics.map((metric, i) => (
                <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{metric.label}</span>
                        <span className="text-[10px] font-bold text-slate-500">{metric.rating}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${metric.rating === 'High' ? 'bg-emerald-500' :
                                    metric.rating === 'Moderate' ? 'bg-yellow-500' :
                                        'bg-blue-500'
                                }`}
                            style={{ width: `${metric.percentage}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
