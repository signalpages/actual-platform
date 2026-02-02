-- Add stages column to shadow_specs for progressive audit loading
-- Stage 0: Silent cache check
-- Stage 1: Claim Profile (1-3s, TTL: 30 days)
-- Stage 2: Independent Signal (5-15s, TTL: 14 days)
-- Stage 3: Forensic Discrepancies (20-30s, TTL: 30 days)
-- Stage 4: Verdict & Truth Index (instant, TTL: 30 days)

ALTER TABLE shadow_specs 
ADD COLUMN IF NOT EXISTS stages JSONB DEFAULT '{
  "stage_1": {"status": "pending", "completed_at": null, "ttl_days": 30, "data": null},
  "stage_2": {"status": "pending", "completed_at": null, "ttl_days": 14, "data": null},
  "stage_3": {"status": "pending", "completed_at": null, "ttl_days": 30, "data": null},
  "stage_4": {"status": "pending", "completed_at": null, "ttl_days": 30, "data": null}
}'::jsonb;

-- Create index for faster stage queries
CREATE INDEX IF NOT EXISTS idx_shadow_specs_stages ON shadow_specs USING gin(stages);

-- Backfill existing rows with default stages structure
UPDATE shadow_specs 
SET stages = '{
  "stage_1": {"status": "done", "completed_at": null, "ttl_days": 30, "data": null},
  "stage_2": {"status": "done", "completed_at": null, "ttl_days": 14, "data": null},
  "stage_3": {"status": "done", "completed_at": null, "ttl_days": 30, "data": null},
  "stage_4": {"status": "done", "completed_at": null, "ttl_days": 30, "data": null}
}'::jsonb
WHERE stages IS NULL;
