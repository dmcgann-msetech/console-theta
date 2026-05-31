#!/usr/bin/env python3
"""
MSE Console index.html stabilization utility.

Purpose:
- Repair known mojibake/emoji corruption caused by UTF-8 bytes being saved or
  interpreted through Windows-1252/Latin-1.
- Replace several static frontend dropdown lists with runtime-populated lists
  from shared constants or DB-backed vendor state.
- Keep the patch repeatable and auditable instead of manually editing the
  large single-file app.

Run from repo root:
    python tools/stabilize_index.py

Then verify:
    git diff -- index.html
    python - <<'PY'
from pathlib import Path
s = Path('index.html').read_text(encoding='utf-8-sig')
for bad in ['ðŸ', 'â€', 'Ã', 'Â', 'ï¸']:
    print(bad, s.count(bad))
PY
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing expected block: {label}")
    return text.replace(old, new, 1)


def cp1252_byte(char: str) -> bytes:
    try:
        return char.encode("cp1252")
    except UnicodeEncodeError:
        code = ord(char)
        if 0 <= code <= 255:
            return bytes([code])
        raise


def decode_mojibake(chunk: str) -> str:
    return b"".join(cp1252_byte(c) for c in chunk).decode("utf-8")


def is_mojibake_char(char: str) -> bool:
    code = ord(char)
    return (
        code in (0x00F0, 0x00EF, 0x00C3, 0x00C2, 0x00E2)
        or 0x0080 <= code <= 0x00FF
        or 0x0100 <= code <= 0x017F
        or 0x2000 <= code <= 0x206F
        or code == 0x20AC
    )


def repair_mojibake(text: str) -> tuple[str, int]:
    out: list[str] = []
    i = 0
    fixed = 0
    starters = {"ð", "â", "Ã", "Â", "ï"}
    while i < len(text):
        if text[i] in starters:
            best = None
            best_len = 0
            for length in range(min(16, len(text) - i), 1, -1):
                chunk = text[i : i + length]
                if not all(is_mojibake_char(c) for c in chunk):
                    continue
                try:
                    decoded = decode_mojibake(chunk)
                except Exception:
                    continue
                if decoded != chunk:
                    best = decoded
                    best_len = length
                    break
            if best is not None:
                out.append(best)
                i += best_len
                fixed += 1
                continue
        out.append(text[i])
        i += 1
    return "".join(out), fixed


def main() -> int:
    text = INDEX.read_text(encoding="utf-8-sig")

    # Dispatch queue status filter: remove hardcoded HTML options and use shared ticket status source.
    text = replace_once(
        text,
        """      <select onchange=\"filterTableByCol('dispatch-tickets-body', this.value, 5)\">\n\n\n        <option value=\"\">All status</option>\n\n\n        <option>Submitted</option><option>Awaiting dispatch</option><option>Assigned</option><option>In progress</option><option>Escalated</option><option>Resolved</option>\n\n\n      </select>""",
        """      <select id=\"dispatch-status-filter\" onchange=\"filterTableByCol('dispatch-tickets-body', this.value, 5)\">\n\n\n      </select>""",
        "dispatch static status select",
    )

    # Ticket priority filter: remove hardcoded HTML options and populate from TICKET_PRIORITIES.
    text = replace_once(
        text,
        """      <select id=\"ticket-priority-filter\" onchange=\"renderTickets()\">\n        <option value=\"\">All priorities</option>\n        <option value=\"High\">&#128308; High</option>\n        <option value=\"Medium\">&#128992; Medium</option>\n        <option value=\"Low\">&#128309; Low</option>\n      </select>""",
        """      <select id=\"ticket-priority-filter\" onchange=\"renderTickets()\">\n      </select>""",
        "ticket priority filter static options",
    )

    old_status_block = """const TICKET_STATUSES = [\n\n\n  { value: 'submitted',        label: 'Submitted' },\n\n\n  { value: 'awaiting_dispatch', label: 'Awaiting dispatch' },\n\n\n  { value: 'needs_review',     label: 'Needs review' },\n\n\n  { value: 'assigned',         label: 'Assigned' },\n\n\n  { value: 'in_progress',      label: 'In progress' },\n\n\n  { value: 'escalated',        label: 'Escalated' },\n\n\n  { value: 'resolved',         label: 'Resolved' },\n\n\n];\n\n\n\n\n\nfunction populateTicketStatusSelect(selectEl, placeholder = 'All statuses') {"""
    new_status_block = """const TICKET_STATUSES = [\n\n\n  { value: 'submitted',        label: 'Submitted' },\n\n\n  { value: 'awaiting_dispatch', label: 'Awaiting dispatch' },\n\n\n  { value: 'needs_review',     label: 'Needs review' },\n\n\n  { value: 'assigned',         label: 'Assigned' },\n\n\n  { value: 'in_progress',      label: 'In progress' },\n\n\n  { value: 'escalated',        label: 'Escalated' },\n\n\n  { value: 'resolved',         label: 'Resolved' },\n\n\n];\n\n\n\nconst TICKET_PRIORITIES = [\n\n\n  { value: 'High',   label: '🔴 High' },\n\n\n  { value: 'Medium', label: '🟡 Medium' },\n\n\n  { value: 'Low',    label: '🔵 Low' },\n\n\n];\n\n\n\nfunction populateOptionSelect(selectEl, items, placeholder) {\n\n\n  if (!selectEl) return;\n\n\n  selectEl.innerHTML = '';\n\n\n  if (placeholder !== null && placeholder !== undefined) {\n\n\n    const first = document.createElement('option');\n\n\n    first.value = '';\n\n\n    first.textContent = placeholder;\n\n\n    selectEl.appendChild(first);\n\n\n  }\n\n\n  (items || []).forEach(item => {\n\n\n    const opt = document.createElement('option');\n\n\n    opt.value = item.value;\n\n\n    opt.textContent = item.label;\n\n\n    selectEl.appendChild(opt);\n\n\n  });\n\n\n}\n\n\n\nfunction populateTicketPrioritySelect(selectEl, placeholder = 'All priorities') {\n\n\n  populateOptionSelect(selectEl, TICKET_PRIORITIES, placeholder);\n\n\n}\n\n\n\nfunction populateActiveVendorSelect(selectEl, placeholder = 'Select vendor…') {\n\n\n  if (!selectEl) return;\n\n\n  const vendors = (DB.vendors || [])\n\n\n    .filter(v => !v.status || String(v.status).toLowerCase() === 'active')\n\n\n    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));\n\n\n  selectEl.innerHTML = '';\n\n\n  const first = document.createElement('option');\n\n\n  first.value = '';\n\n\n  first.textContent = placeholder;\n\n\n  selectEl.appendChild(first);\n\n\n  vendors.forEach(v => {\n\n\n    const opt = document.createElement('option');\n\n\n    opt.value = v.name || v.company_name || '';\n\n\n    opt.textContent = v.name || v.company_name || '';\n\n\n    selectEl.appendChild(opt);\n\n\n  });\n\n\n}\n\n\n\nfunction populateTicketStatusSelect(selectEl, placeholder = 'All statuses') {"""
    text = replace_once(text, old_status_block, new_status_block, "shared ticket constants")

    text = replace_once(
        text,
        """  populateTicketStatusSelect(document.getElementById('ticket-status-filter'), 'All statuses');\n\n\n  populateTicketStatusSelect(document.getElementById('tp-status'));""",
        """  populateTicketStatusSelect(document.getElementById('ticket-status-filter'), 'All statuses');\n\n\n  populateTicketStatusSelect(document.getElementById('dispatch-status-filter'), 'All status');\n\n\n  populateTicketPrioritySelect(document.getElementById('ticket-priority-filter'), 'All priorities');\n\n\n  populateTicketStatusSelect(document.getElementById('tp-status'));""",
        "dropdown initialization",
    )

    text = text.replace("ðŸ‘¤ ${esc(m)}", "👤 ${esc(m)}")

    # Replace static vendor lists with dynamic DB-backed population.
    text = text.replace(
        """        <option value=\"\">None</option>\n\n\n        <option>Aquidneck Fasteners</option><option>Granite City Electric</option><option>Burns Power Tools</option>\n\n\n        <option>Concord Electric Supply</option><option>Schwartz Hardware</option><option>Perplexity AI</option>\n\n\n        <option>Cloudflare</option><option>Google</option><option>Amazon</option>""",
        """        <option value=\"\">None</option>""",
    )
    text = text.replace(
        """          <option value=\"\">None</option>\n\n\n          <option>Aquidneck Fasteners</option><option>Granite City Electric</option><option>Burns Power Tools</option>\n\n\n          <option>Concord Electric Supply</option><option>Schwartz Hardware</option><option>Perplexity AI</option>\n\n\n          <option>Cloudflare</option><option>Google</option><option>Amazon</option>""",
        """          <option value=\"\">None</option>""",
    )

    text = replace_once(
        text,
        """  document.getElementById('pp-edit-partnum').value = part.part_number || '';""",
        """  document.getElementById('pp-edit-partnum').value = part.part_number || '';\n\n\n  populateActiveVendorSelect(document.getElementById('pp-edit-vendor'), 'None');""",
        "part panel vendor populate",
    )
    text = replace_once(
        text,
        """  var receiptEl = document.getElementById('rp-receipt'); if(receiptEl) receiptEl.value='';\n\n\n  calcReceivePart();""",
        """  var receiptEl = document.getElementById('rp-receipt'); if(receiptEl) receiptEl.value='';\n\n\n  populateActiveVendorSelect(document.getElementById('rp-vendor'), 'None');\n\n\n  calcReceivePart();""",
        "receive part vendor populate",
    )
    text = replace_once(
        text,
        """  var unitSel = document.getElementById('np-unit'); if(unitSel) unitSel.selectedIndex=0;\n\n\n  var pnEl = document.getElementById('np-partnum'); if(pnEl) pnEl.value='Generating…';""",
        """  var unitSel = document.getElementById('np-unit'); if(unitSel) unitSel.selectedIndex=0;\n\n\n  populateActiveVendorSelect(document.getElementById('np-vendor'), 'None');\n\n\n  var pnEl = document.getElementById('np-partnum'); if(pnEl) pnEl.value='Generating…';""",
        "new part vendor populate",
    )

    text = replace_once(
        text,
        """function populateBillVendorDropdown() {\n\n\n  const sel = document.getElementById('bill-vendor');\n\n\n  if (!sel) return;\n\n\n  sel.innerHTML = '<option value=\"\">Select vendor…</option>';\n\n\n  (DB.vendors || [])\n\n\n    .filter(v => v.status === 'Active' || v.status === 'active')\n\n\n    .sort((a, b) => a.name.localeCompare(b.name))\n\n\n    .forEach(v => {\n\n\n      const opt = document.createElement('option');\n\n\n      opt.value = v.name;\n\n\n      opt.textContent = v.name;\n\n\n      sel.appendChild(opt);\n\n\n    });\n\n\n}\n""",
        """function populateBillVendorDropdown() {\n\n\n  populateActiveVendorSelect(document.getElementById('bill-vendor'), 'Select vendor…');\n\n\n}\n""",
        "bill vendor helper",
    )

    # Geo-IP lookup: use fallback providers and do not block sign-in logging.
    text = replace_once(
        text,
        """async function _lookupIPAndLocation() {\n\n\n  // Free, HTTPS+CORS, no key — returns ip + city/region/country in one call.\n\n\n  // Best-effort; mobile carriers/VPNs make the location approximate.\n\n\n  try {\n\n\n    const ctl = new AbortController();\n\n\n    const t = setTimeout(() => ctl.abort(), 3500);\n\n\n    const r = await fetch('https://ipwho.is/', { signal: ctl.signal, cache: 'no-store' });\n\n\n    clearTimeout(t);\n\n\n    if (!r.ok) return null;\n\n\n    const j = await r.json();\n\n\n    if (!j || j.success === false) return null;\n\n\n    const ip = j.ip || '';\n\n\n    const parts = [j.city, j.region, j.country_code || j.country].filter(Boolean);\n\n\n    const loc = parts.join(', ');\n\n\n    return { ip, loc };\n\n\n  } catch(_) { return null; }\n\n\n}\n""",
        """async function _lookupIPAndLocation() {\n\n\n  // Best-effort only. Some public geo-IP providers block browsers or rate-limit.\n\n\n  // Do not block sign-in logging if every provider fails.\n\n\n  const providers = [\n\n\n    {\n\n\n      url: 'https://ipapi.co/json/',\n\n\n      map: j => ({ ip: j.ip || '', loc: [j.city, j.region, j.country_code || j.country_name].filter(Boolean).join(', ') })\n\n\n    },\n\n\n    {\n\n\n      url: 'https://ipwho.is/',\n\n\n      map: j => (j && j.success !== false) ? ({ ip: j.ip || '', loc: [j.city, j.region, j.country_code || j.country].filter(Boolean).join(', ') }) : null\n\n\n    }\n\n\n  ];\n\n\n  for (const provider of providers) {\n\n\n    const ctl = new AbortController();\n\n\n    const t = setTimeout(() => ctl.abort(), 2500);\n\n\n    try {\n\n\n      const r = await fetch(provider.url, { signal: ctl.signal, cache: 'no-store' });\n\n\n      clearTimeout(t);\n\n\n      if (!r.ok) continue;\n\n\n      const mapped = provider.map(await r.json());\n\n\n      if (mapped && (mapped.ip || mapped.loc)) return mapped;\n\n\n    } catch(_) {\n\n\n      clearTimeout(t);\n\n\n    }\n\n\n  }\n\n\n  return null;\n\n\n}\n""",
        "geo lookup fallback",
    )

    text, fixed_count = repair_mojibake(text)
    INDEX.write_text(text, encoding="utf-8")
    print(f"index.html stabilized. Mojibake sequences repaired: {fixed_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
