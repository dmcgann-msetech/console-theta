// ========== SUPABASE PERSISTENCE ==========


async function sbInsertAudit(tableName, recordId, action, detail) {


  if (!sbConnected) return;


  try {


    await sb.from('accounting_audit_log').insert({


      table_name: tableName,


      record_id: String(recordId),


      action: action,


      changed_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


      changes: null,


      note: detail,


      created_at: new Date().toISOString()


    });


  } catch(e) { console.warn('Audit log insert failed:', e); }


}





// ===== Multi-assignee helpers (tickets) =====


// assigned_tech is a single TEXT column. We persist multiple assignees as a


// comma-separated string ("D. McGann, J. Pacheco"). The first name is the


// primary (mapped to t.assign for backward compat with existing filters,


// dashboards, claim flows). Additional names live in t.assignees[].


function parseAssigneeString(s) {


  if (!s) return [];


  if (s === 'Unassigned') return [];


  return s.split(',').map(x => x.trim()).filter(x => x && x !== 'Unassigned');


}


function joinAssignees(arr) {


  const list = (arr || []).map(x => (x || '').trim()).filter(Boolean);


  // de-dupe preserving order


  const seen = new Set();


  const out = [];


  for (const n of list) { if (!seen.has(n)) { seen.add(n); out.push(n); } }


  return out.join(', ');


}


function ticketAssigneeList(t) {


  if (!t) return [];


  if (Array.isArray(t.assignees) && t.assignees.length) return t.assignees.slice();


  return parseAssigneeString(t.assign || '');


}





async function loadTicketsFromSupabase() {


  try {


    const { data, error } = await sb.from('tickets').select('*').order('created_at', { ascending: false });


    if (error) throw error;


    if (data && data.length > 0) {


      DB.tickets = data.map(r => {


        // Multi-assignee: assigned_tech may be a single name or comma-separated list.


        // Primary assignee (t.assign) = first name, additional names live in t.assignees.


        const rawAssign = (r.assigned_tech || '').trim();


        const assignees = parseAssigneeString(rawAssign);


        const primary = assignees[0] || (rawAssign && rawAssign !== 'Unassigned' ? rawAssign : '');


        return {


          id: r.job_id || r.id,


          subject: r.issue || r.subject || '',


          client: r.client_name || '',


          assign: primary || 'Unassigned',


          assignees: assignees,


          priority: r.priority || 'Medium',


          status: normalizeTicketStatus(r.status),


          notes: r.notes || '',


          created: r.created_at ? new Date(r.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Recently',


          assigned_at: r.assigned_at || null,


          started_at: r.started_at || null,


          _sbId: r.id


        };


      });


      setConnIndicator('connected');


    }


  } catch(e) {


    console.warn('Supabase tickets fetch failed, using local data:', e);


    setConnIndicator('offline');


  }


  if (typeof updateTicketCounts === "function") updateTicketCounts();


}





async function loadClientsFromSupabase() {


  try {


    const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: false });


    if (error) throw error;


    if (data && data.length > 0) {


      DB.clients = data.map(r => {


        const first = r.first_name || '';


        const last = r.last_name || '';


        const fullName = (first + ' ' + last).trim() || r.name || '';


        const company = r.company || '';


        return {


          // Display name = company if present, otherwise the contact's full name


          name: company || fullName || 'Unnamed client',


          contact_name: fullName,


          first_name: first,


          last_name: last,


          company: company,


          location: r.address || 'â€”',


          contact: r.email || r.phone || 'â€”',


          email: r.email || '',


          phone: r.phone || '',


          tickets: 0, ar: '$0',


          status: r.status || 'Active',


          notes: r.notes || '',


          _sbId: r.id,


          client_number: r.client_number || ''


        };


      });


      rebuildClientDatalist();


      setConnIndicator('connected');


    }


  } catch(e) {


    console.warn('Supabase clients fetch failed, using local data:', e);


    setConnIndicator('offline');


  }


}





async function loadVendorsFromSupabase() {


  try {


    const { data, error } = await sb.from('vendors').select('*').order('created_at', { ascending: false });


    if (error) throw error;


    if (data && data.length > 0) {


      DB.vendors = data.map(r => ({


        name: r.company_name || '',


        category: 'General',


        contact: r.contact_name || r.email || 'â€”',


        email: r.email || '',


        bills: 0, ap: '$0',


        status: r.status || 'Active',


        notes: r.notes || '',


        _sbId: r.id


      }));


      setConnIndicator('connected');


    }


  } catch(e) {


    console.warn('Supabase vendors fetch failed, using local data:', e);


    setConnIndicator('offline');


  }


}





async function loadBillsFromSupabase() {


  // Loads vendor_files (bills) joined with vendors into ACC.bills


  if (!sb) return;


  try {


    const { data, error } = await sb


      .from('vendor_files')


      .select('*, vendors(company_name)')


      .order('created_at', { ascending: false });


    if (error) throw error;


    if (data) {


      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


      const fmtDate = s => {


        if (!s) return 'â€”';


        const d = new Date(s);


        if (isNaN(d)) return s;


        return months[d.getUTCMonth()] + ' ' + d.getUTCDate();


      };


      // Derive category from vendor name or notes


      const deriveCategory = (vendorName, notes) => {


        const v = (vendorName || '').toLowerCase();


        const n = (notes || '').toLowerCase();


        if (v.includes('google') || v.includes('microsoft') || v.includes('adobe') || v.includes('github') || v.includes('atlassian')) return 'Software';


        if (v.includes('comcast') || v.includes('verizon') || v.includes('att') || v.includes('voice') || v.includes('telecom') || v.includes('spectrum')) return 'Telecom';


        if (v.includes('amazon') || v.includes('aws')) return 'Cloud/Hosting';


        if (n.includes('software') || n.includes('saas') || n.includes('subscription')) return 'Software';


        if (n.includes('telecom') || n.includes('internet') || n.includes('phone')) return 'Telecom';


        return 'Other';


      };


      // Map DB status â†’ UI status


      const mapStatus = (dbStatus, paidDate) => {


        if (dbStatus === 'paid') return 'Paid';


        if (dbStatus === 'filed') return paidDate ? 'Paid' : 'Scheduled';


        if (dbStatus === 'archived') return 'Paid';


        return 'Awaiting Approval'; // pending or anything else


      };


      ACC.bills = data.map(r => ({


        id: r.file_number || ('VF-' + r.id),


        attachment_path: r.attachment_path || null,


        attachment_filename: r.attachment_filename || null,


        attachment_mime: r.attachment_mime || null,


        attachment_size_bytes: r.attachment_size_bytes || null,


        attachment_uploaded_at: r.attachment_uploaded_at || null,


        attachment_uploaded_by: r.attachment_uploaded_by || null,


        vendor: (r.vendors && r.vendors.company_name) || 'Unknown Vendor',


        amount: parseFloat(r.amount) || 0,


        due: fmtDate(r.due_date),


        cat: deriveCategory((r.vendors && r.vendors.company_name) || '', r.notes),


        status: mapStatus(r.status, r.paid_date),


        notes: r.notes || '',


        _sbId: r.id,          // Supabase row id for updates


        _vendorId: r.vendor_id


      }));


      setConnIndicator('connected');


      // Re-render AP if the page is currently visible


      if (document.getElementById('ap-body')) renderAP();


    }


  } catch(e) {


    console.warn('Supabase bills fetch failed, using offline cache:', e);


    showToast('Could not load bills â€” using offline cache', 'error');


    setConnIndicator('offline');


  }


}





























// ============================================================



// ============== BANK ACCOUNTS (Banking page) ================


// ============================================================


let _bankAccounts = [];


let _activeBankAccountId = null;  // for edit mode





const BANK_TYPE_LABELS = {


  checking: 'Checking',


  savings: 'Savings',


  money_market: 'Money Market',


  credit_card: 'Credit Card',


  loan: 'Loan',


  other: 'Account'


};





async function loadBankAccountsFromSupabase() {


  if (!sb) return;


  try {


    const { data, error } = await sb.from('bank_accounts')


      .select('*')


      .neq('status', 'closed')


      .order('position', { ascending: true });


    if (error) throw error;


    _bankAccounts = data || [];


    renderBankAccounts();


    setConnIndicator('connected');


  } catch(e) {


    console.warn('Bank accounts load failed:', e);


    _bankAccounts = [];


    renderBankAccounts();


  }


}





function fmtUSD(amount) {


  if (amount === null || amount === undefined || amount === '') return null;


  const n = parseFloat(amount);


  if (isNaN(n)) return null;


  return '$' + n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});


}





function renderBankAccounts() {


  const grid = document.getElementById('bank-accounts-grid');


  if (!grid) return;


  if (!_bankAccounts.length) {


    grid.innerHTML = `<div style="grid-column:1/-1;background:var(--surface2);border:1px dashed var(--border);border-radius:12px;padding:32px;text-align:center;color:var(--muted)">


      <div style="font-size:14px;margin-bottom:8px">No bank accounts yet</div>


      <button class="btn-primary" onclick="openAccountModal()" style="font-size:13px">+ Add Your First Account</button>


    </div>`;


    return;


  }


  grid.innerHTML = _bankAccounts.map(a => {


    const typeLabel = BANK_TYPE_LABELS[a.account_type] || 'Account';


    const last4 = a.last4 ? `*${a.last4}` : '';


    const headLine = `${esc(a.bank_name)} ${esc(typeLabel)} ${last4}`;


    const subLine = a.nickname || 'â€”';


    const balVal = fmtUSD(a.balance);


    const balDisplay = balVal !== null ? balVal : 'â€”';


    const balColor = a.account_type === 'credit_card' && balVal !== null ? '#e87b87' : 'var(--text)';


    return `<div class="kpi" style="cursor:pointer;position:relative" onclick="openAccountModal(${a.id})" title="Click to edit">


      <div class="kpi-label">${headLine}</div>


      <div class="kpi-value" style="color:${balColor}">${balDisplay}</div>


      <div class="kpi-sub">${esc(subLine)}</div>


    </div>`;


  }).join('');


}





function openAccountModal(accountId) {


  _activeBankAccountId = accountId || null;


  const editing = !!accountId;


  document.getElementById('ba-modal-title').textContent = editing ? 'Edit Account' : 'Add Account';


  document.getElementById('ba-delete-btn').style.display = editing ? '' : 'none';





  if (editing) {


    const a = _bankAccounts.find(x => x.id === accountId);


    if (!a) { showToast('Account not found','error'); return; }


    document.getElementById('ba-bank').value = a.bank_name || '';


    document.getElementById('ba-type').value = a.account_type || 'checking';


    document.getElementById('ba-name').value = a.account_name || '';


    document.getElementById('ba-last4').value = a.last4 || '';


    document.getElementById('ba-nickname').value = a.nickname || '';


    document.getElementById('ba-balance').value = (a.balance !== null && a.balance !== undefined) ? a.balance : '';


    document.getElementById('ba-status').value = a.status || 'active';


    document.getElementById('ba-notes').value = a.notes || '';


  } else {


    document.getElementById('ba-bank').value = 'Santander';


    document.getElementById('ba-type').value = 'checking';


    document.getElementById('ba-name').value = '';


    document.getElementById('ba-last4').value = '';


    document.getElementById('ba-nickname').value = '';


    document.getElementById('ba-balance').value = '';


    document.getElementById('ba-status').value = 'active';


    document.getElementById('ba-notes').value = '';


  }


  openModal('modal-bank-account');


}





async function saveBankAccount() {


  const payload = {


    bank_name: document.getElementById('ba-bank').value.trim(),


    account_type: document.getElementById('ba-type').value,


    account_name: document.getElementById('ba-name').value.trim(),


    last4: document.getElementById('ba-last4').value.trim() || null,


    nickname: document.getElementById('ba-nickname').value.trim() || null,


    balance: document.getElementById('ba-balance').value.trim() === '' ? null : parseFloat(document.getElementById('ba-balance').value),


    status: document.getElementById('ba-status').value,


    notes: document.getElementById('ba-notes').value.trim() || null


  };


  if (!payload.bank_name) { showToast('Bank name required','error'); return; }


  if (!payload.account_name) { showToast('Account name required','error'); return; }


  if (payload.last4 && !/^\d{4}$/.test(payload.last4)) { showToast('Last 4 must be 4 digits','error'); return; }





  try {


    if (_activeBankAccountId) {


      const { error } = await sb.from('bank_accounts').update(payload).eq('id', _activeBankAccountId);


      if (error) throw error;


      showToast('Account updated', 'success');


    } else {


      payload.position = _bankAccounts.length;


      payload.balance_as_of = payload.balance !== null ? new Date().toISOString().slice(0,10) : null;


      const { error } = await sb.from('bank_accounts').insert(payload);


      if (error) throw error;


      showToast('Account added', 'success');


    }


    closeModal('modal-bank-account');


    await loadBankAccountsFromSupabase();


  } catch(e) {


    console.warn('Bank account save failed:', e);


    showToast('Save failed: ' + (e.message||'unknown'), 'error');


  }


}





async function deleteBankAccount() {


  if (!_activeBankAccountId) return;


  const a = _bankAccounts.find(x => x.id === _activeBankAccountId);


  if (!a) return;


  if (!confirm(`Delete "${a.bank_name} ${a.account_name}${a.last4 ? ' *'+a.last4 : ''}"?\n\nThis cannot be undone.`)) return;


  try {


    const { error } = await sb.from('bank_accounts').delete().eq('id', _activeBankAccountId);


    if (error) throw error;


    showToast('Account deleted', 'success');


    closeModal('modal-bank-account');


    await loadBankAccountsFromSupabase();


  } catch(e) {


    console.warn('Bank account delete failed:', e);


    showToast('Delete failed: ' + (e.message||'unknown'), 'error');


  }


}


async function loadAuditLogFromSupabase() {


  // Loads accounting_audit_log into ACC.auditLog


  if (!sb) return;


  try {


    const { data, error } = await sb


      .from('accounting_audit_log')


      .select('*')


      .order('created_at', { ascending: false })


      .limit(200);


    if (error) throw error;


    if (data && data.length > 0) {


      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


      const fmtTs = s => {


        if (!s) return 'â€”';


        const d = new Date(s);


        if (isNaN(d)) return s;


        return months[d.getMonth()] + ' ' + d.getDate() + ', ' +


          d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});


      };


      // Merge DB entries with any local optimistic entries (deduplicate by record+action)


      const dbEntries = data.map(r => ({


        time: fmtTs(r.created_at),


        user: r.changed_by || 'staff',


        action: r.action ? (r.action.charAt(0).toUpperCase() + r.action.slice(1)) : 'Edit',


        record: r.record_id || 'â€”',


        detail: r.note || ''


      }));


      // Replace local cache with DB truth


      ACC.auditLog = dbEntries;


      // Re-render if visible


      if (document.getElementById('audit-body')) renderAuditTrail();


    }


  } catch(e) {


    console.warn('Supabase audit log fetch failed:', e);


  }


}





const STAFF_FALLBACK = [


  {initial:'D',name:'Darren McGann',role:'Super Admin',email:'dmcgann@msetech.org',dept:'Management',status:'Active',color:'#7a2a3c'},


  {initial:'A',name:'Andrew Piva',role:'Technician',email:'apiva@msetech.org',dept:'Field Ops',status:'Active',color:'#3a2a5c'},


  {initial:'B',name:'Blyth Egan',role:'Admin',email:'began@msetech.org',dept:'Management',status:'Active',color:'#2a4a3c'},


  {initial:'J',name:'Joey Pacheco',role:'Technician',email:'jpacheco@msetech.org',dept:'Field Ops',status:'Active',color:'#4a3a2a'},


  {initial:'K',name:'Karim Hilmy',role:'Technician',email:'khilmy@msetech.org',dept:'Field Ops',status:'Active',color:'#2a3a4c'},


];











// ============================================================


// =========== STAFF DROPDOWN AUTO-POPULATE ==================


// ============================================================


function _staffShortName(fullName) {


  if (!fullName) return '';


  const parts = fullName.trim().split(/\s+/);


  if (parts.length < 2) return fullName;


  return parts[0][0] + '. ' + parts.slice(1).join(' ');


}





function populateStaffSelects() {


  const staff = (DB.staff || STAFF_FALLBACK || []);


  if (!staff.length) return;


  document.querySelectorAll('select[data-staff-select]').forEach(sel => {


    const flavor = sel.getAttribute('data-staff-select');


    const current = sel.value;


    // Preserve any non-staff "Unassigned" / "Selectâ€¦" options at the top


    const keepOpts = Array.from(sel.options).filter(o =>


      !o.value || /^(unassigned|select|â€”)/i.test(o.textContent || ''));


    sel.innerHTML = '';


    keepOpts.forEach(o => sel.appendChild(o.cloneNode(true)));


    staff.forEach(s => {


      if (!s.name) return;


      const display = flavor === 'short' ? _staffShortName(s.name) : s.name;


      const opt = document.createElement('option');


      opt.value = display;


      opt.textContent = display;


      sel.appendChild(opt);


    });


    if (current) {


      const match = Array.from(sel.options).find(o =>


        o.value === current || o.textContent === current);


      if (match) sel.value = match.value;


    }


  });


}





async function loadStaffFromSupabase() {


  try {


    if (!sb) throw new Error('Supabase not ready');


    const { data, error } = await sb.from('staff').select('*').order('name');


    if (error) throw error;


    if (data && data.length > 0) {


      const colors = ['#7a2a3c','#3a2a5c','#2a4a3c','#4a3a2a','#2a3a4c'];


      DB.staff = data.map((r, i) => ({


        initial: (r.name || r.email || 'U').charAt(0).toUpperCase(),


        name: r.name || r.email || 'Staff',


        role: r.role || 'Technician',


        email: r.email || '',


        dept: r.department || 'Field Ops',


        status: r.status || 'active',


        color: colors[i % colors.length],


        _sbId: r.id


      }));


      setConnIndicator('connected');


    } else {


      DB.staff = STAFF_FALLBACK;


    populateStaffSelects();


    }


  } catch(e) {


    console.warn('Supabase staff fetch failed, using fallback:', e);


    DB.staff = STAFF_FALLBACK;


    setConnIndicator('offline');


  }


  populateStaffSelects();


}





function rebuildClientDatalist() {


  const dl = document.getElementById('client-datalist');


  if (!dl) return;


  dl.innerHTML = DB.clients.map(c => `<option value="${(c.name||'').replace(/"/g,'&quot;')}">`).join('');


}





function handleClientAutofill(clientInputId, contactId, phoneId) {


  const val = (document.getElementById(clientInputId)||{}).value || '';


  const client = DB.clients.find(c => (c.name||'').toLowerCase() === val.toLowerCase());


  if (!client) return;


  const contactEl = document.getElementById(contactId);


  const phoneEl = document.getElementById(phoneId);


  if (contactEl && !contactEl.value) contactEl.value = client.contact || '';


  if (phoneEl && !phoneEl.value) phoneEl.value = client.phone || client.contact || '';


}





// ========== DATA ==========



// ===============================
// CLIENT SYSTEM (SOURCE OF TRUTH)
// ===============================
function renderClientSelects() {
  const selects = [
    'tk-client',
    'rpt-client-select',
    'rpt-client-summary-select',
    'pr-client'
  ];

  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;

    const current = sel.value;

    sel.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '? Select a client ?';
    sel.appendChild(placeholder);

    (DB.clients || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });

    sel.value = current;
  });
}


const DB = {


  tickets: [],


  clients: [],


  vendors: [],


  projects: [],


  staff: [],


  kanban: {


    0: [],


    1: [],


    2: [],


    3: [],


  }


};





// ========== NAVIGATION ==========


const sidebar = document.getElementById('sidebar');


const hamburger = document.getElementById('hamburgerBtn');


const main = document.getElementById('main');








// Hash-based routing helper: returns the page id to show on initial load.


// Strips leading '#', falls back to 'dashboard' if no/invalid hash.


function _initialPageFromHash() {


  const h = (location.hash || '').replace(/^#/, '').trim();


  if (!h) return 'dashboard';


  // Sanitize â€” only allow our known page id charset


  if (!/^[a-z][a-z0-9-]*$/i.test(h)) return 'dashboard';


  // If the page element exists, use it; otherwise fall back to dashboard


  if (document.getElementById('page-' + h)) return h;


  return 'dashboard';


}





// React to hash changes (browser back/forward)


window.addEventListener('hashchange', () => {


  const target = _initialPageFromHash();


  if (typeof navigate === 'function') navigate(target);


});





function navigate(pageId) {


  // Super admin check for settings and SLA pages


  if (pageId && (pageId === 'settings' || pageId.startsWith('settings-') || pageId === 'sla')) {


    const userEmail = currentUser ? (currentUser.email || '') : '';


    if (userEmail && userEmail !== 'dmcgann@msetech.org') {


      showToast('Access restricted to Super Admin', 'error');


      return navigate('dashboard');


    }


  }


  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));


  const target = document.getElementById('page-' + pageId);


  if (target) { target.classList.add('active'); main.scrollTop = 0; }


  document.querySelectorAll('.nav-link').forEach(l => {


    const lPage = l.dataset.page;


    l.classList.toggle('active', lPage === pageId || (pageId.startsWith(lPage + '-') && lPage !== pageId && l.dataset.hasSub));


  });


  document.querySelectorAll('.subnav-link').forEach(l => l.classList.toggle('active', l.dataset.page === pageId));


  if (window.innerWidth < 768) sidebar.classList.remove('open');


  // URL hash routing: keep #page-id in sync so refresh restores the same view.


  if (pageId && location.hash !== '#' + pageId) {


    history.replaceState(null, '', '#' + pageId);


  }


  renderPage(pageId);





  // Accounting page init


  if (pageId && pageId.startsWith('accounting')) initAccountingPage(pageId);


}





document.querySelectorAll('.nav-link[data-page]').forEach(l => {


  l.addEventListener('click', () => {


    const pid = l.dataset.page;


    const hasSub = l.dataset.hasSub;


    if (hasSub) {


      const subnav = document.getElementById('subnav-' + hasSub);


      if (subnav) subnav.classList.toggle('open');


      l.classList.toggle('open');


    }


    navigate(pid);


  });


});


document.querySelectorAll('.subnav-link[data-page]').forEach(l => l.addEventListener('click', () => navigate(l.dataset.page)));





hamburger.addEventListener('click', () => {


  sidebar.classList.toggle('open');


  hamburger.classList.toggle('open');


});


main.addEventListener('click', () => { if (window.innerWidth < 768) { sidebar.classList.remove('open'); hamburger.classList.remove('open'); }});





// ========== RENDER ==========


function renderPage(page) {


  if (page === 'tickets') { loadTicketsFromSupabase().then(() => renderTickets()); }


  else if (page === 'clients') { loadClientsFromSupabase().then(() => renderClients()); }


  else if (page === 'vendors') { loadVendorsFromSupabase().then(() => renderVendors()); }


  else if (page === 'projects') renderProjects();


  else if (page === 'staff') {


    DB.staff = STAFF_FALLBACK;


    renderStaff();


    loadStaffFromSupabase().then(() => renderStaff()).catch(() => {});


  }


  else if (page === 'kanban') renderKanban();


  else if (page === 'dashboard') renderDashboard();


  else if (page === 'documents') { loadAllDocuments(); }


  else if (page === 'sla') renderSLADashboard();


  else if (page === 'reports') { renderReports(); }


  else if (page === 'accounting-banking') { loadBankAccountsFromSupabase(); }


  else if (page === 'settings-links') { loadQuickLinks(); renderQuickLinks(); }


  else if (page === 'hr') { loadHRData(); }


  else if (page === 'my-timeoff') { loadMyTimeOff(); }


  else if (page === 'signin-log') { loadSignInLog(); }


  else if (page === 'dispatch') { loadTicketsFromSupabase().then(() => renderDispatchQueue()); }


  else if (page === 'dispatch-assignments') { loadTicketsFromSupabase().then(() => renderDispatchAssignments()); }


  else if (page === 'dispatch-status') renderFieldStatus();


  else if (page === 'inventory-assets') { loadAssetsFromSupabase(); }


  else if (page === 'inventory-parts') { loadPartsFromSupabase(); }


}





function renderDashboard() {


  const body = document.getElementById('dash-tickets-body');


  if (!body) return;


  const open = DB.tickets.filter(t => isTicketOpen(t.status));


  body.innerHTML = open.slice(0,5).map(t => `


    <tr onclick="openTicketPanel('${esc(t.id)}')">


      <td style="font-family:monospace;font-size:12px;color:var(--soft)">${t.id}</td>


      <td><strong>${esc(t.subject)}</strong></td>


      <td style="color:var(--muted)">${esc(t.client)}</td>


      <td>${statusBadge(t.status)}</td>


    </tr>`).join('');


  const el = document.getElementById('dash-open-tickets');


  if (el) el.textContent = open.length;


}





// Ticket edit panel logic extracted to js/tickets/ticket-panel.js






function populateTicketAgentFilter() {
  const sel = document.getElementById('ticket-agent-filter');
  if (!sel) return;

  const current = sel.value || '';

  const excluded = new Set(['', 'Unassigned', 'Accounting']);

  const techs = [...new Set(
    (DB.tickets || [])
      .flatMap(t => ticketAssigneeList(t))
      .map(n => String(n || '').trim())
      .filter(n => !excluded.has(n))
  )].sort();

  sel.innerHTML =
    '<option value="">All techs</option>' +
    techs.map(n => `<option value="${n}">${n}</option>`).join('');

  if (current && techs.includes(current)) sel.value = current;
}

function renderTickets() {


  const body = document.getElementById('ticket-body');


  if (!body) return;


  populateTicketAgentFilter();

  const admin = isSuperAdmin();


  const slaHeader = document.getElementById('ticket-th-sla');


  if (slaHeader) slaHeader.style.display = admin ? '' : 'none';


  const statusFilter = (document.getElementById('ticket-status-filter') || {}).value || '';


  const priorityFilter = (document.getElementById('ticket-priority-filter') || {}).value || '';


  const searchFilter = ((document.getElementById('ticket-search') || {}).value || '').toLowerCase();

  const agentFilter = (document.getElementById('ticket-agent-filter') || {}).value || '';

  const openFrom = (document.getElementById('ticket-open-from') || {}).value || '';
  const openTo = (document.getElementById('ticket-open-to') || {}).value || '';

  const archivedFrom = (document.getElementById('ticket-archived-from') || {}).value || '';
  const archivedTo = (document.getElementById('ticket-archived-to') || {}).value || '';


  const tickets = DB.tickets.filter(t => {


    const normalizedStatus = normalizeTicketStatus(t.status);

    if (ticketQuickFilter === 'open' && !isTicketOpen(t.status)) return false;
    if (ticketQuickFilter === 'closed' && !isTicketClosed(t.status)) return false;
    if (ticketQuickFilter && !['open','closed'].includes(ticketQuickFilter) && normalizedStatus !== ticketQuickFilter) return false;

    if (statusFilter && normalizedStatus !== statusFilter) return false;


    if (priorityFilter && (t.priority || 'Medium') !== priorityFilter) return false;


    if (agentFilter) {
      const assignees = ticketAssigneeList(t).map(a => a.toLowerCase());
      if (!assignees.includes(agentFilter.toLowerCase())) return false;
    }

    const createdDate = String(t.created || '').slice(0,10);

    if (openFrom && createdDate < openFrom) return false;
    if (openTo && createdDate > openTo) return false;

    const isArchived = isTicketClosed(t.status);

    if (archivedFrom || archivedTo) {
      if (!isArchived) return false;

      const resolvedDate = String(t.updated || t.created || '').slice(0,10);

      if (archivedFrom && resolvedDate < archivedFrom) return false;
      if (archivedTo && resolvedDate > archivedTo) return false;
    }

    if (searchFilter) {


      const hay = [t.id, t.subject, t.client, t.assign, t.priority, t.status].join(' ').toLowerCase();


      if (!hay.includes(searchFilter)) return false;


    }


    return true;


  });


  body.innerHTML = tickets.map(t => {


    const list = ticketAssigneeList(t);


    const primary = t.assign || list[0] || '';


    const extras = list.filter(n => n && n !== primary);


    const extraBadge = extras.length


      ? ` <span title="${esc(extras.join(', '))}" style="display:inline-block;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1px 7px;font-size:11px;color:var(--text);margin-left:4px;white-space:nowrap">+${extras.length} ðŸ‘¥</span>`


      : '';


    return `


    <tr onclick="openTicketPanel('${esc(t.id)}')">


      <td style="font-family:monospace;font-size:12px;color:var(--soft)">${t.id}</td>


      <td><strong>${esc(t.subject)}</strong></td>


      <td>${esc(t.client)}</td>


      <td style="color:var(--muted)"><span style="white-space:nowrap">${esc(primary)||'Unassigned'}</span>${extraBadge}</td>


      <td>${priorityBadge(t.priority)}</td>


      <td>${statusBadge(t.status)}</td>


      <td style="color:var(--soft);font-size:12px">${t.created}</td>


      ${admin ? `<td>${formatSLAStatus(t)}</td>` : ''}


    </tr>`;


  }).join('');


  updateTicketCounts();


}





// ========== DISPATCH JOBS DATA ==========


const DB_JOBS = [];





