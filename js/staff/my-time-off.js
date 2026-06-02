// Theta My Time Off module
// Extracted from index.html as a classic global script.
// Keep exported function names stable because routing and UI handlers call them directly.

// =================== MY TIME OFF (per-user) =================


// ============================================================


let _myStaffRow = null;


let _myRequests = [];





async function loadMyTimeOff() {


  if (!sb || !currentUser) {


    const list = document.getElementById('myto-history-list');


    if (list) list.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px">Sign in to view your PTO.</div>';


    return;


  }


  const myEmail = currentUser.email || '';


  try {


    const [staffRes, reqRes] = await Promise.all([


      sb.from('staff').select('*').eq('email', myEmail).maybeSingle(),


      sb.from('pto_requests').select('*').eq('staff_email', myEmail).order('created_at', { ascending: false })


    ]);


    if (staffRes.error) throw staffRes.error;


    if (reqRes.error) throw reqRes.error;


    _myStaffRow = staffRes.data;


    _myRequests = reqRes.data || [];


    renderMyTimeOff();


  } catch(e) {


    console.warn('My Time Off load failed:', e);


    showToast('Failed to load your time off: ' + (e.message||'unknown'), 'error');


  }


}





function _fmtHrs(hours) {


  if (hours === null || hours === undefined) return '\u2014';


  const h = parseFloat(hours) || 0;


  const days = Math.floor(h / 8);


  const rem = h - days * 8;


  if (h === 0) return '0';


  if (days === 0) return rem + 'h';


  if (rem === 0) return days + 'd';


  return days + 'd ' + rem + 'h';


}





function renderMyTimeOff() {


  if (!_myStaffRow) {


    const list = document.getElementById('myto-history-list');


    if (list) list.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px">No staff record found for ' + esc(currentUser?.email || '?') + '. Ask an admin to add you.</div>';


    return;


  }


  const s = _myStaffRow;


  const vacRem = (s.pto_vacation_hours_annual || 0) - (s.pto_vacation_hours_used || 0);


  const sickRem = (s.pto_sick_hours_annual || 0) - (s.pto_sick_hours_used || 0);


  const perRem = (s.pto_personal_hours_annual || 0) - (s.pto_personal_hours_used || 0);


  const bank = s.pto_sick_hours_bank || 0;





  const vacEl = document.getElementById('myto-vac');


  const sickEl = document.getElementById('myto-sick');


  const perEl = document.getElementById('myto-per');


  const bankEl = document.getElementById('myto-bank');


  if (vacEl) vacEl.textContent = _fmtHrs(vacRem);


  if (sickEl) sickEl.textContent = _fmtHrs(sickRem);


  if (perEl) perEl.textContent = _fmtHrs(perRem);


  if (bankEl) bankEl.textContent = _fmtHrs(bank);


  document.getElementById('myto-vac-sub').textContent = 'of ' + _fmtHrs(s.pto_vacation_hours_annual) + ' annual';


  document.getElementById('myto-sick-sub').textContent = 'of ' + _fmtHrs(s.pto_sick_hours_annual) + ' annual';


  document.getElementById('myto-per-sub').textContent = 'of ' + _fmtHrs(s.pto_personal_hours_annual) + ' annual';





  // Pending list


  const pending = _myRequests.filter(r => r.status === 'pending');


  const pendingEl = document.getElementById('myto-pending-list');


  if (pendingEl) {


    if (!pending.length) {


      pendingEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:8px;text-align:center">No pending requests.</div>';


    } else {


      pendingEl.innerHTML = pending.map(r => myToReqCard(r, true)).join('');


    }


  }





  // History (excluding pending)


  const past = _myRequests.filter(r => r.status !== 'pending');


  const histEl = document.getElementById('myto-history-list');


  if (histEl) {


    if (!past.length) {


      histEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:8px;text-align:center">No past requests yet.</div>';


    } else {


      histEl.innerHTML = past.slice(0, 30).map(r => myToReqCard(r, false)).join('');


    }


  }


}





function myToReqCard(r, isPending) {


  const hours = r.total_hours || (r.total_days||0) * 8;


  const hrLabel = hours === 2 ? '2 hours'


    : hours === 4 ? `4 hours (${r.half_day_period || 'half'})`


    : `${(hours/8).toFixed(hours%8?1:0)} day${hours===8?'':'s'}`;


  const dates = r.start_date === r.end_date ? r.start_date : `${r.start_date} \u2192 ${r.end_date}`;


  const statusColors = { pending: '#b8852c', approved: '#25a06b', denied: '#e87b87', cancelled: '#7a7974' };


  const c = statusColors[r.status] || '#7a7974';


  const cancelBtn = isPending


    ? `<button onclick="cancelMyPTORequest(${r.id})" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;color:var(--text);font-family:inherit;margin-left:8px">Cancel</button>`


    : '';


  return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:10px 12px">


    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">


      <div><strong style="text-transform:capitalize">${esc(r.request_type)}</strong> \u00b7 ${esc(hrLabel)} \u00b7 <span style="color:var(--muted);font-size:12px">${esc(dates)}</span></div>


      <div style="display:flex;align-items:center;gap:6px">


        <span style="background:${c}22;color:${c};padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase">${esc(r.status)}</span>


        ${cancelBtn}


      </div>


    </div>


    ${r.reason ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">${esc(r.reason)}</div>` : ''}


    ${r.denial_reason ? `<div style="font-size:12px;color:#e87b87;margin-top:4px">Denied: ${esc(r.denial_reason)}</div>` : ''}


  </div>`;


}





async function cancelMyPTORequest(reqId) {


  if (!confirm('Cancel this pending request?')) return;


  try {


    const { error } = await sb.from('pto_requests').update({ status: 'cancelled' }).eq('id', reqId);


    if (error) throw error;


    showToast('Request cancelled', 'success');


    loadMyTimeOff();


  } catch(e) { showToast('Cancel failed: ' + (e.message||'unknown'), 'error'); }


}





// ============================================================
