import { ProductCategory } from '@/types';

/**
 * Deterministic product categorization using string heuristics.
 * 
 * Rules applied in order of specificity:
 * 1. Solar generator kits (bundles with panels)
 * 2. Portable power stations
 * 3. Solar panels
 * 4. Batteries (power banks, mAh-based)
 * 5. Inverters
 * 6. Charge controllers
 * 7. Home batteries
 * 8. Microinverters
 * 9. Optimizers
 * 10. DC converters
 */
export function categorizeProduct(modelName: string, brand: string = ''): ProductCategory {
    const text = `${brand} ${modelName}`.toUpperCase().trim();

    // 1. Solar generator kits (must be explicit bundles)
    if (/\bKIT\b|\+ PANEL|SOLAR GENERATOR KIT|WITH PANEL/i.test(text)) {
        return 'solar_generator_kit';
    }

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

    // 4. Batteries (power banks, expansion batteries)
    if (
        /\bmAh\b/.test(text) ||
        /\bPOWER BANK\b/.test(text) ||
        /\bPRIME POWER BANK/.test(text) || // Anker Prime
        /\bEXPANSION BATTERY\b/.test(text) ||
        /\bB\d{3,4}\b/.test(text) // B230, B300, etc (expansion batteries)
    ) {
        return 'battery';
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
        return 'home_battery';
    }

    // 8. Microinverters
    if (
        /\bMICROINVERTER\b/.test(text) ||
        /\bENPHASE IQ/.test(text) ||
        /\bAPSYSTEMS/.test(text)
    ) {
        return 'microinverter';
    }

    // 9. Optimizers
    if (
        /\bOPTIMIZER\b/.test(text) ||
        /\bRAPID SHUTDOWN/.test(text) ||
        /\bTIGO/.test(text) ||
        /(SOLAREDGE).*(OPTIMIZER)/.test(text)
    ) {
        return 'optimizer';
    }

    // 10. DC converters
    if (
        /\bDC-DC|DC TO DC/.test(text) ||
        /\bDC CONVERTER|DC CHARGER/.test(text) ||
        /(VICTRON|RENOGY).*(DC-DC|ORION)/.test(text)
    ) {
        return 'dc_converter';
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
        solar_generator_kit: 'Solar Generator Kit',
        solar_panel: 'Solar Panel',
        inverter: 'Inverter',
        battery: 'Battery',
        charge_controller: 'Charge Controller',
        home_battery: 'Home Battery',
        microinverter: 'Microinverter',
        optimizer: 'Optimizer',
        dc_converter: 'DC Converter',
    };
    return labels[category] || category;
}

/**
 * Validate category against V1 taxonomy
 */
export function isValidCategory(category: string): category is ProductCategory {
    const validCategories: ProductCategory[] = [
        'portable_power_station',
        'solar_generator_kit',
        'solar_panel',
        'inverter',
        'battery',
        'charge_controller',
        'home_battery',
        'microinverter',
        'optimizer',
        'dc_converter',
    ];
    return validCategories.includes(category as ProductCategory);
}
