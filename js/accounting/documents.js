// ========== DOCUMENTS DATA & FUNCTIONS ==========


const DB_DOCS = [];





let activeDocTab = 'All';


let activeDocIdx = null;





function setDocTab(tab, btn) {


  activeDocTab = tab;


  document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active'));


  if (btn) btn.classList.add('active');


  renderDocs();


}





const docTypeBadge = { Invoice:'badge-blue', Contract:'badge-violet', 'Tax filing':'badge-green', 'Job form':'badge-gray', Receipt:'badge-gold', Other:'badge-gray' };





function renderDocs() {


  const body = document.getElementById('docs-body');


  if (!body) return;


  const search = (document.getElementById('docs-search')?.value || '').toLowerCase();


  const filtered = DB_DOCS.filter((d,i) => {


    if (activeDocTab !== 'All' && d.type !== activeDocTab) return false;


    if (search && !(d.name.toLowerCase().includes(search) || d.linked.toLowerCase().includes(search) || d.uploader.toLowerCase().includes(search))) return false;


    return true;


  });


  if (!filtered.length) { body.innerHTML = `<tr><td colspan="6"><div class="empty-state">No documents in this folder</div></td></tr>`; return; }


  body.innerHTML = filtered.map(d => {


    const idx = DB_DOCS.indexOf(d);


    return `<tr onclick="openDocViewPanel(${idx})" style="cursor:pointer">


      <td><strong>${esc(d.name)}</strong></td>


      <td><span class="badge ${docTypeBadge[d.type]||'badge-gray'}">${esc(d.type)}</span></td>


      <td>${esc(d.linked)}</td>


      <td>${esc(d.uploader)}</td>


      <td>${esc(d.date)}</td>


      <td onclick="event.stopPropagation()" style="display:flex;gap:5px;flex-wrap:wrap">


        <button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="event.stopPropagation();openDocViewPanel(${idx})">View</button>


        <button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="event.stopPropagation();docPrint(${idx})">Print</button>


        <button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="event.stopPropagation();docEmail(${idx})">Email</button>


        <button class="btn-danger" style="padding:5px 10px;font-size:12px" onclick="event.stopPropagation();deleteDoc(${idx})">Delete</button>


      </td>


    </tr>`;


  }).join('');


}





function openDocViewPanel(idx) {


  const d = DB_DOCS[idx];


  if (!d) return;


  activeDocIdx = idx;


  document.getElementById('dvp-name').textContent = d.name;


  document.getElementById('dvp-sub').textContent = d.type + ' · ' + d.date;


  document.getElementById('dvp-docname').value = d.name;


  const typeSel = document.getElementById('dvp-type');


  typeSel.value = d.type;


  document.getElementById('dvp-date').value = d.date;


  document.getElementById('dvp-linked').value = d.linked;


  document.getElementById('dvp-uploader').value = d.uploader;


  document.getElementById('dvp-notes').value = d.notes || '';


  document.getElementById('docViewOverlay').classList.add('open');


  document.getElementById('doc-view-panel').classList.add('open');


}





function closeDocViewPanel() {


  document.getElementById('docViewOverlay').classList.remove('open');


  document.getElementById('doc-view-panel').classList.remove('open');


  activeDocIdx = null;


}





function saveDocView() {


  showToast('Document metadata edits coming in Phase 2', 'info');


  closeDocViewPanel();


}





function dvpPrint() {


  const d = DB_DOCS[activeDocIdx];


  if (!d) return;


  const name = document.getElementById('dvp-docname').value || d.name;


  const win = window.open('','_blank','width=700,height=600');


  win.document.write(`<!DOCTYPE html><html><head><title>${name}</title><style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:20px;margin-bottom:8px}.meta{font-size:13px;color:#555;margin-bottom:24px}.label{font-size:11px;text-transform:uppercase;color:#999;font-weight:600;margin-bottom:4px}.field{margin-bottom:16px;font-size:14px}.notes{background:#f5f5f5;border-radius:6px;padding:12px;margin-top:8px;font-size:13px}.footer{margin-top:40px;border-top:1px solid #ddd;padding-top:12px;font-size:11px;color:#999;text-align:center}</style></head><body>`);


  win.document.write(`<h1>${name}</h1>`);


  win.document.write(`<div class="meta">${d.type} &bull; Uploaded by ${d.uploader} &bull; ${d.date}</div>`);


  win.document.write(`<div class="field"><div class="label">Linked To</div>${d.linked}</div>`);


  if (d.notes) win.document.write(`<div class="field"><div class="label">Notes</div><div class="notes">${d.notes}</div></div>`);


  win.document.write(`<div class="footer">MSE McGann Systems Engineering &bull; (508) 233-3565 &bull; cs@msetech.org</div>`);


  win.document.write('</body></html>');


  win.document.close();


  win.print();


}





function dvpEmail() {


  const d = DB_DOCS[activeDocIdx];


  if (!d) return;


  const name = document.getElementById('dvp-docname').value || d.name;


  window.open('mailto:?subject=' + encodeURIComponent(name) + '&body=' + encodeURIComponent('Please find attached: ' + name + '\n\nMSE McGann Systems Engineering\n(508) 233-3565\ncs@msetech.org'));


}





function docPrint(idx) {


  const savedIdx = activeDocIdx;


  activeDocIdx = idx;


  dvpPrint();


  activeDocIdx = savedIdx;


}





function docEmail(idx) {


  const d = DB_DOCS[idx];


  if (!d) return;


  window.open('mailto:?subject=' + encodeURIComponent(d.name) + '&body=' + encodeURIComponent('Please find attached: ' + d.name + '\n\nMSE McGann Systems Engineering\n(508) 233-3565\ncs@msetech.org'));


}





function deleteDoc(idx) {


  const d = DB_DOCS[idx];


  if (!d || !confirm('Delete "' + d.name + '"?')) return;


  DB_DOCS.splice(idx, 1);


  renderDocs();


  showToast(d.name + ' deleted', 'success');


}





function uploadDoc() {


  showToast('Document upload to master Documents view coming in Phase 2 — use entity-level uploads (clients, vendors, projects) for now which DO persist', 'info');


  closeModal('modal-upload-doc');


}





function deleteDocRow(btn) {


  const row = btn.closest('tr');


  const name = row?.cells[0]?.textContent;


  if (!name || !confirm('Delete ' + name + '?')) return;


  row.remove();


  showToast(name + ' deleted', 'success');


}





// ========== AR PANEL ==========


let activeARIdx = null;





function openARPanel(idx) {


  const inv = ACC.invoices[idx];


  if (!inv) return;


  activeARIdx = idx;


  document.getElementById('arp-id').textContent = inv.id;


  document.getElementById('arp-sub').textContent = inv.client + ' · ' + inv.status;


  document.getElementById('arp-invnum').value = inv.id;


  document.getElementById('arp-client').value = inv.client;


  document.getElementById('arp-amount').value = inv.amount;


  document.getElementById('arp-issued').value = inv.issued;


  document.getElementById('arp-due').value = inv.due;


  document.getElementById('arp-status').value = inv.status;


  document.getElementById('arp-notes').value = inv.notes || '';


  document.getElementById('arOverlay').classList.add('open');


  document.getElementById('ar-panel').classList.add('open');


}





function closeARPanel() {


  document.getElementById('arOverlay').classList.remove('open');


  document.getElementById('ar-panel').classList.remove('open');


  activeARIdx = null;


}





function saveARPanel() {


  showToast('A/R panel edits not persisted — invoice record management coming in Phase 2', 'info');


  closeARPanel();


}





function arPanelPrint() {


  const inv = ACC.invoices[activeARIdx];


  if (!inv) return;


  const win = window.open('','_blank','width=700,height=600');


  win.document.write(`<!DOCTYPE html><html><head><title>${inv.id}</title><style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:22px;margin-bottom:4px}.sub{color:#555;font-size:13px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px 12px;border:1px solid #ddd;font-size:13px}th{background:#f0f0f0;font-weight:600;text-align:left}.footer{margin-top:32px;font-size:11px;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:12px}</style></head><body>`);


  win.document.write(`<h1>Invoice ${inv.id}</h1><div class="sub">${inv.client} &bull; Issued: ${inv.issued} &bull; Due: ${inv.due}</div>`);


  win.document.write(`<table><tr><th>Field</th><th>Value</th></tr>`);


  win.document.write(`<tr><td>Amount</td><td>$${inv.amount.toFixed ? inv.amount.toFixed(2) : inv.amount}</td></tr>`);


  win.document.write(`<tr><td>Status</td><td>${inv.status}</td></tr>`);


  if (inv.notes) win.document.write(`<tr><td>Notes</td><td>${inv.notes}</td></tr>`);


  win.document.write(`</table>`);


  win.document.write(`<div class="footer">MSE McGann Systems Engineering &bull; (508) 233-3565 &bull; cs@msetech.org</div>`);


  win.document.write('</body></html>'); win.document.close(); win.print();


}





function arPanelEmail() {


  const inv = ACC.invoices[activeARIdx];


  if (!inv) return;


  window.open('mailto:?subject=' + encodeURIComponent('Invoice ' + inv.id + ' from MSE McGann Systems Engineering') + '&body=' + encodeURIComponent('Please find attached invoice ' + inv.id + ' for $' + inv.amount + '.\n\nDue: ' + inv.due + '\n\nMSE McGann Systems Engineering\n(508) 233-3565\ncs@msetech.org'));


}





// ========== AP PANEL ==========


let activeAPIdx = null;





function openAPPanel(idx) {


  const b = ACC.bills[idx];


  if (!b) return;


  activeAPIdx = idx;


  document.getElementById('app-id').textContent = b.id;


  document.getElementById('app-sub').textContent = b.vendor + ' · ' + b.status;


  document.getElementById('app-billnum').value = b.id;


  document.getElementById('app-vendor').value = b.vendor;


  document.getElementById('app-amount').value = b.amount;


  document.getElementById('app-due').value = b.due;


  document.getElementById('app-cat').value = b.cat || 'Connectivity';


  document.getElementById('app-status').value = b.status;


  document.getElementById('app-notes').value = b.notes || '';


  renderBillAttachment(b);


  const approveBtn = document.getElementById('app-approve-btn');


  const rejectBtn = document.getElementById('app-reject-btn');


  if (approveBtn) approveBtn.style.display = b.status === 'Awaiting Approval' ? '' : 'none';


  if (rejectBtn) rejectBtn.style.display = (b.status === 'Awaiting Approval' || b.status === 'Scheduled') ? '' : 'none';


  document.getElementById('apOverlay').classList.add('open');


  document.getElementById('ap-panel').classList.add('open');


}





function closeAPPanel() {


  document.getElementById('apOverlay').classList.remove('open');


  document.getElementById('ap-panel').classList.remove('open');


  activeAPIdx = null;


}








// ============================================================


// =========== BILL ATTACHMENTS (Supabase Storage) ============


// ============================================================


async function renderBillAttachment(b) {


  const display = document.getElementById('app-attachment-display');


  const controls = document.getElementById('app-attachment-controls');


  if (!display) return;


  if (b && b.attachment_path) {


    // Show file card with download + remove


    const sizeKB = b.attachment_size_bytes ? Math.round(b.attachment_size_bytes / 1024) : null;


    const sizeStr = sizeKB ? (sizeKB > 1024 ? (sizeKB/1024).toFixed(1) + ' MB' : sizeKB + ' KB') : '';


    display.innerHTML = `


      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px">


        <div style="flex:1;min-width:0">


          <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">


            \u{1F4C4} ${esc(b.attachment_filename || 'attachment')}


          </div>


          <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(sizeStr)}${b.attachment_uploaded_at ? ' \u00b7 uploaded ' + new Date(b.attachment_uploaded_at).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : ''}</div>


        </div>


        <button onclick="downloadBillAttachment()" style="background:var(--primary);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">View / Download</button>


        <button onclick="removeBillAttachment()" title="Remove attachment" style="background:transparent;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 4px">\u00d7</button>


      </div>`;


    if (controls) controls.style.display = 'none';


  } else {


    display.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0">No file attached yet.</div>';


    if (controls) controls.style.display = '';


  }


  const status = document.getElementById('app-upload-status');


  if (status) status.textContent = '';


}





async function uploadBillAttachment() {


  const b = ACC.bills[activeAPIdx];


  if (!b || !b._sbId) { showToast('Save the bill first before attaching files', 'error'); return; }


  const input = document.getElementById('app-file-input');


  const file = input.files && input.files[0];


  if (!file) return;


  if (file.size > 20 * 1024 * 1024) { showToast('File too large \u2014 max 20 MB', 'error'); input.value=''; return; }





  const status = document.getElementById('app-upload-status');


  const btn = document.getElementById('app-upload-btn');


  if (btn) btn.disabled = true;


  if (status) status.textContent = 'Uploading\u2026';





  try {


    // Build a stable path: bills/<bill_id>/<timestamp>_<sanitized-filename>


    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);


    const path = `${b._sbId}/${Date.now()}_${safeName}`;


    const { error: upErr } = await sb.storage.from('bills').upload(path, file, {


      contentType: file.type || 'application/octet-stream',


      upsert: false


    });


    if (upErr) throw upErr;





    // Update vendor_files row with attachment metadata


    const meta = {


      attachment_path: path,


      attachment_filename: file.name,


      attachment_mime: file.type || 'application/octet-stream',


      attachment_size_bytes: file.size,


      attachment_uploaded_at: new Date().toISOString(),


      attachment_uploaded_by: currentUser ? (currentUser.email || 'staff') : 'staff'


    };


    const { error: updErr } = await sb.from('vendor_files').update(meta).eq('id', b._sbId);


    if (updErr) throw updErr;





    // Reflect in local state + UI


    Object.assign(b, meta);


    renderBillAttachment(b);


    showToast('File uploaded', 'success');


    if (status) status.textContent = '';


    addAuditEntry((currentUser && currentUser.email) || 'staff', 'Upload', b.id, 'Attached file: ' + file.name);


  } catch(e) {


    console.warn('Bill attachment upload failed:', e);


    showToast('Upload failed: ' + (e.message || 'unknown'), 'error');


    if (status) status.textContent = 'Upload failed: ' + (e.message || 'unknown');


  } finally {


    if (btn) btn.disabled = false;


    input.value = '';


  }


}





async function downloadBillAttachment() {


  const b = ACC.bills[activeAPIdx];


  if (!b || !b.attachment_path) return;


  try {


    const { data, error } = await sb.storage.from('bills').createSignedUrl(b.attachment_path, 3600);


    if (error) throw error;


    if (data && data.signedUrl) {


      window.open(data.signedUrl, '_blank');


    } else {


      throw new Error('No signed URL returned');


    }


  } catch(e) {


    console.warn('Bill attachment download failed:', e);


    showToast('Could not open file: ' + (e.message || 'unknown'), 'error');


  }


}





async function removeBillAttachment() {


  const b = ACC.bills[activeAPIdx];


  if (!b || !b.attachment_path) return;


  if (!confirm(`Remove attached file "${b.attachment_filename || 'file'}"?\\n\\nThis cannot be undone.`)) return;


  const path = b.attachment_path;


  try {


    // Delete from storage


    await sb.storage.from('bills').remove([path]);


    // Clear DB columns


    const meta = {


      attachment_path: null,


      attachment_filename: null,


      attachment_mime: null,


      attachment_size_bytes: null,


      attachment_uploaded_at: null,


      attachment_uploaded_by: null


    };


    const { error } = await sb.from('vendor_files').update(meta).eq('id', b._sbId);


    if (error) throw error;


    Object.assign(b, meta);


    renderBillAttachment(b);


    showToast('Attachment removed', 'success');


    addAuditEntry((currentUser && currentUser.email) || 'staff', 'Delete', b.id, 'Removed attachment');


  } catch(e) {


    console.warn('Remove attachment failed:', e);


    showToast('Remove failed: ' + (e.message || 'unknown'), 'error');


  }


}








function saveAPPanel() {


  const b = ACC.bills[activeAPIdx];


  if (!b) return;


  b.vendor = document.getElementById('app-vendor').value;


  b.amount = parseFloat(document.getElementById('app-amount').value) || b.amount;


  b.due    = document.getElementById('app-due').value;


  b.cat    = document.getElementById('app-cat').value;


  b.status = document.getElementById('app-status').value;


  b.notes  = document.getElementById('app-notes').value;


  closeAPPanel();


  renderAP();


  showToast(b.id + ' saved', 'success');


  addAuditEntry('D. McGann', 'Edit', b.id, 'Bill updated via panel');


  // Persist to Supabase


  if (sb && sbConnected && b._sbId) {


    const dbStatus = b.status === 'Paid' ? 'paid' : b.status === 'Scheduled' ? 'filed' : 'pending';


    sb.from('vendor_files').update({


      amount: b.amount,


      status: dbStatus,


      notes: b.notes,


      updated_at: new Date().toISOString()


    }).eq('id', b._sbId)


      .then(({ error }) => { if (error) console.warn('saveAPPanel DB update failed:', error); });


  }


}





function apPanelApprove() {


  const b = ACC.bills[activeAPIdx];


  if (!b) return;


  b.status = 'Scheduled';


  document.getElementById('app-status').value = 'Scheduled';


  document.getElementById('app-approve-btn').style.display = 'none';


  showToast(b.id + ' approved and scheduled', 'success');


  addAuditEntry('D. McGann', 'Approve', b.id, 'Bill approved via panel');


  // Update Supabase


  if (sb && sbConnected && b._sbId) {


    sb.from('vendor_files').update({ status: 'filed', updated_at: new Date().toISOString() })


      .eq('id', b._sbId)


      .then(({ error }) => { if (error) console.warn('apPanelApprove DB update failed:', error); });


  }


}





function apPanelReject() {


  const b = ACC.bills[activeAPIdx];


  if (!b) return;


  b.status = 'Overdue';


  document.getElementById('app-status').value = 'Overdue';


  document.getElementById('app-reject-btn').style.display = 'none';


  showToast(b.id + ' rejected', 'success');


  addAuditEntry('D. McGann', 'Reject', b.id, 'Bill rejected via panel');


  // Update Supabase (set back to pending = rejected/needs re-review)


  if (sb && sbConnected && b._sbId) {


    sb.from('vendor_files').update({ status: 'pending', updated_at: new Date().toISOString() })


      .eq('id', b._sbId)


      .then(({ error }) => { if (error) console.warn('apPanelReject DB update failed:', error); });


  }


}





// ========== GL PANEL ==========


let activeGLIdx = null;





function openGLPanel(idx) {


  const e = ACC.glEntries[idx];


  if (!e) return;


  activeGLIdx = idx;


  document.getElementById('glp-id').textContent = e.ref;


  document.getElementById('glp-sub').textContent = e.acct + ' · ' + e.date;


  document.getElementById('glp-date').value = e.date;


  document.getElementById('glp-ref').value = e.ref;


  document.getElementById('glp-acct').value = e.acct;


  document.getElementById('glp-dr').value = e.dr !== '—' ? e.dr.replace(/[$,]/g,'') : '';


  document.getElementById('glp-cr').value = e.cr !== '—' ? e.cr.replace(/[$,]/g,'') : '';


  document.getElementById('glp-desc').value = e.desc;


  document.getElementById('glp-status').value = e.status;


  document.getElementById('glp-notes').value = e.notes || '';


  document.getElementById('glOverlay').classList.add('open');


  document.getElementById('gl-panel').classList.add('open');


}





function closeGLPanel() {


  document.getElementById('glOverlay').classList.remove('open');


  document.getElementById('gl-panel').classList.remove('open');


  activeGLIdx = null;


}





function saveGLPanel() {


  showToast('GL entry persistence coming in Phase 2', 'info');


  closeGLPanel();


}





// ========== BANK PANEL ==========


let activeBankIdx = null;





function openBankPanel(idx) {


  const t = ACC.bankTxns[idx];


  if (!t) return;


  activeBankIdx = idx;


  document.getElementById('bankp-id').textContent = t.desc;


  document.getElementById('bankp-sub').textContent = t.date + ' · ' + (t.amount >= 0 ? '+' : '') + '$' + Math.abs(t.amount);


  document.getElementById('bankp-date').value = t.date;


  document.getElementById('bankp-amount').value = t.amount;


  document.getElementById('bankp-desc').value = t.desc;


  document.getElementById('bankp-cat').value = t.cat;


  document.getElementById('bankp-status').value = t.status;


  document.getElementById('bankp-notes').value = t.notes || '';


  document.getElementById('bankOverlay').classList.add('open');


  document.getElementById('bank-panel').classList.add('open');


}





function closeBankPanel() {


  document.getElementById('bankOverlay').classList.remove('open');


  document.getElementById('bank-panel').classList.remove('open');


  activeBankIdx = null;


}





function saveBankPanel() {


  showToast('Bank transaction edits coming in Phase 2 — not persisted', 'info');


  closeBankPanel();


}





// ========== EXPENSE PANEL ==========


let activeExpIdx = null;





function openExpPanel(idx) {


  const e = ACC.expenses[idx];


  if (!e) return;


  activeExpIdx = idx;


  document.getElementById('expp-id').textContent = e.id || 'Expense';


  document.getElementById('expp-sub').textContent = e.staff + ' · ' + e.date;


  document.getElementById('expp-staff').value = e.staff;


  document.getElementById('expp-date').value = e.date;


  document.getElementById('expp-desc').value = e.desc;


  document.getElementById('expp-amount').value = e.amount;


  document.getElementById('expp-cat').value = e.cat;


  document.getElementById('expp-receipt').value = e.receipt;


  document.getElementById('expp-status').value = e.status;


  document.getElementById('expp-notes').value = e.notes || '';


  document.getElementById('expOverlay').classList.add('open');


  document.getElementById('exp-panel').classList.add('open');


}





function closeExpPanel() {


  document.getElementById('expOverlay').classList.remove('open');


  document.getElementById('exp-panel').classList.remove('open');


  activeExpIdx = null;


}





function saveExpPanel() {


  showToast('Expense edits coming in Phase 2 — not persisted', 'info');


  closeExpPanel();


}





function add1099Row() {


  const tbody = document.getElementById('tbl-1099-rows');


  if (!tbody) return;


  const tr = document.createElement('tr');


  tr.innerHTML = '<td><input style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);width:100%;font-family:inherit;font-size:13px;outline:none" placeholder="Contractor name"/></td><td><input style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);width:80px;font-family:inherit;font-size:13px;outline:none" placeholder="XX-XXXXX"/></td><td><input style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);width:80px;font-family:inherit;font-size:13px;outline:none" placeholder="$0.00"/></td><td><select style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;font-family:inherit"><option>Yes</option><option>No</option><option>Requested</option></select></td><td><select style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;font-family:inherit"><option>Yes</option><option>No</option></select></td>';


  tbody.appendChild(tr);


}





function addExpenseRow() {


  const tbody = document.getElementById('tbl-expense-rows');


  if (!tbody) return;


  const tr = document.createElement('tr');


  tr.innerHTML = '<td><input type="date" style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-family:inherit;font-size:13px;outline:none"/></td><td><input style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);width:100%;font-family:inherit;font-size:13px;outline:none" placeholder="Description"/></td><td><select style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;font-family:inherit"><option>Meals</option><option>Vehicle</option><option>Equipment</option><option>Travel</option><option>Other</option></select></td><td><input style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);width:70px;font-family:inherit;font-size:13px;outline:none" placeholder="$0.00"/></td><td><select style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;font-family:inherit"><option>Attached</option><option>Pending</option><option>N/A</option></select></td>';


  tbody.appendChild(tr);


}





function addQuickLink() {


  _quickLinks.push({label: '', url: ''});


  renderQuickLinks();


}





async function loadQuickLinks() {


  if (!sb) return;


  try {


    const { data, error } = await sb.from('quick_links').select('*').order('position', { ascending: true });


    if (error) throw error;


    _quickLinks = (data || []).map(r => ({ id: r.id, label: r.label || '', url: r.url || '' }));


    renderQuickLinks();


  } catch(e) { console.warn('Quick links load failed:', e); }


}





function openQuickLink(i) {


  const l = _quickLinks[i];


  const raw = (l && l.url || '').trim();


  if (!raw) { showToast('Add a URL first', 'info'); return; }


  let href = raw;


  if (!/^https?:\/\//i.test(href)) href = 'https://' + href;


  try {


    const u = new URL(href);


    if (!u.hostname) { showToast('Invalid URL', 'error'); return; }


    window.open(u.href, '_blank', 'noopener,noreferrer');


  } catch(e) {


    showToast('Invalid URL', 'error');


  }


}





function renderQuickLinks() {


  const wrap = document.getElementById('quicklinks-list');


  if (!wrap) return;


  if (!_quickLinks.length) {


    wrap.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:10px 0">No quick links yet. Click + Add Link below.</div>';


    return;


  }


  wrap.innerHTML = _quickLinks.map((l, i) => `


    <div class="fields-2" style="position:relative;align-items:flex-end;display:flex;gap:8px">


      <button onclick="openQuickLink(${i})" title="Open in new tab" aria-label="Open link in new tab" style="background:transparent;border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:16px;cursor:pointer;padding:6px 10px;height:38px;align-self:flex-end;flex:0 0 auto">↗</button>


      <div class="field" style="flex:1"><label>Label</label><input type="text" value="${esc(l.label)}" oninput="_quickLinks[${i}].label = this.value"/></div>


      <div class="field" style="display:flex;gap:8px;align-items:flex-end;flex:1">


        <div style="flex:1"><label>URL</label><input type="text" value="${esc(l.url)}" oninput="_quickLinks[${i}].url = this.value"/></div>


        <button onclick="removeQuickLink(${i})" title="Remove" style="background:transparent;border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:18px;cursor:pointer;padding:6px 10px;height:38px">×</button>


      </div>


    </div>`).join('');


}





function removeQuickLink(i) {


  _quickLinks.splice(i, 1);


  renderQuickLinks();


}





async function saveQuickLinks() {


  if (!sb) { showToast('Not connected', 'error'); return; }


  // Strategy: simple — delete all existing, insert current list.


  // (Quick links table is small; this avoids tracking individual diffs.)


  try {


    const { error: delErr } = await sb.from('quick_links').delete().gte('id', 0);


    if (delErr) throw delErr;


    const valid = _quickLinks.filter(l => l.label.trim() && l.url.trim());


    if (valid.length) {


      const rows = valid.map((l, i) => ({ label: l.label.trim(), url: l.url.trim(), position: i }));


      const { error: insErr } = await sb.from('quick_links').insert(rows);


      if (insErr) throw insErr;


    }


    showToast('Quick links saved', 'success');


    await loadQuickLinks();


  } catch(e) {


    console.warn('Quick links save failed:', e);


    showToast('Save failed: ' + (e.message || 'unknown'), 'error');


  }


}





let _quickLinks = [


  { label: 'Google Drive', url: 'https://drive.google.com' },


  { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard' },


  { label: 'MSE Tech Website', url: 'https://msetech.org' }


];





