# Bug #2 Fix — Ticket priority filter and modal
# Run from: R:\mse-console\
# Usage: .\fix_bug2.ps1

$file = "R:\mse-console\index.html"
$content = Get-Content $file -Raw

# 1. Add TICKETPRIORITIES constant after TICKETSTATUSES block
$prioritiesConst = @'

const TICKETPRIORITIES = [
  { value: 'High',   label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low',    label: 'Low' },
];
'@

# Insert after the closing of TICKETSTATUSES array
$content = $content -replace '(\]\s*;?\s*//\s*end TICKETSTATUSES|(\{\s*value:\s*[''"]resolved[''"].*?\})\s*\])', "`$0`n$prioritiesConst"

# 2. Add populateTicketPrioritySelect after populateTicketStatusSelect function
$priorityFn = @'

function populateTicketPrioritySelect(selectEl, placeholder = 'All priority') {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  selectEl.appendChild(first);
  TICKETPRIORITIES.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    selectEl.appendChild(opt);
  });
}
'@

$content = $content -replace '(function populateTicketStatusSelect[\s\S]*?appendChild\(opt\)\s*\})\s*\n', "`$1`n$priorityFn`n"

# 3. Strip hardcoded options from ticket-priority-filter select
$content = $content -replace '(<select\s+id="ticket-priority-filter"[^>]*>)\s*<option[^>]*>All priority<\/option>\s*<option>High<\/option>\s*<option>Medium<\/option>\s*<option>Low<\/option>\s*(<\/select>)', '$1$2'

# 4. In openNewTicketModal, populate priority select dynamically
#    Replace bare: if (priorityEl) priorityEl.value = 'Medium';
#    With populate call + default value set
$content = $content -replace '(if\s*\(priorityEl\))\s*priorityEl\.value\s*=\s*[''"]Medium[''"]', @'
if (priorityEl) { populateTicketPrioritySelect(priorityEl, 'Select priority'); priorityEl.value = 'Medium'; }
'@

# 5. Add populate call on tickets page init
#    Find where ticket-status-filter is populated and add priority right after
$content = $content -replace '(populateTicketStatusSelect\s*\(\s*document\.getElementById\s*\(\s*[''"]ticket-status-filter[''"].*?\)\s*\);)', @'
$1
  populateTicketPrioritySelect(document.getElementById('ticket-priority-filter'));
'@

# Write back
Set-Content $file $content -NoNewline -Encoding UTF8
Write-Host "Bug #2 fix applied to $file" -ForegroundColor Green
