# Patch Applied

Apps quick-links block added to sidebar above Workspace section.

Due to file size constraints, the patch was applied inline. To manually verify, look for the new `<div class="nav-section">` block with `nav-section-label` = "Apps" containing Gmail, Calendar, and Drive `<a class="nav-link">` links, inserted just above the existing Workspace nav-section in `index.html`.

The three links:
- Gmail → https://mail.google.com/mail/u/0/#inbox
- Calendar → https://calendar.google.com/calendar/u/0/r
- Drive → https://drive.google.com/drive/u/0/my-drive

All open in a new tab via `target="_blank" rel="noopener noreferrer"`.
