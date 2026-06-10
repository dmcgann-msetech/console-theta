// ============================================================


// =========== DOCUMENTS PAGE — PDF / DOWNLOAD ================


// ============================================================


// Saved client_forms are HTML snapshots (storage object or rebuildable from


// form.data). We reuse the existing print pipeline (printHtmlDocument) so


// the user gets a Print dialog with "Save as PDF" — no extra JS libraries


// pulled in. Attachments are downloaded as their stored bytes; PDFs save as


// PDF, images/files save as the original. We never claim a conversion we


// don't perform.


async function downloadClientFormPdf(formId) {


  if (!sb) { showToast('Supabase not connected', 'error'); return; }


  try {


    const { data: form, error } = await sb.from('client_forms').select('*').eq('id', formId).single();


    if (error) throw error;


    const title = form.title || form.form_number || 'Document';





    let html = null;


    if (form.pdf_path) {


      try {


        const { data: blobData, error: dlErr } = await sb.storage.from(FORMS_BUCKET).download(form.pdf_path);


        if (dlErr) throw dlErr;


        html = await blobData.text();


      } catch (dlErr) {


        console.warn('downloadClientFormPdf: storage download failed, will rebuild:', dlErr);


      }


    }


    if (!html && form.data) {


      try {


        const snapshot = _buildSnapshotFromData(form);


        html = _buildPrintableFormHTML(snapshot, form.form_number || form.form_type, form.form_type);


      } catch (re) {


        console.warn('downloadClientFormPdf: rebuild from data failed:', re);


      }


    }


    if (!html) { showToast('No snapshot available to print', 'error'); return; }





    showToast('Opening Print dialog — choose "Save as PDF" to download', 'info');


    printHtmlDocument(html, title);


  } catch (e) {


    console.error('downloadClientFormPdf failed:', e);


    showToast('PDF export failed: ' + (e.message || 'unknown'), 'error');


  }


}





// Download an attachment's stored bytes. Works for PDFs, images, or any other


// uploaded file. We pull a Blob via storage.download() so we can force a


// real "save" (with the original filename) rather than relying on the


// browser's open-in-tab behavior for PDFs/images.


async function downloadAttachmentFile(id) {


  if (!sb) { showToast('Supabase not connected', 'error'); return; }


  const a = (_allDocuments || []).find(x => x._kind === 'attach' && String(x.id) === String(id));


  if (!a) { showToast('Attachment not found — try Refresh', 'error'); return; }





  // Drive-hosted legacy files: open the Drive viewer in a new tab. We can't


  // pull bytes through the Supabase client for those, and the viewer offers


  // its own Download action.


  const path = a.storage_path || a.path;


  if (!path && a.gdrive_file_id) {


    window.open('https://drive.google.com/file/d/' + encodeURIComponent(a.gdrive_file_id) + '/view', '_blank');


    return;


  }


  if (!path) { showToast('No file path on this attachment', 'error'); return; }





  const bucket = a.bucket || TICKET_ATT_BUCKET;


  try {


    const { data: blob, error } = await sb.storage.from(bucket).download(path);


    if (error) throw error;


    const url = URL.createObjectURL(blob);


    const link = document.createElement('a');


    link.href = url;


    // Prefer the stored filename, fall back to the storage object name.


    const filename = a.filename || a.name || (path.split('/').pop()) || 'download';


    link.download = filename;


    link.style.display = 'none';


    document.body.appendChild(link);


    link.click();


    // Clean up after the tap. Revoke on next tick so the browser has time to


    // start the download from the object URL.


    setTimeout(() => {


      try { document.body.removeChild(link); } catch(_) {}


      try { URL.revokeObjectURL(url); } catch(_) {}


    }, 1000);


  } catch (e) {


    console.warn('[documents] downloadAttachmentFile failed:', e);


    showToast('Download failed: ' + (e.message || 'unknown'), 'error');


  }


}





// ============================================================


// === ATTACH-TO-CLIENT (link existing client_forms rows) =====


// ============================================================


// Builds a lightweight overlay so users can pick an existing client and


// link a master Documents row (`client_forms.client_id`) to that client.


// No schema changes; storage files are untouched.


function _attachOverlayClose() {


  const ov = document.getElementById('attach-overlay');


  if (ov) ov.remove();


}





function _attachOverlayBuild(title, innerHtml) {


  _attachOverlayClose();


  const ov = document.createElement('div');


  ov.id = 'attach-overlay';


  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';


  ov.onclick = (e) => { if (e.target === ov) _attachOverlayClose(); };


  ov.innerHTML = `


    <div style="background:var(--surface,#1a1d24);color:var(--text,#e6e8ec);border:1px solid var(--border,#2a2f3a);border-radius:14px;padding:18px;width:100%;max-width:480px;max-height:90vh;display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.5)">


      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">


        <strong style="font-size:15px">${esc(title)}</strong>


        <button onclick="_attachOverlayClose()" style="background:transparent;border:1px solid var(--border,#2a2f3a);color:var(--muted,#9aa3b2);border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer">Close</button>


      </div>


      <div style="flex:1;overflow:auto">${innerHtml}</div>


    </div>`;


  document.body.appendChild(ov);


  return ov;


}





// Master-side action: attach a single client_forms row to a chosen client.


async function openAttachFormToClient(formId) {


  if (!sb) { showToast('Supabase not connected', 'error'); return; }


  try {


    const { data: form, error } = await sb.from('client_forms')


      .select('id, client_id, form_number, form_type, title')


      .eq('id', formId).single();


    if (error) throw error;





    // If already attached, ask before reassigning.


    if (form.client_id) {


      const ok = confirm('This document is already attached to a client. Reassign it to a different client?');


      if (!ok) return;


    }





    const clients = Array.isArray(DB.clients) ? DB.clients.filter(c => c && c._sbId) : [];


    if (!clients.length) { showToast('No clients loaded', 'error'); return; }





    const opts = clients


      .slice()


      .sort((a,b) => ((a.company||a.name||'').localeCompare(b.company||b.name||'')))


      .map(c => `<option value="${esc(c._sbId)}">${esc(c.company || c.name || '(unnamed)')}${c.company && c.name && c.company!==c.name ? ' — ' + esc(c.name) : ''}</option>`)


      .join('');





    const label = (form.form_number || form.title || form.form_type || ('#' + form.id));


    _attachOverlayBuild('Attach to Client', `


      <div style="font-size:13px;color:var(--muted,#9aa3b2);margin-bottom:10px">Choose a client to link <strong style="color:var(--text,#e6e8ec)">${esc(label)}</strong> to.</div>


      <select id="attach-client-select" style="width:100%;background:var(--surface2,#0f1218);border:1px solid var(--border,#2a2f3a);border-radius:10px;padding:10px 12px;color:var(--text,#e6e8ec);font-size:14px;font-family:inherit;outline:none">


        


        


      </select>


      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">


        <button onclick="_attachOverlayClose()" style="background:transparent;border:1px solid var(--border,#2a2f3a);color:var(--muted,#9aa3b2);border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit">Cancel</button>


        <button onclick="_confirmAttachFormToClient(${form.id})" style="background:var(--primary,#3b82f6);border:none;color:#fff;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:600;font-family:inherit">Attach</button>


      </div>


    `);


  } catch(e) {


    console.warn('openAttachFormToClient failed:', e);


    showToast('Attach failed: ' + (e.message||'unknown'), 'error');


  }


}





async function _confirmAttachFormToClient(formId) {


  const sel = document.getElementById('attach-client-select');


  const clientSbId = sel ? sel.value : '';


  if (!clientSbId) { showToast('Pick a client first', 'error'); return; }


  const client = (DB.clients || []).find(c => c && c._sbId === clientSbId);


  if (!client) { showToast('Client not found', 'error'); return; }


  try {


    const { data: form, error: fErr } = await sb.from('client_forms')


      .select('id, client_id, form_number, form_type, title, data')


      .eq('id', formId).single();


    if (fErr) throw fErr;





    const clientName = client.company || client.name || '';


    const update = { client_id: clientSbId };





    // Preserve existing document content; only refresh title/client name fields


    // when the title clearly lacks a client suffix or the data has no client name set.


    const num = form.form_number || '';


    if (clientName) {


      const t = (form.title || '').trim();


      if (!t || (num && t === num) || !/[—\-]/.test(t)) {


        update.title = (num ? num + ' — ' : '') + clientName;


      }


      // Only fill blank client-name slots in data; never overwrite filled values.


      if (form.data && typeof form.data === 'object') {


        const d = { ...form.data };


        let changed = false;


        const blanks = ['client', 'client-name', 'clientname', 'bill-to', 'billto', 'customer', 'customer-name'];


        for (const key of Object.keys(d)) {


          const lk = key.toLowerCase();


          if (blanks.some(b => lk === b || lk.endsWith('-' + b) || lk.endsWith('_' + b))) {


            if (!d[key] || String(d[key]).trim() === '') { d[key] = clientName; changed = true; }


          }


        }


        if (changed) update.data = d;


      }


    }





    const { error } = await sb.from('client_forms').update(update).eq('id', formId);


    if (error) throw error;





    try { await sbInsertAudit('client_forms', formId, 'Attach', 'Attached to ' + clientName); } catch(e) { /* non-fatal */ }





    _attachOverlayClose();


    showToast('Attached to ' + clientName, 'success');





    // Refresh master list + (if open) the affected client's panel list


    if (typeof loadAllDocuments === 'function') await loadAllDocuments();


    if (typeof loadClientForms === 'function') {


      await loadClientForms(clientSbId);


      if (form.client_id && form.client_id !== clientSbId) await loadClientForms(form.client_id);


    }


    if (typeof renderClientForms === 'function') renderClientForms();


  } catch(e) {


    console.warn('attach update failed:', e);


    showToast('Attach failed: ' + (e.message||'unknown'), 'error');


  }


}





// Client-panel action: pick an existing document NOT already on this client and attach it.


async function openAttachExistingDocToClient() {


  if (!sb) { showToast('Supabase not connected', 'error'); return; }


  const c = (typeof activeClientIdx !== 'undefined' && activeClientIdx !== null) ? DB.clients[activeClientIdx] : null;


  if (!c || !c._sbId) { showToast('Open a client first', 'error'); return; }


  try {


    const { data: rows, error } = await sb.from('client_forms')


      .select('id, client_id, form_number, form_type, title, form_date, created_at, amount')


      .order('created_at', { ascending: false });


    if (error) throw error;





    // Candidates: not already attached to THIS client. Includes unattached + other-client rows.


    const candidates = (rows || []).filter(r => r.client_id !== c._sbId);


    if (!candidates.length) {


      _attachOverlayBuild('Attach Existing Document', `


        <div style="font-size:13px;color:var(--muted,#9aa3b2);padding:16px 0">No other documents available to attach.</div>


        <div style="display:flex;justify-content:flex-end"><button onclick="_attachOverlayClose()" style="background:var(--primary,#3b82f6);border:none;color:#fff;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:600;font-family:inherit">OK</button></div>


      `);


      return;


    }





    const opts = candidates.map(r => {


      const dt = r.form_date || r.created_at;


      const d = dt ? new Date(dt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';


      const tag = r.client_id ? ' (currently attached)' : ' (unattached)';


      const lbl = (r.form_number || r.title || r.form_type || ('#' + r.id)) + ' — ' + (r.form_type || '') + (d ? ' — ' + d : '') + tag;


      return `<option value="${esc(r.id)}">${esc(lbl)}</option>`;


    }).join('');





    const cName = c.company || c.name || 'this client';


    _attachOverlayBuild('Attach Existing Document', `


      <div style="font-size:13px;color:var(--muted,#9aa3b2);margin-bottom:10px">Pick a document to attach to <strong style="color:var(--text,#e6e8ec)">${esc(cName)}</strong>.</div>


      <select id="attach-doc-select" size="10" style="width:100%;background:var(--surface2,#0f1218);border:1px solid var(--border,#2a2f3a);border-radius:10px;padding:8px;color:var(--text,#e6e8ec);font-size:13px;font-family:inherit;outline:none;min-height:240px">


        


      </select>


      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">


        <button onclick="_attachOverlayClose()" style="background:transparent;border:1px solid var(--border,#2a2f3a);color:var(--muted,#9aa3b2);border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit">Cancel</button>


        <button onclick="_confirmAttachExistingDocToClient()" style="background:var(--primary,#3b82f6);border:none;color:#fff;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:600;font-family:inherit">Attach</button>


      </div>


    `);


  } catch(e) {


    console.warn('openAttachExistingDocToClient failed:', e);


    showToast('Could not load documents: ' + (e.message||'unknown'), 'error');


  }


}





async function _confirmAttachExistingDocToClient() {


  const c = (typeof activeClientIdx !== 'undefined' && activeClientIdx !== null) ? DB.clients[activeClientIdx] : null;


  if (!c || !c._sbId) { showToast('Open a client first', 'error'); return; }


  const sel = document.getElementById('attach-doc-select');


  const formId = sel ? parseInt(sel.value, 10) : NaN;


  if (!formId) { showToast('Pick a document first', 'error'); return; }


  try {


    const { data: form, error: fErr } = await sb.from('client_forms')


      .select('id, client_id, form_number, form_type, title, data')


      .eq('id', formId).single();


    if (fErr) throw fErr;





    if (form.client_id && form.client_id !== c._sbId) {


      if (!confirm('That document is already attached to another client. Reassign it to this client?')) return;


    }





    const clientName = c.company || c.name || '';


    const update = { client_id: c._sbId };


    const num = form.form_number || '';


    if (clientName) {


      const t = (form.title || '').trim();


      if (!t || (num && t === num) || !/[—\-]/.test(t)) {


        update.title = (num ? num + ' — ' : '') + clientName;


      }


      if (form.data && typeof form.data === 'object') {


        const d = { ...form.data };


        let changed = false;


        const blanks = ['client', 'client-name', 'clientname', 'bill-to', 'billto', 'customer', 'customer-name'];


        for (const key of Object.keys(d)) {


          const lk = key.toLowerCase();


          if (blanks.some(b => lk === b || lk.endsWith('-' + b) || lk.endsWith('_' + b))) {


            if (!d[key] || String(d[key]).trim() === '') { d[key] = clientName; changed = true; }


          }


        }


        if (changed) update.data = d;


      }


    }





    const { error } = await sb.from('client_forms').update(update).eq('id', formId);


    if (error) throw error;





    try { await sbInsertAudit('client_forms', formId, 'Attach', 'Attached to ' + clientName); } catch(e) { /* non-fatal */ }





    _attachOverlayClose();


    showToast('Attached to ' + clientName, 'success');





    if (typeof loadAllDocuments === 'function') await loadAllDocuments();


    if (typeof loadClientForms === 'function') {


      await loadClientForms(c._sbId);


      if (form.client_id && form.client_id !== c._sbId) await loadClientForms(form.client_id);


    }


    if (typeof renderClientForms === 'function') renderClientForms();


  } catch(e) {


    console.warn('attach-existing update failed:', e);


    showToast('Attach failed: ' + (e.message||'unknown'), 'error');


  }


}








// ============================================================


// =========== DOCUMENTS PAGE (master list view) ==============


// ============================================================


let _allDocuments = [];





async function loadAllDocuments() {


  if (!sb) return false;


  try {


    // Fetch forms + clients (for parent name lookup)


    const [formsRes, clientsRes] = await Promise.all([


      sb.from('client_forms').select('*').order('created_at', { ascending: false }),


      sb.from('clients').select('id, name, company')


    ]);


    if (formsRes.error) throw formsRes.error;





    // Build a clients-by-id lookup for parent name


    const clientsById = {};


    (clientsRes.data || []).forEach(c => { clientsById[c.id] = c.company || c.name || ''; });





    // Normalize forms into the shape the render expects (type/number/parent_name/_kind)


    const forms = (formsRes.data || []).map(f => ({


      ...f,


      _kind: 'form',


      type: f.form_type,


      number: f.form_number,


      parent_name: f.client_id ? (clientsById[f.client_id] || '—') : '—',


      date: f.form_date || f.created_at,


    }));





    // Also fetch attachments if the table exists (parent_type/parent_id pattern)


    let attachments = [];


    try {


      const { data: atts } = await sb.from('attachments')


        .select('*').order('created_at', { ascending: false });


      if (atts) {


        attachments = atts.map(a => ({


          ...a,


          _kind: 'attach',


          type: 'attachment',


          number: a.filename || a.name || '—',


          parent_name: a.parent_type === 'client' && a.parent_id ? (clientsById[a.parent_id] || a.parent_type) : (a.parent_type || '—'),


          date: a.created_at,


          title: a.filename || a.name,


        }));


      }


    } catch(e) { /* attachments table may not exist yet */ }





    _allDocuments = [...forms, ...attachments].sort((a,b) =>


      new Date(b.date || b.created_at) - new Date(a.date || a.created_at)


    );


    renderAllDocuments();


    return true;


  } catch(e) {


    console.warn('Documents load failed:', e);


    showToast('Documents load failed: ' + (e.message||'unknown'), 'error');


    return false;


  }


}





// Refresh handler for the Documents page top-right button. Wraps


// loadAllDocuments() with disabled+spinner state and a success toast so the


// click is never silent — the previous wiring just called the async loader


// and the user couldn't tell whether anything had happened. Search and type


// filter survive automatically because renderAllDocuments() reads them from


// the DOM each time.


async function refreshAllDocuments(btn) {


  const el = btn || document.getElementById('docs-refresh-btn');


  const prev = el ? el.innerHTML : null;


  if (el) { el.disabled = true; el.innerHTML = 'Refreshing…'; }


  try {


    const ok = await loadAllDocuments();


    if (ok) showToast('Documents refreshed (' + _allDocuments.length + ')', 'success');


    // If !ok, loadAllDocuments() already toasted an error or sb was missing.


  } finally {


    if (el) { el.disabled = false; el.innerHTML = prev != null ? prev : 'Refresh'; }


  }


}





function renderAllDocuments() {


  const body = document.getElementById('docs-body');


  if (!body) return;


  if (!_allDocuments.length) {


    body.innerHTML = '<div class="empty-state" style="padding:30px;text-align:center;color:var(--muted)">No documents yet — create an invoice or upload a file from any panel.</div>';


    return;


  }


  const search = (document.getElementById('docs-search')?.value || '').toLowerCase().trim();


  const typeFilter = document.getElementById('docs-type-filter')?.value || '';





  // Filter step


  let list = _allDocuments;


  if (search) list = list.filter(d =>


    (d.title||'').toLowerCase().includes(search) ||


    (d.number||'').toLowerCase().includes(search) ||


    (d.parent_name||'').toLowerCase().includes(search) ||


    (d.filename||'').toLowerCase().includes(search));


  if (typeFilter) list = list.filter(d => {


    const f = _docFolderFor(d);


    return f && f.key === typeFilter;


  });





  // Bucket into folders


  const buckets = Object.create(null);


  for (const d of list) {


    const f = _docFolderFor(d);


    if (!f) continue;


    (buckets[f.key] = buckets[f.key] || []).push(d);


  }





  // Render. Hide empty folders unless the user explicitly picked that folder


  // from the type dropdown (then show its empty state so the choice is visible).


  const html = DOCS_FOLDERS.map(f => {


    const rows = buckets[f.key] || [];


    if (!rows.length && typeFilter !== f.key) return '';


    const headerCount = rows.length


      ? '<span style="color:var(--muted);font-size:12px;font-weight:500">' + rows.length + '</span>'


      : '';


    const inner = rows.length


      ? rows.map(_docsRowHtml).join('')


      : '<div class="empty-state" style="padding:18px;text-align:center;color:var(--muted);font-size:13px;border-top:1px solid var(--border)">No matching documents in this folder.</div>';


    return '<details class="docs-folder" open style="border:1px solid var(--border);border-radius:8px;margin-bottom:10px">'


      + '<summary style="padding:10px 12px;font-weight:700;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px">'


      + '<span style="font-size:16px">' + f.icon + '</span>'


      + '<span style="flex:1">' + esc(f.label) + '</span>'


      + headerCount


      + '</summary>'


      + inner


      + '</details>';


  }).filter(Boolean).join('');





  body.innerHTML = html || '<div class="empty-state" style="padding:30px;text-align:center;color:var(--muted)">No documents match the current search/filter.</div>';


}





// Folder definitions for the Documents page. Order here = display order.


// `match(d)` returns true for docs that belong in this folder. Driven by the


// normalized doc shape produced by loadAllDocuments() (_kind + type + mime).


const DOCS_FOLDERS = [


  { key:'invoice',        label:'Invoices',                icon:'\ud83d\udcb5', match:d => d._kind==='form' && d.type==='invoice' },


  { key:'receipt',        label:'Paid Receipts',           icon:'\ud83e\uddfe', match:d => d._kind==='form' && d.type==='receipt' },


  { key:'quote',          label:'Quotes',                  icon:'\ud83d\udcb2', match:d => d._kind==='form' && d.type==='quote' },


  { key:'workorder',      label:'Work Orders',             icon:'\ud83d\udd27', match:d => d._kind==='form' && d.type==='workorder' },


  { key:'servicerequest', label:'Service Requests',        icon:'\ud83d\udce5', match:d => d._kind==='form' && d.type==='servicerequest' },


  { key:'changeorder',    label:'Change Orders',           icon:'\ud83d\udd04', match:d => d._kind==='form' && d.type==='changeorder' },


  { key:'proposal',       label:'Proposals',               icon:'\ud83d\udcd1', match:d => d._kind==='form' && d.type==='proposal' },


  { key:'consultation',   label:'Consultations',           icon:'\ud83d\udcac', match:d => d._kind==='form' && d.type==='consultation' },


  { key:'diagnostic',     label:'Diagnostics',             icon:'\ud83d\udd0d', match:d => d._kind==='form' && d.type==='diagnostic' },


  { key:'signoff',        label:'Sign-offs',               icon:'\u2705',       match:d => d._kind==='form' && d.type==='signoff' },


  { key:'terms',          label:'Terms',                   icon:'\ud83d\udcdc', match:d => d._kind==='form' && d.type==='terms' },


  { key:'intake',         label:'Intake',                  icon:'\ud83d\udcdd', match:d => d._kind==='form' && d.type==='intake' },


  { key:'photo',          label:'Photos / Images',         icon:'\ud83d\uddbc\ufe0f', match:d => d._kind==='attach' && _docIsImage(d) },


  { key:'file',           label:'Files / Other Documents', icon:'\ud83d\udcc1', match:d => d._kind==='attach' && !_docIsImage(d) },


];





function _docIsImage(d) {


  const m = (d.mime || d.mime_type || '').toLowerCase();


  if (m.startsWith('image/')) return true;


  const fn = (d.filename || d.name || d.title || '').toLowerCase();


  return /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)$/.test(fn);


}





function _docFolderFor(d) {


  for (const f of DOCS_FOLDERS) { if (f.match(d)) return f; }


  // Unknown form types fall through to "Files / Other Documents" so we never drop a row.


  return DOCS_FOLDERS.find(f => f.key === 'file');


}





function _docsRowHtml(d) {


  const dtRaw = d.date || d.created_at;


  const dt = dtRaw ? new Date(dtRaw).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';


  const amt = d.amount ? '$' + parseFloat(d.amount).toLocaleString('en-US', {minimumFractionDigits:2}) : '';


  const parent = d.parent_name || '';


  const viewFn = d._kind === 'form' ? 'viewClientForm' : 'viewAttachment';


  const delFn  = d._kind === 'form' ? 'deleteClientForm' : 'deleteAttachment';


  // PDF action — saved client_forms render through the existing print-to-PDF


  // pipeline (popup + browser Print dialog → "Save as PDF"). Attachments that


  // are already PDFs download the stored file. Other attachments (images,


  // misc files) download the original bytes; we label the button "Download"


  // in that case to avoid claiming a format conversion we don't perform.


  const isPdfAttach = d._kind === 'attach' && (


    /pdf/i.test(d.mime || d.mime_type || '') ||


    /\.pdf$/i.test(d.filename || d.name || d.title || '')


  );


  const pdfFn = d._kind === 'form' ? 'downloadClientFormPdf' : 'downloadAttachmentFile';


  const pdfLabel = d._kind === 'form'


    ? 'PDF'


    : (isPdfAttach ? 'PDF' : 'Download');


  const pdfTitle = d._kind === 'form'


    ? 'Open Print dialog to save this document as a PDF'


    : (isPdfAttach ? 'Download the PDF file' : 'Download the original file');


  // Match the existing View/Edit pattern: id is interpolated bare. The site's


  // attachments/forms use numeric IDs in the row markup (UUID rows would


  // already break View/Edit before this change), so this stays consistent.


  const pdfBtn = '<button onclick="' + pdfFn + '(' + d.id + ')" title="' + pdfTitle + '" style="background:transparent;border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">' + pdfLabel + '</button>';


  const paidBadge = (d.status === 'paid')


    ? ' <span class="badge badge-green" style="font-size:10px;margin-left:6px;vertical-align:middle">PAID</span>'


    : '';


  const title = esc(d.number || d.title || d.filename || d.type || 'Untitled');


  const metaParts = [];


  if (parent) metaParts.push(esc(parent));


  if (dt)     metaParts.push(esc(dt));


  if (amt)    metaParts.push(esc(amt));


  // Show category as part of the meta line for attachments so reclassification


  // is visible immediately after Save without leaving the Documents page.


  if (d._kind === 'attach' && d.category) metaParts.push(esc(d.category));


  const meta = metaParts.join(' \u00b7 ');


  // Notes line for attachments \u2014 description added during upload or via the


  // new Edit Details modal. Skip when notes simply duplicates category (older


  // rows persisted that pattern).


  const noteText = (d._kind === 'attach' && d.notes && d.notes !== d.category) ? d.notes : '';


  const formExtras = d._kind === 'form'


    ? '<button onclick="editClientForm(' + d.id + ')" title="Edit this document" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit">Edit</button>'


      + '<button onclick="regenerateClientForm(' + d.id + ')" title="Regenerate snapshot with current letterhead template" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">\u267b</button>'


      + '<button onclick="openAttachFormToClient(' + d.id + ')" title="' + (d.client_id ? 'Reassign to a different client' : 'Attach to a client') + '" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">\ud83d\udcce</button>'


    : '';


  // Edit Details button for attachments \u2014 opens the metadata edit modal so


  // staff can fix a wrongly-classified photo or add a description note.


  const attachExtras = d._kind === 'attach'


    ? '<button onclick="openEditAttachment(' + d.id + ')" title="Edit category and notes" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit">Edit</button>'


    : '';


  return '<div class="docs-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--border);flex-wrap:wrap">'


    +   '<div style="flex:1;min-width:180px">'


    +     '<div style="font-weight:600">' + title + paidBadge + '</div>'


    +     (meta ? '<div style="color:var(--muted);font-size:12px;margin-top:2px">' + meta + '</div>' : '')


    +     (noteText ? '<div style="color:var(--text);font-size:12px;margin-top:4px;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.35">' + esc(noteText) + '</div>' : '')


    +   '</div>'


    +   '<div style="display:flex;gap:4px;flex-wrap:wrap">'


    +     '<button onclick="' + viewFn + '(' + d.id + ')" style="background:var(--primary);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">View</button>'


    +     pdfBtn


    +     formExtras


    +     attachExtras


    +     '<button onclick="' + delFn + '(' + d.id + ')" title="Delete" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">\u00d7</button>'


    +   '</div>'


    + '</div>';


}





// Open the Edit Attachment Details modal pre-populated with the row's current


// category and notes. The id may be numeric or string (UUID), so look it up


// against the loaded _allDocuments cache by string equality.


function openEditAttachment(id) {


  const d = (_allDocuments || []).find(x => x._kind === 'attach' && String(x.id) === String(id));


  if (!d) { showToast('Attachment not found \u2014 try Refresh', 'error'); return; }


  const idEl  = document.getElementById('edit-att-id');


  const fnEl  = document.getElementById('edit-att-filename');


  const catEl = document.getElementById('edit-att-category');


  const ntEl  = document.getElementById('edit-att-notes');


  if (idEl)  idEl.value = String(d.id);


  if (fnEl)  fnEl.textContent = d.filename || d.name || d.title || '';


  if (catEl) {


    const cat = d.category || 'Other';


    // If the stored category is something we don't have in the dropdown


    // (legacy data), inject it as a one-off option so we don't silently


    // overwrite it on save.


    const known = ['Evidence','Site Requirement','Parts Receipt','Invoice','Other'];


    [...catEl.options].filter(o => !known.includes(o.value)).forEach(o => o.remove());


    if (!known.includes(cat)) {


      const opt = document.createElement('option');


      opt.value = cat; opt.textContent = cat + ' (current)';


      catEl.appendChild(opt);


    }


    catEl.value = cat;


  }


  if (ntEl) ntEl.value = d.notes || '';


  if (typeof openModal === 'function') openModal('modal-edit-attachment');


  else { const el = document.getElementById('modal-edit-attachment'); if (el) el.classList.add('open'); }


}





// Persist category + notes back to the attachments row, refresh the local


// cache, and re-render so the reclassification (and any new notes line) is


// visible immediately. Storage object is intentionally untouched.


async function saveEditAttachment() {


  if (!sb) { showToast('Not connected to Supabase', 'error'); return; }


  const idEl  = document.getElementById('edit-att-id');


  const catEl = document.getElementById('edit-att-category');


  const ntEl  = document.getElementById('edit-att-notes');


  const id    = idEl ? idEl.value : '';


  if (!id) { showToast('No attachment selected', 'error'); return; }


  const category = catEl ? catEl.value : '';


  const notes    = ntEl && ntEl.value ? ntEl.value.trim() : '';


  try {


    const payload = { category: category || null, notes: notes || null };


    const { data, error } = await sb.from('attachments').update(payload).eq('id', id).select().single();


    if (error) throw error;


    // Update the in-memory row so renderAllDocuments reflects the change


    // without a round-trip. Fall back to reload if we can't find it.


    const idx = (_allDocuments || []).findIndex(x => x._kind === 'attach' && String(x.id) === String(id));


    if (idx !== -1 && data) {


      _allDocuments[idx] = { ..._allDocuments[idx], ...data, _kind: 'attach' };


      renderAllDocuments();


    } else if (typeof loadAllDocuments === 'function') {


      await loadAllDocuments();


    }


    if (typeof closeModal === 'function') closeModal('modal-edit-attachment');


    else { const el = document.getElementById('modal-edit-attachment'); if (el) el.classList.remove('open'); }


    showToast('Attachment details saved', 'success');


  } catch(e) {


    console.warn('saveEditAttachment failed:', e);


    showToast('Save failed: ' + (e.message || 'unknown'), 'error');


  }


}





// ========== FORM TEMPLATES ==========


// Auto-number counters (starting at 0005)


const formCounters = {


  invoice: 5, quote: 5, workorder: 5, changeorder: 5,


  proposal: 5, consultation: 5, diagnostic: 5, signoff: 5,


  receipt: 5, servicerequest: 5, terms: 5


};





const formMeta = {


  'modal-form-invoice':      { key:'invoice',      prefix:'MSE-INV', numEl:'inv-no',  docNum:'inv-doc-num',  dateEl:'inv-date',  table:'inv-items',   totals:'inv' },


  'modal-form-quote':        { key:'quote',         prefix:'MSE-Q',   numEl:'quote-no',docNum:'quote-doc-num',dateEl:'quote-date',table:'quote-items', totals:'quote' },


  'modal-form-workorder':    { key:'workorder',     prefix:'MSE-WO',  numEl:'wo-no',   docNum:'wo-doc-num',   dateEl:'wo-date',   table:null,          totals:null },


  'modal-form-changeorder':  { key:'changeorder',   prefix:'MSE-CO',  numEl:'co-no',   docNum:'co-doc-num',   dateEl:'co-date',   table:'co-items',    totals:null },


  'modal-form-proposal':     { key:'proposal',      prefix:'MSE-PP',  numEl:'pp-no',   docNum:'pp-doc-num',   dateEl:'pp-date',   table:'pp-items',    totals:'pp' },


  'modal-form-consultation': { key:'consultation',  prefix:'MSE-CS',  numEl:'cs-no',   docNum:'cs-doc-num',   dateEl:'cs-date',   table:null,          totals:null },


  'modal-form-diagnostic':   { key:'diagnostic',    prefix:'MSE-DR',  numEl:'dr-no',   docNum:'dr-doc-num',   dateEl:'dr-date',   table:null,          totals:null },


  'modal-form-signoff':      { key:'signoff',       prefix:'MSE-CF',  numEl:'cf-no',   docNum:'cf-doc-num',   dateEl:'cf-date',   table:null,          totals:null },


  'modal-form-receipt':      { key:'receipt',       prefix:'MSE-PR',  numEl:'pr-no',   docNum:'pr-doc-num',   dateEl:'pr-date',   table:null,          totals:null },


  'modal-form-servicerequest':{ key:'servicerequest',prefix:'MSE-SR', numEl:'sr-no',   docNum:'sr-doc-num',   dateEl:'sr-date',   table:null,          totals:null },


  'modal-form-terms':        { key:'terms',         prefix:'MSE-TC',  numEl:'tc-no',   docNum:'tc-doc-num',   dateEl:'tc-date',   table:null,          totals:null },


};





// Patch openModal to initialize form fields when form modals open


const _origOpenModal2 = window.openModal;


window.openModal = function(id) {


  if (formMeta[id]) initFormModal(id);


  if (typeof _origOpenModal2 === 'function') _origOpenModal2(id);


  else { const el = document.getElementById(id); if(el) el.classList.add('open'); }


};





// Sentinel value displayed in the number field for a brand-new, unsaved form.


// saveCurrentForm() detects this and sends form_number: null so the


// Supabase trigger mse_assign_client_form_number() assigns the real number.


const FORM_NUMBER_PLACEHOLDER = 'Auto-generated on save';





// Compute the next display number for a given form key by scanning


// already-loaded forms (DB.clients-side cache + _allDocuments). Pure


// display only — the DB trigger remains authoritative.


function _nextFormNumberForKey(key, prefix) {


  let max = 0;


  const re = new RegExp('^' + prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '-(\\d+)$', 'i');


  const scan = (rows) => {


    if (!Array.isArray(rows)) return;


    for (const r of rows) {


      const fn = r && r.form_number;


      if (!fn) continue;


      const mm = String(fn).match(re);


      if (mm) {


        const n = parseInt(mm[1], 10);


        if (!isNaN(n) && n > max) max = n;


      }


    }


  };


  scan(_allDocuments);


  if (_clientFormsCache && typeof _clientFormsCache === 'object') {


    for (const k of Object.keys(_clientFormsCache)) scan(_clientFormsCache[k]);


  }


  return max + 1;


}





function initFormModal(id) {


  const m = formMeta[id];


  if (!m) return;


  // Always reset the number fields on open so a previously saved/opened


  // form does not leak its stale number (e.g. MSE-INV-0005) into the


  // next new form. The real number is assigned by the DB trigger on insert.


  const numEl = document.getElementById(m.numEl);


  if (numEl) {


    numEl.value = '';


    numEl.placeholder = FORM_NUMBER_PLACEHOLDER;


    delete numEl.dataset.initialized;


  }


  const docEl = document.getElementById(m.docNum);


  if (docEl) {


    // Best-effort preview of the next number; the saved row will overwrite this.


    const n = _nextFormNumberForKey(m.key, m.prefix);


    docEl.textContent = m.prefix + '-' + String(n).padStart(4,'0');


    delete docEl.dataset.initialized;


  }


  // today's date


  const dateEl = document.getElementById(m.dateEl);


  if (dateEl && !dateEl.value) {


    dateEl.value = new Date().toISOString().slice(0,10);


  }


}





// Currency formatter


function fmtCurrency(el) {


  let v = parseFloat(el.value.replace(/[^0-9.]/g,''));


  if (isNaN(v)) v = 0;


  el.value = '$' + v.toFixed(2);


}





// Calculate line items in a table


function calcLineItems(tableId) {


  const tbl = document.getElementById(tableId);


  if (!tbl) return;


  const rows = tbl.querySelectorAll('tbody tr');


  let sub = 0;


  rows.forEach(row => {


    const qtyEl = row.querySelector('.qty');


    const priceEl = row.querySelector('.unit-price');


    const amtEl = row.querySelector('.line-amt');


    if (!qtyEl || !priceEl || !amtEl) return;


    const qty = parseFloat(qtyEl.value) || 0;


    const price = parseFloat(priceEl.value.replace(/[^0-9.]/g,'')) || 0;


    const amt = qty * price;


    sub += amt;


    amtEl.value = '$' + amt.toFixed(2);


  });


  // find which totals prefix this table belongs to


  for (const [mid, meta] of Object.entries(formMeta)) {


    if (meta.table === tableId && meta.totals) {


      updateSubtotal(meta.totals, sub);


      break;


    }


  }


}





function updateSubtotal(prefix, sub) {


  const subEl = document.getElementById(prefix + '-subtotal');


  if (subEl) subEl.textContent = '$' + sub.toFixed(2);


  calcTotals(prefix);


}





function calcTotals(prefix) {


  const subEl = document.getElementById(prefix + '-subtotal');


  const taxPctEl = document.getElementById(prefix + '-tax-pct');


  const taxAmtEl = document.getElementById(prefix + '-tax-amt');


  const shipEl = document.getElementById(prefix + '-ship');


  const depositEl = document.getElementById(prefix + '-deposit');


  const totalEl = document.getElementById(prefix + '-total');


  if (!subEl || !totalEl) return;





  let sub = parseFloat(subEl.textContent.replace(/[^0-9.]/g,'')) || 0;


  let tax = 0, ship = 0, deposit = 0;





  if (taxPctEl && taxAmtEl) {


    tax = sub * (parseFloat(taxPctEl.value) || 0) / 100;


    taxAmtEl.textContent = '$' + tax.toFixed(2);


  }


  if (shipEl) ship = parseFloat(shipEl.value.replace(/[^0-9.]/g,'')) || 0;


  if (depositEl) deposit = parseFloat(depositEl.value.replace(/[^0-9.]/g,'')) || 0;





  const total = sub + tax + ship - deposit;


  totalEl.textContent = '$' + Math.max(0, total).toFixed(2);


}





// Add a new line-item row to a table


function addLineRow(tableId) {


  const tbl = document.getElementById(tableId);


  if (!tbl) return;


  const tbody = tbl.querySelector('tbody');


  const rowCount = tbody.querySelectorAll('tr').length + 1;


  // Clone structure from first row


  const firstRow = tbody.querySelector('tr');


  if (!firstRow) return;


  const newRow = firstRow.cloneNode(true);


  // Reset values


  newRow.querySelectorAll('input').forEach(inp => {


    if (inp.classList.contains('qty')) inp.value = '1';


    else if (inp.classList.contains('unit-price')) inp.value = '0.00';


    else if (inp.classList.contains('line-amt')) inp.value = '0.00';


    else if (inp.style.textAlign === 'center') inp.value = rowCount;


    else inp.value = '';


  });


  // Re-wire oninput for calc


  newRow.querySelectorAll('input').forEach(inp => {


    if (inp.classList.contains('qty') || inp.classList.contains('unit-price')) {


      inp.setAttribute('oninput', "calcLineItems('" + tableId + "')");


    }


    if (inp.classList.contains('unit-price') || inp.classList.contains('line-amt')) {


      if (!inp.classList.contains('line-amt')) {


        inp.setAttribute('onblur', "fmtCurrency(this)");


      }


    }


  });


  tbody.appendChild(newRow);


}





// Add generic row (for tables without auto-calc)


function addGenericRow(tableId, colCount) {


  const tbl = document.getElementById(tableId);


  if (!tbl) return;


  const tbody = tbl.querySelector('tbody');


  const firstRow = tbody.querySelector('tr');


  if (!firstRow) return;


  const newRow = firstRow.cloneNode(true);


  newRow.querySelectorAll('input').forEach(inp => { inp.value = ''; });


  tbody.appendChild(newRow);


}





// Add proposal phase row


function addProposalPhase() {


  const tbl = document.getElementById('proposal-timeline');


  if (!tbl) return;


  const tbody = tbl.querySelector('tbody');


  const phaseNum = tbody.querySelectorAll('tr').length + 1;


  const tr = document.createElement('tr');


  tr.innerHTML = '<td><input type="text" placeholder="Phase ' + phaseNum + '" style="width:100%"></td><td><input type="text" placeholder="Description" style="width:100%"></td><td><input type="text" placeholder="Duration" style="width:100%"></td><td><input type="date"></td><td><input type="date"></td>';


  tbody.appendChild(tr);


}





// ========== REPORTS ==========


function switchReportTab(tab) {


  document.querySelectorAll('.rpt-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));


  document.querySelectorAll('.rpt-section').forEach(s => s.style.display = s.id === 'rpt-' + tab ? '' : 'none');


  renderReports();


}











// ============================================================


// ============ FINANCIAL + COMPLIANCE REPORTS ================


// ============================================================


function renderFinancialReports() {


  const bills = (typeof ACC !== 'undefined' && ACC.bills) ? ACC.bills : [];





  // A/P Due Report — pulls from ACC.bills (vendor_files)


  const apBody = document.getElementById('rpt-ap-body');


  if (apBody) {


    const dueBills = bills.filter(b => b.status !== 'Paid');


    apBody.innerHTML = dueBills.length ? dueBills.map(b => {


      const amt = b.amount ? '$' + parseFloat(b.amount).toLocaleString('en-US', {minimumFractionDigits:2}) : '—';


      return `<tr><td>${esc(b.vendor || '—')}</td><td style="font-variant-numeric:tabular-nums">${amt}</td><td>${esc(b.due || '—')}</td><td>${esc(b.status || 'Pending')}</td></tr>`;


    }).join('') : '<tr><td colspan="4" class="empty-state">No outstanding bills</td></tr>';


  }





  // Expense Report by Staff — empty until expenses table is wired


  const expBody = document.getElementById('rpt-exp-body');


  if (expBody) {


    expBody.innerHTML = '<tr><td colspan="6" class="empty-state">No expense reports yet — build out the Expenses page first</td></tr>';


  }





  // P&L Summary — try to compute from bills; revenue still N/A until invoicing exists


  const elRev = document.getElementById('rpt-pl-rev');


  const elExp = document.getElementById('rpt-pl-exp');


  const elCos = document.getElementById('rpt-pl-cos');


  const elNet = document.getElementById('rpt-pl-net');


  if (elExp) {


    const totalExp = bills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);


    elExp.textContent = totalExp ? '$' + totalExp.toLocaleString('en-US', {minimumFractionDigits:2}) : '$0.00';


    if (elRev) elRev.textContent = '— (no invoicing yet)';


    if (elCos) elCos.textContent = '—';


    if (elNet) elNet.textContent = totalExp ? '-$' + totalExp.toLocaleString('en-US', {minimumFractionDigits:2}) : '$0.00';


  }





  // Revenue by Client — stays empty until invoicing exists (already has empty state)





  // A/R Aging — stays placeholder until invoicing exists


}





function renderComplianceReports() {


  // Audit trail — pull from ACC.auditLog (loaded by loadAuditLogFromSupabase)


  const auditBody = document.getElementById('rpt-audit-body');


  const log = (typeof ACC !== 'undefined' && ACC.auditLog) ? ACC.auditLog : [];


  if (auditBody) {


    auditBody.innerHTML = log.length ? log.slice(0, 50).map(a =>


      `<tr><td>${esc(a.time || '—')}</td><td>${esc(a.user || a.changed_by || 'staff')}</td><td>${esc(a.action || '—')}</td><td>${esc(a.record || a.table_name || '—')}</td><td style="color:var(--muted)">${esc(a.detail || a.note || '')}</td></tr>`


    ).join('') : '<tr><td colspan="6" class="empty-state">No audit entries yet</td></tr>';


  }





  // SLA Breach History — also has its own renderer (renderSLABreachReport), but


  // make sure empty state is set if no data


  const slaBody = document.getElementById('rpt-sla-breach-body');


  if (slaBody && !slaBody.innerHTML.trim()) {


    slaBody.innerHTML = '<tr><td colspan="6" class="empty-state">No SLA breaches recorded</td></tr>';


  }





  // 1099 Contractor Summary — empty until contractor table exists


  const c1099 = document.getElementById('rpt-1099-body');


  if (c1099) {


    c1099.innerHTML = '<tr><td colspan="6" class="empty-state">No contractor data yet — add 1099 contractors to surface here</td></tr>';


  }


}





function renderReports() {


  renderOpsReports();


  renderStaffReports();


  renderClientReports();


  renderSLABreachReport();


  renderFinancialReports();


  renderComplianceReports();


}





function renderOpsReports() {


  const tickets = DB.tickets || [];





  // Ticket volume by tech


  const techMap = {};


  tickets.forEach(t => {


    const k = t.assign || 'Unassigned';


    if (!techMap[k]) techMap[k] = {submitted:0, inprogress:0, resolved:0};


    const s = normalizeTicketStatus(t.status); if (s === TICKET_STATUS.SUBMITTED || s === TICKET_STATUS.AWAITING_DISPATCH) techMap[k].submitted++;


    else if (isTicketInProgress(t.status) || normalizeTicketStatus(t.status) === TICKET_STATUS.ASSIGNED) techMap[k].inprogress++;


    else if (isTicketClosed(s)) techMap[k].resolved++;


  });


  const tvBody = document.getElementById('rpt-tech-vol-body');


  if (tvBody) {


    tvBody.innerHTML = Object.keys(techMap).length ?


      Object.entries(techMap).map(([name, s]) =>


        `<tr><td>${esc(name)}</td><td>${s.submitted}</td><td>${s.inprogress}</td><td>${s.resolved}</td><td><strong>${s.submitted+s.inprogress+s.resolved}</strong></td></tr>`


      ).join('') : '<tr><td colspan="6" class="empty-state">No ticket data yet</td></tr>';


  }





  // Ticket volume by priority


  const priMap = {High:{open:0,inprogress:0,resolved:0}, Medium:{open:0,inprogress:0,resolved:0}, Low:{open:0,inprogress:0,resolved:0}};


  tickets.forEach(t => {


    const p = t.priority || 'Medium';


    if (!priMap[p]) priMap[p] = {open:0,inprogress:0,resolved:0};


    if (normalizeTicketStatus(t.status) === TICKET_STATUS.SUBMITTED || normalizeTicketStatus(t.status) === TICKET_STATUS.AWAITING_DISPATCH || normalizeTicketStatus(t.status) === TICKET_STATUS.ASSIGNED) priMap[p].open++;


    else if (isTicketInProgress(t.status)) priMap[p].inprogress++;


    else if (isTicketClosed(s)) priMap[p].resolved++;


  });


  const pvBody = document.getElementById('rpt-pri-vol-body');


  if (pvBody) {


    pvBody.innerHTML = Object.entries(priMap).map(([pri, s]) =>


      `<tr><td>${esc(pri)}</td><td>${s.open}</td><td>${s.inprogress}</td><td>${s.resolved}</td><td><strong>${s.open+s.inprogress+s.resolved}</strong></td></tr>`


    ).join('') || '<tr><td colspan="6" class="empty-state">No ticket data yet</td></tr>';


  }





  // Ticket volume by client


  const clientMap = {};


  tickets.forEach(t => {


    const k = t.client || 'Unknown';


    if (!clientMap[k]) clientMap[k] = {open:0, resolved:0};


    if (isTicketClosed(t.status)) clientMap[k].resolved++;


    else clientMap[k].open++;


  });


  const cvBody = document.getElementById('rpt-client-vol-body');


  if (cvBody) {


    cvBody.innerHTML = Object.keys(clientMap).length ?


      Object.entries(clientMap).map(([name, s]) =>


        `<tr><td>${esc(name)}</td><td>${s.open}</td><td>${s.resolved}</td><td><strong>${s.open+s.resolved}</strong></td></tr>`


      ).join('') : '<tr><td colspan="4" class="empty-state">No ticket data yet</td></tr>';


  }





  // Open vs resolved trend


  const trendBody = document.getElementById('rpt-trend-body');


  if (trendBody) {


    const open = tickets.filter(t => isTicketOpen(t.status)).length;


    const resolved = tickets.filter(t => isTicketClosed(t.status)).length;


    const total = tickets.length || 1;


    trendBody.innerHTML = tickets.length ?


      `<tr><td>Open</td><td>${open}</td><td>${Math.round(open/total*100)}%</td></tr>


       <tr><td>Resolved</td><td>${resolved}</td><td>${Math.round(closed/total*100)}%</td></tr>


       <tr style="font-weight:700"><td>Total</td><td>${tickets.length}</td><td>100%</td></tr>` :


      '<tr><td colspan="3" class="empty-state">No ticket data yet</td></tr>';


  }





  // SLA compliance by tech


  const slaMap = {};


  tickets.filter(t => t.started_at).forEach(t => {


    const k = t.assign || 'Unassigned';


    if (!slaMap[k]) slaMap[k] = {started:0, ontime:0, breached:0};


    slaMap[k].started++;


    const elapsed = Date.now() - new Date(t.started_at).getTime();


    const deadline = getSLAMs(t.priority);


    if (elapsed > deadline) slaMap[k].breached++;


    else slaMap[k].ontime++;


  });


  const scBody = document.getElementById('rpt-sla-comp-body');


  if (scBody) {


    scBody.innerHTML = Object.keys(slaMap).length ?


      Object.entries(slaMap).map(([name, s]) => {


        const pct = s.started ? Math.round(s.ontime/s.started*100) : 100;


        const cls = pct >= 90 ? 'up' : pct >= 70 ? 'warn' : 'down';


        return `<tr><td>${esc(name)}</td><td>${s.started}</td><td>${s.ontime}</td><td>${s.breached}</td><td class="${cls}">${pct}%</td></tr>`;


      }).join('') : '<tr><td colspan="6" class="empty-state">No SLA data yet — tickets must be started first</td></tr>';


  }





  // Dispatch completion


  const dispBody = document.getElementById('rpt-dispatch-body');


  if (dispBody) {


    const jobs = DB_JOBS || [];


    const jMap = {};


    jobs.forEach(j => {


      const k = j.tech || 'Unassigned';


      if (!jMap[k]) jMap[k] = {total:0, completed:0, pending:0};


      jMap[k].total++;


      if (j.status === 'Completed') jMap[k].completed++;


      else jMap[k].pending++;


    });


    dispBody.innerHTML = Object.keys(jMap).length ?


      Object.entries(jMap).map(([name, s]) => {


        const pct = s.total ? Math.round(s.completed/s.total*100) : 0;


        return `<tr><td>${esc(name)}</td><td>${s.total}</td><td>${s.completed}</td><td>${s.pending}</td><td>${pct}%</td></tr>`;


      }).join('') : '<tr><td colspan="6" class="empty-state">No dispatch data yet</td></tr>';


  }


}





function renderStaffReports() {


  const tickets = DB.tickets || [];


  const staff = DB.staff || STAFF_FALLBACK;





  // Tech productivity


  const prodBody = document.getElementById('rpt-tech-prod-body');


  if (prodBody) {


    prodBody.innerHTML = staff.length ? staff.map(s => {


      const myTickets = tickets.filter(t => t.assign === s.name);


      const closed = myTickets.filter(t => isTicketClosed(t.status)).length;


      const started = myTickets.filter(t => t.started_at).length;


      const breached = myTickets.filter(t => {


        if (!t.started_at) return false;


        return (Date.now() - new Date(t.started_at).getTime()) > getSLAMs(t.priority);


      }).length;


      const compliance = started ? Math.round((started-breached)/started*100) + '%' : 'N/A';


      const jobs = (DB_JOBS||[]).filter(j => j.tech === s.name && j.status === 'Completed').length;


      return `<tr><td>${esc(s.name)}</td><td>${resolved}</td><td>—</td><td>${jobs}</td><td>${compliance}</td></tr>`;


    }).join('') : '<tr><td colspan="6" class="empty-state">No staff data yet</td></tr>';


  }





  // Reimbursement summary — show empty until expense data is wired


  const reimbBody = document.getElementById('rpt-reimb-body');


  if (reimbBody) {


    reimbBody.innerHTML = '<tr><td colspan="6" class="empty-state">No expense reimbursement data yet</td></tr>';


  }


}





function renderClientReports() {


  const tickets = DB.tickets || [];


  const clients = DB.clients || [];





  // Populate client selects


  ['rpt-client-select','rpt-client-summary-select'].forEach(id => {


    const sel = document.getElementById(id);


    if (!sel) return;


    const first = sel.options[0];


    sel.innerHTML = '';


    sel.appendChild(first);


    clients.forEach(c => {


      const o = document.createElement('option');


      o.value = c.name; o.textContent = c.name;


      sel.appendChild(o);


    });


  });





  renderClientActivityReport();


}





function renderClientActivityReport() {


  const tickets = DB.tickets || [];


  const clients = DB.clients || [];


  const filter = (document.getElementById('rpt-client-select') || {}).value || '';


  const list = filter ? clients.filter(c => c.name === filter) : clients;


  const body = document.getElementById('rpt-client-activity-body');


  if (!body) return;


  body.innerHTML = list.length ? list.map(c => {


    const cTickets = tickets.filter(t => t.client === c.name);


    const open = cTickets.filter(t => isTicketOpen(t.status)).length;


    const resolved = cTickets.filter(t => isTicketClosed(t.status)).length;


    const jobs = (DB_JOBS||[]).filter(j => j.client === c.name && j.status !== 'Completed').length;


    return `<tr><td><strong>${esc(c.name)}</strong></td><td>${open}</td><td>${resolved}</td><td>${jobs}</td><td>—</td><td>${esc(c.ar||'$0')}</td></tr>`;


  }).join('') : '<tr><td colspan="6" class="empty-state">No client data yet</td></tr>';


}





function generateClientSummary() {


  const name = (document.getElementById('rpt-client-summary-select')||{}).value;


  const out = document.getElementById('rpt-client-summary-output');


  if (!out) return;


  if (!name) { out.textContent = 'Please select a client.'; return; }


  const c = DB.clients.find(x => x.name === name);


  const tickets = DB.tickets.filter(t => t.client === name);


  const open = tickets.filter(t => isTicketOpen(t.status)).length;


  const resolved = tickets.filter(t => isTicketClosed(t.status)).length;


  out.innerHTML = `


    <div style="font-weight:800;font-size:16px;margin-bottom:8px">${esc(name)} — Service Summary</div>


    <div style="color:var(--muted);font-size:13px;margin-bottom:16px">Generated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} by MSE McGann Systems Engineering</div>


    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">


      <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:14px"><div style="font-size:11px;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Open Tickets</div><div style="font-size:24px;font-weight:800">${open}</div></div>


      <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:14px"><div style="font-size:11px;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Resolved Tickets</div><div style="font-size:24px;font-weight:800">${resolved}</div></div>


    </div>


    <div style="margin-top:14px;font-size:13px;color:var(--muted)">Contact: ${esc(c?.contact||'—')} · Location: ${esc(c?.location||'—')} · A/R Balance: ${esc(c?.ar||'$0')}</div>


  `;


}





function renderSLABreachReport() {


  const body = document.getElementById('rpt-sla-breach-body');


  if (!body) return;


  const breached = (DB.tickets||[]).filter(t => {


    if (!t.started_at) return false;


    return (Date.now() - new Date(t.started_at).getTime()) > getSLAMs(t.priority);


  });


  body.innerHTML = breached.length ? breached.map(t => {


    const elapsed = Date.now() - new Date(t.started_at).getTime();


    const deadline = getSLAMs(t.priority);


    const over = formatDuration(elapsed - deadline);


    const limitHrs = {High:'4h', Medium:'24h', Low:'72h'}[t.priority] || '24h';


    return `<tr><td style="font-family:monospace">${esc(t.id)}</td><td>${esc(t.subject)}</td><td>${priorityBadge(t.priority)}</td><td>${esc(t.assign||'Unassigned')}</td><td>${limitHrs}</td><td style="color:#e87b87">${over} over</td></tr>`;


  }).join('') : '<tr><td colspan="6" class="empty-state">No SLA breaches — great work!</td></tr>';


}





function exportCSV(tableId) {


  const table = document.getElementById(tableId);


  if (!table) { showToast('No data to export', 'error'); return; }


  const rows = Array.from(table.querySelectorAll('tr'));


  const csv = rows.map(r =>


    Array.from(r.querySelectorAll('th,td')).map(c => '"' + c.textContent.replace(/"/g,'""').trim() + '"').join(',')


  ).join('\n');


  const blob = new Blob([csv], {type:'text/csv'});


  const a = document.createElement('a');


  a.href = URL.createObjectURL(blob);


  a.download = tableId + '-' + new Date().toISOString().slice(0,10) + '.csv';


  a.click();


  showToast('CSV exported', 'success');


}





function exportPDF(title) {


  const w = window.open('', '_blank');


  if (!w) { showToast('Allow popups to export PDF', 'error'); return; }


  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>


    body{font-family:Arial,sans-serif;padding:30px;color:#111}


    h1{font-size:20px;margin-bottom:4px}


    .sub{font-size:13px;color:#666;margin-bottom:20px}


    table{width:100%;border-collapse:collapse;font-size:13px}


    th{background:#222;color:#fff;padding:8px;text-align:left}


    td{padding:8px;border-bottom:1px solid #eee}


    .footer{margin-top:30px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px}


  </style></head><body>


    <h1>MSE McGann Systems Engineering</h1>


    <div class="sub">${title} · Generated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>


  `);


  // Copy the currently visible report tables


  const visible = document.querySelector('.rpt-section:not([style*="display:none"])');


  if (visible) w.document.write(visible.innerHTML);


  w.document.write('<div class="footer">MSE McGann Systems Engineering · (508) 233-3565 · cs@msetech.org · msetech.org</div></body></html>');


  w.document.close();


  w.print();


  showToast('PDF ready to print', 'success');


}





// Generate Report — refresh current tab data and open print-ready PDF


function generateReport() {


  // Refresh data first


  renderReports();


  // Find currently active tab


  const activeTab = document.querySelector('.rpt-tab.active');


  const tabName = activeTab ? activeTab.dataset.tab : 'operations';


  const tabLabel = activeTab ? activeTab.textContent.trim() : 'Operations';


  // Small delay to let DOM update


  setTimeout(() => {


    exportPDF(tabLabel + ' Report');


  }, 100);


}





// Export All Reports — combine all 5 tabs into one print-ready PDF


function exportAllReports() {


  // Refresh data


  renderReports();


  setTimeout(() => {


    const w = window.open('', '_blank');


    if (!w) { showToast('Allow popups to export PDF', 'error'); return; }


    const dateRange = (document.getElementById('rpt-from')?.value || '') + ' — ' + (document.getElementById('rpt-to')?.value || '');


    w.document.write(`<!DOCTYPE html><html><head><title>MSE Tech — All Reports</title><style>


      body{font-family:Arial,sans-serif;padding:30px;color:#111}


      h1{font-size:22px;margin-bottom:4px}


      h2{font-size:16px;margin-top:30px;padding-top:20px;border-top:2px solid #222;page-break-before:always}


      h2:first-of-type{page-break-before:auto;border-top:none;padding-top:0;margin-top:10px}


      .sub{font-size:13px;color:#666;margin-bottom:20px}


      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}


      th{background:#222;color:#fff;padding:8px;text-align:left}


      td{padding:8px;border-bottom:1px solid #eee}


      .card{margin-bottom:14px}


      .footer{margin-top:30px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px}


      .btns,.filter-bar,button{display:none !important}


    </style></head><body>


      <h1>MSE McGann Systems Engineering</h1>


      <div class="sub">Combined Report — All Sections · Generated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}${dateRange.trim() !== '—' ? ' · Range: ' + dateRange : ''}</div>


    `);


    // Iterate every tab section


    const sections = [


      {id:'rpt-operations', label:'Operations'},


      {id:'rpt-financial', label:'Financial'},


      {id:'rpt-clients', label:'Clients'},


      {id:'rpt-staff', label:'Staff'},


      {id:'rpt-compliance', label:'Compliance'}


    ];


    sections.forEach(s => {


      const el = document.getElementById(s.id);


      if (!el) return;


      w.document.write('<h2>' + s.label + '</h2>');


      // Clone the section content but strip buttons


      const clone = el.cloneNode(true);


      clone.querySelectorAll('button,.btns').forEach(b => b.remove());


      w.document.write(clone.innerHTML);


    });


    w.document.write('<div class="footer">MSE McGann Systems Engineering · (508) 233-3565 · cs@msetech.org · msetech.org</div></body></html>');


    w.document.close();


    w.print();


    showToast('Combined report ready to print', 'success');


  }, 150);


}





// Show Reports nav for Super Admin, wire renderPage


