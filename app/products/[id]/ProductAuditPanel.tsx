"use client";

import { useAuditRun } from "@/lib/hooks/useAuditRun";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ProductAuditPanel({ productId }: { productId: string }) {
    const router = useRouter();
    const { isLive, isStarting, start, run, clear } = useAuditRun(productId);
    const [hasRefreshed, setHasRefreshed] = useState(false);

    // Auto-refresh when run completes
    useEffect(() => {
        // If we were live, and now we are done/complete/error, we should refresh
        // Note: useAuditRun handles persistence. When it detects done, it sets isLive=false
        // We need to catch the transition or just check status.
        if (run?.status === "done" || run?.status === "complete" || run?.status === "error") {
            if (!hasRefreshed) {
                setHasRefreshed(true);
                clear(); // Clear session storage so we don't loop or show old status
                router.refresh(); // Refresh server components
            }
        }
    }, [run?.status, hasRefreshed, clear, router]);

    // If live, show banner
    if (isLive) {
        return (
            <div className="mb-6 rounded-lg bg-blue-50 border border-blue-100 p-4 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <p className="text-sm text-blue-700 font-medium">
                        Live Audit in Progress {run?.id ? `(Run ID: ${run.id.slice(0, 8)}...)` : ""} — Results will update automatically.
                    </p>
                </div>
                {/* Optional: Add a spinner or stage info if available in 'run' */}
            </div>
        );
    }

    // If idle, show button
    // We only show button if NOT live.
    return (
        <div className="mb-6 flex justify-end">
            <button
                onClick={start}
                disabled={isStarting}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
                {isStarting ? "Starting..." : "Run Audit"}
            </button>
        </div>
    );
}
