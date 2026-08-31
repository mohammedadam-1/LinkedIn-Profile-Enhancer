# LinkedIn post automation

This automation stores profiles, scraped posts, and run history in Supabase rather than Google Sheets.

## Setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the SQL files in `supabase/migrations/` in filename order.
3. Copy `.env.example` to `.env` and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GROQ_CLOUD_API_KEY2`.
4. Import profiles:

   ```powershell
   npm.cmd run import:profiles -- examples/profiles.csv
   ```

5. Run the automation:

   ```powershell
   npm.cmd start
   ```

Chrome is started automatically with a persistent profile (`.chrome-profile/` by default, headless unless `CHROME_HEADLESS=false`). To sign in to LinkedIn for the first time, run:

```powershell
npm.cmd run chrome:login
```

Sign in and close the window; the session is saved and reused by the worker. If a Chrome instance with remote debugging is already running on `BROWSER_CDP_URL`, it is used as-is.

## CSV format

`linkedin_url` is required. `display_name`, `team`, `status`, and `refresh_interval_days` are optional. Valid statuses are `active` and `paused`. Re-importing an existing LinkedIn URL updates its profile record instead of creating a duplicate.

Successful profiles are re-scraped on their `refresh_interval_days` schedule. A profile that fails to scrape is deleted automatically along with its stored posts; import it again to retry from scratch.

The service-role key is server-only. Do not place it in a browser application or commit it to Git.

## Production

Read [the operations runbook](docs/operations.md) before deploying. The worker is intentionally a single-run command: use an operating-system scheduler or managed job runner to invoke `npm.cmd start`. Run `npm.cmd run preflight` after each configuration or database change.
