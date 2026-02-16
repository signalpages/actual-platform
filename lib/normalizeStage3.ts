/**
 * Deterministic Stage 3 Normalization
 * Deduplicates, canonicalizes, and tags audit entries
 * Produces stable inputs for Stage 4 scoring
 */

// ── Types ──────────────────────────────────────────────

export type Severity = "minor" | "moderate" | "severe";

export type ScoringBucket = "claims_accuracy" | "real_world_fit" | "operational_noise";

export interface NormalizedEntry {
    key: string;
    claim: string;
    reality: string;
    impact: string;
    severity: Severity;
    tags: ScoringBucket[];
}

export interface NormalizedStage3 {
    entries: NormalizedEntry[];
    totalCount: number;
    uniqueCount: number;
}

export interface BaseScores {
    claimsAccuracy: number;
    realWorldFit: number;
    operationalNoise: number;
}

// ── Keyword Buckets ────────────────────────────────────

const BUCKET_KEYWORDS: Record<ScoringBucket, string[]> = {
    operational_noise: [
        "connectivity", "app", "firmware", "bluetooth", "wifi",
        "software", "pairing", "disconnect", "update", "sync",
        "noise", "fan", "loud", "decibel", "db"
    ],
    real_world_fit: [
        "weight", "portab", "setup", "compatib", "voltage",
        "dimension", "size", "bulk", "transport", "placement",
        "proprietary", "cable", "expansion", "ecosystem"
    ],
    claims_accuracy: [
        "spec", "mismatch", "runtime", "watt", "wh", "charging",
        "capacity", "output", "input", "efficiency", "cycle",
        "rated", "actual", "advertised", "claimed"
    ]
};

// ── Helpers ────────────────────────────────────────────

function normalize(text: string): string {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeSeverity(raw: string | undefined): Severity {
    const s = (raw || "").toLowerCase().trim();
    if (s === "severe" || s === "high" || s === "critical") return "severe";
    if (s === "moderate" || s === "medium" || s === "med") return "moderate";
    return "minor";
}

function deriveKey(claim: string, reality: string, impact: string): string {
    const normClaim = normalize(claim);
    const normReality = normalize(reality);
    if (normClaim && normReality) return `${normClaim}::${normReality}`;
    if (normClaim && impact) return `${normClaim}::${normalize(impact)}`;
    return normClaim || normalize(impact) || "unknown";
}

function assignBuckets(entry: { claim: string; reality: string; impact: string }): ScoringBucket[] {
    const combined = [entry.claim, entry.reality, entry.impact]
        .join(" ")
        .toLowerCase();

    const tags: ScoringBucket[] = [];

    for (const [bucket, keywords] of Object.entries(BUCKET_KEYWORDS) as [ScoringBucket, string[]][]) {
        if (keywords.some(kw => combined.includes(kw))) {
            tags.push(bucket);
        }
    }

    // Default to claims_accuracy if no bucket matched
    if (tags.length === 0) {
        tags.push("claims_accuracy");
    }

    return tags;
}

// ── Main Normalizer ────────────────────────────────────

export function normalizeStage3(raw: any): NormalizedStage3 {
    if (!raw || typeof raw !== "object") {
        return { entries: [], totalCount: 0, uniqueCount: 0 };
    }

    // Prefer red_flags as the canonical source; discrepancies is derived
    const candidates: any[] = Array.isArray(raw.red_flags) ? raw.red_flags : [];
    const totalCount = candidates.length;

    // Deduplicate using Map (first occurrence wins)
    const seen = new Map<string, NormalizedEntry>();

    for (const item of candidates) {
        const claim = String(item.claim || item.issue || "").trim();
        const reality = String(item.reality || item.description || "").trim();
        const rawImpact = String(item.impact || "").trim();
        const impact = rawImpact ? rawImpact.replace(/\.?$/, '.') : "";
        const severity = normalizeSeverity(item.severity);

        if (!claim && !reality) continue; // Skip completely empty entries

        // FALSE POSITIVE FILTER: Add-on misconceptions
        // If the issue mentions capacity AND add-ons, it's likely the AI confusing an optional battery for the main unit.
        const combinedText = (claim + " " + reality + " " + impact).toLowerCase();
        const isCapacityIssue = combinedText.includes('capacity') || combinedText.includes('wh');
        const isAddonContext = combinedText.includes('add-on') || combinedText.includes('expansion') || combinedText.includes('extra battery') || combinedText.includes('shelf');

        if (isCapacityIssue && isAddonContext) {
            // Skip this entry entirely
            continue;
        }

        const key = deriveKey(claim, reality, impact);

        if (seen.has(key)) continue; // Dedup: skip duplicates

        const entry: NormalizedEntry = {
            key,
            claim,
            reality,
            impact,
            severity,
            tags: assignBuckets({ claim, reality, impact })
        };

        seen.set(key, entry);
    }

    const entries = Array.from(seen.values());

    return {
        entries,
        totalCount,
        uniqueCount: entries.length
    };
}

// ── Deterministic Scoring ──────────────────────────────

const SEVERITY_PENALTY: Record<Severity, number> = {
    severe: 15,
    moderate: 10,
    minor: 5
};

function ratingLabel(score: number): "High" | "Moderate" | "Low" {
    if (score >= 85) return "High";
    if (score >= 60) return "Moderate";
    return "Low";
}

export function computeBaseScores(entries: NormalizedEntry[]): BaseScores {
    // Per-bucket scores: start at 100, deduct only from relevant entries
    const bucketScores: Record<ScoringBucket, number> = {
        claims_accuracy: 100,
        real_world_fit: 100,
        operational_noise: 100
    };

    for (const e of entries) {
        const penalty = SEVERITY_PENALTY[e.severity];
        for (const tag of e.tags) {
            bucketScores[tag] -= penalty;
        }
    }

    // Clamp all
    for (const k of Object.keys(bucketScores) as ScoringBucket[]) {
        bucketScores[k] = Math.max(0, Math.min(100, bucketScores[k]));
    }

    return {
        claimsAccuracy: bucketScores.claims_accuracy,
        realWorldFit: bucketScores.real_world_fit,
        operationalNoise: bucketScores.operational_noise
    };
}

export function buildMetricBars(scores: BaseScores) {
    return [
        {
            label: "Claims Accuracy",
            rating: ratingLabel(scores.claimsAccuracy),
            percentage: scores.claimsAccuracy
        },
        {
            label: "Real-World Fit",
            rating: ratingLabel(scores.realWorldFit),
            percentage: scores.realWorldFit
        },
        {
            label: "Operational Noise",
            rating: ratingLabel(scores.operationalNoise),
            percentage: scores.operationalNoise
        }
    ];
}
