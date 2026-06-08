// ========== INIT ==========


document.addEventListener('DOMContentLoaded', async () => {


  // Open accounting subnav by default


  const accLink = document.querySelector('.nav-link[data-page="accounting"]');


  if (accLink) accLink.classList.add('open');





  // Build initial client datalist from local data


  rebuildClientDatalist();





  // Populate ticket status dropdowns from single source of truth


  populateTicketStatusSelect(document.getElementById('ticket-status-filter'), 'All statuses');


  populateTicketStatusSelect(document.getElementById('tp-status'));





  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  console.warn('[Theta Local Dev] Bypassing Supabase auth on localhost.');
  window.currentUser = {
    id: 'theta-local-dev',
    email: 'theta.local@msetech.org',
    user_metadata: { full_name: 'Theta Local Dev' }
  };
  window.SESSION_USER = {
    id: 'theta-local-dev',
    email: 'theta.local@msetech.org',
    name: 'Theta Local Dev'
  };
  hideLoginScreen();
  setConnIndicator('local');
  renderPage(location.hash.replace('#','') || 'dashboard');
} else if (sb && sb.auth) {


    // Listen for auth state changes (handles OAuth callback too)


    sb.auth.onAuthStateChange((event, session) => {


      if (session && session.user) {


        currentUser = session.user;


        updateUserAvatar(currentUser);


        applySettingsVisibility();


        hideLoginScreen();


        setConnIndicator('connecting');


        // Only log fresh sign-ins, not token refreshes or initial loads


        if (event === 'SIGNED_IN') captureSignIn();


        Promise.all([


          loadTicketsFromSupabase(),


          loadClientsFromSupabase(),


          loadVendorsFromSupabase(),


          loadBillsFromSupabase(),


          loadAuditLogFromSupabase(),


          loadAssetsFromSupabase(),


          loadProjectsFromSupabase(),


          loadKanbanFromSupabase(),


          loadBankAccountsFromSupabase(),


          loadAccountingFromClientForms()


        ]).then(() => {


          setConnIndicator('connected');


          if (typeof renderProjects === 'function') renderProjects();


          if (typeof startNotifPolling === 'function') startNotifPolling();


          navigate(_initialPageFromHash());


        }).catch(() => {


          setConnIndicator('offline');


          navigate(_initialPageFromHash());


        });


      } else {


        currentUser = null;


        applySettingsVisibility();


        showLoginScreen();


      }


    });





    // Check for existing session immediately


    try {


      const { data: { session } } = await sb.auth.getSession();


      if (session && session.user) {


        currentUser = session.user;


        updateUserAvatar(currentUser);


        applySettingsVisibility();


        hideLoginScreen();


        setConnIndicator('connecting');


        await Promise.all([


          loadTicketsFromSupabase(),


          loadClientsFromSupabase(),


          loadVendorsFromSupabase(),


          loadBillsFromSupabase(),


          loadAuditLogFromSupabase(),


          loadAssetsFromSupabase(),


          loadProjectsFromSupabase(),


          loadKanbanFromSupabase(),


          loadBankAccountsFromSupabase(),


          loadAccountingFromClientForms()


        ]);


        setConnIndicator('connected');


        if (typeof renderProjects === 'function') renderProjects();


        if (typeof startNotifPolling === 'function') startNotifPolling();


        navigate(_initialPageFromHash());


      } else {


        applySettingsVisibility();


        showLoginScreen();


        setConnIndicator('offline');


      }


    } catch(e) {


      console.warn('Session check failed:', e);


      showLoginScreen();


      setConnIndicator('offline');


    }


  } else {


    // Supabase not available â€” skip auth, go straight to app


    console.warn('Supabase not available â€” bypassing auth');


    hideLoginScreen();


    setConnIndicator('offline');


    navigate('dashboard');


  }


});





// ========== SLA HELPERS ==========


function getSLAMs(priority) {


  const h = priority === 'High' ? SLA_POLICIES.high : priority === 'Low' ? SLA_POLICIES.low : SLA_POLICIES.medium;


  return h * 3600000;


}





function formatDuration(ms) {


  if (ms < 0) ms = -ms;


  const totalMins = Math.floor(ms / 60000);


  const h = Math.floor(totalMins / 60);


  const m = totalMins % 60;


  if (h === 0) return m + 'm';


  return h + 'h ' + m + 'm';


}





function formatSLAStatus(ticket) {


  if (!ticket.started_at) {


    return '<span class="badge badge-gray" style="font-weight:600">Not started</span>';


  }


  const elapsed = Date.now() - new Date(ticket.started_at).getTime();


  const deadline = getSLAMs(ticket.priority);


  const remaining = deadline - elapsed;


  const pct = remaining / deadline;


  if (remaining <= 0) {


    return `<span class="badge badge-red">âš Â  Breached ${formatDuration(-remaining)} ago</span>`;


  }


  if (pct < 0.25) {


    return `<span class="badge" style="background:rgba(232,128,74,.18);color:#ffa87a;font-weight:700">âš Â  ${formatDuration(remaining)} left</span>`;


  }


  if (pct < 0.5) {


    return `<span class="badge badge-gold">â± ${formatDuration(remaining)} left</span>`;


  }


  return `<span class="badge badge-green">âœ“ ${formatDuration(remaining)} left</span>`;


}





function formatSLADeadlineStr(ticket) {


  if (!ticket.started_at) return 'â€”';


  const deadline = new Date(new Date(ticket.started_at).getTime() + getSLAMs(ticket.priority));


  return deadline.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});


}





function formatStartedStr(ticket) {


  if (!ticket.started_at) return 'â€”';


  return new Date(ticket.started_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});


}





// ========== CLIENT CONTACT AUTOFILL ==========


// Shared helper: look up a client by name in DB.clients and render contact info


function _renderContactBlock(clientName, prefix) {


  const c = DB.clients.find(x => x.name.toLowerCase() === (clientName||'').toLowerCase());


  const blockEl    = document.getElementById(prefix + '-contact-block');


  const nameEl     = document.getElementById(prefix + '-c-name');


  const phoneWrap  = document.getElementById(prefix + '-c-phone-wrap');


  const emailWrap  = document.getElementById(prefix + '-c-email-wrap');


  if (!blockEl) return;


  if (!c) { blockEl.style.display = 'none'; return; }


  if (nameEl)    nameEl.textContent = c.name || '';


  if (phoneWrap) phoneWrap.innerHTML = c.phone


    ? `<a href="tel:${c.phone.replace(/[^+\d]/g,'')}" style="color:var(--primary);text-decoration:none;font-weight:500">${c.phone}</a>`


    : `<span style="color:var(--muted)">â€”</span>`;


  if (emailWrap) emailWrap.innerHTML = c.contact


    ? `<a href="mailto:${c.contact}" style="color:var(--primary);text-decoration:none;font-weight:500">${c.contact}</a>`


    : `<span style="color:var(--muted)">â€”</span>`;


  blockEl.style.display = '';


}





// Ticket edit panel (tp-client text input with datalist)


function tpClientAutofill() {


  const val = (document.getElementById('tp-client') || {}).value || '';


  _renderContactBlock(val, 'tp');


}





// New Ticket modal (tk-client select)


function tkClientAutofill() {


  const val = (document.getElementById('tk-client') || {}).value || '';


  _renderContactBlock(val, 'tk');


}





// Job panel and New Job modal â€” prefix = 'jp' or 'job'


function jobClientAutofill(prefix) {


  const sel = document.getElementById(prefix + '-client');


  const val = sel ? sel.value : '';


  _renderContactBlock(val, prefix);


  // Also pre-fill location from client address if location field is empty


  const locEl = document.getElementById(prefix + '-location');


  if (locEl && !locEl.value) {


    const c = DB.clients.find(x => x.name.toLowerCase() === (val||'').toLowerCase());


    if (c && c.location) locEl.value = c.location;


  }


}





// ========== CLAIM OVERLAY ACTIONS ==========


function getCurrentUserDisplayName() {


  const u = getUser();


  if (u.user_metadata && u.user_metadata.full_name) return u.user_metadata.full_name;


  return u.email || 'D. McGann';


}





function claimAssign() {


  const t = DB.tickets.find(x => x.id === activeTicketId);


  if (!t) return;


  const name = getCurrentUserDisplayName();


  t.assign = name;


  // Promote new primary to head, keep any prior co-assignees as extras


  const prev = ticketAssigneeList(t);


  t.assignees = [name].concat(prev.filter(n => n && n !== name));


  t.status = TICKET_STATUS.ASSIGNED;


  t.assigned_at = new Date().toISOString();


  // NO started_at


  document.getElementById('tp-assign').value = name;


  if (typeof renderTicketAssigneeChips === 'function') renderTicketAssigneeChips();


  document.getElementById('tp-status').value = 'Assigned';


  document.getElementById('ticketClaimOverlay').style.display = 'none';


  renderTickets();


  renderDashboard();


  showToast('Ticket assigned to you â€” SLA not yet started', 'info');


}





function claimStart() {


  const t = DB.tickets.find(x => x.id === activeTicketId);


  if (!t) return;


  const name = getCurrentUserDisplayName();


  const now = new Date().toISOString();


  // Always assign to the person clicking Start â€” overrides any prior assignment


  const prevStart = ticketAssigneeList(t);


  t.assign      = name;


  t.assignees   = [name].concat(prevStart.filter(n => n && n !== name));


  t.status      = TICKET_STATUS.IN_PROGRESS;


  t.assigned_at = now;


  t.started_at  = now; // SLA clock starts HERE, never on assignment alone


  document.getElementById('tp-assign').value = name;


  if (typeof renderTicketAssigneeChips === 'function') renderTicketAssigneeChips();


  document.getElementById('tp-status').value = TICKET_STATUS.IN_PROGRESS;


  document.getElementById('ticketClaimOverlay').style.display = 'none';


  renderTickets();


  renderDashboard();


  showToast('Ticket started â€” SLA clock running', 'success');


}





function claimTransfer() {


  const t = DB.tickets.find(x => x.id === activeTicketId);


  if (!t) return;


  const sel = document.getElementById('cl-transfer-agent');


  const name = sel ? sel.value : 'Unassigned';


  const prevTrans = ticketAssigneeList(t);


  t.assign = name;


  t.assignees = [name].concat(prevTrans.filter(n => n && n !== name));


  t.status = TICKET_STATUS.ASSIGNED;


  t.assigned_at = new Date().toISOString();


  // NO started_at


  document.getElementById('tp-assign').value = name;


  if (typeof renderTicketAssigneeChips === 'function') renderTicketAssigneeChips();


  document.getElementById('tp-status').value = 'Assigned';


  document.getElementById('ticketClaimOverlay').style.display = 'none';


  renderTickets();


  renderDashboard();


  showToast(name + ' assigned â€” SLA not yet started', 'info');


}





// ========== SLA DASHBOARD RENDER ==========


function renderSLADashboard() {


  const tickets = DB.tickets;


  const open = tickets.filter(t => isTicketOpen(t.status));


  let breachedCount = 0, atRiskCount = 0;


  open.forEach(t => {


    if (!t.started_at) return;


    const elapsed = Date.now() - new Date(t.started_at).getTime();


    const deadline = getSLAMs(t.priority);


    const remaining = deadline - elapsed;


    const pct = remaining / deadline;


    if (remaining <= 0) breachedCount++;


    else if (pct < 0.25) atRiskCount++;


  });


  const kOpen = document.getElementById('sla-kpi-open');


  const kBreached = document.getElementById('sla-kpi-breached');


  const kRisk = document.getElementById('sla-kpi-atrisk');


  if (kOpen) kOpen.textContent = open.length;


  if (kBreached) kBreached.textContent = breachedCount;


  if (kRisk) kRisk.textContent = atRiskCount;


  // Policy display


  const ph = document.getElementById('sla-policy-high');


  const pm = document.getElementById('sla-policy-med');


  const pl = document.getElementById('sla-policy-low');


  if (ph) ph.textContent = SLA_POLICIES.high + ' hour' + (SLA_POLICIES.high === 1 ? '' : 's');


  if (pm) pm.textContent = SLA_POLICIES.medium + ' hours';


  if (pl) pl.textContent = SLA_POLICIES.low + ' hours (' + Math.round(SLA_POLICIES.low/24) + ' business days)';


  // Main ticket SLA table â€” breached first, not started last


  const sorted = [...tickets].sort((a, b) => {


    const scoreA = slaSort(a), scoreB = slaSort(b);


    return scoreA - scoreB;


  });


  const tbody = document.getElementById('sla-tickets-body');


  if (tbody) {


    tbody.innerHTML = sorted.map(t => {


      let remaining = null, pct = null;


      if (t.started_at) {


        const elapsed = Date.now() - new Date(t.started_at).getTime();


        const deadline = getSLAMs(t.priority);


        remaining = deadline - elapsed;


        pct = remaining / deadline;


      }


      const priMap = {High:'badge-red',Medium:'badge-gold',Low:'badge-gray'};


      return `<tr>


        <td style="font-family:monospace;font-size:12px;color:var(--soft)">${esc(t.id)}</td>


        <td><strong>${esc(t.subject)}</strong></td>


        <td>${'<span class="badge ' + (priMap[t.priority]||'badge-gray') + '">' + esc(t.priority) + '</span>'}</td>


        <td style="color:var(--muted)">${esc(t.assign)||'Unassigned'}</td>


        <td style="font-size:12px;color:var(--soft)">${formatStartedStr(t)}</td>


        <td style="font-size:12px;color:var(--soft)">${formatSLADeadlineStr(t)}</td>


        <td>${t.started_at ? formatDuration(Math.abs(remaining)) + (remaining < 0 ? ' <span style="color:#e87b87">(over)</span>' : '') : 'â€”'}</td>


        <td>${formatSLAStatus(t)}</td>


      </tr>`;


    }).join('');


  }


  // Per-technician summary


  const techMap = {};


  tickets.forEach(t => {


    const name = t.assign || 'Unassigned';


    if (!techMap[name]) techMap[name] = {assigned:0, activeSLA:0, breached:0};


    techMap[name].assigned++;


    if (t.started_at) {


      const elapsed = Date.now() - new Date(t.started_at).getTime();


      const deadline = getSLAMs(t.priority);


      const remaining = deadline - elapsed;


      if (remaining <= 0) techMap[name].breached++;


      else techMap[name].activeSLA++;


    }


  });


  const techBody = document.getElementById('sla-tech-body');


  if (techBody) {


    techBody.innerHTML = Object.entries(techMap).map(([name, stats]) =>


      `<tr>


        <td style="font-weight:600">${esc(name)}</td>


        <td>${stats.assigned}</td>


        <td>${stats.activeSLA > 0 ? '<span class="badge badge-blue">' + stats.activeSLA + '</span>' : 'â€”'}</td>


        <td>${stats.breached > 0 ? '<span class="badge badge-red">' + stats.breached + '</span>' : '<span style="color:var(--muted)">0</span>'}</td>


      </tr>`


    ).join('');


  }


}





function slaSort(t) {


  if (!t.started_at) return 3; // not started â€” bottom


  const elapsed = Date.now() - new Date(t.started_at).getTime();


  const deadline = getSLAMs(t.priority);


  const remaining = deadline - elapsed;


  if (remaining <= 0) return 0; // breached â€” top


  const pct = remaining / deadline;


  if (pct < 0.25) return 1; // at risk


  if (pct < 0.5) return 2; // yellow


  return 2.5; // green


}





// ========== SLA SETTINGS SAVE ==========


function saveSLAPolicies() {


  const h = parseInt(document.getElementById('sla-input-high').value) || 4;


  const m = parseInt(document.getElementById('sla-input-med').value) || 24;


  const l = parseInt(document.getElementById('sla-input-low').value) || 72;


  SLA_POLICIES = {high: h, medium: m, low: l};


  showToast('SLA policies saved â€” applies to tickets started after this save', 'success');


  renderTickets();


}





