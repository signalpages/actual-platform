/**
 * hasMeaningfulSpecs
 * Single source of truth for determining whether a product's technical_specs
 * array has at least one meaningful entry. Used across ProductDetailView,
 * AuditResults, and any component that gates Stage 1 rendering.
 *
 * IMPORTANT: technical_specs is Array<{ label: string; value: string }>.
 * It is NOT { items: [] }. Do not use .items.length.
 */
export function hasMeaningfulSpecs(specs: unknown): boolean {
    if (!Array.isArray(specs)) return false;
    return specs.some(
        (s) =>
            s !== null &&
            s !== undefined &&
            typeof (s as any).label === 'string' &&
            (s as any).label.trim().length > 0 &&
            String((s as any).value ?? '').trim().length > 0
    );
}
