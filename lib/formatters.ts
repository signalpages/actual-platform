
/**
 * specific label mappings for known keys
 */
export const LABEL_OVERRIDES: Record<string, string> = {
    'solar_input_max_w': 'Solar Input',
    'solar_input_w': 'Solar Input',
    'storage_capacity_wh': 'Battery Capacity',
    'continuous_ac_output_w': 'AC Output',
    'continuous_ac_output': 'AC Output',
    'peak_surge_output_w': 'Surge Output',
    'peak_surge_output': 'Surge Output',
    'cell_chemistry': 'Battery Chemistry',
    'battery_chemistry': 'Battery Chemistry',
    'cycle_life_cycles': 'Cycle Life',
    'cycle_life': 'Cycle Life',
    'ac_charging_speed': 'Recharge Speed',
    'weight_kg': 'Weight',
    'weight_lbs': 'Weight',
    'warranty_years': 'Warranty',
    'operating_temp': 'Operating Temp',
    'dimensions': 'Dimensions'
};

/**
 * Format a raw key (snake_case) into a Human Readable Label (Title Case)
 * Handles unit suffixes like _wh, _w, _kg etc.
 */
export function formatLabel(key: string): string {
    if (!key) return '';

    // 1. Check overrides first
    if (LABEL_OVERRIDES[key]) {
        return LABEL_OVERRIDES[key];
    }

    // 2. Generic formatting
    let label = key
        .replace(/_/g, ' ')
        .replace(/\bwh\b/i, '(Wh)')
        .replace(/\bw\b/i, '(W)')
        .replace(/\bkg\b/i, '(kg)')
        .replace(/\blbs\b/i, '(lbs)')
        .replace(/\bmm\b/i, '(mm)');

    // Capitalize words
    label = label.replace(/\b\w/g, c => c.toUpperCase());

    // Clean up "Is " prefix for booleans
    if (label.startsWith('Is ')) label = label.substring(3);

    return label.trim();
}
