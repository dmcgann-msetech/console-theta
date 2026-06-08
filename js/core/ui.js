// ========== FILTER ==========




let ticketQuickFilter = '';

function clearTicketManualFilters() {
  const statusSel = document.getElementById('ticket-status-filter');
  const priSel = document.getElementById('ticket-priority-filter');
  const search = document.getElementById('ticket-search');

  if (statusSel) statusSel.value = '';
  if (priSel) priSel.value = '';
  if (search) search.value = '';
}

function setTicketQuickFilter(mode) {
  ticketQuickFilter = mode || '';
  clearTicketManualFilters();
  renderTickets();
}

function setTicketOpenFilter() {
  setTicketQuickFilter('open');
}

function setTicketFilter(status, priority) {
  ticketQuickFilter = '';

  const statusSel = document.getElementById('ticket-status-filter');
  const priSel = document.getElementById('ticket-priority-filter');
  const search = document.getElementById('ticket-search');

  if (statusSel) statusSel.value = status;
  if (priSel) priSel.value = priority;
  if (search) search.value = '';

  renderTickets();
}





function filterTable(tbodyId, query, cols) {


  const q = query.toLowerCase();


  document.querySelectorAll('#' + tbodyId + ' tr').forEach(tr => {


    const text = cols.map(i => tr.cells[i]?.textContent || '').join(' ').toLowerCase();


    tr.style.display = text.includes(q) ? '' : 'none';


  });


}





function filterTableByCol(tbodyId, value, col) {


  const v = value.toLowerCase();


  document.querySelectorAll('#' + tbodyId + ' tr').forEach(tr => {


    const cell = tr.cells[col]?.textContent.toLowerCase() || '';


    tr.style.display = (!v || cell.includes(v)) ? '' : 'none';


  });


}





// ========== CONFIRM DELETE ==========


// Shared destructive-action confirmation. Keeps wording consistent and ensures


// every delete path has an explicit user confirmation (audit / chain-of-evidence).


// label: short noun phrase ("ticket TKT-1024", "attachment receipt.pdf")


// detail: optional extra context (warning about evidence, cascading deletes, etc.)


function confirmDelete(label, detail) {


  const lines = [];


  lines.push('Delete ' + (label || 'this item') + '?');


  lines.push('');


  if (detail) { lines.push(detail); lines.push(''); }


  lines.push('This cannot be undone.');


  return window.confirm(lines.join('\n'));


}





// ========== TOAST ==========


function showToast(msg, type='') {


  const tc = document.getElementById('toast-container');


  const t = document.createElement('div');


  t.className = 'toast' + (type ? ' ' + type : '');


  const icons = {success:'âœ“',error:'âœ•',info:'â„¹'};


  t.innerHTML = `<span>${icons[type]||'â€¢'}</span> ${msg}`;


  tc.appendChild(t);


  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(4px)'; t.style.transition='all .3s'; setTimeout(() => t.remove(), 300); }, 3000);


}





// ========== BADGE HELPERS ==========


function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }





function statusBadge(s) {
  const normalized = normalizeTicketStatus(s);
  const label = ticketStatusLabel(normalized);

  const map = {
    [TICKET_STATUS.SUBMITTED]: 'badge-violet',
    [TICKET_STATUS.AWAITING_DISPATCH]: 'badge-gold',
    [TICKET_STATUS.NEEDS_REVIEW]: 'badge-blue',
    [TICKET_STATUS.ASSIGNED]: 'badge-blue',
    [TICKET_STATUS.IN_PROGRESS]: 'badge-blue',
    [TICKET_STATUS.ESCALATED]: 'badge-red',
    [TICKET_STATUS.RESOLVED]: 'badge-green',
    [TICKET_STATUS.CANCELLED]: 'badge-gray'
  };

  return `<span class="badge ${map[normalized]||'badge-gray'}">${esc(label)}</span>`;
}


function priorityBadge(p) {


  const map = {High:'badge-red',Medium:'badge-gold',Low:'badge-gray'};


  return `<span class="badge ${map[p]||'badge-gray'}">${esc(p)}</span>`;


}


function clientStatusBadge(s) {


  const map = {Active:'badge-green','Overdue balance':'badge-gold','Past due':'badge-red'};


  return `<span class="badge ${map[s]||'badge-gray'}">${esc(s)}</span>`;


}


function vendorStatusBadge(s) {


  const map = {'Pending approval':'badge-gold',Matched:'badge-blue',Scheduled:'badge-green',Exception:'badge-red',Active:'badge-green'};


  return `<span class="badge ${map[s]||'badge-gray'}">${esc(s)}</span>`;


}


function projectStatusBadge(s) {


  const map = {'In progress':'badge-blue',Planned:'badge-gray',Overdue:'badge-red',Complete:'badge-green','On hold':'badge-gold'};


  return `<span class="badge ${map[s]||'badge-gray'}">${esc(s)}</span>`;


}





function updateTicketCounts() {


  const el = id => document.getElementById(id);


  if (el('tk-open')) el('tk-open').textContent = DB.tickets.filter(t => isTicketOpen(t.status)).length;


  if (el('tk-progress')) el('tk-progress').textContent = DB.tickets.filter(t => isTicketInProgress(t.status)).length;


  if (el('tk-resolved')) el('tk-resolved').textContent = DB.tickets.filter(t => normalizeTicketStatus(t.status) == TICKET_STATUS.RESOLVED).length;


  if (el('tk-escalated')) el('tk-escalated').textContent = DB.tickets.filter(t => normalizeTicketStatus(t.status) == TICKET_STATUS.ESCALATED).length;

  if (el('tk-closed')) el('tk-closed').textContent = DB.tickets.filter(t => isTicketClosed(t.status)).length;


  const badge = document.getElementById('ticketBadge');


  if (badge) badge.textContent = DB.tickets.filter(t => isTicketOpen(t.status)).length;


  // Keep Dispatch Queue in sync if its DOM is present


  if (typeof renderDispatchQueue === 'function' && document.getElementById('dispatch-tickets-body')) {


    try { renderDispatchQueue(); } catch (e) { /* noop */ }


  }


}














