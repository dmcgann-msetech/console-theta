// ========== TECH FIELD STATUS ==========


// Seeded from DB_JOBS; maps technician name → current field status string


const TECH_STATUS = {};


(function initTechStatus() {


  // seed from dispatch jobs


  DB_JOBS.forEach(j => {


    if (!j.tech) return;


    const st = j.status; // 'En route', 'On site', 'Completed', 'Pending'


    // normalise to dropdown values


    const map = {'En route':'En Route','On site':'On Site','Completed':'Completed','Pending':'Available'};


    TECH_STATUS[j.tech] = map[st] || 'Available';


  });


})();





const FS_STATUS_BADGE = {


  'Available':        'badge-green',


  'En Route':         'badge-blue',


  'On Site':          'badge-green',


  'In Field':         'badge-blue',


  'In a Meeting':     'badge-gray',


  'Lunch':            'badge-gray',


  'Break':            'badge-gray',


  'Picking Up Parts': 'badge-blue',


  'Wrapping Up':      'badge-blue',


  'Offline':          'badge-red',


  'Completed':        'badge-gray',


  'Unavailable':      'badge-red',


};





// Per-tech status note (free-form, e.g. "At lunch at Popeyes")


const TECH_STATUS_NOTE = {};





// Last-check-in mock (static, relative to page load)


const FS_CHECKIN = {};


(function initCheckin() {


  DB_JOBS.forEach(j => { if (j.tech) FS_CHECKIN[j.tech] = j.tech === 'A. Piva' ? '2 min ago' : j.tech === 'B. Egan' ? '5 min ago' : j.tech === 'J. Pacheco' ? '8 min ago' : '22 min ago'; });


})();











// ============================================================


// ========== AUDIT EXPORT + DISPATCH + DOCS ==================


// ============================================================


function exportAuditLogCSV() {


  const log = (typeof ACC !== 'undefined' && ACC.auditLog) ? ACC.auditLog : [];


  if (!log.length) { showToast('No audit entries to export', 'info'); return; }


  const headers = ['Timestamp', 'User', 'Action', 'Record', 'Details'];


  const escapeCSV = v => {


    if (v === null || v === undefined) return '';


    const s = String(v).replace(/"/g, '""');


    return /[",\n]/.test(s) ? '"' + s + '"' : s;


  };


  const rows = log.map(a => [


    a.time || a.created_at || '',


    a.user || a.changed_by || '',


    a.action || '',


    a.record || a.table_name || '',


    a.detail || a.note || ''


  ].map(escapeCSV).join(','));


  const csv = headers.join(',') + '\n' + rows.join('\n');


  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });


  const url = URL.createObjectURL(blob);


  const a = document.createElement('a');


  a.href = url;


  a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;


  document.body.appendChild(a); a.click(); document.body.removeChild(a);


  URL.revokeObjectURL(url);


  showToast('Audit log downloaded', 'success');


}





function handleDocsFileSelected(e) {


  const f = e.target.files && e.target.files[0];


  if (!f) return;


  // For now this just opens the upload modal pre-populated. Real Drive upload


  // wiring lands in Phase 2 (Sheets/Drive embedded workbench).


  openModal('modal-upload-doc');


  const nameInput = document.getElementById('doc-name');


  if (nameInput && !nameInput.value) nameInput.value = f.name.replace(/\.[^.]+$/, '');


  showToast('File selected: ' + f.name + ' — upload destination coming in Phase 2', 'info');


  e.target.value = '';


}





function renderDispatchAssignments() {


  const grid = document.getElementById('dispatch-assignments-grid');


  if (!grid) return;


  const staff = (DB.staff || STAFF_FALLBACK || []).filter(s =>


    (s.dept === 'Field Ops' || s.department === 'Field Ops' || /tech|dispatcher|field/i.test(s.role || ''))


  );


  if (!staff.length) {


    grid.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted)">No field staff yet. Add staff members in the Staff page.</div>';


    return;


  }


  const tickets = (DB.tickets || []).filter(t => isTicketOpen(t.status));


  grid.innerHTML = staff.map(s => {


    const myTickets = tickets.filter(t => {


      const list = (typeof ticketAssigneeList === 'function') ? ticketAssigneeList(t) : [t.assign].filter(Boolean);


      return list.includes(s.name);


    });


    const dept = s.dept || s.department || 'Field Ops';


    const ticketsHtml = myTickets.length


      ? myTickets.map(t => `<div class="list-item" style="cursor:pointer" onclick="openTicketPanel('${esc(t.id)}')"><h4>${esc(t.client||'Unassigned client')} <span style="font-family:monospace;font-size:11px;color:var(--soft);font-weight:normal">${esc(t.id)}</span></h4><p>${esc(t.subject||'\u2014')} \u00b7 ${esc(ticketStatusLabel(t.status))}</p></div>`).join('')


      : '<div class="list-item"><h4>No active tickets</h4><p>Assigned tickets will appear here</p></div>';


    return `<div class="card"><div class="card-inner">


      <h3>${esc(s.name)}</h3>


      <div class="lead">${esc(dept)} \u00b7 ${myTickets.length} active ticket${myTickets.length===1?'':'s'}</div>


      <div class="list-items">${ticketsHtml}</div>


    </div></div>`;


  }).join('');


}





// ========== DISPATCH QUEUE (tickets-backed) ==========


function renderDispatchQueue() {


  const body = document.getElementById('dispatch-tickets-body');


  if (!body) return;


  const tickets = (DB.tickets || []);


  const active = tickets.filter(t => isTicketOpen(t.status));


  if (!active.length) {


    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No active tickets</td></tr>';


  } else {


    body.innerHTML = active.map(t => {


      const list = (typeof ticketAssigneeList === 'function') ? ticketAssigneeList(t) : [];


      const primary = t.assign && t.assign !== 'Unassigned' ? t.assign : (list[0] || '');


      const techCell = primary


        ? `<span style="white-space:nowrap">${esc(primary)}</span>${list.filter(n => n && n !== primary).length ? ` <span style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1px 7px;font-size:11px;color:var(--text);margin-left:4px;white-space:nowrap">+${list.filter(n => n && n !== primary).length} \ud83d\udc65</span>` : ''}`


        : '<span style="color:var(--muted)">Unassigned</span>';


      return `<tr onclick="openTicketPanel('${esc(t.id)}')" style="cursor:pointer">


        <td style="font-family:monospace;font-size:12px;color:var(--soft)">${esc(t.id)}</td>


        <td><strong>${esc(t.subject||'')}</strong></td>


        <td>${esc(t.client||'')}</td>


        <td>${techCell}</td>


        <td>${typeof priorityBadge === 'function' ? priorityBadge(t.priority) : esc(t.priority||'')}</td>


        <td>${typeof statusBadge === 'function' ? statusBadge(t.status) : esc(t.status||'')}</td>


      </tr>`;


    }).join('');


  }


  // KPIs


  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };


  const isToday = s => {


    if (!s) return false;


    if (typeof s === 'string' && /just now|today/i.test(s)) return true;


    const d = new Date(s);


    if (isNaN(d.getTime())) return false;


    const now = new Date();


    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();


  };


  const activeCount = active.length;


  const inProgress = tickets.filter(t => isTicketInProgress(t.status)).length;


  const closedToday = tickets.filter(t => (isTicketClosed(t.status)) && (isToday(t.updated_at) || isToday(t.resolved_at) || isToday(t.created))).length;


  const unassigned = tickets.filter(t => {


    if (isTicketClosed(t.status)) return false;


    const list = (typeof ticketAssigneeList === 'function') ? ticketAssigneeList(t) : [];


    const primary = t.assign && t.assign !== 'Unassigned' ? t.assign : '';


    return !primary && !list.length;


  }).length;


  set('disp-kpi-active', activeCount);


  set('disp-kpi-progress', inProgress);


  set('disp-kpi-closed', closedToday);


  set('disp-kpi-unassigned', unassigned);


}





function renderFieldStatus() {


  const tbody = document.getElementById('field-status-body');


  if (!tbody) return;


  // Build tech rows from DB_JOBS (one row per tech that has a job)


  const seen = new Set();


  const rows = [];


  DB_JOBS.forEach(j => {


    if (!j.tech || seen.has(j.tech)) return;


    seen.add(j.tech);


    const st = TECH_STATUS[j.tech] || 'Available';


    const cls = FS_STATUS_BADGE[st] || 'badge-gray';


    const checkin = FS_CHECKIN[j.tech] || '—';


    const note = TECH_STATUS_NOTE[j.tech] || '';


    rows.push(`<tr id="fs-row-${j.tech.replace(/[^a-zA-Z0-9]/g,'-')}">


      <td><strong>${esc(j.tech)}</strong>${note ? `<div style="color:var(--muted);font-size:11px;margin-top:2px">${esc(note)}</div>` : ''}</td>


      <td style="color:var(--muted);font-size:12px">${checkin}</td>


      <td style="color:var(--muted)">${esc(j.location)}</td>


      <td style="font-family:monospace;font-size:12px;color:var(--soft)">${esc(j.id)}</td>


      <td><span class="badge ${cls}">${esc(st)}</span></td>


    </tr>`);


  });


  // Include any tech that has a status set but no active job (e.g. user-declared via popover)


  Object.keys(TECH_STATUS).forEach(name => {


    if (!name || seen.has(name)) return;


    seen.add(name);


    const st = TECH_STATUS[name] || 'Available';


    const cls = FS_STATUS_BADGE[st] || 'badge-gray';


    const checkin = FS_CHECKIN[name] || '—';


    const note = TECH_STATUS_NOTE[name] || '';


    rows.push(`<tr id="fs-row-${name.replace(/[^a-zA-Z0-9]/g,'-')}">


      <td><strong>${esc(name)}</strong>${note ? `<div style="color:var(--muted);font-size:11px;margin-top:2px">${esc(note)}</div>` : ''}</td>


      <td style="color:var(--muted);font-size:12px">${checkin}</td>


      <td style="color:var(--muted)">—</td>


      <td style="font-family:monospace;font-size:12px;color:var(--soft)">—</td>


      <td><span class="badge ${cls}">${esc(st)}</span></td>


    </tr>`);


  });


  tbody.innerHTML = rows.join('');


  // Update KPI counters


  const counts = {infield:0, onsite:0, enroute:0, available:0};


  Object.values(TECH_STATUS).forEach(st => {


    if (st === 'On Site') { counts.infield++; counts.onsite++; }


    else if (st === 'En Route') { counts.infield++; counts.enroute++; }


    else if (st === 'In Field' || st === 'Picking Up Parts' || st === 'Wrapping Up') { counts.infield++; }


    else if (st === 'Available') { counts.available++; }


    // Lunch / Break / In a Meeting / Offline / Completed / Unavailable: not counted in infield


  });


  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };


  set('fs-kpi-infield', counts.infield);


  set('fs-kpi-onsite', counts.onsite);


  set('fs-kpi-enroute', counts.enroute);


  set('fs-kpi-available', counts.available);


}





// Update a single row in the field-status table without full re-render


function updateFieldStatusRow(techName) {


  const tbody = document.getElementById('field-status-body');


  if (!tbody) return; // page not visible, renderFieldStatus will handle it on next view


  // Re-render fully — table is small, no need for surgical row replacement


  renderFieldStatus();


}





// Called when the "My Field Status" dropdown changes inside the ticket edit panel


function updateTechFieldStatus() {


  const t = DB.tickets.find(x => x.id === activeTicketId);


  const sel = document.getElementById('tp-field-status');


  if (!sel) return;


  const newStatus = sel.value;


  // Determine which technician this applies to


  const techName = t ? (t.assign || '') : (document.getElementById('tp-assign') ? document.getElementById('tp-assign').value : '');


  if (!techName || techName === 'Unassigned' || techName === '') {


    showToast('Assign the ticket to a technician first', 'error');


    return;


  }


  // Write to TECH_STATUS


  TECH_STATUS[techName] = newStatus;


  // Update timestamp for this tech


  FS_CHECKIN[techName] = 'Just now';


  // Refresh Field Status page if currently visible


  const fsPage = document.getElementById('page-dispatch-status');


  if (fsPage && fsPage.classList.contains('active')) {


    renderFieldStatus();


  }


  // Always update the KPI counters (they read from TECH_STATUS regardless of page)


  updateFieldStatusKPIs();


  showToast('Status updated to ' + newStatus, 'success');


}





function updateFieldStatusKPIs() {


  const counts = {infield:0, onsite:0, enroute:0, available:0};


  Object.values(TECH_STATUS).forEach(st => {


    if (st === 'On Site') { counts.infield++; counts.onsite++; }


    else if (st === 'En Route') { counts.infield++; counts.enroute++; }


    else if (st === 'In Field' || st === 'Picking Up Parts' || st === 'Wrapping Up') { counts.infield++; }


    else if (st === 'Available') { counts.available++; }


  });


  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };


  set('fs-kpi-infield', counts.infield);


  set('fs-kpi-onsite', counts.onsite);


  set('fs-kpi-enroute', counts.enroute);


  set('fs-kpi-available', counts.available);


}





// Save current user's field status + note from the avatar/profile popover.


// Storage: in-memory TECH_STATUS / TECH_STATUS_NOTE / FS_CHECKIN (same as


// the existing My Field Status dropdown on the ticket panel). Optionally


// appends an entry to accounting_audit_log so admins have a history trail.


async function saveMyFieldStatus(e) {


  if (e && e.stopPropagation) e.stopPropagation();


  const sel = document.getElementById('um-field-status');


  const noteEl = document.getElementById('um-field-note');


  if (!sel) return;


  const newStatus = sel.value;


  const note = (noteEl && noteEl.value || '').trim();


  const techName = (window.SESSION_USER && window.SESSION_USER.name) || '';


  if (!techName) {


    showToast('Sign in before updating status', 'error');


    return;


  }


  const prevStatus = TECH_STATUS[techName] || 'Available';


  TECH_STATUS[techName] = newStatus;


  TECH_STATUS_NOTE[techName] = note;


  FS_CHECKIN[techName] = 'Just now';


  // Refresh Field Status page if visible, otherwise just update KPIs


  const fsPage = document.getElementById('page-dispatch-status');


  if (fsPage && fsPage.classList.contains('active')) {


    renderFieldStatus();


  } else {


    updateFieldStatusKPIs();


  }


  // Reflect current value in the popover footer


  const cur = document.getElementById('um-field-status-current');


  if (cur) cur.textContent = 'Current: ' + newStatus + (note ? ' — ' + note : '');


  // Best-effort admin history log via the existing audit-log helper


  // (no schema migration; silently no-ops if Supabase is offline).


  try {


    if (typeof sbInsertAudit === 'function') {


      const detail = 'Field status: ' + prevStatus + ' → ' + newStatus + (note ? ' (' + note + ')' : '');


      sbInsertAudit('field_status', techName, 'status_change', detail);


    }


  } catch(_) {}


  showToast('Status updated to ' + newStatus, 'success');


}





// Pre-fill the popover controls with the current user's stored status/note


function refreshUserMenuFieldStatus() {


  const sel = document.getElementById('um-field-status');


  const noteEl = document.getElementById('um-field-note');


  const cur = document.getElementById('um-field-status-current');


  const techName = (window.SESSION_USER && window.SESSION_USER.name) || '';


  if (!sel) return;


  const st = (techName && TECH_STATUS[techName]) || 'Available';


  const note = (techName && TECH_STATUS_NOTE[techName]) || '';


  // Match by value (fall back silently if status not in list)


  for (let i = 0; i < sel.options.length; i++) {


    if (sel.options[i].value === st || sel.options[i].text === st) { sel.selectedIndex = i; break; }


  }


  if (noteEl) noteEl.value = note;


  if (cur) cur.textContent = techName ? ('Current: ' + st + (note ? ' — ' + note : '')) : '';


}





let activeJobIdx = null;





function openJobPanel(idx) {


  const j = DB_JOBS[idx];


  if (!j) return;


  activeJobIdx = idx;


  document.getElementById('jp-id').textContent = j.id;


  document.getElementById('jp-created').textContent = 'Created ' + j.created;


  document.getElementById('jp-client').value = j.client || '';


  document.getElementById('jp-location').value = j.location || '';


  document.getElementById('jp-issue').value = j.issue || '';


  document.getElementById('jp-status').value = j.status || 'Pending';


  document.getElementById('jp-support-window').value = j.support_window || 'ASAP';


  document.getElementById('jp-tech').value = j.tech || '';


  document.getElementById('jp-sec-name').value = j.secondary_contact || '';


  document.getElementById('jp-sec-phone').value = j.secondary_phone || '';


  document.getElementById('jp-notes').value = j.notes || '';


  // Trigger contact autofill


  jobClientAutofill('jp');


  document.getElementById('jobOverlay').classList.add('open');


  document.getElementById('jobPanel').classList.add('open');


}





function closeJobPanel() {


  document.getElementById('jobOverlay').classList.remove('open');


  document.getElementById('jobPanel').classList.remove('open');


  activeJobIdx = null;


}





function saveJobPanel() {


  showToast('Dispatch job persistence coming in Phase 2 — edit not saved', 'info');


  closeJobPanel();


}





let activeClientIdx = null;


let activeVendorIdx = null;





function openClientPanel(idx) {


  const c = DB.clients[idx];


  if (!c) return;


  activeClientIdx = idx;


  if (!c.files) c.files = [];


  document.getElementById('cp-name').textContent = c.name;


  document.getElementById('cp-id').textContent = c.location + ' · ' + c.contact;


  document.getElementById('cp-first').value = c.first_name || '';


  document.getElementById('cp-last').value = c.last_name || '';


  document.getElementById('cp-company').value = c.company || '';


  document.getElementById('cp-location').value = c.location;


  document.getElementById('cp-contact').value = c.contact;


  document.getElementById('cp-phone').value = c.phone || '';


  document.getElementById('cp-status').value = c.status;


  document.getElementById('cp-notes').value = c.notes || '';


  // Reset form picker + upload area


  document.getElementById('cp-form-picker').style.display = 'none';


  document.getElementById('cp-upload-area').style.display = 'none';


  // Render documents (DB + legacy)


  if (typeof renderClientForms === 'function') renderClientForms();


  if (c._sbId && typeof loadClientForms === 'function') {


    loadClientForms(c._sbId).then(() => renderClientForms());


  }


  // Legacy local files (kept for backward compat)


  if (typeof renderCPFiles === 'function') renderCPFiles(idx);


  document.getElementById('clientOverlay').classList.add('open');


  document.getElementById('clientPanel').classList.add('open');


}





function renderCPFiles(idx) {


  const c = DB.clients[idx !== undefined ? idx : activeClientIdx];


  if (!c) return;


  if (!c.files) c.files = [];


  const list = document.getElementById('cp-files-list');


  if (!list) return;


  if (!c.files.length) { list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0">No files uploaded yet.</div>'; return; }


  list.innerHTML = c.files.map((f,fi) => `


    <div class="panel-file-item">


      <span class="fname">📎 ${esc(f.name)}</span>


      <span class="fdate">${esc(f.date)}</span>


      <button onclick="event.stopPropagation();DB.clients[activeClientIdx].files.splice(${fi},1);renderCPFiles()" style="margin-left:8px;background:rgba(201,48,63,.15);border:1px solid rgba(201,48,63,.3);color:#ffb8bf;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">×</button>


    </div>`).join('');


}





function cpUploadFile() {


  document.getElementById('cp-upload-area').style.display = 'block';


  document.getElementById('cp-upload-filename').focus();


}





function cpConfirmUpload() {


  showToast('Use the Forms button on the client panel to attach files that persist — this quick-add is being phased out', 'info');


  document.getElementById('cp-upload-area').style.display = 'none';


}





function cpToggleFormPicker() {


  const el = document.getElementById('cp-form-picker');


  el.style.display = el.style.display === 'none' ? 'grid' : 'none';


}





function cpOpenForm(type) {


  const c = DB.clients[activeClientIdx];


  const clientName = c ? c.name : '';


  const modalMap = { invoice:'modal-form-invoice', quote:'modal-form-quote', workorder:'modal-form-workorder', servicerequest:'modal-form-servicerequest', changeorder:'modal-form-changeorder', proposal:'modal-form-proposal', consultation:'modal-form-consultation', diagnostic:'modal-form-diagnostic', signoff:'modal-form-signoff', receipt:'modal-form-receipt', terms:'modal-form-terms' };


  const modalId = modalMap[type] || 'modal-form-invoice';


  closeClientPanel();


  openModal(modalId);


  // Pre-fill client name


  setTimeout(() => {


    const inputs = document.querySelectorAll('#' + modalId + ' input[id*="client"], #' + modalId + ' input[id*="Client"]');


    inputs.forEach(inp => { if (!inp.value) inp.value = clientName; });


    const selects = document.querySelectorAll('#' + modalId + ' select[id*="client"], #' + modalId + ' select[id*="Client"]');


    selects.forEach(sel => {


      Array.from(sel.options).forEach(o => { if (o.value === clientName || o.text === clientName) sel.value = clientName; });


    });


    // Fallback: many forms use placeholder-based Client / Company fields without IDs


    const phInputs = document.querySelectorAll('#' + modalId + ' input[placeholder*="Company name"], #' + modalId + ' input[placeholder*="Client"]');


    phInputs.forEach(inp => { if (!inp.value) inp.value = clientName; });


    // Also fill inv-client if this is invoice


    const invClient = document.getElementById('inv-client');


    if (invClient && type === 'invoice') {


      Array.from(invClient.options).forEach(o => { if (o.value === clientName) invClient.value = clientName; });


    }


  }, 100);


  showToast('Opening ' + type + ' for ' + clientName, 'info');


}


function closeClientPanel() {


  document.getElementById('clientOverlay').classList.remove('open');


  document.getElementById('clientPanel').classList.remove('open');


  activeClientIdx = null;


}


function saveClientPanel() {


  const c = DB.clients[activeClientIdx];


  if (!c) return;


  const first = (document.getElementById('cp-first').value || '').trim();


  const last = (document.getElementById('cp-last').value || '').trim();


  const company = (document.getElementById('cp-company').value || '').trim();


  const fullName = (first + ' ' + last).trim();


  c.first_name = first;


  c.last_name = last;


  c.contact_name = fullName;


  c.company = company;


  c.name = company || fullName || c.name;


  c.location = document.getElementById('cp-location').value;


  c.contact = document.getElementById('cp-contact').value;


  c.phone = document.getElementById('cp-phone').value;


  c.status = document.getElementById('cp-status').value;


  c.notes = document.getElementById('cp-notes').value;


  // Persist to Supabase


  if (c._sbId && sb) {


    (async () => {


      try {


        await sb.from('clients').update({


          name: fullName || c.name,


          first_name: first || null,


          last_name: last || null,


          company: company || null,


          email: c.contact && c.contact.includes('@') ? c.contact : null,


          phone: c.phone || null,


          address: c.location || null,


          status: c.status,


          notes: c.notes || null


        }).eq('id', c._sbId);


        await sbInsertAudit('clients', c.name, 'Update', 'Edited client: ' + c.name);


      } catch(e) { console.warn('Client update failed:', e); }


    })();


  }


  closeClientPanel();


  renderClients();


  rebuildClientDatalist();


  showToast(c.name + ' saved', 'success');


}





function archiveClient() {


  const c = DB.clients[activeClientIdx];


  if (!c) return;


  if (!confirm('Archive "' + c.name + '"? They will be hidden from the main table.')) return;


  c.status = 'Archived';


  if (sbConnected) {


    (async () => {


      try {


        if (c._sbId) await sb.from('clients').update({ status: 'Archived' }).eq('id', c._sbId);


        await sbInsertAudit('clients', c.name, 'Archive', 'Client ' + c.name + ' archived');


      } catch(e) { console.warn('Archive failed:', e); }


    })();


  }


  closeClientPanel();


  renderClients();


  showToast(c.name + ' archived', 'success');


}





function openVendorPanel(idx) {


  const v = DB.vendors[idx];


  if (!v) return;


  activeVendorIdx = idx;


  if (!v.files) v.files = [];


  document.getElementById('vp-name').textContent = v.name;


  document.getElementById('vp-id').textContent = v.category;


  document.getElementById('vp-vendorname').value = v.name;


  document.getElementById('vp-category').value = v.category;


  document.getElementById('vp-contact').value = v.contact;


  document.getElementById('vp-status').value = v.status;


  document.getElementById('vp-notes').value = v.notes || '';


  document.getElementById('vp-form-picker').style.display = 'none';


  document.getElementById('vp-upload-area').style.display = 'none';


  renderVPFiles(idx);


  document.getElementById('vendorOverlay').classList.add('open');


  document.getElementById('vendorPanel').classList.add('open');


}





function renderVPFiles(idx) {


  const v = DB.vendors[idx !== undefined ? idx : activeVendorIdx];


  if (!v) return;


  if (!v.files) v.files = [];


  const list = document.getElementById('vp-files-list');


  if (!list) return;


  if (!v.files.length) { list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0">No files uploaded yet.</div>'; return; }


  list.innerHTML = v.files.map((f,fi) => `


    <div class="panel-file-item">


      <span class="fname">📎 ${esc(f.name)}</span>


      <span class="fdate">${esc(f.date)}</span>


      <button onclick="event.stopPropagation();DB.vendors[activeVendorIdx].files.splice(${fi},1);renderVPFiles()" style="margin-left:8px;background:rgba(201,48,63,.15);border:1px solid rgba(201,48,63,.3);color:#ffb8bf;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">×</button>


    </div>`).join('');


}





function vpUploadFile() {


  document.getElementById('vp-upload-area').style.display = 'block';


  document.getElementById('vp-upload-filename').focus();


}





function vpConfirmUpload() {


  showToast('Use the Forms button on the vendor panel to attach files that persist — this quick-add is being phased out', 'info');


  document.getElementById('vp-upload-area').style.display = 'none';


}





function vpToggleFormPicker() {


  const el = document.getElementById('vp-form-picker');


  el.style.display = el.style.display === 'none' ? 'grid' : 'none';


}





function vpOpenForm(type) {


  const v = DB.vendors[activeVendorIdx];


  const vendorName = v ? v.name : '';


  const modalMap = { w9: 'modal-form-w9', invoice: 'modal-new-bill', '1099': 'modal-form-1099' };


  const modalId = modalMap[type] || 'modal-new-bill';


  closeVendorPanel();


  openModal(modalId);


  setTimeout(() => {


    const billVendor = document.getElementById('bill-vendor');


    if (billVendor && type === 'invoice') {


      Array.from(billVendor.options).forEach(o => { if (o.value === vendorName || o.text === vendorName) billVendor.value = vendorName; });


    }


  }, 100);


  showToast('Opening ' + type + ' for ' + vendorName, 'info');


}


function closeVendorPanel() {


  document.getElementById('vendorOverlay').classList.remove('open');


  document.getElementById('vendorPanel').classList.remove('open');


  activeVendorIdx = null;


}


function saveVendorPanel() {


  const v = DB.vendors[activeVendorIdx];


  if (!v) return;


  v.name     = document.getElementById('vp-vendorname').value;


  v.category = document.getElementById('vp-category').value;


  v.contact  = document.getElementById('vp-contact').value;


  v.status   = document.getElementById('vp-status').value;


  v.notes    = document.getElementById('vp-notes').value;


  // Supabase update


  if (sbConnected) {


    (async () => {


      try {


        const updates = { company_name: v.name, contact_name: v.contact, status: v.status, notes: v.notes };


        if (v._sbId) await sb.from('vendors').update(updates).eq('id', v._sbId);


        await sbInsertAudit('vendors', v.name, 'Edit', 'Vendor ' + v.name + ' updated');


      } catch(e) { console.warn('Vendor update failed:', e); }


    })();


  }


  closeVendorPanel();


  renderVendors();


  showToast(v.name + ' saved', 'success');


}





function archiveVendor() {


  const v = DB.vendors[activeVendorIdx];


  if (!v) return;


  if (!confirm('Archive "' + v.name + '"? They will be hidden from the main table.')) return;


  v.status = 'Archived';


  if (sbConnected) {


    (async () => {


      try {


        if (v._sbId) await sb.from('vendors').update({ status: 'Archived' }).eq('id', v._sbId);


        await sbInsertAudit('vendors', v.name, 'Archive', 'Vendor ' + v.name + ' archived');


      } catch(e) { console.warn('Archive failed:', e); }


    })();


  }


  closeVendorPanel();


  renderVendors();


  showToast(v.name + ' archived', 'success');


}





function renderClients() {


  const body = document.getElementById('clients-body');


  if (!body) return;


  const search = (document.getElementById('clients-search')?.value || '').toLowerCase();


  const statusFilter = document.getElementById('clients-status-filter')?.value || '';


  const showArchived = document.getElementById('clients-show-archived')?.checked || false;


  body.innerHTML = DB.clients.map((c,i) => {


    if (!showArchived && c.status === 'Archived') return '';


    if (statusFilter && c.status !== statusFilter) return '';


    if (search && !((c.name||'').toLowerCase().includes(search) || (c.location||'').toLowerCase().includes(search) || (c.contact||'').toLowerCase().includes(search))) return '';


    const fullName = (c.contact_name || ((c.first_name||'') + ' ' + (c.last_name||'')).trim()) || '';


    const showSecond = fullName && fullName !== c.name;


    return `<tr onclick="openClientPanel(${i})">


      <td>


        <strong>${esc(c.name)}</strong>


        ${showSecond ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(fullName)}</div>` : ''}


      </td>


      <td data-mobile-label="Location" style="color:var(--muted)">${esc(c.location)}</td>


      <td data-mobile-label="Contact" style="color:var(--muted)">${esc(c.contact)}</td>


      <td data-mobile-label="Tickets" style="text-align:left">${c.tickets}</td>


      <td data-mobile-label="A/R" style="font-variant-numeric:tabular-nums">${esc(c.ar)}</td>


      <td data-mobile-label="Status">${clientStatusBadge(c.status)}</td>


    </tr>`;


  }).join('');


}





function renderVendors() {


  const body = document.getElementById('vendors-body');


  if (!body) return;


  const search = (document.getElementById('vendors-search')?.value || '').toLowerCase();


  const statusFilter = document.getElementById('vendors-status-filter')?.value || '';


  const showArchived = document.getElementById('vendors-show-archived')?.checked || false;


  body.innerHTML = DB.vendors.map((v,i) => {


    if (!showArchived && v.status === 'Archived') return '';


    if (statusFilter && v.status !== statusFilter) return '';


    if (search && !((v.name||'').toLowerCase().includes(search) || (v.category||'').toLowerCase().includes(search) || (v.contact||'').toLowerCase().includes(search))) return '';


    return `<tr onclick="openVendorPanel(${i})">


      <td><strong>${esc(v.name)}</strong></td>


      <td style="color:var(--muted)">${esc(v.category)}</td>


      <td style="color:var(--muted)">${esc(v.contact)}</td>


      <td style="text-align:center">${v.bills}</td>


      <td style="font-variant-numeric:tabular-nums">${esc(v.ap)}</td>


      <td>${vendorStatusBadge(v.status)}</td>


    </tr>`;


  }).join('');


}





let activeProjectIdx = null;





function openProjectPanel(idx) {


  const p = DB.projects[idx];


  if (!p) return;


  activeProjectIdx = idx;


  document.getElementById('pp-name').textContent = p.name;


  document.getElementById('pp-client').textContent = p.client + ' · ' + p.lead;


  document.getElementById('pp-projname').value = p.name;


  document.getElementById('pp-projclient').value = p.client;


  // Set lead — match existing option or leave as-is


  const leadSel = document.getElementById('pp-lead');


  const leadOpts = Array.from(leadSel.options).map(o => o.value);


  // Map short names to full names in the dropdown


  const leadMap = {'D. McGann':'Darren McGann','A. Piva':'Andrew Piva','B. Egan':'Blyth Egan','J. Pacheco':'Joey Pacheco','K. Hilmy':'Karim Hilmy'};


  const mappedLead = leadMap[p.lead] || p.lead;


  leadSel.value = leadOpts.includes(mappedLead) ? mappedLead : (leadOpts.includes(p.lead) ? p.lead : leadOpts[0]);


  // Dates are stored as ISO YYYY-MM-DD already — feed them straight to the date input.


  // Tolerate legacy display strings like "Apr 1" if any remain in memory.


  function toIso(val) {


    if (!val || val === '—') return '';


    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;


    const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};


    const parts = val.split(' ');


    if (parts.length >= 2 && months[parts[0]]) return new Date().getFullYear() + '-' + months[parts[0]] + '-' + String(parseInt(parts[1])).padStart(2,'0');


    return '';


  }


  document.getElementById('pp-start').value = toIso(p.start);


  document.getElementById('pp-due').value = toIso(p.due);


  const statusSel = document.getElementById('pp-status');


  statusSel.value = p.status;


  document.getElementById('pp-notes').value = p.notes || '';


  // Render notes log + meetings


  renderProjectNotesLog(p);


  renderProjectMeetings(p);


  // Load fresh data from DB if we have an _sbId


  if (p._sbId) {


    loadProjectNotes(p).then(() => renderProjectNotesLog(p));


    loadProjectMeetings(p).then(() => renderProjectMeetings(p));


  }


  document.getElementById('projectOverlay').classList.add('open');


  document.getElementById('project-panel').classList.add('open');


}





function closeProjectPanel() {


  document.getElementById('projectOverlay').classList.remove('open');


  document.getElementById('project-panel').classList.remove('open');


  activeProjectIdx = null;


}





async function saveProjectPanel() {


  const p = DB.projects[activeProjectIdx];


  if (!p) return;


  p.name   = document.getElementById('pp-projname').value;


  p.client = document.getElementById('pp-projclient').value;


  p.lead   = document.getElementById('pp-lead').value;


  p.status = document.getElementById('pp-status').value;


  p.notes  = document.getElementById('pp-notes').value;


  // Store ISO dates directly (YYYY-MM-DD) — formatting is handled at render time


  p.start = document.getElementById('pp-start').value || null;


  p.due   = document.getElementById('pp-due').value || null;


  // Persist


  if (sb && p._sbId) {


    try {


      const { error } = await sb.from('mse_projects').update({


        name: p.name,


        status: p.status,


        start_date: p.start,


        due_date: p.due,


        lead_name: p.lead,


        notes: p.notes


      }).eq('id', p._sbId);


      if (error) throw error;


      sbInsertAudit('mse_projects', p._sbId, 'Update', 'Edited project: ' + p.name);


    } catch(e) {


      console.warn('Project update failed:', e);


      showToast('Saved locally only — DB error: ' + (e.message||'unknown'), 'error');


    }


  }


  closeProjectPanel();


  renderProjects();


  showToast(p.name + ' saved', 'success');


}





async function cancelProject() {


  const p = DB.projects[activeProjectIdx];


  if (!p) return;


  if (!confirm('Cancel project "' + p.name + '"?')) return;


  p.status = 'Cancelled';


  if (sb && p._sbId) {


    try {


      await sb.from('mse_projects').update({ status: 'Cancelled' }).eq('id', p._sbId);


      sbInsertAudit('mse_projects', p._sbId, 'Cancel', 'Cancelled project: ' + p.name);


    } catch(e) { console.warn('Project cancel persistence failed:', e); }


  }


  closeProjectPanel();


  renderProjects();


  showToast(p.name + ' cancelled', 'success');


}








