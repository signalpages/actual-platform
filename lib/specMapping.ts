// lib/specMapping.ts

export const CANONICAL_CLAIM_PROFILE = [
  "Storage Capacity",
  "Continuous AC Output",
  "Peak Surge Output",
  "Cell Chemistry",
  "Cycle Life Rating",
  "AC Charging Speed",
  "Solar Input (Max)",
  "UPS/EPS Protocol",
  "Expansion Capacity",
  "Thermal Operating Range",
] as const;

export const CANONICAL_REALITY_LEDGER = [
  "Measured Discharge Wh",
  "Observed Efficiency %",
  "Stable Output Threshold",
  "Thermal Cut-off Point",
  "Software Reserve Behavior",
  "Measured Noise Level (dB)",
] as const;

export type CanonicalClaimKey = (typeof CANONICAL_CLAIM_PROFILE)[number];
export type CanonicalRealityKey = (typeof CANONICAL_REALITY_LEDGER)[number];

export type Evidence = { title?: string; url?: string; quote?: string };

export type CanonicalRow = {
  key: string; // canonical label
  value: string;
  conditions?: string;
  evidence?: Evidence[];
  status: "ok" | "missing" | "conflict" | "provisional";
  confidence?: number; // 0..1 optional
};

export type CanonicalSpec = {
  claim_profile_rows: CanonicalRow[];
  reality_ledger_rows: CanonicalRow[];
  unmapped?: {
    claim_profile?: any[];
    reality_ledger?: any[];
  };
};

/**
 * V1 deterministic mapping:
 * - Accepts messy AI output shapes
 * - Produces invariant rows aligned to canonical arrays
 * - Never throws; always returns full row coverage
 */
export function mapToCanonicalSpec(rawAudit: any): CanonicalSpec {
  const claimCandidates = extractCandidates(rawAudit, "claim");
  const realityCandidates = extractCandidates(rawAudit, "reality");

  const mappedClaims = mapBucket(
    claimCandidates,
    CANONICAL_CLAIM_PROFILE as readonly string[],
    buildClaimAliases()
  );

  const mappedReality = mapBucket(
    realityCandidates,
    CANONICAL_REALITY_LEDGER as readonly string[],
    buildRealityAliases()
  );

  return {
    claim_profile_rows: mappedClaims.rows,
    reality_ledger_rows: mappedReality.rows,
    unmapped: {
      claim_profile: mappedClaims.unmapped,
      reality_ledger: mappedReality.unmapped,
    },
  };
}

/* -------------------------- internals -------------------------- */

type Candidate = {
  label: string;
  value?: any;
  conditions?: string;
  evidence?: Evidence[] | any[];
  confidence?: number;
  source?: string;
  _raw?: any;
};

function extractCandidates(raw: any, bucket: "claim" | "reality"): Candidate[] {
  // Try common keys in order of likelihood; accept arrays or maps
  const keys =
    bucket === "claim"
      ? ["claim_profile", "claimProfile", "claims", "specs", "profile"]
      : ["reality_ledger", "realityLedger", "reality", "measured", "ledger"];

  // dig shallowly: raw, raw.forensic, raw.summary, raw.data
  const roots = [raw, raw?.forensic, raw?.summary, raw?.data].filter(Boolean);

  for (const root of roots) {
    for (const k of keys) {
      const v = root?.[k];
      const out = normalizeToCandidates(v);
      if (out.length) return out;
    }
  }

  // last resort: look for arrays that "smell" like rows
  const out = normalizeToCandidates(raw);
  return out;
}

function normalizeToCandidates(v: any): Candidate[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (!x) return null;
        if (typeof x === "string") return { label: x, value: "" } as Candidate;
        if (typeof x === "object") {
          const label =
            x.label ?? x.key ?? x.name ?? x.field ?? x.metric ?? x.title;
          const value = x.value ?? x.val ?? x.claim ?? x.observed ?? x.result;
          if (!label) return null;
          return {
            label: String(label),
            value,
            conditions: asString(x.conditions ?? x.when ?? x.context),
            evidence: normalizeEvidence(x.evidence ?? x.sources ?? x.citations),
            confidence: asNumber(x.confidence ?? x.conf),
            source: asString(x.source),
            _raw: x,
          } as Candidate;
        }
        return null;
      })
      .filter(Boolean) as Candidate[];
  }

  if (typeof v === "object") {
    // map -> candidates
    const entries = Object.entries(v);
    // If it looks like a single row object, treat it as one candidate
    if (
      "label" in v ||
      "key" in v ||
      "name" in v ||
      "field" in v ||
      "metric" in v
    ) {
      return normalizeToCandidates([v]);
    }
    return entries.map(([label, value]) => ({
      label,
      value,
      conditions: undefined,
      evidence: undefined,
      confidence: undefined,
      _raw: { label, value },
    }));
  }

  return [];
}

function normalizeEvidence(v: any): Evidence[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) {
    const ev = v
      .map((x) => {
        if (!x) return null;
        if (typeof x === "string") return { url: x } as Evidence;
        if (typeof x === "object")
          return {
            title: asString(x.title ?? x.name),
            url: asString(x.url ?? x.link),
            quote: asString(x.quote ?? x.excerpt),
          } as Evidence;
        return null;
      })
      .filter(Boolean) as Evidence[];
    return ev.length ? ev : undefined;
  }
  if (typeof v === "string") return [{ url: v }];
  return undefined;
}

function mapBucket(
  candidates: Candidate[],
  canon: readonly string[],
  aliasMap: Record<string, string[]>
): { rows: CanonicalRow[]; unmapped: Candidate[] } {
  const picked: Record<string, Candidate> = {};
  const used = new Set<Candidate>();
  const unmapped: Candidate[] = [];

  for (const cand of candidates) {
    const match = matchCanonical(cand.label, canon, aliasMap);
    if (!match) {
      unmapped.push(cand);
      continue;
    }

    const prev = picked[match];
    if (!prev) {
      picked[match] = cand;
      used.add(cand);
      continue;
    }

    // collision: keep better candidate (evidence quality + confidence)
    if (candidateScore(cand) > candidateScore(prev)) {
      picked[match] = cand;
      used.add(cand);
    } else {
      used.add(prev);
    }
  }

  const rows: CanonicalRow[] = canon.map((key) => {
    const cand = picked[key];
    if (!cand) {
      return {
        key,
        value: "—",
        status: "missing",
      };
    }

    const formatted = formatValue(cand.value);
    return {
      key,
      value: formatted || "—",
      conditions: cand.conditions,
      evidence: cand.evidence,
      status: formatted ? "ok" : "provisional",
      confidence: cand.confidence,
    };
  });

  // mark conflicts (multiple mapped to same key) by scanning duplicates in unmapped candidates
  // V1: keep it simple—conflict detection is optional. If you want it, we can upgrade later.

  return { rows, unmapped };
}

function candidateScore(c: Candidate): number {
  const evCount = Array.isArray(c.evidence) ? c.evidence.length : 0;
  const conf = typeof c.confidence === "number" ? c.confidence : 0;
  const hasNumeric = looksNumeric(c.value) ? 1 : 0;
  return evCount * 3 + conf * 5 + hasNumeric * 2;
}

function matchCanonical(
  label: string,
  canon: readonly string[],
  aliasMap: Record<string, string[]>
): string | null {
  const norm = normalize(label);

  // 1) direct canonical match
  for (const key of canon) {
    if (normalize(key) === norm) return key;
  }

  // 2) alias match (strong)
  for (const key of canon) {
    const aliases = aliasMap[key] || [];
    for (const a of aliases) {
      const na = normalize(a);
      if (na === norm) return key;
      if (norm.includes(na) || na.includes(norm)) return key;
    }
  }

  // 3) fuzzy token overlap (weak, thresholded)
  let best: { key: string; score: number } | null = null;
  const tokens = tokenSet(norm);
  for (const key of canon) {
    const keyTokens = tokenSet(normalize(key));
    const overlap = intersectionSize(tokens, keyTokens);
    const score = overlap / Math.max(1, keyTokens.size);
    if (!best || score > best.score) best = { key, score };
  }
  if (best && best.score >= 0.5) return best.key;

  return null;
}

function buildClaimAliases(): Record<string, string[]> {
  return {
    "Storage Capacity": [
      "capacity",
      "battery capacity",
      "rated capacity",
      "watt hours",
      "wh",
    ],
    "Continuous AC Output": [
      "continuous output",
      "rated output",
      "ac output",
      "inverter rating",
      "continuous watts",
    ],
    "Peak Surge Output": ["surge output", "peak watts", "surge watts", "peak w"],
    "Cell Chemistry": ["chemistry", "cell type", "lifepo4", "nmc", "lfp"],
    "Cycle Life Rating": ["cycle life", "cycles", "cycle rating"],
    "AC Charging Speed": ["ac charge", "wall charge", "charging speed", "ac input"],
    "Solar Input (Max)": ["solar input", "max solar", "pv input", "solar watts"],
    "UPS/EPS Protocol": ["ups", "eps", "pass-through", "ups mode", "eps mode"],
    "Expansion Capacity": ["expandable", "expansion", "extra battery", "battery expansion"],
    "Thermal Operating Range": ["operating temp", "temperature range", "thermal range"],
  };
}

function buildRealityAliases(): Record<string, string[]> {
  return {
    "Measured Discharge Wh": [
      "measured discharge",
      "usable wh",
      "delivered wh",
      "measured capacity",
      "output wh",
    ],
    "Observed Efficiency %": [
      "efficiency",
      "observed efficiency",
      "round trip efficiency",
      "ac efficiency",
    ],
    "Stable Output Threshold": [
      "stable output",
      "sustained output",
      "derate point",
      "thermal derate threshold",
    ],
    "Thermal Cut-off Point": ["thermal cutoff", "shutoff temp", "overheat shutoff"],
    "Software Reserve Behavior": [
      "software reserve",
      "hidden reserve",
      "reserve behavior",
      "battery reserve",
    ],
    "Measured Noise Level (dB)": ["noise", "db", "measured noise", "fan noise"],
  };
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(formatValue).filter(Boolean).join(", ");
  if (typeof v === "object") {
    // common shapes like { value: "X", unit: "W" }
    const value = (v.value ?? v.val ?? v.amount ?? v.number) as any;
    const unit = (v.unit ?? v.units) as any;
    const s = [formatValue(value), formatValue(unit)].filter(Boolean).join(" ");
    return s || JSON.stringify(v);
  }
  return String(v);
}

function normalize(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[%]/g, " percent ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(Boolean));
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function asString(v: any): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function asNumber(v: any): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function looksNumeric(v: any): boolean {
  if (typeof v === "number") return true;
  if (typeof v === "string") return /^\s*\d+(\.\d+)?\s*$/.test(v);
  return false;
}
