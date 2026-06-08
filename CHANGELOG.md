# Changelog

All notable changes to **MSE Staff Console / Pyrelane Console**, in reverse-chronological order.

Format: each entry is a short description plus the commit hash. Sections are grouped by release / cleanup pass, newest first.

---

## 2026-06-08 — Refactor: extract remaining inline JS into external modules (complete theta-build split)

Completed the split of the monolithic `index.html`: moved all ~27,950 lines of the main inline `<script>` block into 13 external modules under `js/` (`core/init.js`, `core/data.js`, `core/ui.js`, `core/notifications.js`, `core/settings.js`, `dispatch/dispatch.js`, `projects/projects.js`, `projects/kanban.js`, `accounting/accounting.js`, `accounting/documents.js`, `forms/forms.js`, `forms/documents-page.js`, `inventory/parts.js`), loaded via ordered `<script src>` tags before the previously-extracted ticket/staff/inventory modules. Pure restructure — byte-for-byte identical JS, no behavior change; the small inline bootstrap scripts (error handling, pull-to-refresh, global search) remain inline. `index.html` shrank from ~41,900 to ~13,960 lines.

---

## 2026-04-27 — Branding: enlarge official MSE Tech logo on Forms page master templates (v1.7.1)

Follow-up to the v1.7.0 branding pass: on the **Forms Filing** page every master
form template (Invoice, Quote, Work Order – Scope of Work, Change Order, Project
Proposal, Consultation Summary, Diagnostic Report, Service Request Intake,
Completion Sign-Off, Payment Receipt, Terms & Conditions, W-9 Request Packet,
1099 Prep Sheet, Expense Reimbursement, Project Intake — 15 in total) plus the
shared printable / saved-snapshot renderer (`_buildPrintableFormHTML` and the
generic `renderForm…` template used for receipts, invoices, and other generated
PDFs) already pointed at the official `assets/mse-logo.png`, but the on-screen
modal preview was rendering it at only 60×54 px and the printable popup at
0.85 in × 0.6 in — small enough that on the staging URL preview it read as a
text-only header with the red accent rule on top. This pass enlarges the logo
without touching layout, identity copy, or any other behaviour.

What changed:

- **`.form-print-header-logo` (on-screen modal preview):** 60 px wide / 54 px
  max-height → **88 px wide / 76 px max-height**. Adds an explicit white
  background so the logo never shows the dark app surface behind it.
  `object-fit:contain` is preserved, so the cube stays in proportion.
- **Printable popup `.form-print-header-logo`:** 0.85 in / 0.6 in → **1.15 in /
  0.95 in**, matching the `@media print` override. Same white background guard.
- All 15 Forms-page modals already include
  `<img class="form-print-header-logo" src="/assets/mse-logo.png">`, so no per-form
  markup edit was needed; the size bump applies uniformly.
- Same renderer feeds **forms attached to tickets / projects / clients** and the
  Documents page viewer (they all go through `_buildPrintableFormHTML` and the
  generic snapshot template), so the larger logo also appears in those contexts.
- **Version bump.** Settings → System → Console Version reads `v1.7.1`.

Why: user reported live screenshots of Work Order – Scope of Work, Quote, and
Invoice showing "the old red arc/text-only brand header and no official logo."
The logo *was* present in the markup since v1.7.0; it was just rendered too
small to read. Enlarging it (and adding a white background for safety) gives
the modal preview and saved snapshot a recognisably professional letterhead.

How to test:

1. Open https://mse-staff-console.dmcgann.workers.dev → **Forms Filing**.
2. Click each tile (Invoice, Quote, Work Order, …) and confirm the red-cube
   logo appears clearly in the top-left of the modal preview, with company
   name + address to its right and the document type (e.g. "INVOICE") in red
   at the top-right.
3. Hit **Save** on a form, then on the Documents page tap **View** /
   **PDF** → the popup should show the same enlarged logo on the saved
   snapshot.
4. On a ticket or project that has a form attached, open the form viewer and
   confirm the same logo appears.

Limitations / follow-ups:

- Old saved form snapshots taken before v1.7.0 still have no embedded logo;
  use the ✎ Regen action on the Documents page row to re-render with the
  current template.
- `assets/mse-logo.png` is ~1.9 MB. The base64 `MSE_LOGO_DATA_URL` constant in
  `index.html` is the optimized 240 px PNG used in popup print windows, so the
  large source PNG is only fetched once for the live UI.
- No Supabase schema changes, no new dependencies, no rebuild scripts altered.

Commit: 8cd9e9c.

---

## 2026-04-27 — Branding: official MSE Tech logo across console + generated forms (v1.7.0)

The console (favicon, header, login card) and every printable form letterhead
now use the official MSE Tech logo (the red 3D cube with the "M") instead of
the placeholder Pyrelane mark. Generated invoices, receipts, quotes, work
orders, change orders, proposals, consultations, diagnostics, sign-offs,
terms, project intake, W-9 packets, 1099 prep sheets, and expense
reimbursements all now have a professional letterhead with the logo on the
left, the company name and address in the middle, and the document type on
the right — same clean style for every form, no more gradient red banners.

- **Logo asset.** Added `assets/mse-logo.png` to the repo root (Cloudflare
  static-asset directory). Source artwork: the user-supplied transparent PNG,
  trimmed to its bounding box for tighter layout. Header / login / favicon /
  apple-touch-icon load it via `/assets/mse-logo.png` directly off the worker.
- **Inline data URL for popups.** Print-and-PDF popups open in `about:blank`
  windows where relative paths don't resolve, so the logo is also embedded as
  a base64 data URL constant (`MSE_LOGO_DATA_URL`, ~18 KB optimized 240px PNG)
  at the top of the inline JS. `_buildPrintableFormHTML` and
  `printHtmlDocument` rewrite every `/assets/mse-logo.png` to the data URL
  before writing into the popup, so PDFs and printouts render the logo
  correctly on first paint.
- **Form letterhead structure.** `.form-print-header-left` is now a flex row
  containing `<img class="form-print-header-logo">` followed by a
  `.form-print-header-text` block holding the existing co-name + co-detail.
  All 13 clean-style modal forms and both JS-rendered viewers
  (`_renderInvoiceLikeForm`, `_renderReceiptForm`) updated.
- **Gradient banners removed.** The 4 forms that still used the old red
  gradient banner (W-9 Request Packet, 1099 Prep Sheet, Expense
  Reimbursement, Project Intake) were converted to the clean letterhead
  style with the logo, so every printable form looks consistent.
- **Print sizing.** Logo is fixed to `0.85in` wide, `0.6in` max height in
  print, with `object-fit:contain` and `-webkit-print-color-adjust:exact` so
  it renders crisply on white paper without aspect-ratio distortion.
- **Favicon refresh.** The browser tab icon and iOS home-screen icon now
  show the MSE cube. Old base64 placeholder favicons removed; we serve the
  PNG directly so it stays sharp at any size the OS renders it.
- **Version bump.** Settings → System → Console Version reads `v1.7.0`.
- **Limitations.** Forms saved BEFORE this change have their original HTML
  snapshot (no logo) stored in `client_forms.snapshot_html`. Re-rendering
  through the per-row **Regen** action will produce a new snapshot that
  includes the logo for invoices and receipts (which use the JS renderers);
  other types only get the new logo on documents created from this point
  forward, or on full re-save.
- **How to test.** Hard-refresh the console; favicon should be the MSE cube.
  Sign-in card and the top-left header mark should both show the cube. Open
  a client → Forms → New Invoice (or Quote, Receipt, Work Order, etc.) — the
  letterhead should show the logo on the left, "MSE McGann Systems
  Engineering" + address in the middle, and the doc type on the right. Click
  PDF on a saved invoice/receipt; the popup print preview should show the
  logo on the letterhead and print correctly to PDF on iOS and desktop.
- **Follow-up items.** None blocking. Optional: a one-time backfill that
  re-renders every saved invoice/receipt's snapshot through the current
  renderer so historical PDFs also carry the new logo.
- **Commit:** `2abaf61`

---

## 2026-04-26 — Documents: make Refresh button actually feel like it works

The top-right **Refresh** button on the master **Documents** page was wired to
`loadAllDocuments()` directly. The function ran (and rerendered the grouped
folders), but the click was completely silent — no spinner, no disabled state,
no toast — so when nothing on screen had changed, staff couldn't tell whether
the refresh had actually happened or the button was a no-op. We had a report
that "Refresh doesn't work" for exactly this reason.

- **Visible loading state.** The Refresh button now goes to `disabled` with the
  label `Refreshing…` for the duration of the fetch, and restores itself when
  the fetch resolves (success or error). Rapid double-clicks no longer queue
  multiple parallel loads.
- **Success toast.** On a successful reload, a `success` toast fires reading
  `Documents refreshed (N)` where `N` is `_allDocuments.length` after the
  reload. Staff get a positive confirmation that the click did something even
  when the data hasn't visibly changed.
- **Error toast preserved.** If the Supabase fetch fails, the existing
  `Documents load failed: …` `error` toast still fires (now from inside
  `loadAllDocuments()`); the button still re-enables in the `finally` block,
  so a transient failure doesn't leave Refresh permanently stuck.
- **Search and type filter survive.** The wrapper does not touch the
  `#docs-search` input or the `#docs-type-filter` `<select>`. Because
  `renderAllDocuments()` reads both directly from the DOM at render time, the
  current search query and chosen folder are preserved across the refresh —
  staff who were narrowed to "Invoices" stay on "Invoices" after Refresh.
- **No data-source change.** Refresh reloads exactly what the page already
  reads — `client_forms` (joined to `clients` for parent name) plus
  `attachments` — so it surfaces newly uploaded files and newly saved
  client_forms without changing the grouped-folder layout, the search/filter
  semantics, or any of the per-row actions (View, Edit, Regen, PDF/Download,
  Delete).
- **Implementation.** `loadAllDocuments()` now returns `true` on success and
  `false` when `sb` is missing or a fetch errors, instead of returning
  `undefined` silently. A new `refreshAllDocuments(btn)` wrapper is the
  button's `onclick`; it owns the disabled/label state and the success toast.
  Other callers of `loadAllDocuments()` (page navigation, post-save
  hooks, attachment-edit hooks) are unchanged — they continue to fire-and-
  forget without a toast, which matches existing behavior.
- **Commit:** `a593363`

---

## 2026-04-26 — Documents: add per-row PDF / Download action

Every row on the master **Documents** page now has a PDF/Download action next
to **View**, so staff can pull a sharable copy of any document without first
opening it and hunting for a print button. The action's behavior depends on
what the row actually is — we don't claim a conversion we don't perform.

- **Saved client_forms** (invoices, receipts, quotes, work orders, etc.) get a
  **PDF** button. It runs the existing `printHtmlDocument()` pipeline against
  the saved HTML snapshot — same path used by the in-viewer Print button — so
  the user gets a popup with the browser Print dialog and can pick **Save as
  PDF** to download. We reuse the snapshot-or-rebuild logic from
  `viewClientForm()` (`storage.from(FORMS_BUCKET).download(form.pdf_path)`
  first, fall back to `_buildSnapshotFromData(form)` +
  `_buildPrintableFormHTML()` if the storage object is missing), so the action
  works on legacy rows that pre-date the storage snapshot.
- **PDF attachments** get a **PDF** button that downloads the stored bytes via
  `storage.from(bucket).download(path)`, wraps the Blob in an object URL, and
  triggers a hidden `<a download="filename">` click. The downloaded file
  keeps its original filename and PDF MIME type.
- **Image / non-PDF attachments** get a **Download** button (not "PDF") that
  uses the same Blob-download path. This avoids misleading users into
  thinking we converted a `.png` or `.docx` into a PDF when we didn't.
- **Drive-hosted legacy attachments** (no `storage_path`, only `gdrive_file_id`)
  open the Drive viewer in a new tab — the viewer offers its own Download.
- **No new dependencies.** No PDF library is bundled. We rely on the browser's
  Print → "Save as PDF" for HTML-to-PDF conversion (every modern browser,
  including iOS Safari and Chrome on desktop, supports this), and on plain
  Blob downloads for already-binary files.
- **Mobile-friendly.** The button is the same compact size as the surrounding
  Edit / Regen / × buttons; on narrow viewports the action row already wraps
  via `flex-wrap:wrap`, so the new button doesn't push existing actions off
  screen.
- **Existing actions untouched.** View / Edit / Regen / Attach / Delete on
  client_forms rows and View / Edit / Delete on attachment rows behave
  exactly as before. Only the row markup gained one extra button.
- **Limitations.** The form path is a *Print-to-PDF* flow, not a true
  server-side render — page breaks and pagination match what the user sees
  in the existing Print button, which the team has already validated. If a
  popup blocker fires, `printHtmlDocument()` falls back to its body-swap
  print strategy (same as the existing Print button).

Files touched: `index.html` (`_docsRowHtml` + two new helpers
`downloadClientFormPdf`, `downloadAttachmentFile`).

Commit: `e8624573728e3eb6a404c0df27133a82f58608d4`

---

## 2026-04-26 — Dispatch: convert page output from Jobs to Tickets

The **Dispatch** module's UI and metrics now read from the active ticket queue
instead of the legacy `DB_JOBS` placeholder, so dispatchers see the same data
the rest of the console operates on. The Dispatch / Queue / Assignments / Field
Status structure and the Tickets sidebar module are unchanged — this is a
data/wording swap, not a navigation change.

- **Create Ticket button.** The top-right primary button on **Dispatch
  Queue** and **Dispatch Assignments** now reads **Create Ticket** and opens
  the existing `modal-new-ticket` flow via `openNewTicketModal()`. The legacy
  `modal-new-job` markup is left in place for future use but is no longer
  reachable from Dispatch.
- **Queue table.** The static "No active jobs" placeholder is replaced by a
  live tickets table — Ticket ID / Subject / Client / Technician / Priority /
  Status — driven by `renderDispatchQueue()`. Rows are clickable and open the
  ticket edit panel via `openTicketPanel(id)`. Filters on the search input
  and status dropdown target the new `dispatch-tickets-body` tbody.
- **KPI cards.** Active tickets, In progress, Closed today, and Unassigned
  are computed from `DB.tickets`: active = anything not Resolved / Closed,
  In progress = `status === 'In progress'`, Closed today = Resolved/Closed
  with a today-stamped `updated_at` / `resolved_at` / `created`, Unassigned
  = active rows with no primary assignee and an empty `assignees` list.
  Multi-assignee tickets surface a `+N 👥` chip in the Technician column.
- **Assignments grid.** `renderDispatchAssignments()` now filters
  `DB.tickets` (not `DB_JOBS`) by the staff member's name through
  `ticketAssigneeList(t)`, so multi-assignee tickets correctly appear under
  every assigned tech. Each ticket card is clickable and opens the ticket
  panel.
- **Live refresh.** `updateTicketCounts()` calls `renderDispatchQueue()` when
  the dispatch tbody is in the DOM, so creating / editing a ticket from
  anywhere in the console keeps Dispatch in sync without a page reload.
- **Page route.** `renderPage('dispatch')` and
  `renderPage('dispatch-assignments')` now `await loadTicketsFromSupabase()`
  before rendering, matching the existing Tickets-page wiring.

Files changed: `index.html` (Dispatch Queue + Dispatch Assignments markup,
new `renderDispatchQueue` function, updated `renderDispatchAssignments`,
`renderPage` route, `updateTicketCounts` hook), `README.md`, `CHANGELOG.md`.

Commit: `b4393ca`

---

## 2026-04-26 — Documents: working View / Delete on attachment rows

Follow-up to the Documents-folder grouping and metadata-edit work. The
attachment rows rendered by `_docsRowHtml` referenced `viewAttachment(id)` and
`deleteAttachment(id)` but only the ticket-panel variants
(`viewTicketAttachment` / `deleteTicketAttachment`) existed in the global
scope, so clicking those buttons on the master **Documents** page was a
no-op (silent `ReferenceError`).

- **New global handlers.** `viewAttachment(id)` and `deleteAttachment(id)`
  are now defined alongside `deleteClientForm` and operate on the
  Documents-page `_allDocuments` cache (matched by `String(id)` so numeric
  and UUID rows both resolve).
- **View.** Creates a 1-hour signed URL on the row's storage bucket
  (`a.bucket || TICKET_ATT_BUCKET`) for `storage_path` / `path` and opens it
  in a new tab. Legacy rows with only a `gdrive_file_id` open the public
  Drive viewer URL as a fallback. Missing-path rows toast a clear error.
- **Delete.** Reuses the same chain-of-evidence confirmation wording as
  `deleteTicketAttachment` ("This may be evidence on the ticket and is
  logged in the audit trail."). On confirm: best-effort `storage.remove()`
  for the storage object, then `attachments.delete()` by id, then splice
  the row out of `_allDocuments` and `renderAllDocuments()` so the folder
  re-renders without the deleted entry. Audit trail is appended for
  attachments that have a known parent (`tickets` / `clients`).
- **Ticket panel untouched.** `viewTicketAttachment` / `deleteTicketAttachment`
  still drive the ticket-side `_tpAttachments` flow; the new globals only
  cover the Documents-page rows.

Files changed: `index.html` (added `viewAttachment` / `deleteAttachment` after
`deleteClientForm`), `README.md` (updated Documents test row to cover View /
Delete), `CHANGELOG.md`.

Commit: `4f1a25d`

---

## 2026-04-26 — Documents: edit attachment category + notes after upload

Photos and files uploaded under the wrong category (or with no description) can
now be reclassified directly from the master **Documents** page — no need to
delete and re-upload, and the storage object is left alone.

- **New action.** Each attachment row in the Documents folders (Photos /
  Images, Files / Other Documents) now has an **Edit** button alongside View
  and Delete. Form rows (`client_forms`) keep their existing Edit / Regen /
  Attach buttons unchanged.
- **Edit Attachment Details modal.** Mobile-friendly modal with a category
  dropdown (Evidence, Site Requirement, Parts Receipt, Invoice, Other) and a
  Notes / Description textarea. The current filename is shown read-only at the
  top so staff know which row they're editing. Legacy categories that aren't
  in the dropdown are preserved as a one-off option so Save never silently
  rewrites them.
- **Save path.** Updates `attachments.category` and `attachments.notes` only,
  via Supabase. The storage path, mime, parent_type/parent_id are not
  touched, so files don't move buckets even if the new category implies a
  different folder type.
- **Immediate re-render.** The in-memory `_allDocuments` cache is patched
  with the saved row and `renderAllDocuments()` is called — the row's meta
  line picks up the new category and the notes line appears under the
  filename without a page reload. If the cache lookup misses,
  `loadAllDocuments()` is awaited as a fallback.
- **Notes display.** Attachment rows now show their `notes` text under the
  filename (skipping the legacy case where `notes === category`), so
  descriptions added at upload time or via the new modal are visible at a
  glance in every folder.
- **Scope.** Attachments only this round. `client_forms` rows are intentionally
  left alone — they have their own Edit modal that touches form contents,
  and conflating the two would risk overwriting saved invoice/receipt data.

Updated:
- `index.html` — new `modal-edit-attachment` modal, `openEditAttachment(id)` /
  `saveEditAttachment()` handlers, `_docsRowHtml()` extended with category
  meta + notes line + Edit button for `_kind === 'attach'` rows.
- `README.md` — Documents bullet mentions the new Edit Details flow; test
  checklist adds a reclassify-and-save step for a Photos row.

Commit: `2b41830`

---

## 2026-04-26 — Documents: group page into per-type folders (no more mixed list)

The **Documents** page is no longer a single mixed table where staff have to
decipher icons to figure out what each row is. Records are now grouped into
collapsible folders by normalized type, so invoices live with invoices,
paid receipts with receipts, photos with photos, and files with files.

- **Folders rendered (in this order):** Invoices, Paid Receipts, Quotes,
  Work Orders, Service Requests, Change Orders, Proposals, Consultations,
  Diagnostics, Sign-offs, Terms, Intake, Photos / Images, Files / Other
  Documents.
- **Routing.** `client_forms` rows route by `form_type`. `attachments` rows
  route by mime / filename — anything `image/*` or `.png|.jpg|.jpeg|.gif|
  .webp|.heic|.heif|.bmp|.svg` goes to **Photos / Images**, everything else
  (PDFs, docs, etc.) goes to **Files / Other Documents**. Unknown form
  types fall through to **Files / Other Documents** so nothing is dropped.
- **Search and filter preserved.** The search box filters across every
  folder (number, title, client, filename). The type dropdown now reads
  **All folders** by default; picking a single type collapses the view to
  that one folder. Empty folders are hidden unless that folder is the
  active filter.
- **Per-row actions unchanged.** View / Edit / Regen / Attach / Delete
  remain on each row; layout switched from a fixed-column table to a
  flex-wrap row that works on phones.
- **No data-model changes.** This is a render-only patch — `client_forms`,
  `attachments`, storage layout, and ingestion are all untouched. Editable
  metadata is the next task and is intentionally not in this patch.

Updated:
- `index.html` — Documents page DOM (table → grouped sections),
  `renderAllDocuments()` rewritten, new helpers `DOCS_FOLDERS`,
  `_docFolderFor`, `_docIsImage`, `_docsRowHtml`. Tip and type-filter
  options updated to match the folder list.
- `README.md` — Documents bullet describes the folder grouping; test
  checklist asks the reviewer to confirm the folder layout, routing of a
  saved invoice / receipt / photo / non-image, and that per-row actions
  are still present.

Commit: `6e6c292`

---

## 2026-04-26 — Accounting: auto-compute the `T+N` close-status badge

The **Month-End Close** badge on the Accounting Overview and the
**Month-End Checklist** badge on Reconciliation are no longer hardcoded
to `T+2`. The close period is now derived from today's date (the
previous calendar month) and the badge counts business days elapsed
since that month's last calendar day, with weekends excluded.

- **Period auto-rolls.** Period = previous month relative to today;
  close date = its last calendar day. For Mar/Jun/Sep/Dec the same date
  is the quarter close, and the period label gets a `· Q-end` suffix.
- **Business-day counter.** `T+N` counts only Mon–Fri days strictly
  after the close date; T+0 on the close day or any earlier date.
- **Two badges + subtext.** `acc-close-status` (Overview) shows
  `T+N — In Progress` / `T+N — Complete` based on checklist progress,
  `rec-close-status-badge` (Reconciliation) shows just `T+N`, and the
  `acc-close-days` line under the Overview progress bar now prints the
  resolved close date (e.g. `Close date: Apr 30, 2025 (Q-end)`).
- **Hardcoded `April 2025` removed** from the Reconciliation card
  header next to the progress text — that span is now `rec-close-period`
  and updates with the period.
- Helper functions added in `index.html`: `getCurrentClosePeriod`,
  `businessDaysBetween`, `computeCloseStatus`, `updateCloseStatusBadges`.
  All wired through the existing `updateAccCloseProgress` path so the
  badge refreshes on every checklist toggle and page render.

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
