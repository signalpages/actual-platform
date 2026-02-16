import { ProductCategory } from "@/types";

export const CATEGORY_TO_SCHEMA: Record<ProductCategory, string> = {
    'portable_power_station': 'portable_power_station.v1',
    'solar_generator_kit': 'portable_power_station.v1', // Fallback to PPS for now
    'charge_controller': 'charge_controller.v1',

    // TODO: Define schemas for these
    'solar_panel': 'portable_power_station.v1', // Temp fallback
    'inverter': 'portable_power_station.v1', // Temp fallback
    'battery': 'portable_power_station.v1', // Temp fallback
    'home_backup_system': 'portable_power_station.v1', // Temp fallback
    'ev_charger': 'portable_power_station.v1', // Temp fallback
    'accessory': 'portable_power_station.v1', // Temp fallback
    'off_grid_appliance': 'portable_power_station.v1' // Temp fallback
};

export function getSchemaIdForCategory(category: ProductCategory): string {
    return CATEGORY_TO_SCHEMA[category] || 'portable_power_station.v1';
}
