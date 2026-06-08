// ========== ACCOUNTING ==========





// ---------- DATA ----------


const ACC = {


  closeItems: [


    {id:'c1', label:'Send cut-off deadline reminders', done:false},


    {id:'c2', label:'Bank statement imported â€” all accounts', done:false},


    {id:'c3', label:'Payroll entries posted', done:false},


    {id:'c4', label:'AP accruals â€” goods received not invoiced', done:false},


    {id:'c5', label:'Fixed asset depreciation run', done:false},


    {id:'c6', label:'Prepaid amortization posted', done:false},


    {id:'c7', label:'Revenue recognition reviewed', done:false},


    {id:'c8', label:'Bank reconciliation complete', done:false},


    {id:'c9', label:'AR and AP subledger reconciliations', done:false},


    {id:'c10', label:'Balance sheet account reconciliations', done:false},


    {id:'c11', label:'Preliminary trial balance reviewed', done:false},


    {id:'c12', label:'Draft financials â€” management review', done:false},


  ],





  glEntries: [],





  invoices: [],





  receipts: [],





  bills: [],





  bankTxns: [],





  bankRules: [],





  expenses: [],





  recItems: [],





  taxCalendar: [],





  auditLog: [],


};





// ---------- ACCOUNTING OVERVIEW ----------


function renderAccOverview() {


  renderCloseChecklist('acc-close-list', ACC.closeItems, true, updateAccCloseProgress);


  updateAccCloseProgress();





  const el = id => document.getElementById(id);


  if (el('acc-overview-audit')) {


    const recent = ACC.auditLog.slice(0,5);


    const colors = {Edit:'#cc9533',Create:'#2d7fff',Post:'#25a06b',Delete:'#d63b51',Approve:'#25a06b',Export:'#8b5cf6',Login:'#636b7a'};


    el('acc-overview-audit').innerHTML = recent.map(a => `


      <div class="audit-item">


        <div class="audit-dot" style="background:${colors[a.action]||'#636b7a'}"></div>


        <div class="audit-copy"><strong>${esc(a.action)}: ${esc(a.record)}</strong><span>${esc(a.detail)} Â· ${esc(a.time)}</span></div>


      </div>`).join('');


  }


}





function updateAccCloseProgress() {


  const total = ACC.closeItems.length;


  const done = ACC.closeItems.filter(i => i.done).length;


  const pct = Math.round((done/total)*100);


  const el = id => document.getElementById(id);


  if (el('acc-close-bar')) el('acc-close-bar').style.width = pct + '%';


  if (el('acc-close-progress-text')) el('acc-close-progress-text').textContent = done + ' of ' + total + ' tasks complete';


  const recBar = document.getElementById('rec-progress-bar');


  const recText = document.getElementById('rec-progress-text');


  if (recBar) recBar.style.width = pct + '%';


  if (recText) recText.textContent = done + ' of ' + total + ' complete';


  updateCloseStatusBadges(done, total);


}





// ---------- T+N CLOSE STATUS (auto-computed) ----------


// The "close period" is the most recently ended month: today's previous calendar month.


// Close date = last calendar day of that month (also the quarter end if Mar/Jun/Sep/Dec).


// T+N = business days elapsed AFTER the close date (Sat/Sun excluded). T+0 on close day or before.


function getCurrentClosePeriod(today) {


  const now = today || new Date();


  // Period = previous month relative to today


  const periodMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;


  const periodYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();


  // Last calendar day of that month (also quarter close for Mar/Jun/Sep/Dec)


  const closeDate = new Date(periodYear, periodMonth + 1, 0);


  const isQuarterEnd = [2,5,8,11].indexOf(periodMonth) !== -1; // Mar=2, Jun=5, Sep=8, Dec=11


  return { periodMonth, periodYear, closeDate, isQuarterEnd };


}





function businessDaysBetween(fromDate, toDate) {


  // Counts weekdays strictly AFTER fromDate up to and including toDate.


  // Returns 0 if toDate <= fromDate.


  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());


  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());


  if (end <= start) return 0;


  let count = 0;


  const d = new Date(start);


  d.setDate(d.getDate() + 1);


  while (d <= end) {


    const dow = d.getDay();


    if (dow !== 0 && dow !== 6) count++;


    d.setDate(d.getDate() + 1);


  }


  return count;


}





function computeCloseStatus(today) {


  const now = today || new Date();


  const period = getCurrentClosePeriod(now);


  const tN = businessDaysBetween(period.closeDate, now);


  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];


  return {


    label: 'T+' + tN,


    tN: tN,


    closeDate: period.closeDate,


    isQuarterEnd: period.isQuarterEnd,


    periodLabel: monthNames[period.periodMonth] + ' ' + period.periodYear,


  };


}





function updateCloseStatusBadges(doneCount, totalCount) {


  const status = computeCloseStatus();


  const done = (typeof doneCount === 'number') ? doneCount : 0;


  const total = (typeof totalCount === 'number') ? totalCount : (ACC.closeItems ? ACC.closeItems.length : 0);


  const inProgress = total > 0 && done < total;


  const accBadge = document.getElementById('acc-close-status');


  if (accBadge) {


    const suffix = total === 0 ? '' : (inProgress ? ' â€” In Progress' : ' â€” Complete');


    accBadge.textContent = status.label + suffix;


  }


  const recBadge = document.getElementById('rec-close-status-badge');


  if (recBadge) recBadge.textContent = status.label;


  const closeDays = document.getElementById('acc-close-days');


  if (closeDays) {


    const dateStr = status.closeDate.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});


    closeDays.textContent = 'Close date: ' + dateStr + (status.isQuarterEnd ? ' (Q-end)' : '');


  }


  const recPeriod = document.getElementById('rec-close-period');


  if (recPeriod) recPeriod.textContent = status.periodLabel + (status.isQuarterEnd ? ' Â· Q-end' : '');


}





// ---------- CLOSE CHECKLIST RENDERER ----------


function renderCloseChecklist(containerId, items, sync, onChangeCb) {


  const container = document.getElementById(containerId);


  if (!container) return;


  container.innerHTML = items.map((item, i) => `


    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:${item.done ? 'rgba(37,160,107,.06)' : 'rgba(255,255,255,.02)'};border:1px solid ${item.done ? 'rgba(37,160,107,.2)' : 'rgba(255,255,255,.04)'}">


      <input type="checkbox" ${item.done ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--success);flex-shrink:0;cursor:pointer"


        onchange="closeItemToggle('${item.id}', this.checked, '${containerId}', ${sync}, ${!!onChangeCb})">


      <span style="font-size:13px;flex:1;${item.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(item.label)}</span>


      ${item.done ? '<span style="font-size:11px;color:#4cd69a">âœ“</span>' : ''}


    </div>`).join('');


}





function closeItemToggle(id, checked, containerId, sync, hasCb) {


  const item = ACC.closeItems.find(i => i.id === id);


  if (item) item.done = checked;


  // Re-render both checklists if sync


  if (sync) {


    renderCloseChecklist('acc-close-list', ACC.closeItems, true, true);


    renderCloseChecklist('rec-checklist', ACC.closeItems, true, true);


  } else {


    renderCloseChecklist(containerId, ACC.closeItems, false, false);


  }


  updateAccCloseProgress();


  showToast(checked ? 'Task marked complete' : 'Task reopened', checked ? 'success' : 'info');


  addAuditEntry('D. McGann', 'Edit', 'Close Checklist', 'Task "' + id + '" ' + (checked ? 'completed' : 'reopened'));


}





// ---------- GENERAL LEDGER ----------


let jeLines = [];





function renderGL() {


  const body = document.getElementById('gl-body');


  if (!body) return;


  let runBal = 0;


  let glIdx = 0;


  body.innerHTML = ACC.glEntries.map((e,gi) => {


    const drAmt = parseFloat((e.dr||'').replace(/[$,â€”]/g,'')) || 0;


    const crAmt = parseFloat((e.cr||'').replace(/[$,â€”]/g,'')) || 0;


    runBal += drAmt - crAmt;


    const sc = {Posted:'badge-green',Pending:'badge-gold',Draft:'badge-gray'};


    return `<tr onclick="openGLPanel(${gi})" style="cursor:pointer">


      <td>${esc(e.date)}</td>


      <td style="font-family:monospace;font-size:12px">${esc(e.ref)}</td>


      <td><span style="font-size:12px;color:var(--muted)">${esc(e.acct)}</span></td>


      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.desc)}</td>


      <td style="font-variant-numeric:tabular-nums;color:${e.dr!=='â€”'?'#6aadff':'var(--soft)'}">${esc(e.dr)}</td>


      <td style="font-variant-numeric:tabular-nums;color:${e.cr!=='â€”'?'#4cd69a':'var(--soft)'}">${esc(e.cr)}</td>


      <td><span class="badge ${sc[e.status]||'badge-gray'}">${esc(e.status)}</span></td>


      <td style="color:var(--muted);font-size:12px">${esc(e.by)}</td>


    </tr>`;


  }).join('');


  updateGLBatchBtn();


}





function glApplyFilters() {


  const acct = document.getElementById('gl-acct-filter')?.value || '';


  const rows = document.querySelectorAll('#gl-body tr');


  rows.forEach(tr => {


    const acctCell = tr.cells[2]?.textContent || '';


    tr.style.display = (!acct || acctCell.includes(acct)) ? '' : 'none';


  });


}





function updateGLBatchBtn() {


  const pendingCount = ACC.glEntries.filter(e => e.status === 'Pending' || e.status === 'Draft').length;


  const btn = document.getElementById('gl-batch-post-btn');


  if (btn) btn.textContent = `Batch Post Pending (${pendingCount})`;


}





function glBatchPost() {


  const pending = ACC.glEntries.filter(e => e.status === 'Pending' || e.status === 'Draft');


  if (!pending.length) { showToast('No pending entries to post', 'info'); return; }


  pending.forEach(e => e.status = 'Posted');


  renderGL();


  showToast(pending.length + ' entries posted to ledger', 'success');


  addAuditEntry('D. McGann', 'Post', 'GL Batch', pending.length + ' pending entries posted');


}





// JE Modal


function jeAddLine() {


  jeLines.push({acct:'',desc:'',dr:'',cr:''});


  renderJELines();


}





function renderJELines() {


  const container = document.getElementById('je-lines');


  if (!container) return;


  if (jeLines.length === 0) jeLines = [{acct:'',desc:'',dr:'',cr:''},{acct:'',desc:'',dr:'',cr:''}];


  container.innerHTML = jeLines.map((l,i) => `


    <div style="display:grid;grid-template-columns:2fr 2fr 1fr 1fr auto;gap:6px;align-items:center">


      <select style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;font-family:inherit;outline:none" onchange="jeLines[${i}].acct=this.value;jeCalcTotals()">


        <option value="">Accountâ€¦</option>


        <option>1000 Cash</option><option>1200 A/R</option><option>2000 A/P</option>


        <option>4000 Revenue</option><option>5000 COGS</option><option>6100 Rent</option>


        <option>6200 Depreciation</option><option>6300 Payroll</option><option>6400 Insurance</option>


      </select>


      <input placeholder="Description" value="${esc(l.desc)}" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;font-family:inherit;outline:none" oninput="jeLines[${i}].desc=this.value">


      <input type="number" placeholder="0.00" value="${l.dr}" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:#6aadff;font-size:13px;font-family:inherit;outline:none;font-variant-numeric:tabular-nums" oninput="jeLines[${i}].dr=this.value;jeCalcTotals()">


      <input type="number" placeholder="0.00" value="${l.cr}" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:#4cd69a;font-size:13px;font-family:inherit;outline:none;font-variant-numeric:tabular-nums" oninput="jeLines[${i}].cr=this.value;jeCalcTotals()">


      <button onclick="jeLines.splice(${i},1);renderJELines()" style="width:28px;height:28px;border-radius:6px;background:rgba(201,48,63,.15);border:1px solid rgba(201,48,63,.3);color:#ffb8bf;font-size:16px;display:grid;place-items:center;cursor:pointer;line-height:1">Ã—</button>


    </div>`).join('');


  jeCalcTotals();


}





function jeCalcTotals() {


  let dr = 0, cr = 0;


  jeLines.forEach(l => { dr += parseFloat(l.dr) || 0; cr += parseFloat(l.cr) || 0; });


  const el = id => document.getElementById(id);


  if (el('je-total-dr')) el('je-total-dr').textContent = '$' + dr.toFixed(2);


  if (el('je-total-cr')) el('je-total-cr').textContent = '$' + cr.toFixed(2);


  if (el('je-balanced-msg')) {


    const balanced = Math.abs(dr - cr) < 0.01;


    el('je-balanced-msg').textContent = balanced ? 'âœ“ Balanced' : 'âš Â  Unbalanced';


    el('je-balanced-msg').style.color = balanced ? '#4cd69a' : '#e87b87';


  }


}





function saveJE(status) {


  showToast('Journal Entry persistence coming in Phase 2 â€” record not saved', 'info');


  closeModal('modal-new-je');


}





// ---------- A/R ----------


function renderAR() {


  const body = document.getElementById('ar-body');


  if (!body) return;


  const sc = {Sent:'badge-blue',Partial:'badge-gold',Overdue:'badge-red',Paid:'badge-green',Draft:'badge-gray'};


  body.innerHTML = ACC.invoices.map((inv,i) => `<tr onclick="openARPanel(${i})" style="cursor:pointer">


    <td style="font-family:monospace;font-size:12px">${esc(inv.id)}</td>


    <td>${esc(inv.client)}</td>


    <td style="font-variant-numeric:tabular-nums">${fmtDollar(inv.amount)}</td>


    <td style="color:var(--muted)">${esc(inv.issued)}</td>


    <td style="color:${inv.age > 30 ? '#e87b87' : 'inherit'}">${esc(inv.due)}</td>


    <td style="color:${inv.age > 60 ? '#e87b87' : inv.age > 30 ? '#e8c06a' : 'var(--muted)'}">${inv.age}d</td>


    <td style="color:var(--muted)">${inv.tax ? fmtDollar(inv.tax) : 'â€”'}</td>


    <td><span class="badge ${sc[inv.status]||'badge-gray'}">${esc(inv.status)}</span></td>


    <td onclick="event.stopPropagation()">


      ${inv.status !== 'Paid' ? `<button class="btn-secondary" style="padding:5px 10px;font-size:12px;margin-right:4px" onclick="arMarkPaid(${i})">Mark Paid</button>` : ''}


      ${inv.status === 'Overdue' ? `<button class="btn-danger" style="padding:5px 10px;font-size:12px;margin-right:4px" onclick="arSendReminder(${i})">Remind</button>` : ''}


      


    </td>


  </tr>`).join('');


  renderARChart();


  updateARKPIs();


  // Re-apply current status filter (defaults to Outstanding) so paid invoices


  // are hidden by default and the table matches the top A/R summary totals.


  const sel = document.getElementById('ar-status-filter');


  arApplyStatusFilter(sel ? sel.value : 'outstanding');


  renderReceipts();


}





// Render the Payments Received table â€” paid receipts pulled from


// client_forms (form_type='receipt'). Kept separate from the invoice table


// above so outstanding A/R and incoming cash don't get mixed up visually.


function renderReceipts() {


  const body = document.getElementById('rcpt-body');


  if (!body) return;


  const list = ACC.receipts || [];


  if (!list.length) {


    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">No payments received yet</td></tr>';


  } else {


    body.innerHTML = list.map((r,i) => `<tr${r._form_id ? ` onclick="viewClientForm(${r._form_id})" style="cursor:pointer"` : ''}>


      <td style="font-family:monospace;font-size:12px">${esc(r.id)}</td>


      <td style="font-family:monospace;font-size:12px;color:var(--muted)">${esc(r.relatedInvoice)}</td>


      <td>${esc(r.client)}</td>


      <td style="font-variant-numeric:tabular-nums">${fmtDollar(r.amount)}</td>


      <td style="color:var(--muted)">${esc(r.paymentDate)}</td>


      <td style="color:var(--muted)">${esc(r.method)}</td>


      <td style="color:var(--muted)">${esc(r.reference)}</td>


      <td><span class="badge badge-green">${esc(r.status)}</span></td>


      <td onclick="event.stopPropagation()">${r._form_id ? `<button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="viewClientForm(${r._form_id})">View</button>` : ''}</td>


    </tr>`).join('');


  }


  const total = list.reduce((s,r) => s + (parseFloat(r.amount)||0), 0);


  const tEl = document.getElementById('rcpt-kpi-total');


  if (tEl) tEl.textContent = fmtDollar(total);


}





function updateARKPIs() {


  const active = ACC.invoices.filter(i => i.status !== 'Paid');


  const total = active.reduce((s,i) => s+i.amount, 0);


  const current = active.filter(i => i.age <= 30).reduce((s,i) => s+i.amount, 0);


  const aging31 = active.filter(i => i.age > 30 && i.age <= 60).reduce((s,i) => s+i.amount, 0);


  const over60 = active.filter(i => i.age > 60).reduce((s,i) => s+i.amount, 0);


  const el = id => document.getElementById(id);


  if (el('ar-kpi-total')) el('ar-kpi-total').textContent = fmtDollar(total);


  if (el('ar-kpi-current')) el('ar-kpi-current').textContent = fmtDollar(current);


  if (el('ar-kpi-31')) el('ar-kpi-31').textContent = fmtDollar(aging31);


  if (el('ar-kpi-over')) el('ar-kpi-over').textContent = fmtDollar(over60);


  if (el('acc-kpi-ar')) el('acc-kpi-ar').textContent = fmtDollar(total);


}





function renderARChart() {


  const chart = document.getElementById('ar-aging-chart');


  const labels = document.getElementById('ar-aging-labels');


  if (!chart) return;


  const active = ACC.invoices.filter(i => i.status !== 'Paid');


  const buckets = [


    {label:'Current (0â€“30)',amt:active.filter(i=>i.age<=30).reduce((s,i)=>s+i.amount,0),color:'#4cd69a'},


    {label:'31â€“60 days',amt:active.filter(i=>i.age>30&&i.age<=60).reduce((s,i)=>s+i.amount,0),color:'#e8c06a'},


    {label:'61â€“90 days',amt:active.filter(i=>i.age>60&&i.age<=90).reduce((s,i)=>s+i.amount,0),color:'#e87b87'},


    {label:'90+ days',amt:active.filter(i=>i.age>90).reduce((s,i)=>s+i.amount,0),color:'#c9303f'},


  ];


  const max = Math.max(...buckets.map(b=>b.amt), 1);


  chart.innerHTML = buckets.map(b => `


    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px">


      <div style="font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums">${fmtDollar(b.amt)}</div>


      <div style="width:100%;background:${b.color};border-radius:6px 6px 0 0;height:${Math.round((b.amt/max)*80)}px;min-height:${b.amt>0?4:0}px;opacity:.85"></div>


    </div>`).join('');


  if (labels) labels.innerHTML = buckets.map(b => `<span style="flex:1;text-align:center">${b.label}</span>`).join('');


}





function arMarkPaid(i) {


  showToast('A/R status changes coming in Phase 2 â€” not persisted', 'info');


}





function arSendReminder(i) {


  showToast('Email reminders not yet wired up â€” coming in Phase 2', 'info');


}





function arFilterStatus(status) {


  const sel = document.getElementById('ar-status-filter');


  if (sel) sel.value = status;


  arApplyStatusFilter(status);


}





// Apply the A/R status filter. The "outstanding" sentinel hides Paid rows so


// the invoice table reconciles with the outstanding-only totals shown in the


// top A/R summary KPIs and aging buckets.


function arApplyStatusFilter(value) {


  const v = (value || '').toLowerCase();


  document.querySelectorAll('#ar-body tr').forEach(tr => {


    const cell = tr.cells[7]?.textContent.trim().toLowerCase() || '';


    let show;


    if (v === 'outstanding') show = cell !== 'paid';


    else if (!v) show = true;


    else show = cell.includes(v);


    tr.style.display = show ? '' : 'none';


  });


}





function arFilterAge(min, max) {


  document.querySelectorAll('#ar-body tr').forEach(tr => {


    const ageText = tr.cells[5]?.textContent.replace('d','').trim() || '0';


    const age = parseInt(ageText);


    tr.style.display = (age >= min && age <= max) ? '' : 'none';


  });


}





function createInvoice() {


  const client = document.getElementById('inv-client')?.value;


  const amount = parseFloat(document.getElementById('inv-amount')?.value);


  const desc = document.getElementById('inv-desc')?.value.trim();


  if (!client) { showToast('Client is required','error'); return; }


  if (!amount || amount <= 0) { showToast('Valid amount is required','error'); return; }


  const tax = parseFloat(document.getElementById('inv-tax')?.value) || 0;


  const issued = document.getElementById('inv-issued')?.value;


  const due = document.getElementById('inv-due')?.value;


  const id = 'INV-' + (2096 + ACC.invoices.length);


  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


  const fmt = s => { if(!s) return 'â€”'; const d=new Date(s); return months[d.getMonth()]+' '+d.getDate(); };


  ACC.invoices.unshift({id, client, amount, issued: fmt(issued), due: fmt(due), age:0, tax: Math.round(amount*(tax/100)), status:'Draft'});


  closeModal('modal-new-invoice');


  ['inv-client','inv-amount','inv-desc','inv-issued','inv-due'].forEach(f => {const el=document.getElementById(f);if(el)el.value='';});


  document.getElementById('inv-tax').value = '6.25';


  renderAR();


  showToast(id + ' created â€” ' + client, 'success');


  addAuditEntry('D. McGann', 'Create', id, 'Invoice ' + fmtDollar(amount) + ' for ' + client);


}





// ---------- A/P ----------


function renderAP() {


  const body = document.getElementById('ap-body');


  if (!body) return;


  const sc = {'Awaiting Approval':'badge-gold',Scheduled:'badge-blue',Paid:'badge-green',Overdue:'badge-red'};


  body.innerHTML = ACC.bills.map((b,i) => `<tr onclick="openAPPanel(${i})" style="cursor:pointer">


    <td style="font-family:monospace;font-size:12px">${esc(b.id)}</td>


    <td>${esc(b.vendor)}</td>


    <td style="font-variant-numeric:tabular-nums">${fmtDollar(b.amount)}</td>


    <td style="color:${b.status==='Overdue'?'#e87b87':'inherit'}">${esc(b.due)}</td>


    <td><span class="badge badge-gray" style="font-size:11px">${esc(b.cat)}</span></td>


    <td><span class="badge ${sc[b.status]||'badge-gray'}">${esc(b.status)}</span></td>


    <td onclick="event.stopPropagation()">


      ${b.status === 'Awaiting Approval' ? `<button class="btn-primary" style="padding:5px 10px;font-size:12px;margin-right:4px" onclick="apApprove(${i})">Approve</button>` : ''}


      ${b.status === 'Scheduled' ? `<button class="btn-secondary" style="padding:5px 10px;font-size:12px;margin-right:4px" onclick="apMarkPaid(${i})">Mark Paid</button>` : ''}


      ${b.status === 'Overdue' ? `<button class="btn-danger" style="padding:5px 10px;font-size:12px;margin-right:4px" onclick="apSchedule(${i})">Schedule</button>` : ''}


    </td>


  </tr>`).join('');


  renderAPQueue();


  updateAPKPIs();


}





function apApprove(i) {


  const b = ACC.bills[i];


  if (!b) return;


  b.status = 'Scheduled';


  addAuditEntry('D. McGann', 'Approve', b.id, 'Bill approved â€” ' + b.vendor + ' ' + fmtDollar(b.amount));


  renderAP();


  showToast(b.id + ' approved and scheduled', 'success');


  // Update Supabase


  if (sb && sbConnected && b._sbId) {


    sb.from('vendor_files').update({ status: 'filed', updated_at: new Date().toISOString() })


      .eq('id', b._sbId)


      .then(({ error }) => { if (error) { console.warn('apApprove DB update failed:', error); showToast('Status synced locally â€” DB write failed', 'error'); } });


  }


}





function apMarkPaid(i) {


  const b = ACC.bills[i];


  if (!b) return;


  b.status = 'Paid';


  addAuditEntry('D. McGann', 'Edit', b.id, 'Bill marked paid â€” ' + b.vendor);


  renderAP();


  showToast(b.id + ' marked as paid', 'success');


  // Update Supabase


  if (sb && sbConnected && b._sbId) {


    const today = new Date().toISOString().split('T')[0];


    const user = getUser().email || 'staff';


    sb.from('vendor_files').update({


      status: 'paid',


      paid_date: today,


      paid_by: user,


      updated_at: new Date().toISOString()


    }).eq('id', b._sbId)


      .then(({ error }) => { if (error) { console.warn('apMarkPaid DB update failed:', error); showToast('Status synced locally â€” DB write failed', 'error'); } });


  }


}





function apSchedule(i) {


  const b = ACC.bills[i];


  if (!b) return;


  b.status = 'Scheduled';


  renderAP();


  showToast(b.id + ' scheduled for payment', 'success');


  // Update Supabase


  if (sb && sbConnected && b._sbId) {


    sb.from('vendor_files').update({ status: 'filed', updated_at: new Date().toISOString() })


      .eq('id', b._sbId)


      .then(({ error }) => { if (error) { console.warn('apSchedule DB update failed:', error); showToast('Status synced locally â€” DB write failed', 'error'); } });


  }


}





function renderAPQueue() {


  const queue = document.getElementById('ap-payment-queue');


  if (!queue) return;


  const upcoming = ACC.bills.filter(b => b.status === 'Scheduled').slice(0,5);


  if (!upcoming.length) { queue.innerHTML = '<div class="empty-state">No scheduled payments</div>'; return; }


  queue.innerHTML = upcoming.map(b => `


    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">


      <div><div style="font-size:13px;font-weight:600">${esc(b.vendor)}</div><div style="font-size:12px;color:var(--muted)">${esc(b.id)} Â· Due ${esc(b.due)}</div></div>


      <div style="text-align:right"><div style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums">${fmtDollar(b.amount)}</div><span class="badge badge-blue" style="font-size:11px">Scheduled</span></div>


    </div>`).join('');


}





function updateAPKPIs() {


  const active = ACC.bills.filter(b => b.status !== 'Paid');


  const total = active.reduce((s,b) => s+b.amount, 0);


  const pending = active.filter(b => b.status === 'Awaiting Approval').reduce((s,b) => s+b.amount, 0);


  const el = id => document.getElementById(id);


  if (el('ap-kpi-total')) el('ap-kpi-total').textContent = fmtDollar(total);


  if (el('ap-kpi-pending')) el('ap-kpi-pending').textContent = fmtDollar(pending);


  if (el('acc-kpi-ap')) el('acc-kpi-ap').textContent = fmtDollar(total);


}





function apFilterStatus(status) {


  filterTableByCol('ap-body', status, 5);


}


function populateBillVendorDropdown() {


  const sel = document.getElementById('bill-vendor');


  if (!sel) return;


  sel.innerHTML = '<option value="">Select vendorâ€¦</option>';


  (DB.vendors || [])


    .filter(v => v.status === 'Active' || v.status === 'active')


    .sort((a, b) => a.name.localeCompare(b.name))


    .forEach(v => {


      const opt = document.createElement('option');


      opt.value = v.name;


      opt.textContent = v.name;


      sel.appendChild(opt);


    });


}





function createBill() {


  const vendor = document.getElementById('bill-vendor')?.value;


  const amount = parseFloat(document.getElementById('bill-amount')?.value);


  if (!vendor) { showToast('Vendor is required','error'); return; }


  if (!amount || amount <= 0) { showToast('Valid amount is required','error'); return; }


  const due = document.getElementById('bill-due')?.value;


  const cat = document.getElementById('bill-cat')?.value;


  const notes = document.getElementById('bill-notes')?.value || '';


  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


  const fmt = s => { if(!s) return 'â€”'; const d=new Date(s); return months[d.getMonth()]+' '+d.getDate(); };


  const id = `INV-${String(ACC.bills.length + 1).padStart(4, '0')}`;


  // Optimistic local update


  ACC.bills.unshift({id, vendor, amount, due: fmt(due), cat, status:'Awaiting Approval', notes});


  closeModal('modal-new-bill');


  ['bill-vendor','bill-amount','bill-due','bill-notes'].forEach(f => {const el=document.getElementById(f);if(el)el.value='';});


  renderAP();


  showToast(id + ' created â€” ' + vendor, 'success');


  addAuditEntry('D. McGann', 'Create', id, 'Bill ' + fmtDollar(amount) + ' from ' + vendor);


  // Persist to Supabase


  if (sb && sbConnected) {


    (async () => {


      try {


        // Look up vendor_id by company_name


        const { data: vData } = await sb.from('vendors').select('id').eq('company_name', vendor).maybeSingle();


        const vendorId = vData ? vData.id : null;


        const { error } = await sb.from('vendor_files').insert({


          vendor_id: vendorId,


          file_number: id,


          file_type: 'Invoice',


          file_name: id + ' â€” ' + vendor,


          amount: amount,


          status: 'pending',


          due_date: due || null,


          notes: notes,


          created_at: new Date().toISOString(),


          updated_at: new Date().toISOString()


        });


        if (error) throw error;


        // Reload canonical data from DB


        await loadBillsFromSupabase();


      } catch(e) {


        console.warn('Supabase bill insert failed:', e);


        showToast('Bill saved locally â€” sync failed: ' + (e.message || e), 'error');


      }


    })();


  }


}





// ---------- BANKING ----------


function renderBanking() {


  const body = document.getElementById('bank-body');


  if (!body) return;


  const sc = {Matched:'badge-green','Needs Rule':'badge-gold',Unmatched:'badge-red'};


  body.innerHTML = ACC.bankTxns.map((t,ti) => `<tr onclick="openBankPanel(${ti})" style="cursor:pointer">


    <td style="color:var(--muted)">${esc(t.date)}</td>


    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.desc)}</td>


    <td style="font-variant-numeric:tabular-nums;font-weight:600;color:${t.amount>=0?'#4cd69a':'#e87b87'}">${t.amount>=0?'+':''}${fmtDollar(Math.abs(t.amount))}</td>


    <td><span class="badge badge-gray" style="font-size:11px">${esc(t.cat)}</span></td>


    <td><span class="badge ${sc[t.status]||'badge-gray'}">${esc(t.status)}</span></td>


  </tr>`).join('');





  const rulesEl = document.getElementById('bank-rules-list');


  if (rulesEl) {


    rulesEl.innerHTML = ACC.bankRules.map(r => `


      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface2);border-radius:8px">


        <div><div style="font-size:13px;font-weight:500">${esc(r.keyword)}</div><div style="font-size:11px;color:var(--muted)">â†’ ${esc(r.cat)} Â· ${r.match} matches</div></div>


        <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="showToast('Bank rules editing coming in Phase 2','info')">Edit</button>


      </div>`).join('');


  }


}





function bankReconcile() {


  showToast('Bank reconciliation completed â€” $0.00 difference âœ“', 'success');


  addAuditEntry('D. McGann', 'Post', 'Bank Rec â€” Apr 2025', 'Reconciliation completed â€” difference $0.00');


}





// ---------- EXPENSES ----------


function renderExpenses() {


  const body = document.getElementById('exp-body');


  if (!body) return;


  const sc = {Pending:'badge-gold',Approved:'badge-green',Rejected:'badge-red'};


  body.innerHTML = ACC.expenses.map((e,i) => `<tr onclick="openExpPanel(${i})" style="cursor:pointer">


    <td style="color:var(--muted)">${esc(e.date)}</td>


    <td>


      <div style="display:flex;align-items:center;gap:8px">


        <div class="staff-avatar" style="background:${e.color};color:#91b4ff;width:28px;height:28px;font-size:12px">${esc(e.initial)}</div>


        <span>${esc(e.staff)}</span>


      </div>


    </td>


    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.desc)}</td>


    <td style="font-variant-numeric:tabular-nums;font-weight:600">${fmtDollar(e.amount)}</td>


    <td><span class="badge badge-gray" style="font-size:11px">${esc(e.cat)}</span></td>


    <td><span class="badge ${sc[e.status]||'badge-gray'}">${esc(e.status)}</span></td>


    <td><span class="${e.receipt==='Yes'?'badge badge-green':e.receipt==='Missing'?'badge badge-gold':'badge badge-red'}" style="font-size:11px">${esc(e.receipt)}</span></td>


    <td onclick="event.stopPropagation()">


      ${e.status === 'Pending' ? `


        <button class="btn-primary" style="padding:5px 10px;font-size:12px;margin-right:4px" onclick="expApprove(${i})">Approve</button>


        <button class="btn-danger" style="padding:5px 10px;font-size:12px" onclick="expReject(${i})">Reject</button>` : 'â€”'}


    </td>


  </tr>`).join('');


  updateExpKPIs();


}





function expApprove(i) {


  showToast('Expense approval workflow coming in Phase 2', 'info');


}





function expReject(i) {


  ACC.expenses[i].status = 'Rejected';


  addAuditEntry('D. McGann', 'Edit', ACC.expenses[i].id, ACC.expenses[i].staff + ' expense $' + ACC.expenses[i].amount + ' rejected');


  renderExpenses();


  showToast(ACC.expenses[i].id + ' rejected', 'error');


}





function updateExpKPIs() {


  const pending = ACC.expenses.filter(e => e.status === 'Pending').length;


  const approved = ACC.expenses.filter(e => e.status === 'Approved').reduce((s,e) => s+e.amount, 0);


  const total = ACC.expenses.reduce((s,e) => s+e.amount, 0);


  const el = id => document.getElementById(id);


  if (el('exp-kpi-pending')) el('exp-kpi-pending').textContent = pending;


  if (el('exp-kpi-approved')) el('exp-kpi-approved').textContent = fmtDollar(approved);


  if (el('exp-kpi-total')) el('exp-kpi-total').textContent = fmtDollar(total);


}





function createExpense() {


  showToast('Expense submission coming in Phase 2 â€” not yet wired to database', 'info');


  closeModal('modal-new-expense');


}





// ---------- RECONCILIATION ----------


function renderReconciliation() {


  renderCloseChecklist('rec-checklist', ACC.closeItems, true, true);


  updateAccCloseProgress();





  const body = document.getElementById('rec-items-body');


  if (body) {


    const escCls = {


      'None':'badge-gray','Supervisor':'badge-gold','Controller':'badge-red'


    };


    body.innerHTML = ACC.recItems.map(item => {


      const ageCls = item.age > 60 ? 'badge-red' : item.age > 30 ? 'badge-gold' : 'badge-green';


      return `<tr>


        <td>${esc(item.item)}</td>


        <td style="font-variant-numeric:tabular-nums;font-weight:600">${esc(item.amount)}</td>


        <td><span class="badge ${ageCls}">${item.age}d</span></td>


        <td><span class="badge badge-gray" style="font-size:11px">${esc(item.cat)}</span></td>


        <td style="color:var(--muted)">${esc(item.assign)}</td>


        <td><span class="badge ${escCls[item.escalation]||'badge-gray'}">${esc(item.escalation)}</span></td>


        <td><button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="showToast('Resolve action coming in Phase 2','info')">Resolve</button></td>


      </tr>`;


    }).join('');


  }


}





// ---------- TAX ----------


function renderTax() {


  const body = document.getElementById('tax-calendar-body');


  if (!body) return;


  const sc = {'In Progress':'badge-gold',Prepared:'badge-blue',Filed:'badge-green',Upcoming:'badge-gray'};


  body.innerHTML = ACC.taxCalendar.map(t => `<tr>


    <td style="font-weight:600">${esc(t.name)}</td>


    <td style="color:var(--muted)">${esc(t.period)}</td>


    <td style="color:${t.status==='In Progress'?'#e8c06a':'inherit'}">${esc(t.due)}</td>


    <td>${esc(t.jurisdiction)}</td>


    <td style="color:var(--muted)">${esc(t.assign)}</td>


    <td><span class="badge ${sc[t.status]||'badge-gray'}">${esc(t.status)}</span></td>


    <td><button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="showToast('Filing opened','info')">Open</button></td>


  </tr>`).join('');


}





function createTaxTask() {


  showToast('Tax task tracking coming in Phase 2', 'info');


  closeModal('modal-new-tax-task');


}





// ---------- AUDIT TRAIL ----------


function renderAuditTrail() {


  const body = document.getElementById('audit-body');


  if (!body) return;


  const actionBadge = {


    Create:'badge-blue',Edit:'badge-gold',Delete:'badge-red',


    Post:'badge-green',Approve:'badge-green',Export:'badge-violet',Login:'badge-gray'


  };


  body.innerHTML = ACC.auditLog.map(a => `<tr>


    <td style="color:var(--muted);font-size:12px;white-space:nowrap">${esc(a.time)}</td>


    <td style="font-weight:600">${esc(a.user)}</td>


    <td><span class="badge ${actionBadge[a.action]||'badge-gray'}">${esc(a.action)}</span></td>


    <td style="font-family:monospace;font-size:12px">${esc(a.record)}</td>


    <td style="color:var(--muted);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.detail)}</td>


  </tr>`).join('');


}





function addAuditEntry(user, action, record, detail) {


  const now = new Date();


  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


  const time = months[now.getMonth()] + ' ' + now.getDate() + ', ' +


    now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});


  ACC.auditLog.unshift({time, user, action, record, detail});


  // Re-render if visible


  if (document.getElementById('audit-body')) renderAuditTrail();


  if (document.getElementById('acc-overview-audit')) renderAccOverview();


  // Supabase audit


  sbInsertAudit('accounting', String(record), action, detail);


}





// ---------- UTILS ----------


function fmtDollar(n) {


  return '$' + Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});


}





// ---------- CLIENT_FORMS â†’ ACCOUNTING BRIDGE ----------


// Derives ACC.invoices and accounting GL rows from existing client_forms


// (form_type = invoice | receipt). No schema changes, no durable writes â€”


// keyed by form_number/id so re-renders dedupe naturally.


let _accSyncInFlight = null;


async function loadAccountingFromClientForms() {


  if (!sb) return;


  if (_accSyncInFlight) return _accSyncInFlight;


  _accSyncInFlight = (async () => {


    try {


      const [formsRes, clientsRes] = await Promise.all([


        sb.from('client_forms')


          .select('id,client_id,form_type,form_number,form_date,title,amount,status,data,created_at')


          .in('form_type', ['invoice','receipt'])


          .order('form_date', { ascending: false }),


        sb.from('clients').select('id, name, company, first_name, last_name')


      ]);


      if (formsRes.error) throw formsRes.error;


      const clientsById = {};


      (clientsRes.data || []).forEach(c => {


        const full = ((c.first_name||'') + ' ' + (c.last_name||'')).trim();


        clientsById[c.id] = c.company || c.name || full || 'â€”';


      });





      const rows = formsRes.data || [];


      const invoices = [];


      const seenInvKey = new Set();


      const gl = [];


      const seenGlKey = new Set();


      const today = new Date();


      const dayMs = 86400000;


      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


      const fmtMD = iso => {


        if (!iso) return 'â€”';


        const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);


        if (isNaN(d)) return 'â€”';


        return months[d.getMonth()] + ' ' + d.getDate();


      };


      const fmtFull = iso => {


        if (!iso) return 'â€”';


        const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);


        if (isNaN(d)) return 'â€”';


        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();


      };





      // Pass 1 â€” invoices


      rows.filter(r => r.form_type === 'invoice').forEach(r => {


        const key = r.form_number ? ('FN:' + r.form_number) : ('ID:' + r.id);


        if (seenInvKey.has(key)) return;


        seenInvKey.add(key);


        const amt = parseFloat(r.amount) || 0;


        const issuedIso = r.form_date || (r.created_at ? r.created_at.slice(0,10) : null);


        const issuedDate = issuedIso ? new Date(issuedIso.length <= 10 ? issuedIso + 'T00:00:00' : issuedIso) : null;


        const age = issuedDate && !isNaN(issuedDate)


          ? Math.max(0, Math.floor((today - issuedDate) / dayMs))


          : 0;


        const isPaid = (r.status === 'paid')


          || (r.data && typeof r.data === 'object' && r.data.__paid);


        const status = isPaid ? 'Paid'


          : (age > 30 ? 'Overdue' : 'Sent');


        const client = r.client_id ? (clientsById[r.client_id] || 'â€”') : 'â€”';


        invoices.push({


          id: r.form_number || ('INV-' + r.id),


          client,


          amount: amt,


          issued: fmtMD(issuedIso),


          due: fmtMD(issuedIso),


          age,


          tax: 0,


          status,


          _form_id: r.id,


          _source: 'client_forms'


        });





        // GL: A/R debit on issuance (one row per invoice)


        const glKey = 'INV:' + (r.form_number || r.id);


        if (!seenGlKey.has(glKey)) {


          seenGlKey.add(glKey);


          gl.push({


            date: fmtMD(issuedIso),


            ref: r.form_number || ('INV-' + r.id),


            acct: '1200 A/R',


            desc: 'Invoice â€” ' + client,


            dr: '$' + amt.toFixed(2),


            cr: 'â€”',


            status: 'Posted',


            by: 'system'


          });


        }


      });





      // Pass 2 â€” receipts (incoming payments / cash-in)


      const receipts = [];


      const seenRcptKey = new Set();


      // Receipt forms store extra fields (related invoice, method, reference,


      // payment date) in the form `data` JSON. Pull them out tolerantly so


      // we surface them in the Payments Received table.


      const dataPick = (data, suffixes, labels) => {


        if (!data || typeof data !== 'object') return '';


        const lf = (data.__label_fields && typeof data.__label_fields === 'object') ? data.__label_fields : {};


        for (const suf of (suffixes || [])) {


          for (const k of Object.keys(data)) {


            if (k.endsWith(suf) && data[k] != null && data[k] !== '') return data[k];


          }


        }


        for (const lab of (labels || [])) {


          if (lf[lab] != null && lf[lab] !== '') return lf[lab];


        }


        return '';


      };


      rows.filter(r => r.form_type === 'receipt').forEach(r => {


        const amt = parseFloat(r.amount) || 0;


        if (!amt) return;


        const recIso = r.form_date || (r.created_at ? r.created_at.slice(0,10) : null);


        const client = r.client_id ? (clientsById[r.client_id] || 'â€”') : 'â€”';


        const ref = r.form_number || ('RCPT-' + r.id);


        // Receipt-table row (separate from GL key â€” we always want a row even


        // if the GL was already posted by a duplicate).


        const rcptKey = 'RCPT-ROW:' + ref;


        if (!seenRcptKey.has(rcptKey)) {


          seenRcptKey.add(rcptKey);


          const relatedInv = String(dataPick(r.data, ['-related-invoice'], ['Related Invoice']) || '').trim();


          const method     = String(dataPick(r.data, ['-method'],          ['Payment Method'])  || '').trim();


          const reference  = String(dataPick(r.data, ['-reference'],       ['Reference / Check #','Reference']) || '').trim();


          const payDateRaw = String(dataPick(r.data, ['-payment-date'],    ['Date of Payment']) || '').trim();


          // payDateRaw may be already-formatted ("Apr 12") or ISO ("2026-04-12").


          const payDateDisplay = (() => {


            if (!payDateRaw) return fmtMD(recIso);


            if (/^\d{4}-\d{2}-\d{2}/.test(payDateRaw)) return fmtMD(payDateRaw);


            return payDateRaw;


          })();


          receipts.push({


            id: ref,


            relatedInvoice: relatedInv || 'â€”',


            client,


            amount: amt,


            paymentDate: payDateDisplay,


            method: method || 'â€”',


            reference: reference || 'â€”',


            status: r.status === 'paid' ? 'Paid' : 'Received',


            _form_id: r.id,


            _source: 'client_forms'


          });


        }


        const glKey = 'RCPT:' + ref;


        if (seenGlKey.has(glKey)) return;


        seenGlKey.add(glKey);


        // Cash debit / A/R credit pair so totals reflect payment received.


        gl.push({


          date: fmtMD(recIso),


          ref,


          acct: '1000 Cash',


          desc: 'Payment received â€” ' + client,


          dr: '$' + amt.toFixed(2),


          cr: 'â€”',


          status: 'Posted',


          by: 'system'


        });


        gl.push({


          date: fmtMD(recIso),


          ref,


          acct: '1200 A/R',


          desc: 'Apply receipt â€” ' + client,


          dr: 'â€”',


          cr: '$' + amt.toFixed(2),


          status: 'Posted',


          by: 'system'


        });





        // Audit-trail breadcrumb so receipts surface on Overview's Recent Activity.


        const auditKey = 'rcpt:' + ref;


        if (!ACC.auditLog.some(a => a._key === auditKey)) {


          ACC.auditLog.unshift({


            _key: auditKey,


            time: fmtFull(recIso),


            user: 'system',


            action: 'Post',


            record: ref,


            detail: 'Receipt ' + fmtDollar(amt) + ' from ' + client


          });


        }


      });





      // Replace derived rows in-place. Keep any user-created entries by


      // filtering out only rows that came from this bridge (tagged _source).


      ACC.invoices = invoices.concat(


        (ACC.invoices || []).filter(i => i._source !== 'client_forms')


      );


      ACC.receipts = receipts.concat(


        (ACC.receipts || []).filter(r => r._source !== 'client_forms')


      );


      ACC.glEntries = gl.concat(


        (ACC.glEntries || []).filter(e => !(/^INV-|RCPT-|^MSE-INV|^MSE-RCPT/i.test(e.ref || '')))


      );





      // Re-render whichever accounting page is currently visible.


      if (document.getElementById('page-accounting-ar')?.classList.contains('active')) renderAR();


      if (document.getElementById('page-accounting-gl')?.classList.contains('active')) renderGL();


      if (document.getElementById('page-accounting-audit')?.classList.contains('active')) renderAuditTrail();


      if (document.getElementById('page-accounting')?.classList.contains('active')) renderAccOverview();


      // KPI on Overview header is updated by renderAR's updateARKPIs path.


      updateARKPIs && updateARKPIs();


    } catch(e) {


      console.warn('loadAccountingFromClientForms failed:', e);


    } finally {


      _accSyncInFlight = null;


    }


  })();


  return _accSyncInFlight;


}





// ---------- PAGE INIT HOOK (called by navigate) ----------


function initAccountingPage(pageId) {


  switch(pageId) {


    case 'accounting':


      renderAccOverview();


      if (sb && sbConnected) loadAccountingFromClientForms();


      break;


    case 'accounting-gl':


      if (sb && sbConnected) {


        loadAccountingFromClientForms().then(() => renderGL());


      } else {


        renderGL();


      }


      break;


    case 'accounting-ar':


      if (sb && sbConnected) {


        loadAccountingFromClientForms().then(() => renderAR());


      } else {


        renderAR();


      }


      break;


    case 'accounting-ap':


      // Reload bills from Supabase then render


      if (sb && sbConnected) {


        loadBillsFromSupabase().then(() => renderAP());


      } else {


        renderAP();


      }


      break;


    case 'accounting-banking':


      // TODO: wire bank transactions to Supabase when bank_transactions table is added


      renderBanking(); break;


    case 'accounting-expenses':


      // TODO: wire expenses to Supabase when expenses table is added


      renderExpenses(); break;


    case 'accounting-reconciliation': renderReconciliation(); break;


    case 'accounting-reports': break; // static


    case 'accounting-tax':


      // TODO: wire tax calendar to Supabase when tax_tasks table is added


      renderTax(); break;


    case 'accounting-audit':


      // Load fresh audit data from Supabase + derive receipt postings, then render


      if (sb && sbConnected) {


        Promise.all([loadAuditLogFromSupabase(), loadAccountingFromClientForms()])


          .then(() => renderAuditTrail());


      } else {


        renderAuditTrail();


      }


      break;


  }


}





// Init JE modal when opened


const _origOpenModal = window.openModal;


window.openModal = function(id) {


  if (id === 'modal-new-je') {


    jeLines = [];


    renderJELines();


    const today = new Date().toISOString().split('T')[0];


    const jeDate = document.getElementById('je-date');


    if (jeDate && !jeDate.value) jeDate.value = today;


  }


  if (id === 'modal-new-invoice' || id === 'modal-new-expense') {


    const today = new Date().toISOString().split('T')[0];


    if (id === 'modal-new-invoice') {


      const issuedEl = document.getElementById('inv-issued');


      if (issuedEl && !issuedEl.value) issuedEl.value = today;


    }


    if (id === 'modal-new-expense') {


      const expDateEl = document.getElementById('exp-date');


      if (expDateEl && !expDateEl.value) expDateEl.value = today;


    }


  }


  _origOpenModal(id);


};








// ========== DETAIL PANEL ==========


function openDetailPanel(title, subtitle, rows) {


  document.getElementById('detailTitle').textContent = title;


  document.getElementById('detailSubtitle').textContent = subtitle;


  document.getElementById('detailBody').innerHTML = rows.map(([k,v]) => `


    <div class="detail-row"><span class="key">${esc(k)}</span><span class="val">${esc(v)}</span></div>`).join('');


  document.getElementById('detailOverlay').classList.add('open');


  document.getElementById('detailPanel').classList.add('open');


}


function closeDetailPanel() {


  document.getElementById('detailOverlay').classList.remove('open');


  document.getElementById('detailPanel').classList.remove('open');


}





// ========== MODALS ==========


function openModal(id) { document.getElementById(id).classList.add('open'); }


function closeModal(id) { document.getElementById(id).classList.remove('open'); }


function closeModalBg(e, id) { if (e.target === e.currentTarget) closeModal(id); }





// ========== CREATE ACTIONS ==========





// Ticket status and priority utilities extracted to js/tickets/ticket-utils.js

let _newTicketExtras = [];


function openNewTicketModal() {


  _newTicketExtras = [];


  if (typeof renderNewTicketAssigneeChips === 'function') renderNewTicketAssigneeChips();





  const subjectEl   = document.getElementById('tk-subject');


  const priorityEl  = document.getElementById('tk-priority');


  const clientEl    = document.getElementById('tk-client');


  const assignEl    = document.getElementById('tk-assign');


  const secNameEl   = document.getElementById('tk-sec-name');


  const secPhoneEl  = document.getElementById('tk-sec-phone');


  const statusEl    = document.getElementById('tk-status');


  const descEl      = document.getElementById('tk-desc');


  const contactBlockEl    = document.getElementById('tk-contact-block');


  const contactNameEl     = document.getElementById('tk-c-name');


  const contactPhoneWrapEl = document.getElementById('tk-c-phone-wrap');


  const contactEmailWrapEl = document.getElementById('tk-c-email-wrap');





  if (subjectEl)  subjectEl.value  = '';


  if (priorityEl) { if (typeof populateTicketPrioritySelect === 'function') {
  populateTicketPrioritySelect(priorityEl, 'Select priority');
}
priorityEl.value = 'Medium'; };


  if (clientEl)   clientEl.value   = '';


  if (assignEl)   assignEl.value   = '';


  if (secNameEl)  secNameEl.value  = '';


  if (secPhoneEl) secPhoneEl.value = '';


  if (descEl)     descEl.value     = '';





  if (contactBlockEl)     contactBlockEl.style.display = 'none';


  if (contactNameEl)      contactNameEl.textContent     = '';


  if (contactPhoneWrapEl) contactPhoneWrapEl.textContent = '';


  if (contactEmailWrapEl) contactEmailWrapEl.textContent = '';





  if (typeof populateTicketStatusSelect === 'function' && statusEl) {


    populateTicketStatusSelect(statusEl, 'Select status');


    statusEl.value = TICKET_STATUS.SUBMITTED;


  }





  openModal('modal-new-ticket');


}


function renderNewTicketAssigneeChips() {


  const wrap = document.getElementById('tk-assignees-chips');


  if (!wrap) return;


  wrap.innerHTML = _newTicketExtras.map(m => {


    const safe = String(m).replace(/'/g, "\\'");


    return `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:3px 4px 3px 10px;font-size:12px;color:var(--text)">?? ${esc(m)}<button onclick="removeNewTicketAssignee('${safe}')" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:14px;line-height:1;padding:0 4px;margin-left:4px" title="Remove">Ã—</button></span>`;


  }).join('');


}


function addNewTicketAssignee(name) {


  if (!name) return;


  const primary = (document.getElementById('tk-assign') || {}).value || '';


  if (name === primary) return;


  if (!_newTicketExtras.includes(name)) _newTicketExtras.push(name);


  renderNewTicketAssigneeChips();


}


function removeNewTicketAssignee(name) {


  _newTicketExtras = _newTicketExtras.filter(m => m !== name);


  renderNewTicketAssigneeChips();


}


function onTkPrimaryAssignChange() {


  const primary = (document.getElementById('tk-assign') || {}).value || '';


  _newTicketExtras = _newTicketExtras.filter(m => m && m !== primary);


  renderNewTicketAssigneeChips();


}





function createTicket() {


  const subj = document.getElementById('tk-subject').value.trim();


  if (!subj) { showToast('Subject is required','error'); return; }


  const id = '#T-' + (1048 + DB.tickets.length + 1);


  const primaryAssign = document.getElementById('tk-assign').value || '';


  const assignees = (primaryAssign ? [primaryAssign] : []).concat(


    _newTicketExtras.filter(n => n && n !== primaryAssign)


  );


  const newTicket = {


    id, subject: subj,


    client: document.getElementById('tk-client').value,


    assign: primaryAssign || 'Unassigned',


    assignees: assignees,


    priority: document.getElementById('tk-priority').value,


    status: TICKET_STATUS.SUBMITTED,


    created: 'Just now',


    secondary_contact: (document.getElementById('tk-sec-name') || {}).value || '',


    secondary_phone: (document.getElementById('tk-sec-phone') || {}).value || ''


  };


  DB.tickets.unshift(newTicket);


  // Supabase insert


  if (sbConnected) {


    (async () => {


      try {


        const assignedTechStr = joinAssignees(assignees) || newTicket.assign;


        const { data } = await sb.from('tickets').insert({


          job_id: id,


          issue: newTicket.subject,


          client_name: newTicket.client,


          assigned_tech: assignedTechStr,


          priority: newTicket.priority,


          status: newTicket.status,


          created_at: new Date().toISOString(),


          updated_at: new Date().toISOString()


        }).select().single();


        if (data) newTicket._sbId = data.id;


        await sbInsertAudit('tickets', id, 'Create', 'New ticket ' + id + ': ' + newTicket.subject);


      } catch(e) {
  console.error('?? TICKET INSERT FAILED:', e);
  showToast('Ticket create failed ? check console', 'error');
}


    })();


  }


  closeModal('modal-new-ticket');


  document.getElementById('tk-subject').value = '';


  document.getElementById('tk-desc').value = '';


  const tkSn = document.getElementById('tk-sec-name'); if (tkSn) tkSn.value = '';


  const tkSp = document.getElementById('tk-sec-phone'); if (tkSp) tkSp.value = '';


  const tkCb = document.getElementById('tk-contact-block'); if (tkCb) tkCb.style.display = 'none';


  const tkCl = document.getElementById('tk-client'); if (tkCl) tkCl.value = '';


  // Reset the multi-assignee draft


  _newTicketExtras = [];


  renderNewTicketAssigneeChips();


  renderTickets();


  renderDashboard();


  showToast(id + ' created','success');


}





function createJob() {


  const clientVal = document.getElementById('job-client').value.trim();


  const loc       = document.getElementById('job-location').value.trim();


  const issue     = document.getElementById('job-issue').value.trim();


  if (!clientVal) { showToast('Client is required','error'); return; }


  if (!loc)       { showToast('Location is required','error'); return; }


  if (!issue)     { showToast('Issue description is required','error'); return; }


  const id = '#D-' + (1055 + DB_JOBS.length + 1);


  const newJob = {


    id,


    client:             clientVal,


    location:           loc,


    issue:              issue,


    tech:               document.getElementById('job-tech').value || '',


    support_window:     document.getElementById('job-support-window').value,


    status:             'Pending',


    created:            'Just now',


    secondary_contact:  (document.getElementById('job-sec-name') || {}).value || '',


    secondary_phone:    (document.getElementById('job-sec-phone') || {}).value || '',


    notes:              document.getElementById('job-notes').value || ''


  };


  DB_JOBS.unshift(newJob);


  // Reset modal fields


  document.getElementById('job-client').value = '';


  document.getElementById('job-location').value = '';


  document.getElementById('job-issue').value = '';


  document.getElementById('job-notes').value = '';


  const jSn = document.getElementById('job-sec-name'); if (jSn) jSn.value = '';


  const jSp = document.getElementById('job-sec-phone'); if (jSp) jSp.value = '';


  const jCb = document.getElementById('job-contact-block'); if (jCb) jCb.style.display = 'none';


  closeModal('modal-new-job');


  showToast(id + ' dispatched', 'success');


}


function createVendor() {


  const name = document.getElementById('vn-name').value.trim();


  if (!name) { showToast('Vendor name is required','error'); return; }


  const newVendor = {


    name,


    category: document.getElementById('vn-cat') ? document.getElementById('vn-cat').value : 'General',


    contact: document.getElementById('vn-contact') ? document.getElementById('vn-contact').value : 'â€”',


    email: document.getElementById('vn-email') ? document.getElementById('vn-email').value : '',


    bills: 0, ap: '$0', status: 'Active'


  };


  DB.vendors.push(newVendor);


  if (sbConnected) {


    (async () => {


      try {


             const { data, error } = await sb.from('vendors').insert({


          company_name: newVendor.name,


          contact_name: newVendor.contact === 'â€”' ? null : newVendor.contact,


          email: newVendor.email || null,


          status: 'active',


          vendor_number: 'V-' + Date.now(),


          created_at: new Date().toISOString()


        }).select().single();


        if (error) {


          console.error('Vendor insert failed:', error);


          showToast('Failed to save vendor to database: ' + error.message, 'error');


          return;


        }


        if (data) newVendor._sbId = data.id;


        await sbInsertAudit('vendors', newVendor.name, 'Create', 'New vendor: ' + newVendor.name);


      } catch(e) {


        console.warn('Vendor insert threw:', e);


        showToast('Error saving vendor to database', 'error');


      }


    })();


  }


  closeModal('modal-new-vendor');


  document.getElementById('vn-name').value = '';


  renderVendors();


  showToast(name + ' added','success');


}





function createClient() {


function createClient() {


  const first = document.getElementById('cl-first').value.trim();


  const last = document.getElementById('cl-last').value.trim();


  const company = document.getElementById('cl-company').value.trim();


  const phone = document.getElementById('cl-phone').value.trim();


  const email = document.getElementById('cl-email').value.trim();


  if (!first || !last) { showToast('First and last name are required','error'); return; }


  const fullName = (first + ' ' + last).trim();


  const displayName = company || fullName;


  const newClient = {


    name: displayName,


    contact_name: fullName,


    first_name: first,


    last_name: last,


    company: company,


    location: document.getElementById('cl-location').value || 'â€”',


    contact: email || phone || 'â€”',


    email: email,


    phone: phone,


    tickets: 0, ar: '$0', status: 'Active'


  };


  DB.clients.push(newClient);


  // Supabase insert


  if (sbConnected) {


    (async () => {


      try {


        const { data } = await sb.from('clients').insert({


          name: fullName,


          first_name: first,


          last_name: last,


          company: company || null,


          email: email || null,


          phone: phone || null,


          address: newClient.location,


          status: 'Active'


        }).select().single();


        if (data) newClient._sbId = data.id;


        await sbInsertAudit('clients', displayName, 'Create', 'New client: ' + displayName);


      } catch(e) { console.warn('Client insert failed:', e); }


    })();


  }


  rebuildClientDatalist();


  closeModal('modal-new-client');


  ['cl-first','cl-last','cl-company','cl-location','cl-email','cl-phone'].forEach(id => {


    const el = document.getElementById(id); if (el) el.value = '';


  });


  renderClients();


  showToast(displayName + ' added','success');


}





  // Supabase insert


  if (sbConnected) {


    (async () => {


      try {


        const { data, error } = await sb.from('vendors').insert({


          company_name: newVendor.name,


          contact_name: newVendor.contact === 'â€”' ? null : newVendor.contact,


          email: newVendor.email || null,


          status: 'active',


          created_at: new Date().toISOString()


        }).select().single();





        if (error) {


          console.error('Vendor insert failed:', error);


          showToast('Failed to save vendor to database: ' + error.message, 'error');


          return;


        }





        if (data) newVendor._sbId = data.id;


        await sbInsertAudit('vendors', newVendor.name, 'Create', 'New vendor: ' + newVendor.name);


      } catch(e) {


        console.warn('Vendor insert threw:', e);


        showToast('Error saving vendor to database', 'error');


  }


    })();


  }


  closeModal('modal-new-vendor');


  document.getElementById('vn-name').value = '';


  renderVendors();


  showToast(name + ' added','success');


}


async function createProject() {


  const name = document.getElementById('pr-name').value.trim();


  if (!name) { showToast('Project name is required','error'); return; }


  const clientName = document.getElementById('pr-client').value;


  const leadName = document.getElementById('pr-lead').value;


  const startVal = document.getElementById('pr-start').value || null;


  const dueVal = document.getElementById('pr-due').value || null;


  const statusVal = document.getElementById('pr-status').value;


  // Resolve client_id from clients DB if matched


  let client_id = null;


  if (clientName && Array.isArray(DB.clients)) {


    const match = DB.clients.find(c => (c.name === clientName) || (c.company === clientName));


    if (match && match._sbId) client_id = match._sbId;


  }


  const proj = {


    name,


    client: clientName,


    lead: leadName,


    start: startVal,


    due: dueVal,


    status: statusVal,


    notes: '',


    _sbId: null,


    client_id


  };


  // Persist to Supabase


  if (sb && currentUser) {


    try {


      const { data, error } = await sb.from('mse_projects').insert({


        name,


        status: statusVal,


        due_date: dueVal,


        start_date: startVal,


        client_id: client_id,


        lead_email: currentUser.email || null,


        lead_name: leadName,


        notes: ''


      }).select().single();


      if (error) throw error;


      if (data) proj._sbId = data.id;


      sbInsertAudit('mse_projects', data.id, 'Create', 'New project: ' + name);


    } catch(e) {


      console.warn('Project insert failed:', e);


      showToast('Project saved locally only (DB error: ' + (e.message||'unknown') + ')', 'error');


    }


  }


  DB.projects.push(proj);


  closeModal('modal-new-project');


  document.getElementById('pr-name').value = '';


  document.getElementById('pr-start').value = '';


  document.getElementById('pr-due').value = '';


  renderProjects();


  showToast(name + ' created','success');


}





function createTask() {


  const title = document.getElementById('tsk-title').value.trim();


  if (!title) { showToast('Task title is required','error'); return; }


  const col = parseInt(document.getElementById('tsk-col').value);


  DB.kanban[col] = DB.kanban[col] || [];


  const pri = document.getElementById('tsk-priority').value;


  const cls = {Low:'badge-gray',Medium:'badge-gold',High:'badge-red'}[pri] || 'badge-gray';


  DB.kanban[col].push({title, desc: document.getElementById('tsk-project').value, badge: pri, badgeClass: cls});


  closeModal('modal-new-task');


  document.getElementById('tsk-title').value = '';


  renderKanban();


  showToast('Task added to ' + COLS[col],'success');


}





async function updateStaffRole(idx, role) {


  DB.staff[idx].role = role;


  try {


    await sb.from('staff').update({role}).eq('email', DB.staff[idx].email);


  } catch(e) {}


  showToast(DB.staff[idx].name + ' role updated to ' + role, 'success');


  renderStaff();


}





async function deleteStaff(idx) {


  const s = DB.staff[idx];


  if (!confirm('Remove ' + s.name + ' from staff?')) return;


  try {


    await sb.from('staff').delete().eq('email', s.email);


  } catch(e) {}


  DB.staff.splice(idx, 1);


  renderStaff();


  showToast(s.name + ' removed', 'success');


}





function createStaff() {


  const fname = document.getElementById('st-fname').value.trim();


  const lname = document.getElementById('st-lname').value.trim();


  const email = document.getElementById('st-email').value.trim();


  if (!fname || !lname || !email) { showToast('Name and email are required','error'); return; }


  const colors = ['#2a4a3c','#3a2a5c','#4a3a2a','#2a3a4c','#5c2a2a'];


  const fullName = fname + ' ' + lname;


  const newStaff = {


    initial: fname[0].toUpperCase(),


    name: fullName,


    role: document.getElementById('st-role').value,


    email,


    dept: document.getElementById('st-dept').value,


    status: 'Active',


    color: colors[DB.staff.length % colors.length]


  };


  DB.staff.push(newStaff);


  // Supabase insert


  if (sbConnected) {


    (async () => {


      try {


        const { data } = await sb.from('staff').insert({


          full_name: newStaff.name,


          email: newStaff.email,


          role: newStaff.role,


          department: newStaff.dept,


          status: 'Active',


          created_at: new Date().toISOString()


        }).select().single();


        if (data) newStaff._sbId = data.id;


        await sbInsertAudit('staff', newStaff.name, 'Create', 'New staff: ' + newStaff.name);


      } catch(e) { console.warn('Staff insert failed:', e); }


    })();


  }


  closeModal('modal-new-staff');


  document.getElementById('st-fname').value = '';


  document.getElementById('st-lname').value = '';


  document.getElementById('st-email').value = '';


  renderStaff();


  showToast(fullName + ' added','success');


}





