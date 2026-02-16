import { ProductCategory } from '@/types';

/**
 * Deterministic product categorization using string heuristics.
 * 
 * Rules applied in order of specificity:
 * 1. Solar generator kits (bundles with panels)
 * 2. Portable power stations
 * 3. Solar panels
 * 4. Inverters
 * 5. Charge controllers
 * 7. Home batteries
 * 8. Microinverters
 * 9. Optimizers
 * 10. DC converters
 */
export function categorizeProduct(modelName: string, brand: string = ''): ProductCategory {
    const text = `${brand} ${modelName}`.toUpperCase().trim();

    // 2. Portable power stations (all-in-one battery + inverter)
    if (
        /\bAC\d+|AC200|AC300|AC500|EP\d+|EP500|EP600/.test(text) || // Bluetti AC/EP series
        /\bDELTA|RIVER\b/.test(text) || // EcoFlow
        /\bYETI|GOAL ZERO YETI/.test(text) || // Goal Zero
        /\bEXPLORER\b/.test(text) || // Jackery
        /\bJUMP\b/.test(text) || // VTOMAN
        /\bSOLIX F\d+|SOLIX C\d+/.test(text) || // Anker Solix
        /\bPOWER STATION\b/.test(text) || // Generic
        /\bF\d{4}\b/.test(text) // Anker F-series pattern (F2000, F3800, etc)
    ) {
        return 'portable_power_station';
    }

    // 3. Solar panels
    if (
        /\bPANEL\b/.test(text) ||
        /\bSOLARSAGA\b/.test(text) ||
        /\bPV\d+/.test(text) || // PV200, PV350
        /\b\d+W SOLAR|\d+W PANEL/.test(text) || // 200W Solar, 100W Panel
        /\bFOLDABLE SOLAR|RIGID PANEL/.test(text)
    ) {
        return 'solar_panel';
    }



    // 5. Charge controllers
    if (
        /\bMPPT\b/.test(text) ||
        /\bPWM\b/.test(text) ||
        /\bCHARGE CONTROLLER\b/.test(text) ||
        /(VICTRON|RENOGY).*(SMART|BLUE|CONTROLLER)/.test(text)
    ) {
        return 'charge_controller';
    }

    // 6. Inverters
    if (
        /\bINVERTER\b/.test(text) &&
        !/MICROINVERTER/.test(text) && // Exclude microinverters
        !/POWER STATION/.test(text) // Exclude power stations
    ) {
        return 'inverter';
    }

    // 7. Home batteries (wall-mount, rack-mount)
    if (
        /\bWALL BATTERY|WALL MOUNT/.test(text) ||
        /\bRACK MOUNT|STACKABLE/.test(text) ||
        /\bSERVER BATTERY|HOME BATTERY/.test(text) ||
        /\bEG4\b/.test(text) || // EG4 brand specializes in home batteries
        /\bFORTRESS POWER/.test(text)
    ) {
        return 'home_backup_system';
    }

    // 8. Microinverters
    if (
        /\bMICROINVERTER\b/.test(text) ||
        /\bENPHASE IQ/.test(text) ||
        /\bAPSYSTEMS/.test(text)
    ) {
        return 'inverter';
    }



    // Default fallback - portable_power_station is most common
    // (This should rarely be hit if seeding is done correctly)
    console.warn(`⚠️  Unable to categorize: "${text}" - defaulting to portable_power_station`);
    return 'portable_power_station';
}

/**
 * Get human-readable category label
 */
export function getCategoryLabel(category: ProductCategory): string {
    const labels: Record<ProductCategory, string> = {
        portable_power_station: 'Portable Power Station',
        solar_panel: 'Solar Panel',
        inverter: 'Inverter',
        charge_controller: 'Charge Controller',
        home_backup_system: 'Solar Backup Battery',
        ev_charger: 'EV Charger'
    };
    return labels[category] || category;
}

/**
 * Validate category against V1 taxonomy
 */
export function isValidCategory(category: string): category is ProductCategory {
    const validCategories: ProductCategory[] = [
        'portable_power_station',
        'solar_panel',
        'inverter',
        'charge_controller',
        'home_backup_system',
        'ev_charger',
    ];
    return validCategories.includes(category as ProductCategory);
}
