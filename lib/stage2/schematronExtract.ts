import { extractText } from "@/lib/stage2/http";

type ClaimCard = {
  claim: string;
  observed_reality: string;
  conditions?: string | null;
  measurement_type?: string | null;
  confidence?: number | null;
  source_url?: string | null; // filled later if you want
};

type Extracted = {
  claim_cards: ClaimCard[];
};

export async function schematronExtract(html: string): Promise<{ ok: boolean; data?: Extracted; errors?: any }> {
  try {
    const text = extractText(html, 90_000);

    // Extremely simple heuristic: grab sentences that look like specs/measurements.
    // This is not “smart”; it’s deterministic and fast.
    const sentences = text
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 40 && s.length <= 220);

    const signals = [
      "wh", "watt", "watts", "mah", "cycle", "cycles",
      "db", "decibel", "lbs", "kg", "amp", "amps",
      "voltage", "v", "ac", "dc", "solar", "charging",
      "inverter", "surge", "capacity", "runtime", "hours"
    ];

    const candidates = sentences.filter((s) => {
      const lower = s.toLowerCase();
      const hasNumber = /\d/.test(lower);
      const hasSignal = signals.some((k) => lower.includes(k));
      return hasNumber && hasSignal;
    });

    const claim_cards: ClaimCard[] = candidates.slice(0, 18).map((s) => ({
      claim: s,
      observed_reality: "Evidence sentence extracted from source text.",
      conditions: null,
      measurement_type: "text_excerpt",
      confidence: 0.4,
    }));

    // Strict schema enforcement (pilot):
    if (claim_cards.length === 0) {
      return { ok: false, data: { claim_cards: [] }, errors: [{ code: "NO_CLAIMS", message: "No extractable claims found." }] };
    }

    return { ok: true, data: { claim_cards } };
  } catch (e: any) {
    return { ok: false, data: { claim_cards: [] }, errors: [{ code: "EXTRACT_EXCEPTION", message: e?.message ?? String(e) }] };
  }
}
