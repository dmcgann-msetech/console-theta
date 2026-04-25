#!/usr/bin/env python3
"""
Nightly Supabase backup script.

Reads every public table via the Supabase REST API using the service-role key
(which bypasses RLS). Writes one JSON file per table into backups/<DATE>/, plus
a manifest.json with row counts and a checksum.

Designed to be self-explanatory enough that a different AI agent could
diagnose and rerun it cold. Stays simple on purpose — no fancy diffing,
no compression, no encryption. Each night = full snapshot.

Retention: GitHub holds files forever via git history. We keep the last
30 nights as separate folders, older snapshots stay in git history if
you ever need them (just `git log -- backups/`).

Required environment:
  SUPABASE_URL          e.g. https://gaolcfupyanbtskamdll.supabase.co
  SUPABASE_SERVICE_KEY  service_role key from Supabase dashboard
                        (NOT the anon/publishable key)

If this script fails, see RUNBOOK.md → "Backup is broken".
"""

import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ─── Config ──────────────────────────────────────────────────────────────────
TABLES = [
    "accounting_audit_log", "activity_events", "asset_audit_log", "asset_documents",
    "asset_maintenance_schedule", "asset_repairs", "assets", "board_lists", "boards",
    "client_forms", "clients", "company_documents", "kanban_activity", "kanban_boards",
    "kanban_cards", "kanban_columns", "kanban_comments", "mse_projects", "part_documents",
    "part_transactions", "parts", "profiles", "project_meetings", "project_notes",
    "project_tasks", "projects", "quick_links", "reconciliation_periods", "staff",
    "tickets", "vendor_budgets", "vendor_files", "vendors", "work_item_assignees",
    "work_item_comments", "work_items", "workspace_members", "workspaces",
]

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKUPS_DIR = REPO_ROOT / "backups"
RETENTION_DAYS = 30

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY environment vars required.", file=sys.stderr)
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json",
    # ask postgrest to give us the count header
    "Prefer": "count=exact",
}

# ─── Fetch ───────────────────────────────────────────────────────────────────

def fetch_table(table: str) -> list[dict]:
    """Page through a table 1000 rows at a time."""
    out: list[dict] = []
    offset = 0
    page = 1000
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*"
    while True:
        r = requests.get(
            url,
            headers={**HEADERS, "Range": f"{offset}-{offset + page - 1}"},
            timeout=60,
        )
        if r.status_code not in (200, 206):
            raise RuntimeError(f"{table}: HTTP {r.status_code} — {r.text[:300]}")
        rows = r.json()
        out.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return out

# ─── Run ─────────────────────────────────────────────────────────────────────

def main() -> int:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = BACKUPS_DIR / today
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "supabase_url": SUPABASE_URL,
        "tables": {},
        "errors": {},
    }

    overall_ok = True
    for t in TABLES:
        try:
            rows = fetch_table(t)
            payload = json.dumps(rows, indent=2, default=str, sort_keys=True)
            (out_dir / f"{t}.json").write_text(payload)
            manifest["tables"][t] = {
                "row_count": len(rows),
                "size_bytes": len(payload),
                "sha256": hashlib.sha256(payload.encode()).hexdigest(),
            }
            print(f"  ✓ {t}: {len(rows)} rows")
        except Exception as e:
            overall_ok = False
            manifest["errors"][t] = str(e)
            print(f"  ✗ {t}: {e}", file=sys.stderr)

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # Retention: prune snapshot folders older than RETENTION_DAYS days.
    # We delete folders, not the git history, so old snapshots remain restorable
    # via `git checkout <commit> -- backups/<date>/`.
    cutoff = time.time() - RETENTION_DAYS * 86400
    if BACKUPS_DIR.exists():
        for child in BACKUPS_DIR.iterdir():
            if child.is_dir() and child.name != today:
                try:
                    name_dt = datetime.strptime(child.name, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
                    if name_dt < cutoff:
                        # Remove this old snapshot folder
                        for f in child.rglob("*"):
                            if f.is_file():
                                f.unlink()
                        child.rmdir()
                        print(f"  pruned: {child.name}")
                except ValueError:
                    pass  # not a dated folder, skip

    print(f"\nDone. Snapshot at backups/{today}/")
    print(f"Tables OK: {len(manifest['tables'])}/{len(TABLES)}, errors: {len(manifest['errors'])}")
    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
