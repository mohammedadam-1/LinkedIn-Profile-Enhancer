# Operations runbook

## Deployment model

Run one dedicated worker on a managed Windows or Linux host. The scheduler invokes `npm run preflight` and then `npm start` at the chosen cadence (for example, hourly). Do not run more than one worker at a time; the database lease prevents overlapping jobs and expires automatically if a worker crashes.

The worker needs an authenticated Chrome profile started with remote debugging and `BROWSER_CDP_URL` set to its CDP endpoint. Keep this endpoint private to the worker host. It is not an HTTP service for team members.

## Before a deployment

1. Back up the Supabase project.
2. Run the newest SQL file in `supabase/migrations/` through the Supabase SQL Editor.
3. Set environment variables from `.env.example` in the host's secret manager. Never copy `.env` into an image or source control.
4. Run `npm.cmd run check` and `npm.cmd run preflight`.
5. Run one controlled job with a small `MAX_PROFILES_PER_RUN`, then inspect `automation_runs` and `posts` in Supabase.

## Monitoring

The worker emits JSON logs. Forward stdout to the host's log collector and alert on `automation_failed`, `profile_failed`, `run_completion_failed`, and `run_lock_release_failed` events.

Check these tables daily:

- `automation_runs`: failed runs, duration, profiles succeeded/failed.
- `profiles`: shrinking row count can indicate profiles removed after scrape failures; correlate with `profile_failed_deleted` log events.
- `automation_locks`: a lock past its expiry indicates a crashed job; it is automatically reclaimable after expiry.

## Recovery

- If a profile fails, it is deleted immediately (including its stored posts); import it again to retry from scratch. Successful profiles keep their `refresh_interval_days` schedule and no posts are duplicated because `posts` uses `(profile_id, post_fingerprint)` as its unique key.
- If a job is interrupted, wait for `RUN_LOCK_MINUTES` or verify the prior process has stopped before starting another worker.

## Security

- The Supabase service-role key is permitted only on this worker. It bypasses RLS and must never be placed in a client, dashboard, browser extension, or shared document.
- The production migration enables RLS and removes `anon` and `authenticated` access to the internal tables. The worker remains authorized through `service_role`.
- Rotate Supabase and Groq keys immediately if they are committed, pasted into tickets, or otherwise exposed.
