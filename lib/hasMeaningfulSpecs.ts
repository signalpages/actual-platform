/**
 * hasMeaningfulSpecs
 * Single source of truth for determining whether a product's technical_specs
 * has at least one meaningful entry. Handles all known shapes:
 *   1. Array<{ label: string; value: string }>  — standard seeder format
 *   2. Plain object with string/number values    — inverter / nested object format
 *   3. Array of primitives                       — legacy strings
 *
 * CRITICAL: Do NOT use .items.length — technical_specs does NOT have .items.
 */
export function hasMeaningfulSpecs(specs: unknown): boolean {
    if (!specs) return false;

    // Shape 1 & 3: array
    if (Array.isArray(specs)) {
        return specs.some((s) => {
            if (s === null || s === undefined) return false;
            // {label, value} format
            if (typeof s === 'object' && typeof (s as any).label === 'string' && (s as any).label.trim()) {
                return String((s as any).value ?? '').trim().length > 0;
            }
            // primitive in array
            if (typeof s === 'string') return s.trim().length > 0;
            if (typeof s === 'number') return true;
            return false;
        });
    }

    // Shape 2: plain object (nested specs like { continuous_ac_output_w: "3000W", ... })
    if (typeof specs === 'object') {
        return Object.values(specs as Record<string, unknown>).some(
            (v) => v !== null && v !== undefined && String(v).trim().length > 0
        );
    }

    return false;
}
