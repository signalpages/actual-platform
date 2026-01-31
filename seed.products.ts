
import { Asset } from './types';

const seedData: Partial<Asset>[] = [
  { "id": "ef-d2", "brand": "EcoFlow", "model_name": "Delta 2", "category": "portable_power_station", "signature": "ECOFLOW-DELTA-2", "is_audited": true },
  { "id": "ef-d2m", "brand": "EcoFlow", "model_name": "Delta 2 Max", "category": "portable_power_station", "signature": "ECOFLOW-DELTA-2-MAX", "is_audited": true },
  { "id": "ak-c1000", "brand": "Anker", "model_name": "Solix C1000", "category": "portable_power_station", "signature": "ANKER-SOLIX-C1000", "is_audited": true },
  { "id": "bl-ac180", "brand": "Bluetti", "model_name": "AC180", "category": "portable_power_station", "signature": "BLUETTI-AC180", "is_audited": true },
  { "id": "jk-e2000p", "brand": "Jackery", "model_name": "Explorer 2000 Plus", "category": "portable_power_station", "signature": "JACKERY-EXPLORER-2000-PLUS", "is_audited": true },
  { "id": "tw-pw2", "brand": "Tesla", "model_name": "Powerwall 2", "category": "battery", "signature": "TESLA-POWERWALL-2", "is_audited": true },
  { "id": "tw-pw3", "brand": "Tesla", "model_name": "Powerwall 3", "category": "battery", "signature": "TESLA-POWERWALL-3", "is_audited": true },
  { "id": "en-iq10", "brand": "Enphase", "model_name": "IQ Battery 10", "category": "battery", "signature": "ENPHASE-IQ-10", "is_audited": true },
  { "id": "eg-6000xp", "brand": "EG4", "model_name": "6000XP", "category": "inverter", "signature": "EG4-6000XP", "is_audited": true },
  { "id": "zn-v6400", "brand": "Zendure", "model_name": "SuperBase V6400", "category": "portable_power_station", "signature": "ZENDURE-V6400", "is_audited": false },
  { "id": "sp-r400", "brand": "SanTan", "model_name": "Solar 400W Rigid", "category": "solar_panel", "signature": "SANTAN-400W-RIGID", "is_audited": true },
  { "id": "vi-m3000", "brand": "Victron", "model_name": "MultiPlus-II 3000", "category": "inverter", "signature": "VICTRON-M3000", "is_audited": true }
];

export default seedData;
