export interface ClaimItem {
    label: string;
    value: string;
}

export function composeClaimProfile(specs: any): ClaimItem[] {
    // Guard: if specs is null/undefined
    if (!specs) return [];

    const claims: ClaimItem[] = [];

    // Unwrap nested structure (e.g. { kv: {...}, items: [...] })
    let s: Record<string, any> = specs;

    // CASE A: Data in .kv (common in our DB)
    if (specs.kv && typeof specs.kv === 'object' && !Array.isArray(specs.kv)) {
        s = specs.kv;
    }
    // CASE B: Data in .items (legacy/array format) -> map to object
    else if (specs.items && Array.isArray(specs.items)) {
        s = {};
        specs.items.forEach((item: any) => {
            if (item?.key && item.value) {
                s[item.key] = item.value;
            }
        });
    }
    // CASE C: specs IS the kv object (already flat) -> s = specs (default)

    // Battery Capacity
    if (s.storage_capacity_wh) {
        claims.push({
            label: "Battery Capacity",
            value: `${s.storage_capacity_wh}Wh`
        });
    }

    // AC Output (handle 'continuous_ac_output' and 'continuous_ac_output_w')
    const acOutput = s.continuous_ac_output || s.continuous_ac_output_w;
    if (acOutput) {
        const peak = s.peak_surge_output || s.peak_surge_output_w;
        const surge = peak ? ` (${peak}W surge)` : "";
        const val = String(acOutput).replace(/w$/i, '');
        claims.push({
            label: "AC Output",
            value: `${val}W continuous${surge}`
        });
    }

    // Battery Chemistry (handle 'cell_chemistry' and 'battery_chemistry')
    const chemistry = s.cell_chemistry || s.battery_chemistry;
    if (chemistry) {
        claims.push({
            label: "Battery Chemistry",
            value: String(chemistry)
        });
    }

    // Cycle Life (handle 'cycle_life' and 'cycle_life_cycles')
    const cycles = s.cycle_life || s.cycle_life_cycles;
    if (cycles) {
        claims.push({
            label: "Cycle Life",
            value: String(cycles)
        });
    }

    // Recharge Speed (handle 'ac_charging_speed')
    // Seeder writes 'recharge_time_minutes' which is different. 
    // If we have 'ac_charging_speed' (from previous seeds/harvests), use it.
    if (s.ac_charging_speed) {
        const val = String(s.ac_charging_speed).replace(/w$/i, '');
        claims.push({
            label: "Recharge Speed",
            value: `${val}W AC input`
        });
    }

    // Weight
    // Seeder may write 'weight_lbs' or 'weight_kg' or 'weight_display' in display obj
    const weight = s.weight_kg || s.weight_lbs || s.weight_display || s.display?.weight; // Simple fallback check
    if (weight) {
        // If it's weight_lbs (s.weight_lbs exists), formatted below differently?
        // Let's just blindly assume s.weight_kg for now if we want consistency or verify based on keys.

        if (s.weight_kg) {
            const kg = parseFloat(s.weight_kg);
            if (!isNaN(kg)) {
                const lbs = (kg * 2.20462).toFixed(1);
                claims.push({
                    label: "Weight",
                    value: `${lbs} lbs (${s.weight_kg}kg)`
                });
            } else {
                claims.push({ label: "Weight", value: s.weight_kg });
            }
        } else if (s.weight_lbs) {
            claims.push({
                label: "Weight",
                value: `${s.weight_lbs} lbs`
            });
        }
    }

    // --- Extras ---

    // Solar Input (handle 'solar_input_w' and 'solar_input_max_w')
    const solar = s.solar_input_w || s.solar_input_max_w;
    if (solar) {
        claims.push({
            label: "Solar Input",
            value: `${solar}W max`
        });
    }

    // Warranty
    if (s.warranty_years) {
        claims.push({
            label: "Warranty",
            value: `${s.warranty_years} years`
        });
    }

    // Dimensions
    const dimensions = s.dimensions || s.dimensions_display || s.display?.dimensions;
    if (dimensions) {
        claims.push({
            label: "Dimensions",
            value: dimensions
        });
    }

    // Operating Temperature
    const opTemp = s.operating_temp || s.operating_temp_display || s.display?.operating_temp;
    if (opTemp) {
        claims.push({
            label: "Operating Temp",
            value: opTemp
        });
    }

    return claims;
}
