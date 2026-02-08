-- 004_audit_helpers.sql

-- Helper: Claim next run (for manual debugging or doctor checks)
-- Returns the run_id of the claimed run, or NULL if no pending runs exist.
-- Side effect: Marks the run as 'running' and updates timestamps.
create or replace function public.claim_next_audit_run()
returns uuid
language plpgsql
as $$
declare
  r_id uuid;
begin
  -- Find and lock
  select id into r_id
  from audit_runs
  where status = 'pending'
  order by created_at asc
  limit 1
  for update skip locked;

  if r_id is not null then
    -- Mark as running
    update audit_runs
    set
      status = 'running',
      started_at = now(),
      last_heartbeat = now(),
      locked_at = now(),
      attempt_count = coalesce(attempt_count, 0) + 1
    where id = r_id;
  end if;

  return r_id;
end;
$$;

-- Admin Helper: Mark Run Failed
-- sets status='failed', clears locked_at, sets error=reason
create or replace function public.admin_mark_run_failed(run_id uuid, reason text)
returns void
language plpgsql
security definer
as $$
begin
  update audit_runs
  set
    status = 'failed',
    finished_at = now(),
    locked_at = null,
    error = reason
  where id = run_id;
end;
$$;

-- Admin Helper: Retry Run
-- sets status='pending', clears locked_at/heartbeat, increments attempt_count
create or replace function public.admin_retry_run(run_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update audit_runs
  set
    status = 'pending',
    locked_at = null,
    last_heartbeat = null,
    attempt_count = coalesce(attempt_count, 0) + 1,
    error = null
  where id = run_id;
end;
$$;
