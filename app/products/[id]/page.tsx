import { getProductPageData } from "@/lib/productPage.server";
import { ProductAuditPanel } from "./ProductAuditPanel";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const data = await getProductPageData(params.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{data.product.model_name}</h1>
        <p className="text-sm opacity-70">
          {data.product.brand} · {data.product.category}
        </p>
      </header>

      {/* Audit Control & Status */}
      <ProductAuditPanel productId={data.product.id} />

      {/* Above the fold */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-2xl border p-5">
          <h2 className="text-xs font-extrabold tracking-widest opacity-70">VERDICT</h2>
          {data.assessment ? (
            <>
              <p className="mt-2 text-lg font-semibold">
                {data.assessment.assessment_json?.verdict ?? "Verified ledger entry"}
              </p>
              {/* Truth Index gating can happen here */}
            </>
          ) : (
            <p className="mt-2 opacity-70">No verified audit yet.</p>
          )}
        </div>

        <div className="rounded-2xl border p-5">
          <h2 className="text-xs font-extrabold tracking-widest opacity-70">COMMUNITY SIGNAL</h2>
          {data.community.latest?.checked_at ? (
            <>
              <p className="mt-2 text-sm opacity-80">
                Activity checked: {new Date(data.community.latest.checked_at).toLocaleDateString()}
              </p>
              <p className="mt-2 text-sm">
                {data.community.latest.activity_level === "none"
                  ? "No notable recent discussion detected."
                  : "Recent community discussion detected."}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm opacity-70">No monitoring snapshot yet.</p>
          )}
        </div>
      </section>

      {/* Ledger */}
      <section className="mt-8 rounded-2xl border p-5">
        <h2 className="text-sm font-bold">Claims vs Reality</h2>
        {/* Render from data.canonical.normalized_json */}
      </section>

      {/* Evidence */}
      <section className="mt-4 rounded-2xl border p-5">
        <h2 className="text-sm font-bold">Evidence used</h2>
        {/* Render sources list */}
      </section>

      {/* Optional audit selector */}
      {
        data.auditsForDropdown.length > 1 && (
          <section className="mt-4 rounded-2xl border p-5">
            <h2 className="text-sm font-bold">Audit version</h2>
            {/* dropdown that links ?runId=... or uses server action */}
          </section>
        )
      }
    </main >
  );
}
