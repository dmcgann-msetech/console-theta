# MSE Staff Console (Pyrelane Console)

Custom internal operations and finance app for **MSE Tech** — a small IT services company in Massachusetts / Rhode Island. Used by staff for tickets, clients, dispatch, field work, documents, and accounting.

> Branded as **Pyrelane Console** in the UI (header badge, login screen, favicon). "MSE Staff Console" and "Pyrelane Console" refer to the same app.

- **Live URL:** <https://console.msetech.org>
- **Backup URL:** <https://mse-staff-console.dmcgann.workers.dev>
- **Repo:** <https://github.com/dmcgann-msetech/mse-console>

---

## What it is

A single-page internal app, deployed as a static `index.html` served from Cloudflare Workers, backed by Supabase (Postgres + Auth + Storage).

- **Frontend:** one `index.html` file (vanilla JS / HTML / CSS, no build step)
- **Backend:** Supabase project `gaolcfupyanbtskamdll`
- **Auth:** Google OAuth via Supabase, restricted to `@msetech.org` accounts
- **Deploy:** push to `master` → Cloudflare auto-deploys (no manual step)
- **Backups:** GitHub Actions run nightly at 07:00 UTC, dumping every public table to `backups/YYYY-MM-DD/`

For full backup and recovery procedure, see [`RUNBOOK.md`](./RUNBOOK.md).

---

## Core workflow

**Tickets are the unit of work.** Everything else hangs off them or supports them:

- **Tickets** — work orders, with multi-person field assignment, attachments, and per-upload notes.
- **Clients** — contacts, locations, and a forms picker (proposal, consultation, diagnostic, sign-off, receipt, terms, invoice, and more — 11 templates).
- **Documents / Forms** — invoices, receipts, proposals, etc. saved as `client_forms` records, viewable and editable in-place, printable on iOS/desktop.
- **Accounting** — Accounts Receivable, General Ledger, and the Overview's Recent Activity automatically reflect every saved invoice and receipt from `client_forms` (no separate accounting entry needed). The A/R page splits invoices and payments cleanly: the **Invoices** table on top is invoice-only (defaults to Open / Outstanding) and a separate **Payments Received** table below lists paid receipts with related invoice, amount, payment date, method, reference, and status — totalled separately so outstanding A/R and incoming cash don't get mixed up. Receipts also post Cash + A/R rows in the GL; receipts without a related invoice still show as incoming payments. The **Month-End Close** and **Reconciliation** views compute their `T+N` badge automatically — `N` is the number of business days (Sat/Sun excluded) elapsed since the last calendar day of the most recently ended month, which is also the quarter close for Mar/Jun/Sep/Dec. The period label and close date update on every render.
- **Dispatch & Field Status** — field staff can quickly set their own status and a short note from the profile popover.
- **Attachments** — every entity supports file uploads; a master Documents view aggregates them.
- **Settings** — Quick Links, sign-in log (with IP and approximate location), and per-user preferences.

---

## Safety standards

These rules apply to every change to this repo:

1. **One narrow job at a time.** Don't bundle unrelated fixes.
2. **Preserve working features.** Don't touch behavior outside the task's scope.
3. **Push after each completed fix.** `master` is the deploy branch.
4. **Update docs every time.** Maintain `README.md`, `CHANGELOG.md`, and `RUNBOOK.md` as part of the work — not after.

See [`docs/OPERATING_RULES.md`](./docs/OPERATING_RULES.md) for the operating rules in full.

---

## Basic test checklist

After any change, before pushing to `master`, verify the obvious paths still work:

- [ ] **Sign in** with a `@msetech.org` Google account; sign out; sign back in.
- [ ] **Tickets:** open a ticket, edit a field, attach a file, delete an attachment (confirmation prompt fires).
- [ ] **Clients:** open a client, open the forms picker, create a new form, save it, reopen it.
- [ ] **Documents:** view a saved invoice/receipt, print preview renders correctly on desktop and iOS.
- [ ] **Accounting → A/R:** the invoice table defaults to **Open / Outstanding** (paid invoices hidden) so the table totals reconcile with the top A/R / aging KPIs. Switching the status filter to **Paid** or **All status** reveals paid invoices with a status badge. Below the invoice table, the **Payments Received** section lists every paid receipt from `client_forms` (receipt #, related invoice, client, amount, payment date, method, reference, status) and shows a **Total received** sum that is independent of A/R. Clicking a receipt row opens the saved receipt form. Saving a new receipt with a related invoice number flips the matching A/R row to **Paid** and adds a Cash + A/R pair to the General Ledger.
- [ ] **Field Status:** open the profile popover, change status, set a short note, confirm it persists.
- [ ] **Settings → Quick Links:** add a row, save, reopen, click the open-link button.
- [ ] **Sign-in log:** confirm latest login row shows IP and approximate location.
- [ ] **No console errors** in the browser DevTools.

---

## Where things live

| File / dir | Purpose |
|---|---|
| `index.html` | The entire frontend. One file. |
| `_headers` | Cloudflare cache headers (`Cache-Control: no-store`). |
| `wrangler.toml` | Cloudflare Worker config. |
| `scripts/backup.py` | Nightly Supabase → JSON backup script. |
| `.github/workflows/` | GitHub Actions (nightly backup). |
| `backups/YYYY-MM-DD/` | Nightly snapshots of every public table. |
| `RUNBOOK.md` | Backup, restore, and disaster recovery. |
| `CHANGELOG.md` | What changed and when, in reverse-chronological order. |
| `docs/OPERATING_RULES.md` | The three operating rules every change must follow. |

---

## Contact

Business / app owner: **Darren McGann** — `dmcgann@msetech.org`
