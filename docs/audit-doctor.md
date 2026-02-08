# Audit Doctor Manual

Use this guide to interpret the results of `docs/audit-doctor.sql`.

| Indicator | Green ✅ | Yellow ⚠️ | Red 🔴 |
| :--- | :--- | :--- | :--- |
| **Cron Jobs** | `tick_audit_runner` (1m) & `reap_stuck_audits` (5m) exist and are active. | Jobs exist but `last_run` is old (>2m for runner). | No jobs listed. |
| **Cron History** | `succeeded` with recent timestamps. | `failed` occasionally. | Consistently `failed` or no history. |
| **Active Runs** | Small number of 'pending'/'running'. `heartbeat_lag` < 1m. | `pending` piling up (>10). `heartbeat_lag` > 1m. | `running` stuck with `heartbeat_lag` > 5m (Reaper should catch these). |
| **Stage Progression** | `stage` changes (discover -> fetch -> ...). | `stage` stagnant for >1m. | `stage` null or unchanging for >5m. |
| **Active Uniqueness** | `active_run_count` is 1 per product. | - | `active_run_count` > 1 for same product (Concurrency bug). |

## Validation Procedure

1.  **Run Schema Snapshot**: Verify `stage_state`, `last_heartbeat`, `locked_at`, `attempt_count` exist.
2.  **Run Required Columns Present?**: Should return `1` for all columns.
3.  **Run Status Constraint Definition**: Ensure it lists 'failed' (or similar error state) in the allowed values. (e.g., `CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'done'::text, 'failed'::text, 'error'::text]))`).
4.  **Run Functions Exist?**: Should list `tick_audit_runner`, `reap_stuck_audits`, `claim_next_audit_run`.
5.  **Run Cron Jobs**: Check for 2 rows. `active` should be true.
6.  **Run Cron History**: Look for `status` = 'succeeded'. If 'failed', check `return_message` (could be net error or permission).
7.  **Run active Runs + Heartbeat Lag**: `heartbeat_lag` should be low (seconds). If > 5 minutes, Reaper isn't working or runs are crashing hard before heartbeat.
8.  **Drilldown**: Use if debugging specific product issues.

## Expected Outcomes

-   **Schema**: All columns present.
-   **Status**: Constraint allows 'failed' or 'error'.
-   **Cron**: "succeeded".
-   **Heartbeats**: Updating regularly.

## Admin Helpers

If configured, you can use these functions to manually intervene:

-   `select public.admin_mark_run_failed('<run_id>', 'Manual failure reason');`
    -   Forces a run to 'failed' state and stops it from being picked up (clears locks).
-   `select public.admin_retry_run('<run_id>');`
    -   Resets a run to 'pending' to be picked up again by the runner. Increments `attempt_count`.

## Troubleshooting

-   **Heartbeat Lag Large**: The Edge Function is likely crashing or timing out. Check Supabase Edge Function logs.
-   **Cron Failed**: Check `pg_net` extension status and `vault` secrets (if used) or `ANON_KEY` validity.
-   **Duplicate Active Runs**: The `tick_audit_runner` might not be using `SKIP LOCKED` correctly or transaction isolation is weak. (Should be fixed in V1).
