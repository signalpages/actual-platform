import { ProductCategory } from "@/types";
import { getSchemaIdForCategory } from "./specs/categoryToSchema";
import { getSchema, SpecSchema } from "./specs/registry";

export interface ClaimItem {
    label: string;
    value: string;
}

export function composeClaimProfile(specs: any, category: ProductCategory): ClaimItem[] {
    // Guard: if specs is null/undefined
    if (!specs) return [];

    const claims: ClaimItem[] = [];

    // 1. Determine Schema
    const schemaId = getSchemaIdForCategory(category);
    const schema = getSchema(schemaId);

    if (!schema) {
        // Fallback or log error? For now, empty or legacy behavior could go here.
        // But since we want to be data-driven, let's return what we can find if we had a legacy fallback, 
        // or just return empty to fail safe.
        return [];
    }

    // 2. Unwrap specs if needed (handle .kv, .items, or flat)
    let s: Record<string, any> = specs;
    if (specs.kv && typeof specs.kv === 'object' && !Array.isArray(specs.kv)) {
        s = specs.kv;
    } else if (specs.items && Array.isArray(specs.items)) {
        s = {};
        specs.items.forEach((item: any) => {
            if (item?.key && item.value) s[item.key] = item.value;
        });
    }

    // 3. Iterate Schema Fields
    for (const field of schema.fields) {
        // Validation/Lookup
        let rawValue = s[field.key];

        // Try altKeys if main key missing
        if ((rawValue === undefined || rawValue === null || rawValue === '') && field.altKeys) {
            for (const altKey of field.altKeys) {
                const val = s[altKey];
                if (val !== undefined && val !== null && val !== '') {
                    rawValue = val;
                    break;
                }
            }
        }

        // If we found a value, format and add it
        if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
            // Special handling for booleans if needed, or let formatter handle it
            let displayValue = String(rawValue);

            if (field.formatter) {
                displayValue = field.formatter(rawValue);
            } else if (field.unit) {
                // Default formatter if unit exists but no custom formatter
                displayValue = `${rawValue}${field.unit}`;
            }

            claims.push({
                label: field.label,
                value: displayValue
            });
        }
    }

    // If schema-driven approach yielded claims, return them
    if (claims.length > 0) return claims;

    // Generic fallback: flatten any non-empty specs object/array to display pairs.
    // Used when: (a) schema fields don't match stored keys, or (b) all schema fields are empty.
    // Ensures Stage 1 always renders for products that have SOME technical_specs data.
    if (Array.isArray(s)) {
        // Flat {label, value} array (standard seeder format)
        for (const item of s) {
            if (item?.label && String(item?.value ?? '').trim()) {
                claims.push({ label: String(item.label), value: String(item.value) });
            }
        }
    } else if (s && typeof s === 'object') {
        // Plain object: humanize keys and render values
        for (const [key, val] of Object.entries(s)) {
            if (val === null || val === undefined || String(val).trim() === '') continue;
            if (['evidence', 'spec_sources', 'content_hash', '_meta'].includes(key)) continue;
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            claims.push({ label, value: String(val) });
        }
    }

    return claims;
}
