import { ProductCategory } from "@/types";

export interface SpecDefinition {
    key: string;       // internal key (e.g., 'ac_output_continuous')
    label: string;     // display label (e.g., 'AC Output')
    type: 'string' | 'number' | 'range' | 'boolean';
    units?: string;    // e.g., 'W', 'Wh', 'lbs'
    requiredForAudit: boolean; // If true, missing this downgrades audit assurance
    verify?: boolean;  // If true, this field is materially verifiable (Stage 3 + Truth Index)
}

export type CategorySpecSchema = Record<ProductCategory, SpecDefinition[]>;

export const CATEGORY_RULES: CategorySpecSchema = {
    portable_power_station: [
        { key: "storage_capacity_wh", label: "Battery Capacity", type: "number", units: "Wh", requiredForAudit: true, verify: true },
        { key: "continuous_ac_output_w", label: "AC Output", type: "number", units: "W", requiredForAudit: true, verify: true },
        { key: "peak_surge_output_w", label: "Surge Output", type: "number", units: "W", requiredForAudit: false, verify: true },
        { key: "solar_input_max_w", label: "Solar Input", type: "number", units: "W", requiredForAudit: false, verify: true },
        { key: "cell_chemistry", label: "Battery Chemistry", type: "string", requiredForAudit: true, verify: false },
        { key: "cycle_life_cycles", label: "Cycle Life", type: "string", requiredForAudit: false, verify: true },
        { key: "weight_lbs", label: "Weight", type: "number", units: "lbs", requiredForAudit: false, verify: false },
        { key: "recharge_time_minutes", label: "Recharge Time", type: "string", requiredForAudit: false, verify: true },
        { key: "dimensions", label: "Dimensions", type: "string", requiredForAudit: false, verify: false },
        { key: "warranty_years", label: "Warranty", type: "number", units: "years", requiredForAudit: false, verify: false }
    ],
    solar_panel: [
        { key: "rated_power_w", label: "Rated Power", type: "number", units: "W", requiredForAudit: true, verify: true },
        { key: "efficiency_pct", label: "Efficiency", type: "number", units: "%", requiredForAudit: true, verify: true },
        { key: "voc_v", label: "Open Circuit Voltage (Voc)", type: "number", units: "V", requiredForAudit: true, verify: true },
        { key: "isc_a", label: "Short Circuit Current (Isc)", type: "number", units: "A", requiredForAudit: true, verify: true },
        { key: "weight_lbs", label: "Weight", type: "number", units: "lbs", requiredForAudit: false, verify: false },
        { key: "dimensions_in", label: "Dimensions", type: "string", requiredForAudit: false, verify: false },
        { key: "cell_type", label: "Cell Type", type: "string", requiredForAudit: false, verify: false }
    ],
    inverter: [
        { key: "rated_output_w", label: "Rated Output", type: "number", units: "W", requiredForAudit: true, verify: true },
        { key: "surge_output_w", label: "Surge Output", type: "number", units: "W", requiredForAudit: true, verify: true },
        { key: "voltage_in_v", label: "Input Voltage", type: "number", units: "V", requiredForAudit: true, verify: true },
        { key: "voltage_out_v", label: "Output Voltage", type: "number", units: "V", requiredForAudit: true, verify: true },
        { key: "idle_consumption_w", label: "Idle Consumption", type: "number", units: "W", requiredForAudit: false, verify: true },
        { key: "efficiency_peak_pct", label: "Peak Efficiency", type: "number", units: "%", requiredForAudit: false, verify: true }
    ],
    ev_charger: [
        { key: "max_amperage_a", label: "Max Amperage", type: "number", units: "A", requiredForAudit: true, verify: true },
        { key: "voltage_v", label: "Voltage", type: "number", units: "V", requiredForAudit: true, verify: true },
        { key: "cable_length_ft", label: "Cable Length", type: "number", units: "ft", requiredForAudit: false, verify: false },
        { key: "smart_features", label: "Smart Features", type: "string", requiredForAudit: false, verify: false }
    ],
    charge_controller: [
        { key: "max_current_a", label: "Max Current", type: "number", units: "A", requiredForAudit: true, verify: true },
        { key: "max_pv_voltage_v", label: "Max PV Voltage", type: "number", units: "V", requiredForAudit: true, verify: true },
        { key: "battery_system_voltage_v", label: "System Voltage", type: "number", units: "V", requiredForAudit: true, verify: true }
    ],
    home_backup_system: [
        { key: "total_capacity_kwh", label: "Total Capacity", type: "number", units: "kWh", requiredForAudit: true, verify: true },
        { key: "continuous_output_kw", label: "Continuous Output", type: "number", units: "kW", requiredForAudit: true, verify: true },
        { key: "grid_tie", label: "Grid Tie Support", type: "boolean", requiredForAudit: true, verify: false }
    ],
    // lifepo4_battery, portable_ac, solar_generator_kit removed as they are not in ProductCategory type
};
