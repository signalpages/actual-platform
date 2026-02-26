import { ProductCategory } from "@/types";
import { getSchemaIdForCategory } from "./specs/categoryToSchema";
import { getSchema } from "./specs/registry";

export interface ClaimItem {
    label: string;
    value: string;
}

// Keys that are internal metadata and should never be displayed as spec rows
const INTERNAL_KEYS = new Set([
    'spec_sources', 'evidence', 'content_hash', '_meta', 'spec_status',
    'is_expandable', 'expansion_notes', 'max_expansion_wh',
]);

// Values that are meaningless placeholders
const SKIP_VALUES = new Set(['tbd', 'n/a', 'null', 'undefined', 'false', '']);

function isValidValue(val: unknown): boolean {
    if (val === null || val === undefined) return false;
    const str = String(val).trim().toLowerCase();
    return !SKIP_VALUES.has(str);
}

/**
 * Compose a flat, display-ready array of {label, value} from technical_specs.
 *
 * Strategy:
 * 1. If a category schema exists, use it to produce ordered, well-labelled rows
 *    for any fields that have real values.
 * 2. Then append any remaining non-null, non-internal fields NOT covered by the schema.
 * 3. Never show TBD / N/A / placeholder values.
 */
export function composeClaimProfile(specs: any, category: ProductCategory): ClaimItem[] {
    if (!specs) return [];

    // Unwrap JSON string
    let raw = specs;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { return []; }
    }

    // Legacy: array of {label, value} — filter out placeholders and return
    if (Array.isArray(raw)) {
        return raw
            .filter((s: any) => s?.label && isValidValue(s?.value))
            .map((s: any) => ({ label: String(s.label), value: String(s.value) }));
    }

    if (!raw || typeof raw !== 'object') return [];

    const claims: ClaimItem[] = [];
    const usedKeys = new Set<string>();

    // --- Pass 1: Schema-driven (ordered, properly labelled) ---
    const schemaId = getSchemaIdForCategory(category);
    const schema = getSchema(schemaId);

    if (schema) {
        for (const field of schema.fields) {
            // Try primary key then altKeys
            const keysToTry = [field.key, ...(field.altKeys || [])];
            for (const k of keysToTry) {
                const val = raw[k];
                if (!isValidValue(val)) continue;
                usedKeys.add(k);
                // Mark ALL altKeys as used so they don't repeat in pass 2
                (field.altKeys || []).forEach(ak => usedKeys.add(ak));
                usedKeys.add(field.key);

                let displayValue: string;
                if (field.formatter) {
                    try { displayValue = field.formatter(val); } catch { displayValue = String(val); }
                } else if (field.unit) {
                    displayValue = `${val}${field.unit}`;
                } else {
                    displayValue = String(val);
                }
                claims.push({ label: field.label, value: displayValue });
                break; // found this field, move to next schema field
            }
        }
    }

    // --- Pass 2: Any remaining non-internal keys with real values ---
    for (const [key, val] of Object.entries(raw)) {
        if (usedKeys.has(key)) continue;
        if (INTERNAL_KEYS.has(key)) continue;
        if (!isValidValue(val)) continue;
        if (typeof val === 'object') continue; // skip nested objects (e.g. spec_sources array)

        const label = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        claims.push({ label, value: String(val) });
    }

    return claims;
}
