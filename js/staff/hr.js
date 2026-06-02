// ===================== HR MODULE ============================


// ============================================================


let _hrEmployees = [];   // staff rows w/ HR cols


let _hrRequests = [];    // pto_requests rows


let _hrOnbCache = {};    // staff_id -> tasks[]


let _activeHREmpId = null;





const HR_DEFAULT_ONBOARDING_TASKS = [


  { task_key: 'w4', task_label: 'W-4 form on file' },


  { task_key: 'i9', task_label: 'I-9 form on file' },


  { task_key: 'direct_deposit', task_label: 'Direct deposit set up' },


  { task_key: 'handbook', task_label: 'Employee handbook reviewed' },


  { task_key: 'orientation', task_label: 'Orientation complete' },


  { task_key: 'equipment', task_label: 'Equipment assigned' },


];





const HR_DEFAULT_CONTRACTOR_TASKS = [


  { task_key: 'w9', task_label: 'W-9 on file' },


  { task_key: 'contract', task_label: 'Contractor agreement signed' },


  { task_key: 'insurance', task_label: 'Insurance certificate received' },


];





async function loadHRData() {


  const empBody = document.getElementById('hr-emp-body');


  const reqBody = document.getElementById('hr-req-body');


  const onbBody = document.getElementById('hr-onboarding-body');


  if (!sb) {


    if (empBody) empBody.innerHTML = '<tr><td colspan="8" class="empty-state">No Supabase connection.</td></tr>';


    return;


  }


  if (!currentUser) {


    if (empBody) empBody.innerHTML = '<tr><td colspan="8" class="empty-state">Not signed in. Sign out and back in.</td></tr>';


    return;


  }


  if (empBody) empBody.innerHTML = '<tr><td colspan="8" class="empty-state">Loadingâ€¦</td></tr>';


  try {


    const [empRes, reqRes] = await Promise.all([


      sb.from('staff').select('*').order('name', { ascending: true }),


      sb.from('pto_requests').select('*').order('created_at', { ascending: false })


    ]);


    if (empRes.error) throw empRes.error;


    if (reqRes.error) throw reqRes.error;


    _hrEmployees = empRes.data || [];


    _hrRequests = reqRes.data || [];


    if (!_hrEmployees.length) {


      if (empBody) empBody.innerHTML = '<tr><td colspan="8" class="empty-state">No staff rows returned. (Email seen: ' + esc(currentUser.email||'?') + ' â€” if not your admin email, RLS may be blocking.)</td></tr>';


      return;


    }


    renderHRKPIs();


    renderHREmployees();


    renderHRRequests();


    renderHROnboarding();


  } catch(e) {


    console.warn('HR load failed:', e);


    if (empBody) empBody.innerHTML = '<tr><td colspan="8" class="empty-state">Error: ' + esc(e.message || 'unknown') + '</td></tr>';


    showToast('HR data load failed: ' + (e.message || 'unknown'), 'error');


  }


}





function renderHRKPIs() {


  const headcount = _hrEmployees.filter(e => e.status === 'active').length;


  document.getElementById('hr-kpi-headcount').textContent = headcount;


  const empCount = _hrEmployees.filter(e => e.status === 'active' && e.employment_type === 'employee').length;


  const ctrCount = _hrEmployees.filter(e => e.status === 'active' && e.employment_type === 'contractor').length;


  document.getElementById('hr-kpi-headcount-sub').textContent = `${empCount} employees, ${ctrCount} contractors`;





  const pending = _hrRequests.filter(r => r.status === 'pending').length;


  document.getElementById('hr-kpi-pending').textContent = pending;





  const today = new Date().toISOString().slice(0,10);


  const outToday = _hrRequests.filter(r =>


    r.status === 'approved' && r.start_date <= today && r.end_date >= today


  );


  document.getElementById('hr-kpi-out-today').textContent = outToday.length;


  document.getElementById('hr-kpi-out-today-sub').textContent =


    outToday.length ? outToday.map(r => r.staff_name).join(', ') : 'Everyone in';





  // Onboarding count needs the onb cache, default to 'â€”' for now


  const onbEl = document.getElementById('hr-kpi-onboarding');


  if (onbEl) onbEl.textContent = 'â€”';


}





function renderHREmployees() {


  const body = document.getElementById('hr-emp-body');


  if (!body) return;


  const search = (document.getElementById('hr-emp-search')?.value || '').toLowerCase();


  const typeFilter = document.getElementById('hr-emp-type-filter')?.value || '';


  let list = _hrEmployees.slice();


  if (search) list = list.filter(e =>


    (e.name||'').toLowerCase().includes(search) ||


    (e.email||'').toLowerCase().includes(search) ||


    (e.role||'').toLowerCase().includes(search));


  if (typeFilter) list = list.filter(e => e.employment_type === typeFilter);


  if (!list.length) {


    body.innerHTML = '<tr><td colspan="8" class="empty-state">No employees match.</td></tr>';


    return;


  }


  body.innerHTML = list.map(e => {


    const vacRem = (e.pto_vacation_days || 0) - (e.pto_vacation_used || 0);


    const sickRem = (e.pto_sick_days || 0) - (e.pto_sick_used || 0);


    const perRem = (e.pto_personal_days || 0) - (e.pto_personal_used || 0);


    const sickBank = e.pto_sick_balance || 0;


    const typeBadge = e.employment_type === 'contractor'


      ? '<span class="badge badge-blue">1099</span>'


      : '<span class="badge badge-gray">W-2</span>';


    const statusBadge = e.status === 'active' ? '<span class="badge badge-green">Active</span>'


      : e.status === 'on_leave' ? '<span class="badge badge-gold">On Leave</span>'


      : '<span class="badge badge-red">Terminated</span>';


    return `<tr onclick="openHREmpPanel(${e.id})" style="cursor:pointer">


      <td><strong>${esc(e.name)}</strong><br><span style="font-size:11px;color:var(--muted)">${esc(e.email||'')}</span></td>


      <td>${esc(e.role||'\u2014')}</td>


      <td>${typeBadge}</td>


      <td>${esc(e.hire_date||'\u2014')}</td>


      <td>${vacRem.toFixed(1)} / ${(e.pto_vacation_days||0).toFixed(0)}</td>


      <td>${sickRem.toFixed(1)} / ${(e.pto_sick_days||0).toFixed(0)} <span style="font-size:10px;color:var(--muted)">(+${sickBank.toFixed(1)} bank)</span></td>


      <td>${perRem.toFixed(1)} / ${(e.pto_personal_days||0).toFixed(0)}</td>


      <td>${statusBadge}</td>


    </tr>`;


  }).join('');


}





function renderHRRequests() {


  const body = document.getElementById('hr-req-body');


  if (!body) return;


  const status = document.getElementById('hr-req-status-filter')?.value || '';


  const type = document.getElementById('hr-req-type-filter')?.value || '';


  let list = _hrRequests.slice();


  if (status) list = list.filter(r => r.status === status);


  if (type) list = list.filter(r => r.request_type === type);


  if (!list.length) {


    body.innerHTML = '<tr><td colspan="8" class="empty-state">No requests match.</td></tr>';


    return;


  }


  body.innerHTML = list.map(r => {


    const dates = r.start_date === r.end_date ? r.start_date : `${r.start_date} \u2192 ${r.end_date}`;


    const statusBadge = ({


      pending: '<span class="badge badge-gold">Pending</span>',


      approved: '<span class="badge badge-green">Approved</span>',


      denied: '<span class="badge badge-red">Denied</span>',


      cancelled: '<span class="badge badge-gray">Cancelled</span>'


    })[r.status] || `<span class="badge badge-gray">${esc(r.status)}</span>`;


    const docNote = r.doctor_note_path


      ? `<button onclick="downloadDoctorNote(${r.id})" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;color:var(--text);font-family:inherit">View</button>`


      : (r.request_type === 'sick' && r.total_days >= 5 ? '<span style="color:#ffa87a;font-size:11px">Required</span>' : '\u2014');


    let actions = '';


    if (r.status === 'pending') {


      actions = `


        <button onclick="approvePTORequest(${r.id})" style="background:#25a06b;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">Approve</button>


        <button onclick="denyPTORequest(${r.id})" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;margin-left:4px">Deny</button>`;


    } else {


      actions = '\u2014';


    }


    return `<tr>


      <td><strong>${esc(r.staff_name)}</strong></td>


      <td>${esc(r.request_type)}</td>


      <td>${esc(dates)}</td>


      <td>${r.total_days}</td>


      <td style="font-size:12px;color:var(--muted)">${esc(r.reason||'')}</td>


      <td>${statusBadge}</td>


      <td>${docNote}</td>


      <td>${actions}</td>


    </tr>`;


  }).join('');


}





function renderHROnboarding() {


  const body = document.getElementById('hr-onboarding-body');


  if (!body) return;


  if (!_hrEmployees.length) {


    body.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted)">No employees yet.</div>';


    return;


  }


  body.innerHTML = _hrEmployees.map(e => {


    const tasks = _hrOnbCache[e.id];


    if (!tasks) {


      // Trigger lazy load


      loadOnboardingTasks(e.id);


      return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:12px"><strong>${esc(e.name)}</strong> <span style="color:var(--muted);font-size:12px">â€” loading\u2026</span></div>`;


    }


    const done = tasks.filter(t => t.completed).length;


    const total = tasks.length || 0;


    const pct = total ? Math.round(done/total*100) : 0;


    const color = pct === 100 ? '#25a06b' : pct >= 50 ? '#b8852c' : '#e87b87';


    return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:12px;cursor:pointer" onclick="openHREmpPanel(${e.id});setTimeout(() => switchHREmpTab('onb'), 50)">


      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">


        <strong>${esc(e.name)}</strong>


        <span style="font-size:11px;color:${color};font-weight:600">${done} / ${total} (${pct}%)</span>


      </div>


      <div style="background:rgba(255,255,255,.05);border-radius:4px;height:6px;overflow:hidden">


        <div style="background:${color};height:100%;width:${pct}%;transition:width .3s"></div>


      </div>


    </div>`;


  }).join('');





  // Update KPI now that we have first round of cache hits


  const incomplete = Object.entries(_hrOnbCache).filter(([_, tasks]) =>


    tasks && tasks.length && tasks.some(t => !t.completed)


  ).length;


  const onbEl = document.getElementById('hr-kpi-onboarding');


  if (onbEl && Object.keys(_hrOnbCache).length === _hrEmployees.length) onbEl.textContent = incomplete;


}





async function loadOnboardingTasks(staffId) {


  if (!sb) return;


  try {


    const { data, error } = await sb.from('onboarding_checklist')


      .select('*').eq('staff_id', staffId).order('position');


    if (error) throw error;


    if (!data || !data.length) {


      // Auto-seed default tasks based on employment type


      const emp = _hrEmployees.find(e => e.id === staffId);


      const defaults = (emp?.employment_type === 'contractor') ? HR_DEFAULT_CONTRACTOR_TASKS : HR_DEFAULT_ONBOARDING_TASKS;


      const rows = defaults.map((t, i) => ({ staff_id: staffId, task_key: t.task_key, task_label: t.task_label, position: i }));


      const { data: ins, error: insErr } = await sb.from('onboarding_checklist').insert(rows).select();


      if (insErr) throw insErr;


      _hrOnbCache[staffId] = ins || [];


    } else {


      _hrOnbCache[staffId] = data;


    }


    renderHROnboarding();


  } catch(e) { console.warn('Onboarding load failed for', staffId, e); _hrOnbCache[staffId] = []; }


}





function switchHRTab(tab) {


  document.querySelectorAll('[data-hr-tab]').forEach(b => {


    b.classList.toggle('active', b.getAttribute('data-hr-tab') === tab);


  });


  document.querySelectorAll('.hr-section').forEach(s => {


    s.style.display = s.id === 'hr-section-' + tab ? '' : 'none';


  });


}





// ====== Employee Detail Panel ======


function openHREmpPanel(staffId) {


  _activeHREmpId = staffId;


  const e = _hrEmployees.find(x => x.id === staffId);


  if (!e) { showToast('Employee not found', 'error'); return; }


  document.getElementById('hrep-name').textContent = e.name;


  document.getElementById('hrep-sub').textContent = `${e.role || '\u2014'} \u00b7 ${e.email || ''}`;


  document.getElementById('hrep-fullname').value = e.name || '';


  document.getElementById('hrep-email').value = e.email || '';


  document.getElementById('hrep-role').value = e.role || '';


  document.getElementById('hrep-dept').value = e.department || '';


  document.getElementById('hrep-phone').value = e.phone || '';


  document.getElementById('hrep-hire').value = e.hire_date || '';


  document.getElementById('hrep-type').value = e.employment_type || 'employee';


  document.getElementById('hrep-status').value = e.status || 'active';


  document.getElementById('hrep-pay-rate').value = e.pay_rate || '';


  document.getElementById('hrep-pay-period').value = e.pay_period || '';


  document.getElementById('hrep-emrg-name').value = e.emergency_contact_name || '';


  document.getElementById('hrep-emrg-phone').value = e.emergency_contact_phone || '';


  document.getElementById('hrep-equipment').value = e.equipment_assigned || '';


  document.getElementById('hrep-notes').value = e.hr_notes || '';


  // PTO


  document.getElementById('hrep-pto-vac-allot').value = e.pto_vacation_days || 15;


  document.getElementById('hrep-pto-sick-allot').value = e.pto_sick_days || 15;


  document.getElementById('hrep-pto-per-allot').value = e.pto_personal_days || 3;


  document.getElementById('hrep-pto-vac-used').value = e.pto_vacation_used || 0;


  document.getElementById('hrep-pto-sick-used').value = e.pto_sick_used || 0;


  document.getElementById('hrep-pto-per-used').value = e.pto_personal_used || 0;


  document.getElementById('hrep-pto-sick-bank').value = e.pto_sick_balance || 0;


  // Render history + onboarding for this person


  renderHREmpHistory(staffId);


  renderHREmpOnboarding(staffId);


  // Always reset to Info tab


  switchHREmpTab('info');


  document.getElementById('hrEmpOverlay').classList.add('open');


  document.getElementById('hr-emp-panel').classList.add('open');


}





function closeHREmpPanel() {


  document.getElementById('hrEmpOverlay').classList.remove('open');


  document.getElementById('hr-emp-panel').classList.remove('open');


  _activeHREmpId = null;


}





function switchHREmpTab(tab) {


  ['info','pto','history','onb'].forEach(t => {


    const btn = document.getElementById('hrep-tab-' + t);


    const content = document.getElementById('hrep-content-' + t);


    if (btn) {


      btn.style.borderBottom = t === tab ? '2px solid var(--primary)' : '2px solid transparent';


      btn.style.color = t === tab ? 'var(--text)' : 'var(--muted)';


    }


    if (content) content.style.display = t === tab ? '' : 'none';


  });


}





function renderHREmpHistory(staffId) {


  const list = _hrRequests.filter(r => r.staff_id === staffId);


  const el = document.getElementById('hrep-history-list');


  if (!el) return;


  if (!list.length) {


    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">No time-off history.</div>';


    return;


  }


  el.innerHTML = list.map(r => {


    const status = ({pending:'#b8852c',approved:'#25a06b',denied:'#e87b87',cancelled:'#7a7974'})[r.status] || '#7a7974';


    const dates = r.start_date === r.end_date ? r.start_date : `${r.start_date} \u2192 ${r.end_date}`;


    return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:10px 12px">


      <div style="display:flex;justify-content:space-between;align-items:center">


        <div><strong>${esc(r.request_type)}</strong> \u00b7 ${r.total_days}d \u00b7 <span style="color:var(--muted);font-size:12px">${esc(dates)}</span></div>


        <span style="background:${status}22;color:${status};padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase">${esc(r.status)}</span>


      </div>


      ${r.reason ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">${esc(r.reason)}</div>` : ''}


    </div>`;


  }).join('');


}





function renderHREmpOnboarding(staffId) {


  const el = document.getElementById('hrep-onb-list');


  if (!el) return;


  const tasks = _hrOnbCache[staffId];


  if (!tasks) { loadOnboardingTasks(staffId); el.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:13px">Loading\u2026</div>'; return; }


  if (!tasks.length) {


    el.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:13px">No onboarding tasks.</div>';


    return;


  }


  el.innerHTML = tasks.map(t => `


    <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px">


      <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleOnboardingTask(${t.id}, this.checked)" style="width:18px;height:18px;cursor:pointer"/>


      <div style="flex:1">


        <div style="font-size:13px;${t.completed ? 'text-decoration:line-through;color:var(--muted)' : 'color:var(--text)'}">${esc(t.task_label)}</div>


        ${t.completed_at ? `<div style="font-size:10px;color:var(--muted)">Completed ${new Date(t.completed_at).toLocaleDateString()} by ${esc(t.completed_by||'admin')}</div>` : ''}


      </div>


      <button onclick="deleteOnboardingTask(${t.id})" style="background:transparent;border:none;color:var(--muted);font-size:14px;cursor:pointer">\u00d7</button>


    </div>`).join('');


}





async function toggleOnboardingTask(taskId, done) {


  if (!sb) return;


  const updates = { completed: done };


  if (done) {


    updates.completed_at = new Date().toISOString();


    updates.completed_by = currentUser?.email || 'admin';


  } else {


    updates.completed_at = null;


    updates.completed_by = null;


  }


  try {


    await sb.from('onboarding_checklist').update(updates).eq('id', taskId);


    // Update cache


    Object.values(_hrOnbCache).forEach(arr => {


      if (arr) {


        const t = arr.find(x => x.id === taskId);


        if (t) Object.assign(t, updates);


      }


    });


    if (_activeHREmpId) renderHREmpOnboarding(_activeHREmpId);


    renderHROnboarding();


  } catch(e) { console.warn('Onboarding toggle failed:', e); }


}





async function deleteOnboardingTask(taskId) {


  if (!confirm('Remove this task?')) return;


  try {


    await sb.from('onboarding_checklist').delete().eq('id', taskId);


    Object.keys(_hrOnbCache).forEach(k => {


      _hrOnbCache[k] = (_hrOnbCache[k] || []).filter(t => t.id !== taskId);


    });


    if (_activeHREmpId) renderHREmpOnboarding(_activeHREmpId);


    renderHROnboarding();


  } catch(e) { console.warn('Onboarding delete failed:', e); }


}





async function addOnboardingTask() {


  if (!_activeHREmpId) return;


  const label = prompt('Task label:');


  if (!label || !label.trim()) return;


  try {


    const tasks = _hrOnbCache[_activeHREmpId] || [];


    const { data, error } = await sb.from('onboarding_checklist').insert({


      staff_id: _activeHREmpId, task_key: 'custom', task_label: label.trim(), position: tasks.length


    }).select().single();


    if (error) throw error;


    tasks.push(data);


    _hrOnbCache[_activeHREmpId] = tasks;


    renderHREmpOnboarding(_activeHREmpId);


    renderHROnboarding();


  } catch(e) { showToast('Add task failed: ' + (e.message||'unknown'), 'error'); }


}





async function saveHREmpPanel() {


  if (!_activeHREmpId || !sb) return;


  const updates = {


    name: document.getElementById('hrep-fullname').value.trim(),


    email: document.getElementById('hrep-email').value.trim() || null,


    role: document.getElementById('hrep-role').value.trim() || null,


    department: document.getElementById('hrep-dept').value.trim() || null,


    phone: document.getElementById('hrep-phone').value.trim() || null,


    hire_date: document.getElementById('hrep-hire').value || null,


    employment_type: document.getElementById('hrep-type').value,


    status: document.getElementById('hrep-status').value,


    pay_rate: parseFloat(document.getElementById('hrep-pay-rate').value) || null,


    pay_period: document.getElementById('hrep-pay-period').value || null,


    emergency_contact_name: document.getElementById('hrep-emrg-name').value.trim() || null,


    emergency_contact_phone: document.getElementById('hrep-emrg-phone').value.trim() || null,


    equipment_assigned: document.getElementById('hrep-equipment').value.trim() || null,


    hr_notes: document.getElementById('hrep-notes').value.trim() || null,


    pto_vacation_days: parseFloat(document.getElementById('hrep-pto-vac-allot').value) || 15,


    pto_sick_days: parseFloat(document.getElementById('hrep-pto-sick-allot').value) || 15,


    pto_personal_days: parseFloat(document.getElementById('hrep-pto-per-allot').value) || 3,


    pto_vacation_used: parseFloat(document.getElementById('hrep-pto-vac-used').value) || 0,


    pto_sick_used: parseFloat(document.getElementById('hrep-pto-sick-used').value) || 0,


    pto_personal_used: parseFloat(document.getElementById('hrep-pto-per-used').value) || 0,


    pto_sick_balance: Math.min(365, parseFloat(document.getElementById('hrep-pto-sick-bank').value) || 0)


  };


  try {


    const { error } = await sb.from('staff').update(updates).eq('id', _activeHREmpId);


    if (error) throw error;


    Object.assign(_hrEmployees.find(e => e.id === _activeHREmpId), updates);


    renderHRKPIs();


    renderHREmployees();


    showToast('Saved', 'success');


    closeHREmpPanel();


  } catch(e) {


    console.warn('HR save failed:', e);


    showToast('Save failed: ' + (e.message||'unknown'), 'error');


  }


}





// ====== Time-Off Request Modal (employee-facing) ======


function openHRRequestModal() {


  document.getElementById('ptoreq-type').value = 'vacation';


  document.getElementById('ptoreq-duration').value = 'full';


  document.getElementById('ptoreq-ampm').value = 'AM';


  document.getElementById('ptoreq-start').value = '';


  document.getElementById('ptoreq-end').value = '';


  document.getElementById('ptoreq-reason').value = '';


  document.getElementById('ptoreq-summary').textContent = 'Choose dates and duration above.';


  document.getElementById('ptoreq-doc-note-block').style.display = 'none';


  ptoReqDurationChanged();  // sync UI to default


  ptoReqTypeChanged();


  openModal('modal-pto-request');


}





function openMyTimeOffModal() { openHRRequestModal(); }





function ptoReqTypeChanged() {


  // Vacation can't use 2hr; clamp if currently set


  const type = document.getElementById('ptoreq-type').value;


  const dur = document.getElementById('ptoreq-duration');


  if (type === 'vacation' && dur.value === '2hr') dur.value = 'half';


  // Disable 2hr option for vacation


  Array.from(dur.options).forEach(o => {


    if (o.value === '2hr') o.disabled = (type === 'vacation');


  });


  ptoReqDurationChanged();


}





function ptoReqDurationChanged() {


  const dur = document.getElementById('ptoreq-duration').value;


  const ampm = document.getElementById('ptoreq-ampm-wrap');


  const endWrap = document.getElementById('ptoreq-end-wrap');


  // AM/PM only relevant for half-day


  ampm.style.display = (dur === 'half') ? '' : 'none';


  // 2hr and half always single date â€” hide end date


  endWrap.style.display = (dur === 'full') ? '' : 'none';


  if (dur !== 'full') {


    document.getElementById('ptoreq-end').value = document.getElementById('ptoreq-start').value;


  }


  ptoReqDatesChanged();


}





function ptoReqDatesChanged() {


  const start = document.getElementById('ptoreq-start').value;


  let end = document.getElementById('ptoreq-end').value;


  const type = document.getElementById('ptoreq-type').value;


  const dur = document.getElementById('ptoreq-duration').value;


  const ampm = document.getElementById('ptoreq-ampm').value;


  const docBlock = document.getElementById('ptoreq-doc-note-block');


  const summary = document.getElementById('ptoreq-summary');





  if (dur !== 'full') end = start;  // single-date for partial-day requests





  if (!start) { summary.textContent = 'Pick a start date.'; docBlock.style.display = 'none'; return; }


  if (dur === 'full' && !end) { summary.textContent = 'Pick an end date.'; docBlock.style.display = 'none'; return; }


  if (start > end) { summary.textContent = '\u26a0 End date must be after start.'; docBlock.style.display = 'none'; return; }





  // Compute hours


  let hours;


  if (dur === '2hr') {


    hours = 2;


    summary.textContent = `${start}: 2 hours requested.`;


  } else if (dur === 'half') {


    hours = 4;


    summary.textContent = `${start} (${ampm}): half day \u2014 4 hours.`;


  } else {


    const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;


    hours = days * 8;


    summary.textContent = `${days} full day${days===1?'':'s'} \u2014 ${hours} hours total.`;


  }


  // Doctor's note check (sick + 5+ days = 40+ hours)


  docBlock.style.display = (type === 'sick' && hours >= 40) ? '' : 'none';


}





async function submitPTORequest() {


  if (!sb || !currentUser) { showToast('Not signed in', 'error'); return; }


  const start = document.getElementById('ptoreq-start').value;


  let end = document.getElementById('ptoreq-end').value;


  const type = document.getElementById('ptoreq-type').value;


  const dur = document.getElementById('ptoreq-duration').value;


  const ampm = document.getElementById('ptoreq-ampm').value;


  const reason = document.getElementById('ptoreq-reason').value.trim();


  if (!start) { showToast('Start date required', 'error'); return; }





  // Single-date for half-day or 2hr


  if (dur !== 'full') end = start;


  if (!end) { showToast('End date required', 'error'); return; }


  if (start > end) { showToast('End date must be after start', 'error'); return; }





  // Calculate hours


  let total_hours, hours_per_day, half_period = null;


  if (dur === '2hr') { total_hours = 2; hours_per_day = 2; }


  else if (dur === 'half') { total_hours = 4; hours_per_day = 4; half_period = ampm; }


  else { const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1; total_hours = days * 8; hours_per_day = 8; }


  const total_days = total_hours / 8;  // legacy column compatibility





  const docInput = document.getElementById('ptoreq-doc-input');


  const docFile = docInput?.files?.[0];


  if (type === 'sick' && total_hours >= 40 && !docFile) {


    if (!confirm("This is 5+ sick days but no doctor's note attached. Submit anyway? It will stay pending until you upload one.")) return;


  }





  // Find staff record for the current user


  const myEmail = currentUser.email || '';


  let staffRow = null;


  try {


    const { data, error } = await sb.from('staff').select('*').eq('email', myEmail).maybeSingle();


    if (error) throw error;


    staffRow = data;


  } catch(e) { /* fall through */ }


  if (!staffRow) {


    showToast('No staff record found for ' + myEmail + ' \u2014 ask admin to add you', 'error');


    return;


  }





  // Insert request


  const payload = {


    staff_id: staffRow.id,


    staff_email: myEmail,


    staff_name: staffRow.name,


    request_type: type,


    start_date: start,


    end_date: end,


    total_days: total_days,


    total_hours: total_hours,


    hours_per_day: hours_per_day,


    half_day_period: half_period,


    reason: reason || null,


    status: 'pending'


  };


  let inserted = null;


  try {


    const { data, error } = await sb.from('pto_requests').insert(payload).select().single();


    if (error) throw error;


    inserted = data;


  } catch(e) {


    showToast('Submit failed: ' + (e.message||'unknown'), 'error');


    return;


  }





  // Upload doctor's note if provided


  if (docFile && inserted) {


    try {


      const safeName = docFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);


      const path = `${inserted.id}/${Date.now()}_${safeName}`;


      const { error: upErr } = await sb.storage.from('doctor-notes').upload(path, docFile, { contentType: docFile.type });


      if (upErr) throw upErr;


      await sb.from('pto_requests').update({


        doctor_note_path: path,


        doctor_note_filename: docFile.name,


        doctor_note_uploaded_at: new Date().toISOString()


      }).eq('id', inserted.id);


    } catch(e) { console.warn("Doctor's note upload failed:", e); showToast("Request submitted but doctor's note upload failed", 'error'); }


  }





  closeModal('modal-pto-request');


  showToast('Time-off request submitted \u2014 awaiting approval', 'success');


  // Refresh whichever HR page might be open


  const myToPage = document.getElementById('page-my-timeoff');


  if (myToPage && myToPage.classList.contains('active')) loadMyTimeOff();


  const hrPage = document.getElementById('page-hr');


  if (hrPage && hrPage.classList.contains('active')) loadHRData();


}





async function approvePTORequest(reqId) {


  if (!sb || !currentUser) return;


  const r = _hrRequests.find(x => x.id === reqId);


  if (!r) return;


  // Sick 5+ days (40+ hours) require doctor's note before approval


  const hours = r.total_hours || (r.total_days || 0) * 8;


  if (r.request_type === 'sick' && hours >= 40 && !r.doctor_note_path) {


    showToast("Cannot approve \u2014 5+ sick days require doctor's note first", 'error');


    return;


  }


  const hrLabel = hours === 2 ? '2 hours'


    : hours === 4 ? `4 hours (${r.half_day_period || 'half day'})`


    : `${(hours/8).toFixed(hours%8?1:0)} day${hours===8?'':'s'}`;


  if (!confirm(`Approve ${r.staff_name}'s ${r.request_type} request \u2014 ${hrLabel}?`)) return;


  try {


    await sb.from('pto_requests').update({


      status: 'approved',


      approver_email: currentUser.email,


      approver_name: currentUser.user_metadata?.full_name || currentUser.email,


      approved_at: new Date().toISOString()


    }).eq('id', reqId);


    // Deduct from hour-based PTO balance


    const used_field = r.request_type === 'vacation' ? 'pto_vacation_hours_used'


      : r.request_type === 'sick' ? 'pto_sick_hours_used'


      : r.request_type === 'personal' ? 'pto_personal_hours_used' : null;


    if (used_field) {


      const emp = _hrEmployees.find(e => e.id === r.staff_id);


      if (emp) {


        const newUsed = parseFloat(emp[used_field] || 0) + hours;


        await sb.from('staff').update({ [used_field]: newUsed }).eq('id', r.staff_id);


      }


    }


    loadHRData();


    showToast('Request approved', 'success');


  } catch(e) { showToast('Approve failed: ' + (e.message||'unknown'), 'error'); }


}





async function denyPTORequest(reqId) {


  const reason = prompt('Reason for denial (optional):');


  if (reason === null) return;  // cancelled


  try {


    await sb.from('pto_requests').update({


      status: 'denied',


      denial_reason: reason || null,


      approver_email: currentUser?.email,


      approver_name: currentUser?.user_metadata?.full_name || currentUser?.email


    }).eq('id', reqId);


    loadHRData();


    showToast('Request denied', 'success');


  } catch(e) { showToast('Deny failed: ' + (e.message||'unknown'), 'error'); }


}





async function downloadDoctorNote(reqId) {


  const r = _hrRequests.find(x => x.id === reqId);


  if (!r || !r.doctor_note_path) return;


  try {


    const { data, error } = await sb.storage.from('doctor-notes').createSignedUrl(r.doctor_note_path, 3600);


    if (error) throw error;


    if (data?.signedUrl) window.open(data.signedUrl, '_blank');


  } catch(e) { showToast('Could not open: ' + (e.message||'unknown'), 'error'); }


}





// ============================================================


