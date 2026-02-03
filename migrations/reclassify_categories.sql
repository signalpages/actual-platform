-- Reclassify products from "solar" catch-all to proper categories
-- Run this in Supabase SQL Editor

BEGIN;

-- Update products.category based on model_name heuristics
UPDATE products
SET category = CASE
    -- Portable Power Stations
    WHEN model_name ~* 'Explorer|Delta|River|Bluetti (AC|EB|EP)|Yeti|Solix|Jackery|EcoFlow|Anker.*F\d{4}|VTOMAN' THEN 'Portable Power Stations'
    
    -- Solar Generator Kits (bundles)
    WHEN model_name ~* 'kit|bundle|with.*panel|SolarSaga|x ?\d+W|\+ ?\d+W' THEN 'Solar Generator Kits'
    
    -- Solar Panels
    WHEN model_name ~* 'panel|PV|mono|bifacial|watt solar|W solar|photovoltaic' THEN 'Solar Panels'
    
    -- Inverters
    WHEN model_name ~* 'inverter|hybrid inverter|grid-tie|microinverter|string inverter' THEN 'Inverters'
    
    -- Batteries
    WHEN model_name ~* '\d+Ah\b|\d+kWh\b.*battery|LFP battery|LiFePO4|rack mount battery|server rack battery|expansion battery' THEN 'Batteries'
    
    -- Charge Controllers
    WHEN model_name ~* 'MPPT|PWM|charge controller|solar controller' THEN 'Charge Controllers'
    
    -- Home Backup Systems
    WHEN model_name ~* 'whole home|transfer switch|smart home panel|gateway|powerwall|home backup' THEN 'Home Backup Systems'
    
    -- EV Chargers
    WHEN model_name ~* 'EVSE|Level 2 charger|J1772|NACS|EV charger|electric vehicle' THEN 'EV Chargers'
    
    -- Accessories
    WHEN model_name ~* 'cable|connector|MC4|fuse|breaker|mount|rail|clamp|adapter|extension' THEN 'Accessories'
    
    -- Off-Grid Appliances
    WHEN model_name ~* 'mini split|fridge|freezer|refrigerator|off-grid appliance' THEN 'Off-Grid Appliances'
    
    -- Default fallback
    ELSE 'Portable Power Stations'
END
WHERE category = 'solar'
   OR category IS NULL
   OR category = '';

-- Log the changes
DO $$
DECLARE
    total_updated INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_updated 
    FROM products 
    WHERE category != 'solar';
    
    RAISE NOTICE 'Reclassified % products', total_updated;
END $$;

COMMIT;

-- Verify the distribution
SELECT 
    category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM products
GROUP BY category
ORDER BY count DESC;
