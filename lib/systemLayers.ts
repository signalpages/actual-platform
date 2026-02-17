export type SystemLayer = 'Generation' | 'Conversion' | 'Storage' | 'Control' | 'Electrification';

interface LayerInfo {
    layer: SystemLayer;
    upstream?: string; // e.g. "Solar Panels"
    downstream?: string; // e.g. "Inverters"
    description: string;
}

export const CATEGORY_LAYERS: Record<string, LayerInfo> = {
    'solar_panel': {
        layer: 'Generation',
        downstream: 'Charge Controllers or Inverters',
        description: 'Captures energy from the sun.'
    },
    'charge_controller': {
        layer: 'Control',
        upstream: 'Solar Panels',
        downstream: 'Batteries',
        description: 'Regulates voltage and current from solar panels to battery.'
    },
    'deep_cycle_battery': { // Kept for completeness of logic even if removed from V1 seed
        layer: 'Storage',
        upstream: 'Charge Controllers',
        downstream: 'Inverters',
        description: 'Stores energy for later use.'
    },
    'home_backup_system': {
        layer: 'Storage',
        upstream: 'Grid or Solar',
        downstream: 'Home Loads',
        description: 'Whole-home energy storage and backup.'
    },
    'portable_power_station': {
        layer: 'Storage', // Hybrid really
        upstream: 'Wall Outlet or Solar',
        downstream: 'Devices',
        description: 'All-in-one battery, inverter, and controller.'
    },
    'inverter': {
        layer: 'Conversion',
        upstream: 'Batteries',
        downstream: 'AC Appliances',
        description: 'Converts DC battery power to AC household power.'
    },
    'ev_charger': {
        layer: 'Electrification',
        upstream: 'Grid or Inverter',
        downstream: 'Electric Vehicle',
        description: 'Delivers power to your vehicle.'
    }
};
