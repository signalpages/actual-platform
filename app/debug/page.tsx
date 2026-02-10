import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

function supabaseAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { persistSession: false } });
}

export default async function DebugAuditPage() {
    const sb = supabaseAdmin();

    // Fetch runs with product details
    // Note: Supabase-js doesn't do SQL-like joins easily on 'admin' unless foreign keys are set up perfectly.
    // We'll fetch both and join in memory for simplicity/speed in this debug view.

    const { data: runs, error: runError } = await sb
        .from("audit_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

    if (runError) {
        return <div className="p-10 text-red-600">Error loading runs: {runError.message}</div>;
    }

    // extract product IDs
    const productIds = Array.from(new Set(runs.map((r: any) => r.product_id)));

    const { data: products, error: prodError } = await sb
        .from("products")
        .select("id, brand, model_name, slug")
        .in("id", productIds);

    const productMap = new Map();
    if (products) {
        products.forEach((p: any) => {
            productMap.set(p.id, p);
        });
    }

    // Also fetch shadow specs stats?
    // "Prove results persistence for a done run"
    // Let's check shadow_specs for these products
    const { data: shadows } = await sb
        .from("shadow_specs")
        .select("product_id, created_at, is_verified")
        .in("product_id", productIds);

    const shadowMap = new Map();
    if (shadows) {
        // Group by product_id? Or just take latest?
        // Let's just store "has shadow"
        shadows.forEach((s: any) => {
            shadowMap.set(s.product_id, (shadowMap.get(s.product_id) || 0) + 1);
        });
    }

    return (
        <div className="p-8 max-w-7xl mx-auto font-mono text-sm">
            <h1 className="text-2xl font-bold mb-6">Audit System Debugger</h1>

            <div className="bg-white border rounded shadow overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 border-b">
                            <th className="p-3">Run ID / Age</th>
                            <th className="p-3">Product</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Heartbeat</th>
                            <th className="p-3">Output (Shadows)</th>
                            <th className="p-3">Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {runs.map((run: any) => {
                            const product = productMap.get(run.product_id);
                            const age = Math.round((Date.now() - new Date(run.created_at).getTime()) / 60000);
                            const heartbeatAge = run.last_heartbeat
                                ? Math.round((Date.now() - new Date(run.last_heartbeat).getTime()) / 1000) + 's ago'
                                : 'Never';

                            const shadowCount = shadowMap.get(run.product_id) || 0;

                            return (
                                <tr key={run.id} className="border-b hover:bg-slate-50">
                                    <td className="p-3" title={run.id}>
                                        <span className="font-bold">{run.id.slice(0, 6)}...</span>
                                        <div className="text-xs text-slate-400">
                                            {Math.round((Date.now() - new Date(run.created_at).getTime()) / 60000)} mins ago<br />
                                            <span className="text-[10px]">{run.created_at}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        {product ? (
                                            <div>
                                                <div className="font-bold text-blue-700">{product.brand} {product.model_name}</div>
                                                <div className="text-xs text-slate-400">{product.slug}</div>
                                            </div>
                                        ) : (
                                            <span className="text-red-400">Unknown Product ({run.product_id})</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${run.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                                            run.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                                run.status === 'failed' || run.status === 'error' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-100 text-slate-600'
                                            }`}>
                                            {run.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs">{heartbeatAge}</td>
                                    <td className="p-3">
                                        {shadowCount > 0 ? (
                                            <span className="text-emerald-600 font-bold">Yes ({shadowCount})</span>
                                        ) : (
                                            <span className="text-slate-300">No</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-red-600 max-w-xs break-words text-xs">
                                        {run.error ? JSON.stringify(run.error) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
