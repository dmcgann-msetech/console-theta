# MSE Tech Console — Backup & Recovery Runbook

**Last updated:** 2026-04-25
**Audience:** A future AI agent or technical human who has never seen this system before but needs to restore data after something bad happens.
**Read time:** 10 minutes. Print this. Keep it somewhere safe.

---

## TL;DR — If You're Panicking Right Now

1. **Stay calm.** Your data is backed up nightly. Worst-case you've lost <24 hours.
2. Backups live at: `https://github.com/dmcgann-msetech/mse-console/tree/master/backups`
3. Each subfolder is one night, named `YYYY-MM-DD`. Open the most recent one.
4. Each table is its own JSON file. Load them back into Supabase via the SQL editor (see "Restore from Backup" below).
5. The console reads from Supabase. As soon as Supabase has data, the console works again.

If you need to skip ahead, jump to **"Common Failure Modes"** at the bottom.

---

## What This System Is

**MSE Tech Console** is a custom internal operations + finance app for MSE Tech (a small IT services company in Massachusetts/Rhode Island). It is NOT a SaaS product. It runs as:

- **Frontend:** A single `index.html` file served by Cloudflare Workers from `console.msetech.org` (custom domain) and `mse-staff-console.dmcgann.workers.dev`.
- **Backend:** Supabase Postgres database, project ID `gaolcfupyanbtskamdll`, URL `https://gaolcfupyanbtskamdll.supabase.co`.
- **Auth:** Google OAuth via Supabase, restricted to `@msetech.org` accounts.
- **Source code:** GitHub repo `dmcgann-msetech/mse-console` on `master` branch.
- **Deploy:** GitHub push → Cloudflare auto-deploy (no manual step).

That's it. There's no separate API server, no Redis, no other moving parts. **All durable data is in Supabase.** The HTML is stateless.

---

## What "Backup" Means Here

Every night at **07:00 UTC (03:00 ET)**, GitHub Actions runs `scripts/backup.py`. It:

1. Connects to Supabase using the **service role key** stored as GitHub Secret `SUPABASE_SERVICE_KEY`.
2. Reads every row from every public table (37 tables as of writing).
3. Writes one JSON file per table into `backups/YYYY-MM-DD/`.
4. Writes a `manifest.json` with row counts, byte sizes, and SHA-256 checksums.
5. Commits and pushes to the `master` branch.
6. Prunes snapshot folders older than 30 days (older snapshots remain in git history).

**Where to find a backup:**
- Open `https://github.com/dmcgann-msetech/mse-console`
- Navigate to `backups/`
- Pick the date folder you want
- Each `.json` file is a complete dump of that table

---

## Restore from Backup — Step by Step

### Scenario 1: One specific table got nuked or corrupted

Example: `tickets` got accidentally truncated.

1. **Get the backup file:**
   - Go to `https://github.com/dmcgann-msetech/mse-console/tree/master/backups/<DATE>/tickets.json`
   - Click "Raw" → save the file locally (or right-click "Save link as")

2. **Open Supabase SQL editor:**
   - https://supabase.com/dashboard/project/gaolcfupyanbtskamdll/sql/new
   - You need to be logged in as a project admin (Darren has access)

3. **Optional safety net — back up the current bad state first:**
   ```sql
   CREATE TABLE tickets_corrupt_backup AS SELECT * FROM tickets;
   ```

4. **Truncate the broken table:**
   ```sql
   TRUNCATE TABLE tickets RESTART IDENTITY CASCADE;
   ```

5. **Insert the backup data.** The JSON file is a list of objects, one per row. The fastest way is:
   - In the Supabase Table Editor, open the `tickets` table
   - Click "Import data via CSV" if available, OR
   - Use this SQL pattern (paste the JSON inline):
     ```sql
     INSERT INTO tickets
     SELECT * FROM jsonb_populate_recordset(NULL::tickets, '<paste JSON array here>'::jsonb);
     ```

6. **Verify:**
   ```sql
   SELECT count(*) FROM tickets;
   ```
   Should match the row count in `backups/<DATE>/manifest.json`.

7. **Hard-refresh the live console.** Sign out and sign back in if needed.

### Scenario 2: Whole database wiped / Supabase project deleted

Hopefully never. But if it happens:

1. **Create a new Supabase project** at https://supabase.com.
2. **Re-apply the schema migrations** — they're tracked in Supabase's migration history. If lost, you can reconstruct from the `manifest.json` table list and the column definitions in the JSON dumps. Easier path: recreate the `mse_projects`, `project_notes`, `project_meetings` schemas using `phase1_baseline_rls` and `projects_v2_notes_meetings` migrations, applied in order, found in the Supabase dashboard → Database → Migrations.
3. **Restore each table** using the procedure above, in dependency order:
   - First: tables with no FK refs (`vendors`, `clients`, `staff`, `kanban_boards`, `mse_projects`, `assets`, `parts`, `company_documents`)
   - Then: tables that reference those (`vendor_files`, `tickets`, `kanban_columns`, `project_notes`, `project_meetings`, `kanban_cards`, etc.)
   - Last: audit/log tables
4. **Update the console's HTML** with the new Supabase URL and anon key:
   - Edit `index.html`, search for `SUPABASE_URL` and `SUPABASE_KEY` constants, update
   - Commit + push → Cloudflare auto-deploys
5. **Update GitHub Secrets** `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` with the new project's values.

### Scenario 3: A specific record got bad data and you want to revert just that row

1. Find the row in the relevant `backups/<DATE>/<table>.json` file
2. Use SQL to UPDATE just that row:
   ```sql
   UPDATE clients SET email = 'good@example.com', updated_at = now()
   WHERE id = 5;
   ```
3. No need to touch the rest of the data.

---

## Backup is Broken — How to Diagnose

The backup runs as a GitHub Action. If it fails, GitHub emails the repo owner (`dmcgann@msetech.org`).

### Check status

1. Go to https://github.com/dmcgann-msetech/mse-console/actions
2. Look for "Nightly Supabase Backup" workflow runs
3. Red ❌ = failed; click in to see logs

### Common causes & fixes

**"401 Unauthorized" or "Invalid JWT" in logs**
- The `SUPABASE_SERVICE_KEY` GitHub Secret is missing, expired, or wrong.
- **Fix:**
  1. Go to Supabase → Project Settings → API → "service_role" key → copy it
  2. GitHub repo → Settings → Secrets and variables → Actions → update `SUPABASE_SERVICE_KEY`
  3. Re-run the failed workflow from the Actions tab

**"Connection timeout" / "Could not resolve host"**
- Supabase or GitHub had transient downtime.
- **Fix:** Wait 30 min and re-run manually from the Actions tab. If it persists, check `https://status.supabase.com` and `https://www.githubstatus.com`.

**"Permission denied to push"**
- The workflow's `GITHUB_TOKEN` lost write permission, or branch protection was added.
- **Fix:** Repo → Settings → Actions → General → "Workflow permissions" → set to "Read and write permissions" and save.

**Workflow not running at all**
- Possible: workflow file disabled, or repo has been silent for 60 days (GitHub auto-disables scheduled workflows in repos that haven't had pushes in 60 days).
- **Fix:** Push any commit to wake it up, OR manually re-enable the workflow in the Actions tab.

**Manually trigger a backup right now**
1. Go to https://github.com/dmcgann-msetech/mse-console/actions
2. Click "Nightly Supabase Backup" in the left list
3. Click "Run workflow" → "Run workflow"
4. Wait ~2 min, refresh, check it succeeded

---

## Common Failure Modes (Beyond Backup)

### "The console is showing me a login screen but I'm signed in"
- Cause: Cloudflare cached old HTML. Cache headers should prevent this (commit `87ed039`), but check.
- **Fix:** Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R). If that doesn't work, purge Cloudflare cache: dashboard → console.msetech.org zone → Caching → Purge Everything.

### "All my data is gone but Supabase is fine"
- Probably a UI bug (loader not running, or RLS policy too strict). Open the browser DevTools → Console tab and look for errors.
- The data is still in Supabase. You can verify: SQL editor → `SELECT count(*) FROM tickets;`

### "Refreshing the projects page boots me to login"
- Was a cache bug. Fixed in commit `87ed039` by adding `_headers` file with `Cache-Control: no-store`.
- If it returns: check `_headers` file is still in repo root.

### "I can't sign in / Google OAuth is failing"
- Check Supabase → Authentication → Providers → Google is still configured with the right OAuth client ID/secret.
- Check the Authorized redirect URIs in Google Cloud Console include `https://gaolcfupyanbtskamdll.supabase.co/auth/v1/callback`.

---

## Required Secrets & Where They Live

| Secret | Used by | Where to find it |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | GitHub Actions backup | Supabase dashboard → Project Settings → API → "service_role" |
| `SUPABASE_URL` | GitHub Actions backup | `https://gaolcfupyanbtskamdll.supabase.co` |
| Google OAuth client ID/secret | Supabase Auth | Google Cloud Console → APIs & Services → Credentials |
| Cloudflare API token | (only if doing manual deploys) | Cloudflare dashboard → Profile → API Tokens |

If you rotate any of these, update **both** the place they're used (Supabase / GitHub Actions) AND your secure password manager.

---

## Recurring Maintenance ("Fire Drill")

Once every **3 months**, do a restore drill:

1. Pick yesterday's backup
2. Restore one table to a temporary `_test` table (e.g. `tickets_test`)
3. Compare row counts and a few random rows against production
4. Drop the test table
5. If anything went wrong, fix the runbook BEFORE you forget

This catches stale instructions, broken API calls, and assumed permissions before they matter in a real crisis.

---

## Phone-A-Friend Escalation

When you're truly stuck:

| Service | URL | Notes |
|---|---|---|
| Supabase support | https://supabase.com/support | Free tier = community support; paid = email/chat |
| Supabase Discord | https://discord.supabase.com | Fast for "is this expected?" questions |
| GitHub support | https://support.github.com | Use for Actions or repo issues |
| Cloudflare support | https://dash.cloudflare.com → Support | Free tier = community; paid = chat |

For MSE Tech business questions: Darren McGann <dmcgann@msetech.org>.

---

## Glossary

- **Anon key** — Supabase's public client key. Embedded in the HTML. Subject to RLS rules. Anyone can use it; they only see what RLS allows.
- **Service role key** — Supabase's superuser key. **Bypasses RLS.** Never put in client code or commit to git. Lives in GitHub Secrets only.
- **RLS (Row-Level Security)** — Postgres feature that filters which rows a query can see based on the user's identity. Configured per-table in Supabase.
- **Cloudflare Worker** — Edge server that runs your code worldwide. In our case, it serves a static HTML file.
- **PostgREST** — The HTTP API layer Supabase puts in front of Postgres. The backup script talks to it.

---

## When This Runbook Is Wrong

If a step in this runbook doesn't work the way it's described:

1. **Don't keep going.** A wrong step on top of a wrong step compounds.
2. Check the date at the top of this file. If it's >12 months old, parts may be stale.
3. Read the actual Supabase / GitHub docs for the specific step.
4. **Update this runbook** when you figure it out, so the next person doesn't suffer.

This document only stays useful if it's maintained. Treat it like code.
