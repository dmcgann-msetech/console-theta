# Changelog

All notable changes to **MSE Staff Console / Pyrelane Console**, in reverse-chronological order.

Format: each entry is a short description plus the commit hash. Sections are grouped by release / cleanup pass, newest first.

---

## 2026-04-26 — A/R: separate Payments Received table from invoices

Refined the Accounts Receivable page so paid receipts no longer share a row
type with outstanding invoices. The top **Invoices** table stays
invoice-only; a new **Payments Received** card below lists paid receipts
pulled from `client_forms` with their own total — keeping outstanding A/R
and incoming cash visually distinct without waiting on Phase 2.

- **New Payments Received table** below the A/R invoice table, showing
  Receipt #, Related Invoice, Client, Amount, Payment Date, Method,
  Reference, Status, with a **Total received** KPI summed independently
  from the A/R totals.
- **Invoice table unchanged** — still invoice-only, still defaults to
  Open / Outstanding. No data migration; existing records (e.g.
  `MSE-PR-0002` $5,500 → `MSE-INV-0002`, `MSE-PR-0003` $2,500 →
  `MSE-INV-0003`) appear automatically on first load.
- **Receipt rows** are clickable and open the saved receipt form. Related
  invoice, payment method, reference, and date of payment are pulled
  tolerantly from the form `data` JSON (handles both id-suffix and
  label-field storage).
- **GL untouched** — receipts still post the Cash debit + A/R credit
  pair; Audit Trail still records receipts. No invoice/receipt
  save/view/print path changed.

---

## 2026-04-26 — A/R table defaults to outstanding-only

Fixed a display mismatch where the A/R top summary (e.g. `$4,500`) reflected
**outstanding** invoices but the invoice table below listed every invoice
including paid ones, so the totals and table looked inconsistent.

- **Default view:** the A/R invoice table now defaults to **Open / Outstanding**
  (paid invoices hidden), so the table reconciles with the top A/R / aging
  totals at a glance.
- **Status filter dropdown:** options are now **Open / Outstanding** (default),
  All status, Sent, Partial, Overdue, Paid, Draft. Switch to **Paid** or
  **All status** to see paid invoices when needed.
- **Total A/R KPI:** clicking the Total A/R card filters to outstanding (matches
  the KPI's own "All outstanding invoices" sublabel).
- KPIs and aging buckets continue to be computed on outstanding invoices only —
  no totals math changed. Only the default table filter changed.

---

## 2026-04-26 — Accounting sync for saved invoices & receipts

Tied saved `client_forms` invoices and receipts into the Accounting module
so existing records show up in Accounts Receivable, the General Ledger, and
the Overview's Recent Activity automatically — no schema changes, no manual
backfill step.

- **A/R:** Saved invoices (`form_type='invoice'`) populate the A/R table with
  client, invoice number (`form_number`), amount, issued date, age, and
  status (Paid / Sent / Overdue). Existing rows backfill on first load.
- **General Ledger:** Each saved invoice posts an A/R debit; each saved
  receipt posts a Cash debit + A/R credit pair so cash-in is reflected.
- **Overview / Audit Trail:** Receipts surface as `Post` events in
  Recent Activity with the receipt number, amount, and client.
- **Paid linkage:** When a receipt's related-invoice number matches a saved
  invoice, the existing save flow already flips the invoice's status to
  `paid` (and writes `data.__paid`); the bridge now reads both signals so
  the A/R row shows **Paid**.
- **Idempotent:** Rows are derived (not durably written) and keyed by
  `form_number` / form id, so re-renders dedupe naturally and existing
  saved view / edit / print flows are untouched.

---

## 2026-04-26 — Documentation foundation

Documentation cleanup pass. No application behavior changes.

- Added top-level `README.md` describing the app, deploy model, core workflow, safety standards, and basic test checklist.
- Added this `CHANGELOG.md`, summarizing major recent work with commit hashes.
- Added `docs/OPERATING_RULES.md` capturing the three operating rules every change must follow (one narrow job, push after each fix with docs updated, keep checklist/handoff current).

---

## Recent feature & fix work

### Field & dispatch

- `fdba289` — **Field Status:** set status and short note directly from the profile popover, without leaving the current page.
- `5f54c5c` — **Tickets:** multi-person assignment for field jobs (a ticket can be assigned to several staff at once).
- `f0c2cdd` — **Cards & notifications:** multi-member card assignment plus Supabase-backed notifications.

### Settings — Quick Links

- `e35e962` — **Quick Links:** open-link button (icon) added to each row, so a saved link can be opened in one click.
- `c8f3386` — **Quick Links:** save fix — uses a bigint-safe predicate when clearing rows so saves no longer drop entries.

### Clients & forms

- `3f1cf31` — **Client form picker:** all 11 templates now available — proposal, consultation, diagnostic, sign-off, receipt, terms, invoice, and the rest.
- `b6625b3` — **Forms:** attach existing `client_forms` records to a client.
- `edb8e82` — **Forms:** edit saved invoices, receipts, and forms in place.
- `820233b` — **Forms:** receipt cash-out marks the related invoice as paid.
- `9fbd99a` — **Forms:** capture all filled fields in the saved snapshot, plus invoice number in body.
- `85b9774` — **Forms:** stop reusing the static `MSE-INV-0005` placeholder; defer to the DB-assigned `form_number`.
- `5476ca0` — **Forms:** `client_forms` saves were failing silently — now actually persist (critical fix).
- `5fe35f2` — **Forms:** `client_forms` check constraints + mobile modal layout.

### Sign-in log

- `39520d1` — **Sign-in log:** capture IP address and approximate location, surface them in the UI and CSV export.

### Tickets — attachments

- `8dfcd63` — **Attachments:** drop the `bucket` column from the attachments insert payload so inserts succeed.
- `545b820` — **Attachments:** harden upload path against bad iOS camera filenames (e.g. ones with stray characters).
- `90f06fa` — **Attachments:** preserve `storage_path` during the attachments insert retry.
- `3aae6f0` — **Attachments:** mobile-first attach bottom sheet, plus wrap-friendly file rows.
- `730717c` — **Attachments:** per-upload description / notes field for ticket attachments.
- `fbf7d81` — **Attachments:** photo / file attachments on the ticket detail page for field use.
- `67b7bad` — **Attachments:** unified — every entity gets file uploads, plus a master Documents view.

### Tickets — safety

- `f18be44` — **Deletes:** require confirmation before destructive deletes.

### Document rendering & print

- `45f3220` — **Forms:** readable, balanced header for saved receipt / invoice docs.
- `1af78fa` — **Print:** popup-window strategy for saved receipt / invoice print on iOS.
- `0afdec6` — **Forms:** receipt-shaped saved snapshot + multi-page print.
- `f3bb992` — **Forms:** fit-to-width mobile viewer + disable conflicting global print CSS.
- `5b90613` — **Print:** body-swap print host overrides global `visibility: hidden` on iOS.
- `045f378` — **Print:** full-viewport `visibility: hidden` iframe for iOS print preview.
- `008010c` — **Forms:** inline scrollable viewer + full-page print iframe for iOS.
- `59b036a` — **Forms:** unify storage bucket + data fallback for view, plus reliable print.
- `e8b391f` — **Print:** Print button on every detail panel + universal `printPanel` helper.
- `7c807ce` — **Documents:** iframe viewer for saved forms + Documents column mapping.

### Documents page

- `04c667f` — **Docs:** help banner + regenerate-with-template button for old saved forms.
- `d1407fd` — **Docs:** auto-load Documents page from Supabase + premium invoice template.

### Mobile / modals

- `6f7e23a` — Form modal horizontal overflow on mobile fixed.
- `ddff02b` — Form modal scroll trap on mobile fixed.
- `1ed6328` — Route ALL invoice triggers to the real form modal that persists.
- `74214d1` — A/R New Invoice button now opens the real form modal that persists to `client_forms`.

### Branding

- `3a92d56` — **Pyrelane:** badge + product name on login screen.
- `b8c3358` — **Pyrelane branding:** header badge, divider, MSE Tech / Pyrelane Console label, favicon.

---

## Earlier baseline

- `799fafe` — **v1.3.0** — Supabase persistence, Google SSO (`@msetech.org`), form client auto-populate, live / offline indicator.
- `6ce4c88` — **v1.2.0** — 11 print-matched form templates, MSE McGann Systems Engineering legal name consistent throughout.
- `29131c1` — **v1.1.0** — Full accounting module, notifications, editable tickets / clients / vendors, project board, company pre-filled.
- `a158882` — Initial static build for Cloudflare Pages.
