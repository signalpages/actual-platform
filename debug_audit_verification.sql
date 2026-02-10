/* =========================================================
   AUDIT V1 — CANONICAL VERIFICATION QUERY PACK
   
   Usage:
   1. Replace <PRODUCT_ID> with the UUID of the product you are debugging.
   2. Run queries individually to diagnose specific stages of the failure.
   ========================================================= */

-- 1️⃣ Running Audits + Heartbeat Age
-- Detect stalled runners immediately.
select
  id as run_id,
  product_id,
  status,
  locked_at,
  last_heartbeat,
  now() - last_heartbeat as heartbeat_age,
  error,
  created_at,
  updated_at
from public.audit_runs
where status = 'running'
order by last_heartbeat asc nulls first
limit 50;
-- Expected: heartbeat_age < 30s for active audits. > 2-3 mins is dead.

-- 2️⃣ Recent Audit Runs for Product
-- Confirms lifecycle transitions.
-- Replace <PRODUCT_ID> below
select
  id,
  product_id,
  status,
  error,
  created_at,
  updated_at,
  finished_at
from audit_runs
where product_id = '<PRODUCT_ID>'
order by created_at desc
limit 5;

-- 3️⃣ Cron Activity — Runner & Reaper
-- Verify cron isn’t masking failures.
select
  jobid,
  runid,
  command,
  status,
  return_message,
  start_time,
  end_time
from cron.job_run_details
where command ilike '%tick_audit_runner%'
   or command ilike '%reap_stuck_audits%'
order by start_time desc
limit 50;
-- Red Flag: Reaper repeatedly firing with STUCK_RUN_TIMEOUT.

-- 4️⃣ Shadow Specs: Structural Sanity Check
-- Confirm audit output actually exists.
-- Replace <PRODUCT_ID> below
select
  id,
  product_id,
  updated_at,
  is_verified,
  truth_score,
  coalesce(jsonb_array_length(canonical_spec_json->'claim_profile'), 0) as claim_profile_len,
  coalesce(jsonb_array_length(canonical_spec_json->'discrepancies'), 0) as discrepancies_len,
  coalesce(jsonb_array_length(red_flags), 0) as red_flags_len,
  stages
from public.shadow_specs
where product_id = '<PRODUCT_ID>'
order by updated_at desc
limit 5;
-- Expected: claim_profile_len > 0, discrepancies_len >= 0, stages populated.

-- 5️⃣ Shadow Specs Table Schema (Ground Truth)
-- Eliminates column name confusion.
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'shadow_specs'
order by ordinal_position;

-- 6️⃣ Downstream Table Population Check
-- Verifies fan-out after synthesis.
select 'audit_assessments' as table_name, count(*) as row_count from public.audit_assessments
union all
select 'audit_sources' as table_name, count(*) as row_count from public.audit_sources
union all
select 'audits' as table_name, count(*) as row_count from public.audits;
-- Red Flag: shadow_specs populated but these are 0 -> pipeline stops after synthesis.

-- 7️⃣ Table Discovery (Forensics)
-- Ensures no writes are landing in unexpected tables.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and (
    table_name ilike '%spec%'
    or table_name ilike '%audit%'
    or table_name ilike '%result%'
    or table_name ilike '%forensic%'
  )
order by table_name;
