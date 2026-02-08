-- AUDIT DOCTOR — Schema Snapshot
select column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name='audit_runs'
order by ordinal_position;

-- AUDIT DOCTOR — Required Columns Present?
select
  max((column_name='stage_state')::int) as has_stage_state,
  max((column_name='last_heartbeat')::int) as has_last_heartbeat,
  max((column_name='locked_at')::int) as has_locked_at,
  max((column_name='attempt_count')::int) as has_attempt_count
from information_schema.columns
where table_schema='public'
  and table_name='audit_runs'
  and column_name in ('stage_state','last_heartbeat','locked_at','attempt_count');

-- AUDIT DOCTOR — Status Constraint Definition
select pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.audit_runs'::regclass
  and conname='audit_runs_status_check';

-- AUDIT DOCTOR — Functions Exist?
select proname
from pg_proc
join pg_namespace n on n.oid = pg_proc.pronamespace
where n.nspname='public'
  and proname in ('tick_audit_runner','reap_stuck_audits','claim_next_audit_run');

-- AUDIT DOCTOR — Cron Jobs (should show runner + reaper)
select jobid, schedule, command, nodename, nodeport, database, username, active
from cron.job
order by jobid;

-- AUDIT DOCTOR — Cron Job Run Details (last 25)
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
order by start_time desc
limit 25;

-- AUDIT DOCTOR — Active Runs (pending/running)
select
  id, product_id, status, created_at, started_at, finished_at, locked_at, last_heartbeat,
  stage_state->>'current' as stage
from public.audit_runs
where status in ('pending','running')
order by created_at desc
limit 25;

-- AUDIT DOCTOR — Heartbeat Lag (running only)
select
  id,
  product_id,
  status,
  last_heartbeat,
  now() - last_heartbeat as heartbeat_lag,
  stage_state->>'current' as stage
from public.audit_runs
where status='running'
order by created_at desc
limit 25;

-- AUDIT DOCTOR — Drilldown by Product
-- Replace :product_id with a UUID string
select
  id, product_id, status, created_at, started_at, finished_at, locked_at, last_heartbeat,
  stage_state->>'current' as stage
from public.audit_runs
where product_id = :product_id
order by created_at desc
limit 10;

-- AUDIT DOCTOR — Active Run Uniqueness Check (per product)
select
  product_id,
  count(*) filter (where status in ('pending','running')) as active_run_count
from public.audit_runs
group by product_id
having count(*) filter (where status in ('pending','running')) > 0
order by active_run_count desc;

-- AUDIT DOCTOR — Claim Next Run (manual test)
select public.claim_next_audit_run();
