/* =========================================================
   AUDIT DEBUG PACK — V1
   Replace product_id (and optionally run_id) below.
   ========================================================= */

with params as (
  select
    'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id,
    null::uuid as run_id  -- optionally set to a specific audit_runs.id
)
select * from params;

/* -------------------------
   1) LATEST RUNS FOR PRODUCT
   ------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  id as run_id,
  product_id,
  status,
  error,
  locked_at,
  last_heartbeat,
  now() - last_heartbeat as heartbeat_age,
  created_at,
  updated_at,
  finished_at
from public.audit_runs
where product_id = (select product_id from params)
order by created_at desc
limit 10;

/* -------------------------
   2) PICK “LATEST DONE” RUN
   ------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select id as latest_done_run_id
from public.audit_runs
where product_id = (select product_id from params)
  and status = 'done'
order by finished_at desc nulls last, created_at desc
limit 1;

/* --------------------------------------
   3) RUN DETAIL (set params.run_id first)
   -------------------------------------- */
with params as (
  select
    'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id,
    null::uuid as run_id
)
select *
from public.audit_runs
where id = (select run_id from params);

/* -----------------------------------
   4) STAGE STATE (PRETTY, IF PRESENT)
   ----------------------------------- */
with params as (
  select
    'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id
)
select
  r.id as run_id,
  r.status,
  jsonb_pretty(r.stage_state) as stage_state_pretty
from public.audit_runs r
where r.product_id = (select product_id from params)
order by r.created_at desc
limit 3;

/* -----------------------------------------
   5) RUNNING RUNS + HEARTBEAT AGE (ALL)
   ----------------------------------------- */
select
  id as run_id,
  product_id,
  status,
  locked_at,
  last_heartbeat,
  now() - last_heartbeat as heartbeat_age,
  error,
  created_at
from public.audit_runs
where status = 'running'
order by last_heartbeat asc nulls first
limit 50;

/* ---------------------------------------
   6) “ABOUT TO BE REAPED” (10m threshold)
   --------------------------------------- */
select
  id as run_id,
  product_id,
  last_heartbeat,
  now() - last_heartbeat as heartbeat_age
from public.audit_runs
where status = 'running'
  and last_heartbeat is not null
  and last_heartbeat < now() - interval '10 minutes'
order by last_heartbeat asc
limit 50;

/* -----------------------------------
   7) PENDING RUNS BACKLOG
   ----------------------------------- */
select
  id as run_id,
  product_id,
  status,
  created_at
from public.audit_runs
where status = 'pending'
order by created_at asc
limit 50;

/* =========================================================
   OUTPUTS — WHERE DOES THE AUDIT WRITE RESULTS?
   Tables found: audit_assessments, audits, audit_sources,
                canonical_specs, shadow_specs
   ========================================================= */

/* -----------------------------------
   8) shadow_specs: LATEST ROWS (PRODUCT)
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  id,
  product_id,
  created_at,
  updated_at,
  truth_score,
  is_verified,
  array_length(source_urls, 1) as source_url_count,
  jsonb_typeof(stages) as stages_type,
  jsonb_typeof(canonical_spec_json) as canonical_spec_json_type,
  jsonb_typeof(claimed_specs) as claimed_specs_type,
  jsonb_typeof(actual_specs) as actual_specs_type,
  jsonb_typeof(red_flags) as red_flags_type
from public.shadow_specs
where product_id = (select product_id from params)
order by created_at desc
limit 10;

/* -----------------------------------
   9) shadow_specs: CHECK “HAS DATA?”
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  id,
  created_at,
  (claimed_specs is not null) as has_claimed,
  (actual_specs is not null) as has_actual,
  (red_flags is not null) as has_red_flags,
  (canonical_spec_json is not null) as has_canonical_blob,
  truth_score,
  is_verified
from public.shadow_specs
where product_id = (select product_id from params)
order by created_at desc
limit 10;

/* -----------------------------------
   10) shadow_specs: SAMPLE PAYLOAD (SMALL)
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  id,
  created_at,
  left(claimed_specs::text, 500) as claimed_specs_preview,
  left(actual_specs::text, 500) as actual_specs_preview,
  left(red_flags::text, 500) as red_flags_preview,
  left(canonical_spec_json::text, 500) as canonical_preview
from public.shadow_specs
where product_id = (select product_id from params)
order by created_at desc
limit 3;

/* -----------------------------------
   11) canonical_specs: LATEST ROWS (PRODUCT)
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  *
from public.canonical_specs
where product_id = (select product_id from params)
order by created_at desc
limit 5;

/* -----------------------------------
   12) audit_assessments: LATEST ROWS (PRODUCT)
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  *
from public.audit_assessments
where product_id = (select product_id from params)
order by created_at desc
limit 5;

/* -----------------------------------
   13) audit_sources: COUNT + LATEST (PRODUCT)
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  count(*) as source_rows,
  max(created_at) as latest_source_at
from public.audit_sources
where product_id = (select product_id from params);

/* -----------------------------------
   14) audit_sources: LIST (PRODUCT)
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select
  id,
  product_id,
  created_at,
  left(url::text, 300) as url
from public.audit_sources
where product_id = (select product_id from params)
order by created_at desc
limit 50;

/* -----------------------------------
   15) audits: LATEST (PRODUCT)
   ----------------------------------- */
with params as (select 'a70b745d-7562-49ac-a018-545c6ce946f7'::uuid as product_id)
select *
from public.audits
where product_id = (select product_id from params)
order by created_at desc
limit 5;

/* =========================================================
   CONTRACT / UI DIAGNOSTICS
   ========================================================= */

/* -----------------------------------
   16) DOES UI EXPECT “specs” FIELD?
   Quick view: shadow_specs does NOT have specs.
   This query confirms columns.
   ----------------------------------- */
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'shadow_specs'
order by ordinal_position;

/* -----------------------------------
   17) FIND ANY TABLE THAT HAS “specs” COLUMN
   ----------------------------------- */
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name ilike '%spec%'
order by table_name, column_name;

/* -----------------------------------
   18) DOES ANY TABLE LINK TO audit_runs.id?
   (looking for run_id / audit_run_id columns)
   ----------------------------------- */
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name ilike '%run%'
order by table_name, column_name;

/* =========================================================
   CRON / DISPATCH DIAGNOSTICS
   ========================================================= */

/* -----------------------------------
   19) CRON JOBS LIST (what’s scheduled)
   ----------------------------------- */
select jobid, schedule, command, nodename, nodeport, database, username, active
from cron.job
order by jobid;

/* -----------------------------------
   20) CRON RUN DETAILS (last 100)
   ----------------------------------- */
select
  jobid,
  runid,
  status,
  command,
  return_message,
  start_time,
  end_time
from cron.job_run_details
order by start_time desc
limit 100;
