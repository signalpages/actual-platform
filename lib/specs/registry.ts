
export interface SpecSchema {
    id: string;
    version: string;
    fields: {
        key: string;       // primary key to look for
        label: string;     // display label
        unit?: string;     // display unit
        altKeys?: string[]; // fallback keys
        formatter?: (val: any) => string;
    }[];
}

// --------------------------------------------------------
// SCHEMA: PORTABLE POWER STATION (V1)
// --------------------------------------------------------
export const PPS_SCHEMA_V1: SpecSchema = {
    id: 'portable_power_station.v1',
    version: '1.0.0',
    fields: [
        {
            key: 'storage_capacity_wh',
            label: 'Battery Capacity',
            unit: 'Wh',
            formatter: (v) => `${v}Wh`,
            altKeys: ['capacity_wh', 'battery_capacity_wh']
        },
        {
            key: 'continuous_ac_output_w',
            label: 'AC Output',
            unit: 'W',
            formatter: (v) => `${v}W continuous`,
            altKeys: ['ac_output_w', 'inverter_output_w', 'continuous_ac_output']
        },
        {
            key: 'peak_surge_output_w',
            label: 'Surge Output',
            unit: 'W',
            formatter: (v) => `${v}W surge`,
            altKeys: ['surge_output_w', 'peak_output_w', 'peak_surge_output']
        },
        {
            key: 'ac_charging_speed',
            label: 'AC Charging Speed',
            formatter: (v) => String(v).replace(/w$/i, '') + 'W AC input'
        },
        {
            key: 'solar_input_max_w',
            label: 'Solar Input',
            unit: 'W',
            formatter: (v) => `${v}W max`,
            altKeys: ['solar_input_w', 'pv_input_w']
        },
        {
            key: 'cell_chemistry',
            label: 'Battery Chemistry',
            altKeys: ['battery_chemistry', 'chemistry']
        },
        {
            key: 'cycle_life_cycles',
            label: 'Cycle Life',
            formatter: (v) => `${v} cycles`,
            altKeys: ['cycle_life', 'lifecycles']
        },
        {
            key: 'ups_eps_switchover_ms',
            label: 'UPS/EPS Protocol',
            formatter: (v) => `<${v}ms switchover`,
            altKeys: ['ups_switchover_ms', 'eps_switchover_ms']
        },
        {
            key: 'weight_lbs',
            label: 'Weight',
            formatter: (v) => `${v} lbs`,
            altKeys: ['weight'] // Note: special handling for kg might be needed in composer
        },
        {
            key: 'warranty_years',
            label: 'Warranty',
            formatter: (v) => `${v} years`
        }
    ]
};

// --------------------------------------------------------
// SCHEMA: CHARGE CONTROLLER (V1)
// --------------------------------------------------------
export const CHARGE_CONTROLLER_SCHEMA_V1: SpecSchema = {
    id: 'charge_controller.v1',
    version: '1.0.0',
    fields: [
        {
            key: 'controller_type',
            label: 'Controller Type',
            altKeys: ['type', 'technology'], // e.g. MPPT vs PWM
        },
        {
            key: 'max_pv_voltage_v',
            label: 'Max PV Voltage',
            unit: 'V',
            formatter: (v) => `${v}V`,
            altKeys: ['max_solar_voltage', 'max_input_voltage']
        },
        {
            key: 'max_pv_current_a',
            label: 'Max PV Current',
            unit: 'A',
            formatter: (v) => `${v}A`,
            altKeys: ['max_solar_current', 'max_input_current']
        },
        {
            key: 'max_charge_current_a',
            label: 'Max Charge Current',
            unit: 'A',
            formatter: (v) => `${v}A`,
            altKeys: ['rated_current', 'charge_current']
        },
        {
            key: 'max_pv_power_12v_w',
            label: 'Max PV Power (12V)',
            unit: 'W',
            formatter: (v) => `${v}W`,
        },
        {
            key: 'max_pv_power_24v_w',
            label: 'Max PV Power (24V)',
            unit: 'W',
            formatter: (v) => `${v}W`,
        },
        {
            key: 'battery_nominal_voltage',
            label: 'Battery Voltage',
            altKeys: ['system_voltage', 'nominal_voltage'] // e.g. "12V/24V Auto"
        },
        {
            key: 'grounding_type',
            label: 'Grounding',
            altKeys: ['grounding']
        },
        {
            key: 'communication_defined',
            label: 'Comms',
            altKeys: ['communication', 'interface'] // e.g. "RS-232, Ethernet"
        },
        {
            key: 'operating_temp_range',
            label: 'Operating Temp',
            altKeys: ['operating_temperature']
        },
        {
            key: 'dimensions',
            label: 'Dimensions',
            altKeys: ['dimensions_display']
        },
        {
            key: 'weight_lbs',
            label: 'Weight',
            formatter: (v) => `${v} lbs`,
            altKeys: ['weight']
        }
    ]
};

const REGISTRY: Record<string, SpecSchema> = {
    [PPS_SCHEMA_V1.id]: PPS_SCHEMA_V1,
    [CHARGE_CONTROLLER_SCHEMA_V1.id]: CHARGE_CONTROLLER_SCHEMA_V1
};

export function getSchema(id: string): SpecSchema | undefined {
    return REGISTRY[id];
}
