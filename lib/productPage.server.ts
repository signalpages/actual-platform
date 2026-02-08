import { createClient } from "@supabase/supabase-js";

function sbAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type ProductPageData = {
  product: any;
  auditRun: any | null;
  canonical: any | null;
  assessment: any | null;
  community: {
    latest: any | null;
    items: any[];
  };
  auditsForDropdown: Array<{
    run_id: string;
    created_at: string;
    source_kind?: string | null;
    version_label?: string | null;
    source_url?: string | null;
    is_current?: boolean;
  }>;
  activeRun: any | null;
};

export async function getProductPageData(productId: string): Promise<ProductPageData> {
  const sb = sbAdmin();

  // 1) product
  const { data: product, error: pErr } = await sb
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();
  if (pErr || !product) throw new Error(pErr?.message ?? "PRODUCT_NOT_FOUND");

  // 2) candidate runs: last few
  const { data: runs } = await sb
    .from("audit_runs")
    .select("id, status, created_at, finished_at, source_artifact_id")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(25);

  const currentId = product.current_audit_run_id as string | null;

  // helper: fetch canonical+assessment for a run
  async function loadRun(runId: string) {
    const [{ data: canonical }, { data: assessment }] = await Promise.all([
      sb.from("canonical_specs").select("*").eq("audit_run_id", runId).maybeSingle(),
      sb.from("audit_assessments").select("*").eq("audit_run_id", runId).maybeSingle(),
    ]);

    // payload gate: “empty results are illegal”
    const ok =
      !!canonical?.normalized_json &&
      (canonical?.claim_count ?? 0) >= 5 &&
      (canonical?.source_count ?? 0) >= 3 &&
      !!assessment?.assessment_json;

    return { canonical, assessment, ok };
  }

  // 3) choose authoritative run
  let auditRun: any | null = null;
  let canonical: any | null = null;
  let assessment: any | null = null;

  // Requirement:
  // if (latestRun.status === 'running') { show cached audit + progress banner }
  // else if (latestSuccess) { show cached audit }
  // else if (latestRun.status === 'failed') { show failure state }
  // else { show empty state }

  const latestRun = runs?.[0]; // runs are ordered by created_at desc
  const latestSuccess = runs?.find(r => r.status === "complete" || r.status === "done");

  let displayedRunCandidate = latestRun;

  if (latestRun?.status === "running" || latestRun?.status === "pending") {
    // Show cached if available
    if (latestSuccess) {
      displayedRunCandidate = latestSuccess;
    }
    // If no success, we display the running one (which will result in empty/progress state in UI)
  } else if (latestSuccess) {
    // If we have a success, and latest is NOT running (e.g. it's failed, or it IS the success), show success.
    displayedRunCandidate = latestSuccess;
  } else if (latestRun?.status === "failed" || latestRun?.status === "error") {
    // No success available, latest failed. Show failure.
    displayedRunCandidate = latestRun;
  } else {
    // Empty state
    displayedRunCandidate = null;
  }

  if (displayedRunCandidate) {
    // We perform the load check.
    // If existing code already does `loadRun`, we can reuse it, but we need to match it to `displayedRunCandidate.id`.
    const loaded = await loadRun(displayedRunCandidate.id);
    if (loaded.ok || displayedRunCandidate.status === "failed" || displayedRunCandidate.status === "error" || displayedRunCandidate.status === "running" || displayedRunCandidate.status === "pending") {
      // We accept it even if !ok if we are just showing status? 
      // But `loadRun` returns `ok` only if canonical exists.
      // If we are showing "failure" or "running", canonical might be null.
      auditRun = displayedRunCandidate;
      canonical = loaded.canonical;
      assessment = loaded.assessment;
    }
  }

  // 4) dropdown list (optional): include artifact metadata if you added it
  let auditsForDropdown: ProductPageData["auditsForDropdown"] = [];
  if (runs?.length) {
    // join artifacts (if table exists)
    const artifactIds = runs.map(r => r.source_artifact_id).filter(Boolean);
    let artifactsById = new Map<string, any>();
    if (artifactIds.length) {
      const { data: artifacts } = await sb
        .from("source_artifacts")
        .select("id, kind, version_label, url")
        .in("id", artifactIds as string[]);
      (artifacts ?? []).forEach(a => artifactsById.set(a.id, a));
    }

    auditsForDropdown = runs
      .filter(r => r.status === "complete")
      .slice(0, 10)
      .map(r => {
        const a = r.source_artifact_id ? artifactsById.get(r.source_artifact_id) : null;
        return {
          run_id: r.id,
          created_at: r.created_at,
          source_kind: a?.kind ?? null,
          version_label: a?.version_label ?? null,
          source_url: a?.url ?? null,
          is_current: currentId ? r.id === currentId : false,
        };
      });
  }

  // 5) community latest + items (new pipeline you’re building)
  const { data: communityLatest } = await sb
    .from("community_latest")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  let items: any[] = [];
  if (communityLatest?.last_run_id) {
    const { data: rows } = await sb
      .from("community_items")
      .select("source, source_domain, url, title, published_at")
      .eq("community_run_id", communityLatest.last_run_id)
      .order("published_at", { ascending: false })
      .limit(8);
    items = rows ?? [];
  }

  return {
    product,
    auditRun,
    canonical,
    assessment,
    community: { latest: communityLatest ?? null, items },
    auditsForDropdown,
    activeRun: (latestRun?.status === "running" || latestRun?.status === "pending") ? latestRun : null,
  };
}
