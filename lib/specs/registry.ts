
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
        },
        {
            key: 'operating_temp_range',
            label: 'Operating Temp',
            altKeys: ['operating_temp', 'operating_temperature', 'operating_temp_display']
        },
        {
            key: 'dimensions',
            label: 'Dimensions',
            altKeys: ['dimensions_display']
        },
        // Fallback for recharge time if not AC charging speed
        {
            key: 'recharge_time_minutes',
            label: 'Recharge Time',
            formatter: (v) => `${v} mins`,
            altKeys: ['recharge_time_display']
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

// --------------------------------------------------------
// SCHEMA: SOLAR PANEL (V1)
// --------------------------------------------------------
export const SOLAR_PANEL_SCHEMA_V1: SpecSchema = {
    id: 'solar_panel.v1',
    version: '1.0.0',
    fields: [
        {
            key: 'rated_power_w',
            label: 'Rated Power',
            unit: 'W',
            formatter: (v) => `${v}W`,
            altKeys: ['power', 'wattage']
        },
        {
            key: 'efficiency_pct',
            label: 'Efficiency',
            unit: '%',
            formatter: (v) => `${v}%`,
            altKeys: ['efficiency']
        },
        {
            key: 'voc_v',
            label: 'Open Circuit Voltage (Voc)',
            unit: 'V',
            formatter: (v) => `${v}V`
        },
        {
            key: 'vmpp_v',
            label: 'Max Power Voltage (Vmpp)',
            unit: 'V',
            formatter: (v) => `${v}V`
        },
        {
            key: 'isc_a',
            label: 'Short Circuit Current (Isc)',
            unit: 'A',
            formatter: (v) => `${v}A`
        },
        {
            key: 'impp_a',
            label: 'Max Power Current (Impp)',
            unit: 'A',
            formatter: (v) => `${v}A`
        },
        {
            key: 'cell_type',
            label: 'Cell Type',
            altKeys: ['cell_chemistry']
        },
        {
            key: 'connector_type',
            label: 'Connector',
            altKeys: ['connector']
        },
        {
            key: 'dimensions',
            label: 'Dimensions'
        },
        {
            key: 'weight_kg',
            label: 'Weight',
            formatter: (v) => `${v}kg`
        },
        {
            key: 'bifacial',
            label: 'Bifacial',
            formatter: (v) => v ? 'Yes' : 'No'
        }
    ]
};

// --------------------------------------------------------
// SCHEMA: EV CHARGER (V1)
// --------------------------------------------------------
export const EV_CHARGER_SCHEMA_V1: SpecSchema = {
    id: 'ev_charger.v1',
    version: '1.0.0',
    fields: [
        {
            key: 'max_power_kw',
            label: 'Max Power',
            unit: 'kW',
            formatter: (v) => `${v}kW`,
            altKeys: ['max_output_kw']
        },
        {
            key: 'max_current_a',
            label: 'Max Current',
            unit: 'A',
            formatter: (v) => `${v}A`,
            altKeys: ['max_amperage_a']
        },
        {
            key: 'input_voltage_v',
            label: 'Input Voltage',
            unit: 'V',
            formatter: (v) => `${v}V`
        },
        {
            key: 'connector_type',
            label: 'Connector',
            altKeys: ['connector']
        },
        {
            key: 'cable_length_ft',
            label: 'Cable Length',
            unit: 'ft',
            formatter: (v) => `${v} ft`
        },
        {
            key: 'hardwired',
            label: 'Hardwired',
            formatter: (v) => v ? 'Yes' : 'No'
        },
        {
            key: 'wifi_enabled',
            label: 'WiFi',
            formatter: (v) => v ? 'Yes' : 'No'
        },
        {
            key: 'app_required',
            label: 'App Required',
            formatter: (v) => v ? 'Yes' : 'No'
        },
        {
            key: 'ip_rating',
            label: 'IP Rating',
            altKeys: ['indoor_outdoor_rating', 'rating']
        },
        {
            key: 'utility_metering',
            label: 'Utility Grade Metering',
            // Sometimes mapped from 'ocpp_support' or similar if needed, 
            // but for now let's map 'energy_star_certified' as a proxy for high quality? 
            // actually better to just map what we have.
            // Let's add 'ocpp_support'
        },
        {
            key: 'ocpp_support',
            label: 'OCPP',
            formatter: (v) => v ? 'Yes' : 'No'
        },
        {
            key: 'warranty_years',
            label: 'Warranty',
            formatter: (v) => `${v} years`
        },
        {
            key: 'weight_lbs',
            label: 'Weight',
            formatter: (v) => `${v} lbs`
        }
    ]
};

// --------------------------------------------------------
// SCHEMA: INVERTER (V1)
// --------------------------------------------------------
export const INVERTER_SCHEMA_V1: SpecSchema = {
    id: 'inverter.v1',
    version: '1.0.0',
    fields: [
        {
            key: 'continuous_ac_output_w',
            label: 'Continuous AC Output',
            formatter: (v) => `${v}W`,
            altKeys: ['continuous_output_w', 'rated_power_w', 'output_power_w']
        },
        {
            key: 'surge_output_w',
            label: 'Surge Output',
            formatter: (v) => `${v}W`,
            altKeys: ['peak_output_w', 'peak_surge_output_w', 'surge_power_w']
        },
        {
            key: 'output_voltage_v',
            label: 'AC Output Voltage',
            formatter: (v) => `${v}VAC`,
            altKeys: ['ac_output_voltage', 'output_voltage']
        },
        {
            key: 'output_frequency_hz',
            label: 'Output Frequency',
            formatter: (v) => `${v}Hz`,
            altKeys: ['frequency_hz', 'frequency']
        },
        {
            key: 'dc_input_voltage_v',
            label: 'DC Input Voltage',
            formatter: (v) => `${v}VDC`,
            altKeys: ['input_voltage_v', 'battery_voltage_v', 'dc_voltage']
        },
        {
            key: 'max_dc_input_current_a',
            label: 'Max DC Input Current',
            formatter: (v) => `${v}A`,
            altKeys: ['max_input_current_a', 'dc_input_current']
        },
        {
            key: 'idle_consumption_w',
            label: 'Idle Draw',
            formatter: (v) => `${v}W`,
            altKeys: ['no_load_power_w', 'standby_power_w', 'idle_power']
        },
        {
            key: 'parallel_capable',
            label: 'Parallel Capable',
            formatter: (v) => (v === true || v === 'true' || v === 'yes' || v === 'Yes') ? 'Yes' : 'No',
        },
        {
            key: 'remote_monitoring',
            label: 'Remote Monitoring',
            formatter: (v) => (v === true || v === 'true' || v === 'yes' || v === 'Yes') ? 'Yes' : 'No',
        },
        {
            key: 'weight_kg',
            label: 'Weight',
            formatter: (v) => `${v}kg`,
            altKeys: ['weight_lbs', 'weight']
        },
        {
            key: 'dimensions_mm',
            label: 'Dimensions',
            altKeys: ['dimensions', 'dimensions_display']
        },
        {
            key: 'operating_temp_c',
            label: 'Operating Temp',
            altKeys: ['operating_temp_range', 'operating_temperature']
        },
        {
            key: 'warranty_years',
            label: 'Warranty',
            formatter: (v) => `${v} years`,
        },
    ]
};

const REGISTRY: Record<string, SpecSchema> = {
    [PPS_SCHEMA_V1.id]: PPS_SCHEMA_V1,
    [CHARGE_CONTROLLER_SCHEMA_V1.id]: CHARGE_CONTROLLER_SCHEMA_V1,
    [SOLAR_PANEL_SCHEMA_V1.id]: SOLAR_PANEL_SCHEMA_V1,
    [EV_CHARGER_SCHEMA_V1.id]: EV_CHARGER_SCHEMA_V1,
    [INVERTER_SCHEMA_V1.id]: INVERTER_SCHEMA_V1,
    'solar_panel.v1': {
        id: 'solar_panel.v1',
        version: '1.0.0',
        fields: [
            { key: 'rated_power_w', label: 'Rated Power', unit: 'W', formatter: (v) => `${v}W`, altKeys: ['power', 'wattage'] },
            { key: 'efficiency_pct', label: 'Efficiency', formatter: (v) => `${v}%`, altKeys: ['efficiency'] },
            { key: 'vmpp_v', label: 'Max Power Voltage (Vmpp)', unit: 'V', formatter: (v) => `${v}V` },
            { key: 'impp_a', label: 'Max Power Current (Impp)', unit: 'A', formatter: (v) => `${v}A` },
            { key: 'voc_v', label: 'Open Circuit Voltage (Voc)', unit: 'V', formatter: (v) => `${v}V` },
            { key: 'isc_a', label: 'Short Circuit Current (Isc)', unit: 'A', formatter: (v) => `${v}A` },
            { key: 'cell_type', label: 'Cell Type', altKeys: ['chemistry'] },
            { key: 'bifacial', label: 'Bifacial', formatter: (v) => String(v).toLowerCase() === 'true' ? 'Yes' : 'No' },
            { key: 'weight_kg', label: 'Weight', formatter: (v) => `${v} kg` },
            { key: 'dimensions', label: 'Dimensions' }
        ]
    },
    'battery.v1': {
        id: 'battery.v1',
        version: '1.0.0',
        fields: [
            { key: 'capacity_wh', label: 'Capacity', unit: 'Wh', formatter: (v) => `${v}Wh`, altKeys: ['energy', 'capacity'] },
            { key: 'capacity_kwh', label: 'Capacity', unit: 'kWh', formatter: (v) => `${v}kWh`, altKeys: ['energy_kwh'] },
            { key: 'voltage_v', label: 'Voltage', unit: 'V', formatter: (v) => `${v}V`, altKeys: ['system_voltage'] },
            { key: 'ah', label: 'Amp Hours', unit: 'Ah', formatter: (v) => `${v}Ah`, altKeys: ['amp_hours'] },
            { key: 'continuous_a', label: 'Continuous Discharge', unit: 'A', formatter: (v) => `${v}A`, altKeys: ['max_continuous_discharge'] },
            { key: 'continuous_kw', label: 'Continuous Output', unit: 'kW', formatter: (v) => `${v}kW`, altKeys: ['continuous_power'] },
            { key: 'peak_a', label: 'Peak Discharge', unit: 'A', formatter: (v) => `${v}A`, altKeys: ['peak_discharge', 'surge_current'] },
            { key: 'peak_kw', label: 'Peak Output', unit: 'kW', formatter: (v) => `${v}kW`, altKeys: ['peak_power'] },
            { key: 'chemistry', label: 'Chemistry', altKeys: ['cell_chemistry', 'type'] },
            { key: 'cycles', label: 'Cycle Life', formatter: (v) => `${v} cycles`, altKeys: ['cycle_life', 'lifecycles'] },
            { key: 'warranty_years', label: 'Warranty', formatter: (v) => `${v} years` },
            { key: 'weight_lbs', label: 'Weight', formatter: (v) => `${v} lbs` },
            { key: 'dimensions', label: 'Dimensions' },
            { key: 'expandable_to_kwh', label: 'Expandable To', formatter: (v) => `${v}kWh` },
            { key: 'communication', label: 'Comms', altKeys: ['communication_ports'] },
            { key: 'rating', label: 'IP Rating', altKeys: ['ip_rating'] }
        ]
    }
};

export function getSchema(id: string): SpecSchema | undefined {
    return REGISTRY[id];
}
