import { ProductCategory } from "@/types";

export const CATEGORY_TO_SCHEMA: Record<ProductCategory, string> = {
    'portable_power_station': 'portable_power_station.v1',
    'charge_controller': 'charge_controller.v1',

    // TODO: Define schemas for these
    'solar_panel': 'solar_panel.v1',
    'inverter': 'inverter.v1',
    'home_backup_system': 'battery.v1',
    'ev_charger': 'ev_charger.v1'
};

export function getSchemaIdForCategory(category: ProductCategory): string {
    return CATEGORY_TO_SCHEMA[category] || 'portable_power_station.v1';
}
