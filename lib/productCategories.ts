/**
 * Product category taxonomy
 * 10 categories - enough to prevent nonsense comparisons, not so many that seeding is chaos
 */


export const PRODUCT_CATEGORIES = [
    'portable_power_station',
    'solar_panel',
    'inverter',
    'charge_controller',
    'home_backup_system',
    'ev_charger'
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

/**
 * Category descriptions for UI
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    'Portable Power Stations': 'Battery-powered generators (Jackery, EcoFlow, Bluetti, etc.)',
    'Solar Panels': 'Photovoltaic panels for solar energy generation',
    'Inverters': 'Convert DC to AC power (grid-tie, off-grid, hybrid)',
    'Charge Controllers': 'MPPT and PWM solar charge controllers',
    'Home Backup Systems': 'Solar Backup Batteries (Powerwall-style)',
    'EV Chargers': 'Electric vehicle charging stations (Level 2, etc.)'
};

/**
 * Auto-categorize a product based on model name
 */
export function autoCategorizeby(modelName: string): ProductCategory {
    const name = modelName.toLowerCase();

    // Portable Power Stations
    if (/explorer|delta|river|bluetti (ac|eb|ep)|yeti|solix|jackery|ecoflow|anker.*f\d{4}|vtoman/i.test(name)) {
        return 'portable_power_station';
    }

    // Solar Panels
    if (/panel|pv|mono|bifacial|watt solar|w solar|photovoltaic/i.test(name)) {
        return 'solar_panel';
    }

    // Inverters
    if (/inverter|hybrid inverter|grid-tie|microinverter|string inverter/i.test(name)) {
        return 'inverter';
    }

    // Charge Controllers
    if (/mppt|pwm|charge controller|solar controller/i.test(name)) {
        return 'charge_controller';
    }

    // Home Backup Systems
    if (/whole home|transfer switch|smart home panel|gateway|powerwall|home backup/i.test(name)) {
        return 'home_backup_system';
    }

    // EV Chargers
    if (/evse|level 2 charger|j1772|nacs|ev charger|electric vehicle/i.test(name)) {
        return 'ev_charger';
    }



    // Default fallback
    return 'portable_power_station';
}

/**
 * Check if two products are in the same category (for comparison validation)
 */
export function isSameCategory(categoryA: string, categoryB: string): boolean {
    return categoryA === categoryB;
}

/**
 * Get category icon emoji
 */
export function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
        'portable_power_station': '🔋',
        'solar_panel': '📐',
        'inverter': '⚡',
        'charge_controller': '🎛️',
        'home_backup_system': '🏠',
        'ev_charger': '🚗'
    };
    return icons[category] || '📦';
}
