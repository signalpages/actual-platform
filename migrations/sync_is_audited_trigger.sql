-- Trigger to keep products.is_audited synced with shadow_specs.is_verified

-- 1) One-time backfill
UPDATE products p
SET is_audited = true
FROM shadow_specs s
WHERE s.product_id = p.id
  AND s.is_verified = true;

-- 2) Function to sync changes
CREATE OR REPLACE FUNCTION sync_products_is_audited()
RETURNS trigger AS $$
BEGIN
  UPDATE products
  SET is_audited = COALESCE(NEW.is_verified, false)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Drop existing trigger if any (safety)
DROP TRIGGER IF EXISTS trg_sync_products_is_audited ON shadow_specs;

-- 4) Create trigger
CREATE TRIGGER trg_sync_products_is_audited
AFTER INSERT OR UPDATE OF is_verified
ON shadow_specs
FOR EACH ROW
EXECUTE PROCEDURE sync_products_is_audited();
