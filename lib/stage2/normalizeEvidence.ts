import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

function canonicalizeClaim(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s%°\-./]/g, "")
    .trim()
    .slice(0, 180);
}

export async function normalizeEvidence(runId: string) {
  const sb = supabaseAdmin();
  const { data: chunks, error } = await sb
    .from("evidence_chunks")
    .select("source_url, extracted_json, is_valid")
    .eq("audit_run_id", runId);

  if (error) throw new Error(error.message);

  const valid = (chunks ?? []).filter((c) => c.is_valid && c.extracted_json?.claim_cards?.length);

  const source_count = new Set(valid.map((v) => v.source_url)).size;

  const byKey = new Map<string, { key: string; count: number; citations: string[]; samples: string[] }>();

  for (const c of valid) {
    const cards = c.extracted_json.claim_cards as any[];
    for (const card of cards) {
      const raw = String(card?.claim || "");
      const key = canonicalizeClaim(raw);
      if (!key) continue;

      const rec = byKey.get(key) ?? { key, count: 0, citations: [], samples: [] };
      rec.count += 1;
      rec.citations.push(c.source_url);
      if (rec.samples.length < 2) rec.samples.push(raw);
      byKey.set(key, rec);
    }
  }

  // Pilot rule: require corroboration by >=2 mentions (not perfect, but deterministic)
  const merged = Array.from(byKey.values())
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const claim_count = merged.length;

  return {
    source_count,
    claim_count,
    claims: merged.map((m) => ({
      claim_key: m.key,
      frequency: m.count,
      citations: Array.from(new Set(m.citations)),
      samples: m.samples,
    })),
  };
}
