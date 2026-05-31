#!/usr/bin/env python3
"""Install a focused runtime mojibake guard into index.html.

This is intentionally narrow: it does not redesign the app, touch data logic,
or change schema behavior. It inserts a small browser-side guard that repairs
visible UTF-8/Windows-1252 mojibake in rendered UI text and common display
attributes. This catches both corrupted literals in index.html and corrupted
strings returned from data/rendering paths.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
MARKER = "MSE_MOJIBAKE_RUNTIME_GUARD_V1"

GUARD = r'''
<!-- MSE_MOJIBAKE_RUNTIME_GUARD_V1 -->
<script>
(function(){
  'use strict';
  const MARKER = 'MSE_MOJIBAKE_RUNTIME_GUARD_V1';
  const BAD_RE = /(?:ðŸ|â€|âœ|âš|Ã|Â|ï¸|�)/;
  const ATTRS = ['title','aria-label','placeholder','alt','value'];

  function fallbackRepair(value){
    return value
      .replaceAll('ðŸ‘¤', '👤')
      .replaceAll('ðŸ“§', '📧')
      .replaceAll('ðŸ“„', '📄')
      .replaceAll('ðŸ§¾', '🧾')
      .replaceAll('ðŸ–¨', '🖨')
      .replaceAll('ðŸ–¼ï¸', '🖼️')
      .replaceAll('ðŸ–¼', '🖼')
      .replaceAll('ðŸ“Ž', '📎')
      .replaceAll('ðŸ“‹', '📋')
      .replaceAll('ðŸ”Ž', '🔎')
      .replaceAll('ðŸ”�', '🔍')
      .replaceAll('â€”', '—')
      .replaceAll('â€“', '–')
      .replaceAll('â€˜', '‘')
      .replaceAll('â€™', '’')
      .replaceAll('â€œ', '“')
      .replaceAll('â€�', '”')
      .replaceAll('â€¦', '…')
      .replaceAll('Â·', '·')
      .replaceAll('Â ', ' ')
      .replaceAll('Ã—', '×');
  }

  function decodeOnce(value){
    if (!value || !BAD_RE.test(value)) return value;
    let repaired = fallbackRepair(value);
    try {
      const decoded = decodeURIComponent(escape(repaired));
      if (decoded && decoded !== repaired) repaired = decoded;
    } catch (_) {}
    repaired = fallbackRepair(repaired);
    return repaired;
  }

  function repairTextNode(node){
    const before = node.nodeValue;
    const after = decodeOnce(before);
    if (after !== before) node.nodeValue = after;
  }

  function shouldSkipElement(el){
    if (!el || !el.tagName) return false;
    return /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/i.test(el.tagName);
  }

  function repairElement(el){
    if (!el || shouldSkipElement(el)) return;
    for (const attr of ATTRS) {
      if (!el.hasAttribute || !el.hasAttribute(attr)) continue;
      const before = el.getAttribute(attr);
      const after = decodeOnce(before);
      if (after !== before) el.setAttribute(attr, after);
    }
    for (const child of el.childNodes || []) {
      if (child.nodeType === Node.TEXT_NODE) repairTextNode(child);
      else if (child.nodeType === Node.ELEMENT_NODE) repairElement(child);
    }
  }

  function repairDocument(){
    repairElement(document.body || document.documentElement);
  }

  function start(){
    repairDocument();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) repairTextNode(m.target);
        for (const n of m.addedNodes || []) {
          if (n.nodeType === Node.TEXT_NODE) repairTextNode(n);
          else if (n.nodeType === Node.ELEMENT_NODE) repairElement(n);
        }
        if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) repairElement(m.target);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
    window[MARKER] = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
</script>
'''.strip()


def main() -> int:
    text = INDEX.read_text(encoding="utf-8-sig")
    if MARKER in text:
        print("Mojibake runtime guard already installed.")
        return 0
    if "</body>" in text:
        text = text.replace("</body>", GUARD + "\n\n</body>", 1)
    else:
        text = text.rstrip() + "\n\n" + GUARD + "\n"
    INDEX.write_text(text, encoding="utf-8")
    print("Installed mojibake runtime guard into index.html.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
