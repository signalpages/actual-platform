-- 003_audit_jobs_v1.sql

-- Enable required extensions
create extension if not exists "pg_cron" with schema "extensions";
create extension if not exists "pg_net" with schema "extensions";

-- TASK 1: Schema Alignment
-- audit_runs core lifecycle updates
alter table audit_runs
  add column if not exists stage_state jsonb not null default '{}'::jsonb,
  add column if not exists last_heartbeat timestamptz,
  add column if not exists attempt_count int default 0,
  add column if not exists locked_at timestamptz;

-- Index for runner pickup
create index if not exists idx_audit_runs_pending
  on audit_runs (status, created_at)
  where status in ('pending', 'running');

-- Function: pick + run next audit
create or replace function public.tick_audit_runner()
returns void
language plpgsql
as $$
declare
  r record;
  -- IMPORTANT: Replace these with your actual Project URL/Key or manage via secrets
  -- In a real migration, often these are interpolated or fetched from a secure store
  worker_url text := 'https://REPLACE_WITH_PROJECT_REF.supabase.co/functions/v1/audit-runner';
  anon_key text := 'REPLACE_WITH_ANON_KEY';
  payload jsonb;
begin
  -- 1. Pick next pending run with SKIP LOCKED
  select * into r
  from audit_runs
  where status = 'pending'
  order by created_at asc
  limit 1
  for update skip locked;

  if r.id is null then
    return;
  end if;

  -- 2. Update state to running
  update audit_runs
  set
    status = 'running',
    started_at = now(),
    last_heartbeat = now(),
    locked_at = now(),
    attempt_count = coalesce(attempt_count, 0) + 1
  where id = r.id;

  -- 3. Invoke Edge Function via pg_net
  payload := jsonb_build_object('run_id', r.id);

  perform net.http_post(
    url := worker_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    )
  );
end;
$$;

-- Function: reap stuck audits
create or replace function public.reap_stuck_audits()
returns void
language plpgsql
as $$
begin
  -- 1. Retry stale runs if attempts < 3
  update audit_runs
  set
    status = 'pending',
    last_heartbeat = null,
    locked_at = null,
    error = 'Heartbeat timeout - retrying'
  where status = 'running'
    and last_heartbeat < now() - interval '5 minutes'
    and attempt_count < 3;

  -- 2. Fail stale runs if attempts >= 3
  update audit_runs
  set
    status = 'failed',
    finished_at = now(),
    error = 'HEARTBEAT_TIMEOUT'
  where status = 'running'
    and last_heartbeat < now() - interval '5 minutes'
    and attempt_count >= 3;
end;
$$;

-- TASK 2: Cron Jobs
-- Idempotent schedule creation
select cron.schedule(
  'audit_runner_every_minute',
  '* * * * *',
  $$ select public.tick_audit_runner(); $$
);

select cron.schedule(
  'audit_reaper_every_5',
  '*/5 * * * *',
  $$ select public.reap_stuck_audits(); $$
);
