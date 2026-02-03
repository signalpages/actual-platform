/**
 * Product category taxonomy
 * 10 categories - enough to prevent nonsense comparisons, not so many that seeding is chaos
 */

export const PRODUCT_CATEGORIES = [
    'Portable Power Stations',
    'Solar Generator Kits',
    'Solar Panels',
    'Inverters',
    'Batteries',
    'Charge Controllers',
    'Home Backup Systems',
    'EV Chargers',
    'Accessories',
    'Off-Grid Appliances'
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

/**
 * Category descriptions for UI
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    'Portable Power Stations': 'Battery-powered generators (Jackery, EcoFlow, Bluetti, etc.)',
    'Solar Generator Kits': 'Power stations bundled with solar panels',
    'Solar Panels': 'Photovoltaic panels for solar energy generation',
    'Inverters': 'Convert DC to AC power (grid-tie, off-grid, hybrid)',
    'Batteries': 'Standalone battery banks and expansion batteries',
    'Charge Controllers': 'MPPT and PWM solar charge controllers',
    'Home Backup Systems': 'Whole-home backup solutions (Powerwall-style)',
    'EV Chargers': 'Electric vehicle charging stations (Level 2, etc.)',
    'Accessories': 'Cables, connectors, fuses, mounts, and other accessories',
    'Off-Grid Appliances': 'Fridges, mini-splits, and other off-grid appliances'
};

/**
 * Auto-categorize a product based on model name
 */
export function autoCategorizeby(modelName: string): ProductCategory {
    const name = modelName.toLowerCase();

    // Portable Power Stations
    if (/explorer|delta|river|bluetti (ac|eb|ep)|yeti|solix|jackery|ecoflow|anker.*f\d{4}|vtoman/i.test(name)) {
        return 'Portable Power Stations';
    }

    // Solar Generator Kits (bundles)
    if (/kit|bundle|with.*panel|solarsaga|x ?\d+w|\+ ?\d+w/i.test(name)) {
        return 'Solar Generator Kits';
    }

    // Solar Panels
    if (/panel|pv|mono|bifacial|watt solar|w solar|photovoltaic/i.test(name)) {
        return 'Solar Panels';
    }

    // Inverters
    if (/inverter|hybrid inverter|grid-tie|microinverter|string inverter/i.test(name)) {
        return 'Inverters';
    }

    // Batteries
    if (/\d+ah\b|\d+kwh\b.*battery|lfp battery|lifepo4|rack mount battery|server rack battery|expansion battery/i.test(name)) {
        return 'Batteries';
    }

    // Charge Controllers
    if (/mppt|pwm|charge controller|solar controller/i.test(name)) {
        return 'Charge Controllers';
    }

    // Home Backup Systems
    if (/whole home|transfer switch|smart home panel|gateway|powerwall|home backup/i.test(name)) {
        return 'Home Backup Systems';
    }

    // EV Chargers
    if (/evse|level 2 charger|j1772|nacs|ev charger|electric vehicle/i.test(name)) {
        return 'EV Chargers';
    }

    // Accessories
    if (/cable|connector|mc4|fuse|breaker|mount|rail|clamp|adapter|extension/i.test(name)) {
        return 'Accessories';
    }

    // Off-Grid Appliances
    if (/mini split|fridge|freezer|refrigerator|off-grid appliance/i.test(name)) {
        return 'Off-Grid Appliances';
    }

    // Default fallback
    return 'Portable Power Stations';
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
        'Portable Power Stations': '🔋',
        'Solar Generator Kits': '☀️',
        'Solar Panels': '📐',
        'Inverters': '⚡',
        'Batteries': '🔌',
        'Charge Controllers': '🎛️',
        'Home Backup Systems': '🏠',
        'EV Chargers': '🚗',
        'Accessories': '🔧',
        'Off-Grid Appliances': '🌲'
    };
    return icons[category] || '📦';
}
