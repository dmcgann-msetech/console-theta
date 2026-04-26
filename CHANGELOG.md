# Changelog

All notable changes to **MSE Staff Console / Pyrelane Console**, in reverse-chronological order.

Format: each entry is a short description plus the commit hash. Sections are grouped by release / cleanup pass, newest first.

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
