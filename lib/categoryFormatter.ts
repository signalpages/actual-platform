import { ProductCategory, CATEGORY_LABELS } from '../types';

/**
 * Format category slug to human-readable label
 * Falls back to title-cased slug if not found in map
 */
export function formatCategoryLabel(category: string | ProductCategory): string {
    // Try to get from CATEGORY_LABELS map
    if (category in CATEGORY_LABELS) {
        return CATEGORY_LABELS[category as ProductCategory];
    }

    // Fallback: convert snake_case to Title Case
    return category
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
