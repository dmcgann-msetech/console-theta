// ============================================================


// =============== FORM PERSISTENCE (all forms) ===============


// ============================================================


// Each form modal gets generic save: collect inputs, capture the


// rendered <div class="print-form"> as HTML, store both the data


// and a printable HTML snapshot in Supabase.





function _activeFormModal() {


  // Find which form modal is currently open


  for (const id of Object.keys(formMeta)) {


    const el = document.getElementById(id);


    if (el && el.classList.contains('open')) return id;


  }


  // Also check intake (not in formMeta)


  const intake = document.getElementById('modal-form-intake');


  if (intake && intake.classList.contains('open')) return 'modal-form-intake';


  return null;


}





function _formInputsToData(modalEl) {


  const data = {};


  const labelFields = {}; // label-text -> value (for inputs without id)


  const used = new WeakSet();





  // 1. Capture every input/select/textarea, keyed by id (preferred) or


  //    by its enclosing <label> text. Line-item table cells handled below.


  const itemsTable = modalEl.querySelector('table[id$="-items"]');


  modalEl.querySelectorAll('input, select, textarea').forEach(el => {


    if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return;


    // Skip line-item table cells â€” captured as a structured array below


    if (itemsTable && itemsTable.contains(el)) return;


    let val;


    if (el.type === 'checkbox') val = !!el.checked;


    else if (el.tagName === 'SELECT') val = el.value;


    else val = el.value;


    if (el.id) {


      data[el.id] = val;


      used.add(el);


    } else if (el.name) {


      data[el.name] = val;


      used.add(el);


    } else {


      // Try label-text fallback so things like Terms/Prepared By/Notes get captured


      const wrap = el.closest('.pf-field, label');


      let labelText = '';


      if (wrap) {


        const lbl = wrap.querySelector('label');


        if (lbl) labelText = (lbl.textContent || '').trim();


        if (!labelText && wrap.tagName === 'LABEL') labelText = (wrap.firstChild?.textContent || '').trim();


      }


      // Field placeholder is a final fallback so unlabeled fields are still


      // round-trippable (e.g. some related-doc inputs use placeholder only).


      if (!labelText) labelText = (el.getAttribute('placeholder') || '').trim();


      if (labelText) {


        labelFields[labelText] = val;


        used.add(el);


      }


    }


  });


  data.__label_fields = labelFields;





  // 2. Line-item tables: capture as a structured array. Cell order in our


  //    invoice/quote/etc tables is: [#, description, qty, unit_price, amount].


  //    We don't rely on id/name (the markup has none), we read inputs by cell


  //    index and skip rows where the description is empty AND qty/price are 0.


  const items = [];


  if (itemsTable) {


    itemsTable.querySelectorAll('tbody tr').forEach(tr => {


      const cells = tr.querySelectorAll('td');


      if (cells.length < 5) return;


      const getVal = (cell) => {


        const inp = cell.querySelector('input, textarea, select');


        return inp ? (inp.value || '') : (cell.textContent || '').trim();


      };


      const description = getVal(cells[1]).trim();


      const qtyRaw = getVal(cells[2]);


      const unitRaw = getVal(cells[3]);


      const amtRaw  = getVal(cells[4]);


      const qty = parseFloat(String(qtyRaw).replace(/[^\d.\-]/g,'')) || 0;


      const unit_price = parseFloat(String(unitRaw).replace(/[^\d.\-]/g,'')) || 0;


      const amount = parseFloat(String(amtRaw).replace(/[^\d.\-]/g,'')) || (qty * unit_price);


      // Drop rows that have no description AND no real money on them. The


      // default qty is "1", so we look at unit_price/amount instead.


      if (!description && unit_price === 0 && amount === 0) return;


      items.push({ description, qty, unit_price, amount });


    });


  }


  if (items.length) data.line_items = items;





  // 3. Read computed totals from the modal so we don't lose tax/subtotal/deposit


  //    just because they live in <span> tags.


  const totalsRoot = modalEl.querySelector('.pf-totals');


  if (totalsRoot) {


    const subEl = totalsRoot.querySelector('[id$="-subtotal"]');


    const taxAmtEl = totalsRoot.querySelector('[id$="-tax-amt"]');


    const totalEl  = totalsRoot.querySelector('[id$="-total"]');


    if (subEl)    data.__subtotal = subEl.textContent.trim();


    if (taxAmtEl) data.__tax_amt  = taxAmtEl.textContent.trim();


    if (totalEl)  data.__total    = totalEl.textContent.trim();


  }





  return data;


}





// Sync live input/textarea/select state into the DOM attributes so that


// outerHTML serialization actually contains the typed values. Without this,


// `<input>` elements serialize with their original `value="0.00"` markup.


// Idempotent â€” safe to call multiple times.


function _syncInputAttrsToDom(root) {


  if (!root) return;


  root.querySelectorAll('input').forEach(el => {


    if (el.type === 'checkbox' || el.type === 'radio') {


      if (el.checked) el.setAttribute('checked',''); else el.removeAttribute('checked');


    } else if (el.type === 'file') {


      // skip


    } else {


      el.setAttribute('value', el.value || '');


    }


  });


  root.querySelectorAll('textarea').forEach(el => {


    // For textarea, innerHTML/textContent is what serializes


    el.textContent = el.value || '';


  });


  root.querySelectorAll('select').forEach(sel => {


    Array.from(sel.options).forEach(opt => {


      if (opt.selected) opt.setAttribute('selected','');


      else opt.removeAttribute('selected');


    });


  });


}





function _findClientForForm(modalEl, data) {


  // Try common client-name fields in this order. -client-co is the company


  // input on the modern invoice/quote modals; legacy -client kept as fallback.


  const candidates = ['inv-client-co', 'quote-client-co', 'wo-client-co', 'co-client-co',


                      'pp-client-co', 'cs-client-co', 'dr-client-co', 'cf-client-co',


                      'pr-client-co', 'sr-client-co', 'tc-client-co', 'intake-client-co',


                      'inv-client', 'quote-client', 'wo-client', 'co-client',


                      'pp-client', 'cs-client', 'dr-client', 'cf-client',


                      'pr-client', 'sr-client', 'tc-client', 'intake-client'];


  for (const id of candidates) {


    if (data[id] && String(data[id]).trim()) return String(data[id]).trim();


  }


  // Generic fallback: any input with "client" in its id


  for (const k of Object.keys(data)) {


    if (/client/i.test(k) && typeof data[k] === 'string' && data[k].trim()) return data[k].trim();


  }


  // Last resort: __label_fields entry


  const lf = data.__label_fields || {};


  for (const lab of ['Client / Company','Bill To','Company']) {


    if (lf[lab] && String(lf[lab]).trim()) return String(lf[lab]).trim();


  }


  return null;


}





function _findAmountForForm(data) {


  // Prefer the rendered grand-total span we captured in _formInputsToData


  if (data && data.__total) {


    const num = parseFloat(String(data.__total).replace(/[^\d.\-]/g, ''));


    if (!isNaN(num) && num > 0) return num;


  }


  // Fallback: legacy *-total input names (kept for older modals)


  const candidates = ['inv-total','quote-total','co-total','pp-total','pr-amount'];


  for (const id of candidates) {


    if (data[id]) {


      const num = parseFloat(String(data[id]).replace(/[^\d.\-]/g, ''));


      if (!isNaN(num)) return num;


    }


  }


  // Final fallback: sum line_items


  if (Array.isArray(data && data.line_items)) {


    const s = data.line_items.reduce((acc,i) => {


      const a = parseFloat(String(i.amount||'').replace(/[^\d.\-]/g,'')) || 0;


      const q = parseFloat(String(i.qty||'').replace(/[^\d.\-]/g,'')) || 0;


      const u = parseFloat(String(i.unit_price||'').replace(/[^\d.\-]/g,'')) || 0;


      return acc + (a || (q * u));


    }, 0);


    if (s > 0) return s;


  }


  return null;


}





// Build a polished, branded printable HTML for invoices/quotes/etc.


// Looks like a real $5,500 document, not a Notepad printout.


function _buildPrintableFormHTML(snapshotHtml, title, formKey) {


  // Strip readonly/disabled visual styling, transform <input> values into bold text.


  // We do this via a DocumentFragment so values actually print on the saved snapshot.


  const wrap = document.createElement('div');


  wrap.innerHTML = snapshotHtml;


  // Replace all inputs/textareas/selects with their values as text


  wrap.querySelectorAll('input, textarea, select').forEach(el => {


    let val = '';


    if (el.tagName === 'SELECT') val = el.options[el.selectedIndex]?.text || '';


    else val = el.value || '';


    // Preserve placeholder for empty fields so the doc doesn't look hollow


    const fallback = el.getAttribute('placeholder') || '';


    const span = document.createElement('span');


    span.className = 'pf-val' + (val ? '' : ' empty');


    span.textContent = val || (fallback && fallback.length < 40 ? 'â€”' : '');


    if (el.classList.contains('line-amt') || el.classList.contains('unit-price') || el.classList.contains('qty')) {


      span.style.cssText = 'display:inline-block;width:100%;text-align:right;padding:6px 4px';


    }


    el.replaceWith(span);


  });


  // Remove the Add Row button from print


  wrap.querySelectorAll('.pf-add-row-btn').forEach(b => b.remove());





  // Inline the MSE logo as a data URL so it renders inside the popup window


  // (relative paths like /assets/mse-logo.png resolve to about:blank in the


  // print popup and would otherwise break).


  wrap.querySelectorAll('img.form-print-header-logo, img[src="/assets/mse-logo.png"]').forEach(img => {


    img.setAttribute('src', MSE_LOGO_DATA_URL);


  });





  const body = wrap.innerHTML;


  const todayStr = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });





  return `<!doctype html>


<html><head><meta charset="utf-8"><title>${title}</title>


<style>


  @page { size: Letter; margin: 0.5in; }


  * { box-sizing: border-box; }


  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#1a1a1a; background:#fff; margin:0; padding:0; font-size:11pt; line-height:1.45; }


  /* Re-apply body-equivalent styles directly on .print-form so the inline


     viewer (which renders just .print-form, not <body>) doesn't inherit the


     dark/giant-text look from the host app. */


  .print-form {


    max-width: 7.5in;


    margin: 0 auto;


    padding: 24px 24px 32px;


    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;


    color: #1a1a1a;


    background: #fff;


    font-size: 11pt;


    line-height: 1.45;


    font-weight: 400;


    text-align: left;


    -webkit-text-size-adjust: 100%;


  }


  .print-form, .print-form * { box-sizing: border-box; }


  .print-form h1, .print-form h2, .print-form h3, .print-form h4 { color:#1a1a1a; margin:0; font-weight:700; }


  .print-form table { background: transparent; }





  /* === Letterhead ===


     Clean, balanced, professional. White background with a slim red accent


     bar on top and a thin red rule below â€” keeps brand color without


     dominating the page. Sized so it stays readable at print scale AND when


     the viewer scales the 8.5in doc down to phone width. */


  .form-print-header {


    display:flex; align-items:flex-start; justify-content:space-between;


    gap:18px; padding:14px 0 14px;


    border-top: 4px solid #c9303f;


    border-bottom: 1px solid #d9d9d9;


    margin-bottom: 22px;


  }


  .form-print-header-left {


    flex: 1 1 auto; min-width: 0;


    display:flex; flex-direction:row; align-items:center; gap:14px;


  }


  .form-print-header-logo {


    flex: 0 0 auto;


    width: 1.15in; height: auto; max-height: 0.95in;


    display:block; object-fit:contain; background:#fff;


    -webkit-print-color-adjust: exact; print-color-adjust: exact;


  }


  .form-print-header-text {


    flex: 1 1 auto; min-width: 0;


    display:flex; flex-direction:column; justify-content:center;


  }


  .form-print-header-left .co-name {


    font-size:13pt; font-weight:800; letter-spacing:-0.005em;


    color:#1a1a1a; margin-bottom:4px; line-height:1.2;


  }


  .form-print-header-left .co-detail {


    font-size:8.5pt; color:#444; line-height:1.5; max-width:4.5in;


  }


  .form-print-header-right {


    flex: 0 0 auto; text-align:right; min-width: 0;


    display:flex; flex-direction:column; align-items:flex-end; justify-content:flex-start;


  }


  .form-print-header-right .doc-type {


    font-size:16pt; font-weight:800; letter-spacing:0.08em;


    color:#c9303f; line-height:1.1; margin-bottom:4px;


    white-space:nowrap;


  }


  .form-print-header-right .doc-num {


    font-size:10pt; font-weight:600; color:#1a1a1a;


    font-family: 'SF Mono', Menlo, Consolas, monospace;


    letter-spacing:0.02em;


  }


  /* Narrow-viewport guard: if this doc is ever rendered without the


     transform-scale viewer (e.g. opened directly on a phone), stack the


     header instead of overflowing or letting text get unreadably tiny. */


  @media (max-width: 600px) {


    .form-print-header { flex-direction: column; gap: 8px; padding: 12px 0; }


    .form-print-header-right { text-align: left; align-items: flex-start; }


    .form-print-header-right .doc-type { font-size: 15pt; letter-spacing: 0.06em; }


    .form-print-header-left .co-detail { max-width: 100%; }


  }





  /* === Section bars === */


  .form-section-bar { font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.14em; color:#c9303f; padding:12px 0 6px; margin-top:14px; border-bottom:1.5px solid #1a1a1a; margin-bottom:10px; }





  /* === Field grids === */


  .pf-fields-2, .pf-fields-3 { display:grid; gap:14px 22px; margin-bottom:8px; }


  .pf-fields-2 { grid-template-columns: 1fr 1fr; }


  .pf-fields-3 { grid-template-columns: 1fr 1fr 1fr; }


  .pf-field label { display:block; font-size:8.5pt; text-transform:uppercase; letter-spacing:0.1em; color:#777; font-weight:600; margin-bottom:2px; }


  .pf-field .pf-val { display:block; font-size:11pt; color:#1a1a1a; font-weight:500; padding:4px 0; min-height:18px; border-bottom:1px solid #ddd; }


  .pf-field .pf-val.empty { color:#bbb; font-weight:400; }





  /* === Line items table === */


  .pf-table { width:100%; border-collapse:collapse; margin:6px 0 4px; font-size:10.5pt; }


  .pf-table thead th { background:#1a1a1a; color:#fff; padding:10px 8px; text-align:left; font-size:9pt; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; }


  .pf-table thead th:first-child { border-top-left-radius:3px; }


  .pf-table thead th:last-child { border-top-right-radius:3px; text-align:right; }


  .pf-table tbody td { padding:10px 8px; border-bottom:1px solid #e5e5e5; vertical-align:top; }


  .pf-table tbody tr:nth-child(even) td { background:#fafafa; }


  .pf-table tbody td:last-child { text-align:right; font-variant-numeric: tabular-nums; font-weight:600; }


  .pf-table tbody td:first-child { color:#888; font-size:10pt; text-align:center; }





  /* === Totals === */


  .pf-totals { margin-top:18px; margin-left:auto; width:3.2in; border:1px solid #ddd; border-radius:4px; overflow:hidden; }


  .pf-total-row { display:flex; justify-content:space-between; padding:8px 14px; font-size:10.5pt; }


  .pf-total-row + .pf-total-row { border-top:1px solid #eee; }


  .pf-total-row .pf-total-label { color:#555; }


  .pf-total-row .pf-total-val { font-variant-numeric:tabular-nums; font-weight:600; color:#1a1a1a; }


  .pf-total-row.grand { background:#c9303f; color:#fff; padding:12px 14px; font-size:13pt; font-weight:800; border-top:none; }


  .pf-total-row.grand .pf-total-label { color:#fff; letter-spacing:0.06em; text-transform:uppercase; font-size:10pt; }


  .pf-total-row.grand .pf-total-val { color:#fff; font-size:14pt; }





  /* === Footer === */


  .pf-footer { margin-top:32px; padding-top:14px; border-top:2px solid #1a1a1a; font-size:8.5pt; color:#666; text-align:center; line-height:1.6; }


  .pf-footer::before { content:'Thank you for your business.'; display:block; font-size:10pt; color:#c9303f; font-weight:700; margin-bottom:6px; letter-spacing:0.04em; }





  /* === Notes blocks === */


  textarea, .pf-val { white-space: pre-wrap; word-wrap:break-word; }


  .pf-fields-2 .pf-field:has(textarea), .pf-fields-2 .pf-field:has(.pf-val) { min-height:60px; }





  /* === Print tweaks === */


  @media print {


    body { padding:0; }


    .pf-add-row-btn, button { display:none !important; }


    .form-print-header { page-break-after: avoid; }


    .form-section-bar { page-break-after: avoid; }


    .pf-totals { page-break-inside: avoid; }


  }


</style>


</head><body>${body}
</body></html>`;


}





// Single source of truth for the saved-forms storage bucket.


// All save / view / regenerate / delete paths must use this constant.


const FORMS_BUCKET = 'client-forms';





async function saveCurrentForm() {


  if (!sb || !currentUser) { showToast('Not signed in', 'error'); return; }


  const modalId = _activeFormModal();


  if (!modalId) { showToast('No form open', 'error'); return; }


  const modalEl = document.getElementById(modalId);


  const meta = formMeta[modalId] || { key: 'intake', prefix: 'MSE-INK' };





  const data = _formInputsToData(modalEl);


  const clientName = _findClientForForm(modalEl, data);


  const amount = _findAmountForForm(data);





  // Resolve client_id from clients DB if a name was given


  let client_id = null;


  if (clientName && Array.isArray(DB.clients)) {


    const match = DB.clients.find(c =>


      (c.name||'').toLowerCase() === clientName.toLowerCase() ||


      (c.company||'').toLowerCase() === clientName.toLowerCase());


    if (match && match._sbId) client_id = match._sbId;


  }





  // Document number: only honor a value the user explicitly typed (rare).


  // For new forms, we deliberately send null so the Supabase trigger


  // mse_assign_client_form_number() assigns the next real number â€” this is


  // the only authoritative source. The visible doc-num preview is just UI.


  let formNumber = '';


  if (meta.numEl) {


    const numInputEl = document.getElementById(meta.numEl);


    if (numInputEl) formNumber = (numInputEl.value || '').trim();


  }


  // Strip the placeholder sentinel and known stale hardcoded values so they


  // never reach the server.


  if (formNumber === FORM_NUMBER_PLACEHOLDER) formNumber = '';


  if (/^MSE-INV-0005$/i.test(formNumber)) formNumber = '';





  // Form date


  let formDate = null;


  if (meta.dateEl) {


    const d = document.getElementById(meta.dateEl);


    if (d) formDate = d.value || null;


  }


  if (!formDate) formDate = new Date().toISOString().slice(0,10);





  // Edit mode: when _editingFormCtx targets this modal, we update the


  // existing row instead of inserting a new one. Authoritative form_number


  // is preserved from the original row \u2014 never re-assigned by the DB trigger.


  const editing = (_editingFormCtx && _editingFormCtx.modalId === modalId) ? _editingFormCtx : null;


  if (editing) {


    formNumber = editing.originalNumber || (editing.form && editing.form.form_number) || formNumber;


  }





  showToast(editing ? 'Updating \u2026' : 'Saving \u2026', 'info');





  // DIAGNOSTIC: log what we're about to send


  console.log('[saveCurrentForm] mode:', editing ? 'EDIT id=' + editing.id : 'CREATE');


  console.log('[saveCurrentForm] clientName resolved:', clientName);


  console.log('[saveCurrentForm] client_id resolved:', client_id);


  console.log('[saveCurrentForm] form_type:', meta.key, 'form_number:', formNumber || '(null \u2014 server will assign)');


  console.log('[saveCurrentForm] amount:', amount, 'date:', formDate);





  // Insert OR update client_forms row. On insert, the DB trigger


  // mse_assign_client_form_number() assigns the real form_number when we


  // send null. On update we preserve the existing number authoritatively.


  const provisionalTitle = (formNumber || meta.prefix || meta.key.toUpperCase()) +


    (clientName ? ' \u2014 ' + clientName : '');


  let saved = null;


  try {


    if (editing) {


      const original = editing.form || {};


      const update = {


        client_id: client_id != null ? client_id : (original.client_id || null),


        form_number: formNumber || null,


        title: provisionalTitle,


        form_date: formDate,


        amount: amount,


        data: data


      };


      console.log('[saveCurrentForm] update payload:', update, 'where id=', editing.id);


      const { data: row, error } = await sb.from('client_forms')


        .update(update).eq('id', editing.id).select().single();


      if (error) throw error;


      saved = row;


    } else {


      const payload = {


        client_id: client_id,


        form_type: meta.key,


        form_number: formNumber || null,


        title: provisionalTitle,


        form_date: formDate,


        amount: amount,


        data: data,


        status: 'saved',


        created_by_email: currentUser.email || null,


        created_by_name: currentUser.user_metadata?.full_name || currentUser.email || null


      };


      console.log('[saveCurrentForm] insert payload:', payload);


      const { data: row, error } = await sb.from('client_forms').insert(payload).select().single();


      if (error) throw error;


      saved = row;


    }


    console.log('[saveCurrentForm] saved row id:', saved?.id, 'authoritative form_number:', saved?.form_number);


  } catch(e) {


    console.error('[saveCurrentForm] Form save failed:', e);


    // Show a much more verbose error so we can debug from mobile


    const detail = e?.message || e?.code || e?.details || JSON.stringify(e).slice(0,200);


    showToast('Save failed: ' + detail, 'error');


    // Also alert so user definitely sees it


    setTimeout(() => alert('SAVE FAILED â€” ' + detail + '\n\nclient_id: ' + (client_id||'NULL') + '\nclientName: ' + (clientName||'(none)') + '\nform: ' + meta.key), 100);


    return;


  }





  // Authoritative number from the inserted row (DB trigger assigns it).


  const authoritativeNumber = (saved && saved.form_number) ? saved.form_number : (formNumber || '');


  const finalTitle = (authoritativeNumber || meta.prefix || meta.key.toUpperCase()) +


    (clientName ? ' â€” ' + clientName : '');





  // Patch the visible DOM with the real number BEFORE snapshotting so the


  // saved HTML snapshot embeds the assigned number, not the placeholder.


  // Important: setAttribute('value',...) so outerHTML serializes it â€” setting


  // .value alone only updates the JS property, leaving the markup empty.


  if (meta.numEl) {


    const numInputEl2 = document.getElementById(meta.numEl);


    if (numInputEl2) {


      numInputEl2.value = authoritativeNumber;


      numInputEl2.setAttribute('value', authoritativeNumber);


    }


  }


  if (meta.docNum) {


    const docElPost = document.getElementById(meta.docNum);


    if (docElPost) docElPost.textContent = authoritativeNumber;


  }


  // Update the captured data dict so the saved row's JSON also has the number.


  if (meta.numEl) data[meta.numEl] = authoritativeNumber;





  // Sync ALL form-control state (input.value, textarea.value, select option)


  // into DOM attributes so outerHTML preserves what the user typed. Without


  // this, the snapshot becomes a hollow shell with default values.


  const printForm = modalEl.querySelector('.print-form');


  _syncInputAttrsToDom(printForm);


  // For receipts, render the saved snapshot through _buildSnapshotFromData


  // (which has a payment-centric layout) instead of cloning the modal's


  // outerHTML. The modal markup is fine in the editor but produces an


  // invoice-shaped document when fed through _buildPrintableFormHTML â€” the


  // user reported saved receipts coming out without payment data and with a


  // confusing empty line-items table. _buildSnapshotFromData(receipt)


  // surfaces method/amount/reference/balance/related invoice as the primary


  // content.


  const snapshot = (meta.key === 'receipt')


    ? _buildSnapshotFromData({


        ...saved,


        form_type: 'receipt',


        form_number: authoritativeNumber || saved.form_number,


        form_date: formDate,


        amount: amount,


        data: data,


        status: saved.status,


        created_by_name: saved.created_by_name


      })


    : (printForm ? printForm.outerHTML : '');


  const fullHtml = _buildPrintableFormHTML(snapshot, authoritativeNumber || meta.key, meta.key);





  // Upload HTML snapshot to forms bucket so we can re-render later


  try {


    const safeNum = (authoritativeNumber || 'form').replace(/[^a-zA-Z0-9._-]/g,'_');


    const path = `${meta.key}/${saved.id}_${safeNum}.html`;


    const blob = new Blob([fullHtml], { type: 'text/html' });


    const { error: upErr } = await sb.storage.from(FORMS_BUCKET).upload(path, blob, {


      contentType: 'text/html',


      upsert: true


    });


    if (upErr) {


      console.warn('[saveCurrentForm] snapshot upload failed:', upErr);


      showToast('Saved, but snapshot upload failed: ' + (upErr.message || 'unknown'), 'info');


      // Still write back authoritative data + title even if upload failed


      await sb.from('client_forms').update({


        title: finalTitle,


        data: data,


        amount: amount


      }).eq('id', saved.id);


    } else {


      // Persist everything authoritative: title with real number, full data


      // including the now-stamped form_number key, line_items, totals.


      await sb.from('client_forms').update({


        title: finalTitle,


        data: data,


        amount: amount,


        pdf_path: path,


        pdf_filename: (authoritativeNumber || 'form') + '.html'


      }).eq('id', saved.id);


    }


  } catch(e) {


    console.warn('Snapshot upload failed (record still saved):', e);


    showToast('Saved, but snapshot upload failed: ' + (e.message || 'unknown'), 'info');


  }





  // Audit log â€” distinguish create vs edit so the trail reflects reality.


  try {


    await sbInsertAudit('client_forms', saved.id, editing ? 'Edit' : 'Create',


      meta.key + ' ' + (authoritativeNumber||'') + ' for ' + (clientName||'?'));


  } catch(e) { /* non-fatal */ }





  // Receipt â†’ cash-out: when a Payment Receipt is saved with a Related Invoice


  // number that matches an existing client_forms invoice row, flip that


  // invoice's status to 'paid'. Scoped narrowly: same client_id when present,


  // exact form_number match, no schema changes. The receipt itself is also


  // marked paid so its row shows as the cash-out artifact.


  if (meta.key === 'receipt') {


    try {


      const markChoice = (data['pr-mark-paid'] || 'auto').toLowerCase();


      const relRaw = (data['pr-related-invoice'] || '').trim();


      if (relRaw && markChoice !== 'no') {


        const paidInfo = {


          receipt_form_id: saved.id,


          receipt_number: authoritativeNumber || null,


          paid_on: data['pr-payment-date'] || formDate,


          method: data['pr-method'] || null,


          reference: data['pr-reference'] || null,


          amount: amount


        };


        let q = sb.from('client_forms').select('id,form_number,client_id,data,status')


          .eq('form_type', 'invoice')


          .ilike('form_number', relRaw);


        if (client_id) q = q.eq('client_id', client_id);


        const { data: invRows, error: invErr } = await q;


        if (invErr) {


          console.warn('[saveCurrentForm] invoice lookup failed:', invErr);


        } else if (invRows && invRows.length) {


          const inv = invRows[0];


          const invData = (inv.data && typeof inv.data === 'object') ? inv.data : {};


          invData.__paid = paidInfo;


          const { error: updErr } = await sb.from('client_forms')


            .update({ status: 'paid', data: invData })


            .eq('id', inv.id);


          if (updErr) {


            console.warn('[saveCurrentForm] mark invoice paid failed:', updErr);


            showToast('Receipt saved, but invoice paid-update failed: ' + (updErr.message||''), 'info');


          } else {


            // Also mark the receipt row paid so the cash-out artifact is visible.


            await sb.from('client_forms').update({ status: 'paid' }).eq('id', saved.id);


            try {


              await sbInsertAudit('client_forms', inv.id, 'Edit',


                'Invoice ' + (inv.form_number||'') + ' marked PAID by receipt ' + (authoritativeNumber||''));


            } catch(_) {}


            showToast('Invoice ' + (inv.form_number||relRaw) + ' marked paid', 'success');


          }


        } else if (markChoice === 'yes') {


          showToast('No invoice matching "' + relRaw + '" found for this client.', 'info');


        }


      }


    } catch(e) {


      console.warn('[saveCurrentForm] receipt cash-out flow failed:', e);


    }


  }





  // Increment the form counter so next form gets next number â€” only on


  // create. Editing an existing row must not bump the next-number preview.


  if (!editing && meta.key && formCounters[meta.key] !== undefined) {


    formCounters[meta.key] += 1;


  }





  showToast(editing


    ? (authoritativeNumber || meta.prefix) + ' updated'


    : (meta.prefix + ' saved'), 'success');


  closeModal(modalId);





  // If the client panel is open, refresh its files list


  if (typeof loadClientForms === 'function') loadClientForms(client_id);


  if (activeClientIdx !== null && activeClientIdx !== undefined && typeof renderClientForms === 'function') {


    renderClientForms();


  }


  // If the documents page is open, refresh


  const docsPage = document.getElementById('page-documents');


  if (docsPage && docsPage.classList.contains('active') && typeof loadAllDocuments === 'function') {


    loadAllDocuments();


  }


  // Refresh the accounting bridge so newly saved invoices/receipts show up


  // in A/R, GL, and Overview without requiring a manual page reload.


  if ((meta.key === 'invoice' || meta.key === 'receipt') && typeof loadAccountingFromClientForms === 'function') {


    loadAccountingFromClientForms();


  }


}








// ============================================================


// =========== CLIENT FORMS LIST (on Client panel) ============


// ============================================================


let _clientFormsCache = {};  // client_id -> forms[]


async function loadClientForms(clientId) {


  if (!sb || !clientId) return [];


  try {


    const { data, error } = await sb.from('client_forms')


      .select('*').eq('client_id', clientId).order('created_at', { ascending: false });


    if (error) throw error;


    _clientFormsCache[clientId] = data || [];


    return data || [];


  } catch(e) { console.warn('client_forms load failed:', e); return []; }


}





async function renderClientForms() {


  const c = (typeof activeClientIdx !== 'undefined' && activeClientIdx !== null) ? DB.clients[activeClientIdx] : null;


  const list = document.getElementById('cp-files-list');


  if (!list || !c) return;


  // Combine: legacy local files + DB-persisted forms


  const dbForms = c._sbId ? (_clientFormsCache[c._sbId] || await loadClientForms(c._sbId)) : [];


  const legacy = c.files || [];





  if (!dbForms.length && !legacy.length) {


    list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0">No documents yet.</div>';


    return;


  }





  const formIcons = {


    invoice:'\ud83d\udcb5', quote:'\ud83d\udcb2', workorder:'\ud83d\udd27',


    changeorder:'\ud83d\udd04', proposal:'\ud83d\udcd1', consultation:'\ud83d\udcac',


    diagnostic:'\ud83d\udd0d', signoff:'\u2705', receipt:'\ud83e\uddfe',


    servicerequest:'\ud83d\udce5', terms:'\ud83d\udcdc', intake:'\ud83d\udcdd'


  };


  const dbHtml = dbForms.map(f => {


    const ic = formIcons[f.form_type] || '\ud83d\udcc4';


    const dt = f.form_date ? new Date(f.form_date + 'T00:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';


    const amt = f.amount ? ' \u00b7 $' + parseFloat(f.amount).toLocaleString('en-US', {minimumFractionDigits:2}) : '';


    const paidBadge = (f.status === 'paid')


      ? ' <span class="badge badge-green" style="font-size:10px;margin-left:4px">PAID</span>'


      : '';


    return `<div class="panel-file-item">


      <span class="fname">${ic} <strong>${esc(f.form_number || f.form_type)}</strong>${paidBadge} ${esc(f.title.replace(f.form_number||'','').replace(/^\u2014\s*/,'').trim())}${esc(amt)}</span>


      <span class="fdate">${esc(dt)}</span>


      <button onclick="event.stopPropagation();viewClientForm(${f.id})" style="background:var(--primary);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit;min-height:30px">View</button>


      <button onclick="event.stopPropagation();editClientForm(${f.id})" title="Edit this document" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:inherit;min-height:30px">Edit</button>


      <button onclick="event.stopPropagation();deleteClientForm(${f.id})" aria-label="Delete document" style="background:rgba(201,48,63,.15);border:1px solid rgba(201,48,63,.3);color:#ffb8bf;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;min-height:30px">\u00d7</button>


    </div>`;


  }).join('');


  const legacyHtml = legacy.map((f,fi) => `


    <div class="panel-file-item">


      <span class="fname">\ud83d\udcce ${esc(f.name)}</span>


      <span class="fdate">${esc(f.date)}</span>


      <button onclick="event.stopPropagation();DB.clients[activeClientIdx].files.splice(${fi},1);renderClientForms()" style="margin-left:8px;background:rgba(201,48,63,.15);border:1px solid rgba(201,48,63,.3);color:#ffb8bf;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">\u00d7</button>


    </div>`).join('');


  list.innerHTML = dbHtml + legacyHtml;


}





async function viewClientForm(formId) {


  if (!sb) return;


  try {


    const { data: form, error } = await sb.from('client_forms').select('*').eq('id', formId).single();


    if (error) throw error;





    const title = form.title || form.form_number || 'Document';





    // Helper: rebuild printable HTML from saved form.data when storage isn't available


    const renderFromData = () => {


      if (!form.data) return false;


      try {


        const snapshot = _buildSnapshotFromData(form);


        const html = _buildPrintableFormHTML(snapshot, form.form_number || form.form_type, form.form_type);


        showFormViewer(html, title);


        return true;


      } catch(re) {


        console.warn('viewClientForm: rebuild from data failed:', re);


        return false;


      }


    };





    if (!form.pdf_path) {


      // No snapshot in storage â€” try to rebuild from saved data


      if (renderFromData()) return;


      showToast('No snapshot available', 'error');


      return;


    }





    showToast('Loading documentâ€¦', 'info');


    const { data: blobData, error: dlErr } = await sb.storage.from(FORMS_BUCKET).download(form.pdf_path);


    if (dlErr) {


      console.warn('viewClientForm: storage download failed, trying data fallback:', dlErr);


      if (renderFromData()) return;


      throw dlErr;


    }


    const html = await blobData.text();


    showFormViewer(html, title);


  } catch(e) {


    console.error('viewClientForm failed:', e);


    showToast('Open failed: ' + (e.message||'unknown'), 'error');


  }


}





// Central print helper â€” popup-window strategy with body-swap fallback.


// Why popup: iOS Safari/Chrome share the host page's stylesheet when printing


// the top-level document, and the host page has aggressive global rules


// (`body * { visibility: hidden }`, `.print-form { position: fixed }`) that


// fight every in-document print strategy. Even disabling those <style> tags


// at runtime doesn't reliably clear them from the print render tree on iOS.


// A separate window has *zero* host CSS and is the most reliable path. The


// call must be synchronous from a user tap (Print button onclick) so popup


// blockers allow it. If the popup is blocked, we fall back to the body-swap


// strategy in the current document.


function printHtmlDocument(html, title) {


  try {


    // Parse the printable HTML so we can validate body content and build a


    // self-contained printable document for the popup.


    const parsed = new DOMParser().parseFromString(html, 'text/html');


    const bodyHtml = (parsed.body && parsed.body.innerHTML) ? parsed.body.innerHTML : html;


    const docTitle = title || parsed.title || document.title || 'Print';





    // Empty-host guard: bail out before opening the print sheet if there is


    // nothing meaningful to print. Saves the user from a blank dialog.


    const probe = document.createElement('div');


    probe.innerHTML = bodyHtml;


    const visibleText = (probe.textContent || '').replace(/\s+/g,'').trim();


    if (!visibleText) {


      console.warn('printHtmlDocument: nothing to print (empty body)');


      showToast('Nothing to print', 'error');


      return;


    }





    // Build a clean, fully self-contained printable document. We strip any


    // <script> for safety and any inline `transform:` styles so the on-screen


    // viewer's scale never carries into print. Inline the MSE logo as a data


    // URL so the popup window (about:blank) can render it without a network


    // round-trip and without breaking on the relative /assets path.


    const safeHtml = String(html)


      .replace(/<script[\s\S]*?<\/script>/gi, '')


      .replace(/style="([^"]*?)transform\s*:\s*[^;"]+;?([^"]*?)"/gi, 'style="$1$2"')


      .replace(/src="\/assets\/mse-logo\.png"/g, 'src="' + MSE_LOGO_DATA_URL + '"');


    // Inject a minimal print-time reset that allows multi-page flow. We do


    // this by appending a <style> to the parsed head before serializing.


    const parsed2 = new DOMParser().parseFromString(safeHtml, 'text/html');


    const resetStyle = parsed2.createElement('style');


    resetStyle.textContent = `


      @page { size: Letter; margin: 0.5in; }


      html, body {


        background:#fff !important; color:#000 !important;


        height:auto !important; min-height:0 !important; max-height:none !important;


        overflow:visible !important; margin:0 !important; padding:0 !important;


        transform:none !important;


      }


      .print-form, #form-viewer-doc, [class*="print-"] {


        position: static !important; left:auto !important; top:auto !important;


        right:auto !important; bottom:auto !important;


        width:auto !important; max-width:none !important;


        height:auto !important; max-height:none !important;


        overflow:visible !important; transform:none !important;


        page-break-inside: auto !important; break-inside: auto !important;


      }


      .pf-add-row-btn, button { display:none !important; }


      .form-print-header-left {


        display:flex !important; flex-direction:row !important;


        align-items:center !important; gap:14px !important;


      }


      .form-print-header-logo {


        flex: 0 0 auto !important;


        width: 1.15in !important; height: auto !important; max-height: 0.95in !important;


        display:block !important; object-fit:contain !important; background:#fff !important;


        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;


      }


      .form-print-header-text { flex: 1 1 auto !important; min-width: 0 !important; display:flex !important; flex-direction:column !important; justify-content:center !important; }


      @media print {


        html, body { height:auto !important; overflow:visible !important; }


        .pf-fields-2, .pf-fields-3, .pf-totals { page-break-inside: avoid; break-inside: avoid; }


        .form-section-bar { page-break-after: avoid; break-after: avoid; }


        .form-print-header { page-break-after: avoid; break-after: avoid; }


        .form-print-header-logo { width: 1.15in !important; max-height: 0.95in !important; }


      }


    `;


    parsed2.head.appendChild(resetStyle);


    if (parsed2.title !== docTitle) {


      let titleEl = parsed2.querySelector('title');


      if (!titleEl) { titleEl = parsed2.createElement('title'); parsed2.head.prepend(titleEl); }


      titleEl.textContent = docTitle;


    }


    const finalHtml = '<!doctype html>\n' + parsed2.documentElement.outerHTML;





    // === Strategy 1: open a synchronous popup window. ===


    // Must run on the same tick as the user tap so popup blockers allow it.


    let popup = null;


    try { popup = window.open('', '_blank'); } catch(_) { popup = null; }





    if (popup && popup.document) {


      try {


        popup.document.open();


        popup.document.write(finalHtml);


        popup.document.close();


        // Try to focus + print. iOS Safari needs a small delay after write()


        // for layout to settle. afterprint won't fire reliably across all


        // browsers, so close on a timer too.


        const triggerPrint = () => {


          try {


            popup.focus();


            popup.print();


          } catch (e) {


            console.warn('popup print failed:', e);


          }


        };


        // Some browsers fire load on the popup, others don't (especially


        // after document.write). Use both signals.


        let printed = false;


        const safePrint = () => {


          if (printed) return;


          printed = true;


          triggerPrint();


        };


        try {


          popup.addEventListener('load', safePrint, { once: true });


          popup.addEventListener('afterprint', () => {


            try { popup.close(); } catch(_) {}


          });


        } catch(_) {}


        // Fallback timer in case the load event never fires.


        setTimeout(safePrint, 350);


        return;


      } catch (popupErr) {


        console.warn('popup print path failed, falling back to body-swap:', popupErr);


        try { popup.close(); } catch(_) {}


      }


    } else {


      console.warn('popup blocked or unavailable â€” using body-swap fallback');


      showToast('If nothing happens, allow popups for this site', 'info');


    }





    // === Strategy 2: body-swap fallback. ===


    // Tear down any prior print artifacts.


    document.getElementById('mse-print-frame')?.remove();


    document.getElementById('mse-print-host')?.remove();


    document.getElementById('mse-print-css')?.remove();





    const styles = Array.from(parsed.querySelectorAll('style'))


      .map(s => s.outerHTML).join('\n');





    // Build the print host. It is appended directly to <body> so it is in the


    // top-level document's print render tree. The class is whitelisted by the


    // injected CSS below, which overrides the host page's print rules.


    const host = document.createElement('div');


    host.id = 'mse-print-host';


    host.className = 'mse-print-host';


    host.setAttribute('role', 'document');


    host.setAttribute('aria-label', docTitle);


    // Inline saved styles + content. The saved CSS is scoped via class


    // selectors inside .print-form, so it renders the same when injected here.


    // Strip <script> defensively before injection. Also strip any inline


    // transform/scale that the on-screen viewer may have left on a wrapping


    // element â€” they would carry into print and cause cropping/cutoff.


    const safeBody = bodyHtml


      .replace(/<script[\s\S]*?<\/script>/gi, '')


      .replace(/style="([^"]*?)transform\s*:\s*[^;"]+;?([^"]*?)"/gi, 'style="$1$2"');


    host.innerHTML = styles + safeBody;


    // Defensive runtime sweep in case any transform sneaks through inline or


    // via attribute. Page-level transform is the #1 cause of print cutoff


    // because the printed page sees a clipped, scaled-down render.


    host.querySelectorAll('[style*="transform"]').forEach(el => {


      el.style.transform = 'none';


    });





    // The host page has two pre-existing `@media print` blocks (around line


    // 519 and 526) that:


    //   - apply `body * { visibility: hidden }` and re-show only `.print-form`


    //   - position `.print-form` fixed at top-left


    //   - apply `display:none` on every body child except `.print-doc-only`


    // These rules conflict with our body-swap strategy: the visibility:hidden


    // tries to win on iOS Safari (which gives the older sheet higher


    // specificity in some renderers) and the fixed positioning yanks any


    // .print-form inside our host out of normal flow, breaking pagination.


    //


    // Strategy: temporarily disable the existing print-scoped <style> tags


    // entirely while we own the print pipeline, then restore on cleanup.


    // We disable by toggling the style sheet's `disabled` flag â€” fast, fully


    // reversible, and avoids fragile selector-overriding gymnastics.


    const disabledSheets = [];


    try {


      const allStyles = document.querySelectorAll('style');


      allStyles.forEach(styleEl => {


        // Only touch host-app styles, never our own injected ones.


        if (styleEl.id === 'mse-print-css' || styleEl.id === 'form-viewer-scope-css') return;


        const txt = styleEl.textContent || '';


        // Heuristic: any host-app style block that defines @media print rules


        // we need to suppress for the duration of printing.


        if (/@media\s+print/i.test(txt) && /visibility\s*:\s*hidden|\.print-form|\.print-doc-only/i.test(txt)) {


          if (styleEl.sheet && !styleEl.sheet.disabled) {


            styleEl.sheet.disabled = true;


            disabledSheets.push(styleEl);


          }


        }


      });


    } catch (sheetErr) {


      console.warn('printHtmlDocument: could not disable host print styles:', sheetErr);


    }





    // Inject print-time CSS that:


    //   1. Forces our host visible (last word on visibility / display).


    //   2. Hides every other top-level body child during print.


    //   3. Resets background/color so the dark app shell doesn't bleed through.


    //   4. Sets a sane @page margin.


    // Screen-time CSS hides the host so it doesn't flash over the live UI


    // between mount and print sheet open.


    const css = document.createElement('style');


    css.id = 'mse-print-css';


    css.textContent = `


      /* Keep the print host out of the live UI flow on screen. */


      #mse-print-host { position: fixed; left: -10000px; top: 0; width: 1px; height: 1px; overflow: hidden; }





      @media print {


        @page { size: Letter; margin: 0.5in; }


        html, body {


          background: #fff !important;


          color: #000 !important;


          height: auto !important;


          min-height: 0 !important;


          max-height: none !important;


          overflow: visible !important;


          margin: 0 !important;


          padding: 0 !important;


          visibility: visible !important;


          transform: none !important;


        }


        body > *:not(#mse-print-host) { display: none !important; visibility: hidden !important; }


        body #mse-print-host {


          position: static !important;


          left: auto !important;


          top: auto !important;


          right: auto !important;


          bottom: auto !important;


          width: auto !important;


          height: auto !important;


          min-height: 0 !important;


          max-height: none !important;


          overflow: visible !important;


          background: #fff !important;


          color: #000 !important;


          visibility: visible !important;


          display: block !important;


          transform: none !important;


          page-break-inside: auto !important;


          break-inside: auto !important;


        }


        /* Make every descendant of the print host visible AND let it size


           naturally. We deliberately do NOT force display:revert on every


           element here â€” that wipes out the saved doc's flex/grid layout.


           The host-app print rules that hid things have already been


           disabled via styleSheet.disabled = true, so this is enough. */


        body #mse-print-host * {


          visibility: visible !important;


          max-height: none !important;


          overflow: visible !important;


          -webkit-print-color-adjust: exact !important;


          print-color-adjust: exact !important;


        }


        /* Strip transforms inside print host so the on-screen viewer scale


           never carries into the print output. */


        body #mse-print-host #form-viewer-doc,


        body #mse-print-host .print-form { transform: none !important; }


        body #mse-print-host .pf-add-row-btn, body #mse-print-host button { display: none !important; }


        /* If a saved doc still tries to fix-position .print-form (from old


           page CSS that we disabled, or future regressions), normalize it.


           Don't constrain max-width â€” let it use the saved doc's setting so


           the layout matches what users see in the viewer. */


        body #mse-print-host .print-form {


          position: static !important;


          left: auto !important;


          top: auto !important;


          page-break-inside: auto !important;


          break-inside: auto !important;


        }


        /* Allow page breaks inside the body content (fields, totals). */


        body #mse-print-host .pf-body { page-break-inside: auto !important; break-inside: auto !important; }


        body #mse-print-host .pf-fields-2,


        body #mse-print-host .pf-fields-3 { page-break-inside: avoid; break-inside: avoid; }


        body #mse-print-host .form-section-bar { page-break-after: avoid; break-after: avoid; }


        body #mse-print-host .pf-totals { page-break-inside: avoid; break-inside: avoid; }


      }


    `;





    // Append CSS LAST so it wins specificity ties against any host-app style


    // we couldn't disable (cascade order is the final tiebreaker).


    document.body.appendChild(host);


    document.head.appendChild(css);





    // Preserve & lock title for the print sheet header on iOS.


    const prevTitle = document.title;


    document.title = docTitle;





    let cleanedUp = false;


    const cleanup = () => {


      if (cleanedUp) return;


      cleanedUp = true;


      try { host.remove(); } catch (_) {}


      try { css.remove(); } catch (_) {}


      try { document.title = prevTitle; } catch (_) {}


      // Re-enable the host-app print styles we suppressed.


      try {


        disabledSheets.forEach(styleEl => {


          if (styleEl.sheet) styleEl.sheet.disabled = false;


        });


      } catch (_) {}


      window.removeEventListener('afterprint', cleanup);


    };


    window.addEventListener('afterprint', cleanup);


    // Safari iOS doesn't always fire afterprint reliably â€” schedule a fallback.


    setTimeout(cleanup, 60000);





    // Give the layout one frame to commit before opening the print sheet.


    requestAnimationFrame(() => {


      setTimeout(() => {


        try {


          // Final guard â€” make sure host actually has rendered text.


          const hostText = (host.textContent || '').replace(/\s+/g,'').trim();


          if (!hostText) {


            console.warn('printHtmlDocument: print host empty at print time');


            showToast('Nothing to print', 'error');


            cleanup();


            return;


          }


          window.focus();


          window.print();


        } catch (err) {


          console.warn('window.print() failed:', err);


          showToast('Print not available â€” use the browser menu (Share â†’ Print)', 'info');


          cleanup();


        }


      }, 50);


    });


  } catch (e) {


    console.warn('printHtmlDocument failed:', e);


    showToast('Print failed â€” use the browser menu (Share â†’ Print)', 'error');


  }


}





// In-app document viewer modal â€” renders the saved HTML inline in a scrollable


// container (no iframe) so iOS Safari/Chrome can scroll/pan the document


// reliably. The saved doc is laid out for an 8.5"x11" Letter sheet (~720px


// wide). On a phone (~390px) that overflows horizontally, which Safari was


// "fixing" by auto-zooming the whole page out â€” leaving the user with a tiny,


// unreadable doc cropped at the top. We instead measure the natural document


// width and apply a CSS transform to scale-down so the document fits the


// viewport on mobile, then size the wrapper to the post-scale height so


// vertical scrolling still works. Desktop renders 1:1 (no scale).


//


// Print uses printHtmlDocument() so the entire document paginates against the


// real Letter page, completely independent of this on-screen scaling.


function showFormViewer(html, title) {


  // Remove any existing viewer


  const existing = document.getElementById('form-viewer-overlay');


  if (existing) existing.remove();





  // Parse the saved HTML so we can render <body> inline and pull <style> in scoped


  const doc = new DOMParser().parseFromString(html, 'text/html');


  const styleNodes = Array.from(doc.querySelectorAll('style'));


  const bodyHtml = doc.body ? doc.body.innerHTML : html;





  const overlay = document.createElement('div');


  overlay.id = 'form-viewer-overlay';


  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;';





  // Lock background scroll so only the viewer scrolls


  const prevBodyOverflow = document.body.style.overflow;


  document.body.style.overflow = 'hidden';





  // Top bar with title + actions (fixed, does not scroll). Light surface so


  // it doesn't read as a "dark overlay" sitting on top of the white doc.


  const topBar = document.createElement('div');


  topBar.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f5f5f5;color:#1a1a1a;border-bottom:1px solid #d9d9d9;';


  topBar.innerHTML = `


    <div style="flex:1;font-size:14px;font-weight:600;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</div>


    <button id="fv-print" style="background:#c9303f;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer">??? Print</button>


    <button id="fv-close" style="background:#fff;color:#1a1a1a;border:1px solid #c9c9c9;border-radius:6px;padding:8px 12px;font-size:13px;font-family:inherit;cursor:pointer">Close</button>


  `;


  overlay.appendChild(topBar);





  // Scoped CSS that overrides any global mobile rules (e.g. .modal-bg width


  // shrinks under @media (max-width:768px)) and disables horizontal page


  // scaling done by the saved style. We pin .print-form to a known design


  // width so our JS scale math is stable.


  const scopeCss = document.createElement('style');


  scopeCss.id = 'form-viewer-scope-css';


  scopeCss.textContent = `


    #form-viewer-overlay #form-viewer-page { background:#fff; color:#1a1a1a; }


    /* Render the saved doc at its natural Letter width inside the viewer.


       The transform scaling below shrinks it to fit the phone viewport. */


    #form-viewer-overlay #form-viewer-doc {


      width: 8.5in;


      max-width: 8.5in;


      margin: 0 auto;


      transform-origin: top left;


      will-change: transform;


    }


    /* Neutralize narrow-viewport rules that were squeezing the doc and


       hiding the right edge; we control sizing with the transform. */


    #form-viewer-overlay .print-form {


      max-width: none !important;


      width: 100% !important;


      margin: 0 !important;


    }


    #form-viewer-overlay .modal-bg, #form-viewer-overlay .form-modal {


      max-width: none !important; width: 100% !important;


    }


  `;


  overlay.appendChild(scopeCss);





  // Scrollable container â€” inline render gives iOS native scroll & pan.


  const scroller = document.createElement('div');


  scroller.id = 'form-viewer-scroll';


  // -webkit-overflow-scrolling for older iOS, overscroll-behavior to keep


  // pull-to-refresh from triggering. touch-action:pan-y/pinch-zoom keeps the


  // user able to pinch in if they want a closer look, but the default state


  // is fit-to-width thanks to the transform.


  scroller.style.cssText = 'flex:1 1 auto;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#fff;touch-action:pan-y pinch-zoom;';





  const page = document.createElement('div');


  page.id = 'form-viewer-page';


  page.style.cssText = 'width:100%;min-height:100%;background:#fff;color:#1a1a1a;padding:0;';


  styleNodes.forEach(s => page.appendChild(s.cloneNode(true)));





  // The "doc" element is what we apply the transform to. It contains the


  // saved body markup (which usually starts with .print-form). Wrapping in a


  // dedicated element keeps the transform predictable across all saved docs.


  const doc2 = document.createElement('div');


  doc2.id = 'form-viewer-doc';


  doc2.innerHTML = bodyHtml;


  doc2.querySelectorAll('script').forEach(n => n.remove());


  page.appendChild(doc2);


  scroller.appendChild(page);


  overlay.appendChild(scroller);





  document.body.appendChild(overlay);





  // === Fit-to-width logic ===


  // Measure the natural rendered width of the doc, then scale down so it


  // fits the scroller's available width. We also compress the wrapper height


  // to the post-scale height so vertical scrolling matches what's visible.


  const fitDoc = () => {


    if (!doc2.isConnected) return;


    // Reset before measuring so we read the natural layout width.


    doc2.style.transform = '';


    page.style.height = '';


    // Read the desired design width directly (matches scopeCss above).


    // 1in = 96 CSS pixels (CSS spec). 8.5in = 816px.


    const designWidth = 816;


    const available = scroller.clientWidth || window.innerWidth || designWidth;


    // No scale-up on desktop â€” only fit-down on narrow viewports.


    const scale = available < designWidth ? (available / designWidth) : 1;


    if (scale < 1) {


      doc2.style.transform = `scale(${scale})`;


      // Without explicit width, the post-transform layout still reserves the


      // full pre-transform box, leaving a horizontal gap. Lock the wrapper


      // height to the visual height so vertical scrolling matches what the


      // user sees (use scrollHeight to include all overflow).


      const naturalH = doc2.scrollHeight;


      page.style.height = Math.ceil(naturalH * scale) + 'px';


    } else {


      page.style.height = '';


    }


    // Always start scrolled to the top â€” the user complained the viewer


    // opened scrolled past the red header.


    scroller.scrollTop = 0;


    scroller.scrollLeft = 0;


  };





  // Initial fit after the browser has applied the saved styles.


  requestAnimationFrame(() => {


    fitDoc();


    // Run once more after fonts/images settle.


    setTimeout(fitDoc, 120);


  });





  // Keep fit on rotate / resize.


  const onResize = () => fitDoc();


  window.addEventListener('resize', onResize);


  window.addEventListener('orientationchange', onResize);





  // Cleanup helper used by Close + any error path


  const cleanup = () => {


    document.getElementById('mse-print-frame')?.remove();


    document.getElementById('mse-print-host')?.remove();


    document.getElementById('mse-print-css')?.remove();


    document.body.style.overflow = prevBodyOverflow;


    window.removeEventListener('resize', onResize);


    window.removeEventListener('orientationchange', onResize);


    overlay.remove();


  };





  document.getElementById('fv-close').onclick = cleanup;





  document.getElementById('fv-print').onclick = () => {


    // IMPORTANT: pass the original normalized HTML, NOT the scaled DOM.


    // Print pagination must run against the unscaled Letter document.


    printHtmlDocument(html, title);


  };


}





// Universal panel/modal printer â€” clones a panel's content, strips form controls,


// renders read-only into an iframe, and prints. Works on mobile (no popup blocker).


function printPanel(panelId, title) {


  const panel = document.getElementById(panelId);


  if (!panel) { showToast('Nothing to print', 'error'); return; }


  title = title || (document.title || 'Print');





  // Clone so we don't mutate the live panel


  const clone = panel.cloneNode(true);





  // Strip footer buttons + close X â€” they shouldn't print


  clone.querySelectorAll('.detail-panel-footer, .modal-close, button').forEach(el => el.remove());





  // Convert form controls to plain text so values actually print


  clone.querySelectorAll('input, textarea, select').forEach(el => {


    let val = '';


    if (el.tagName === 'SELECT') {


      val = el.options[el.selectedIndex]?.text || '';


    } else {


      val = el.value || '';


    }


    const span = document.createElement('div');


    span.textContent = val || 'â€”';


    span.style.cssText = 'padding:6px 0;border-bottom:1px solid #ddd;color:#000;font-size:13px;min-height:20px';


    el.replaceWith(span);


  });





  // Build the printable document


  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>


  <style>


    body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#000;background:#fff;margin:24px;font-size:13px;line-height:1.45}


    h1,h2,h3,h4{color:#000;margin:0 0 8px}


    h3{font-size:18px}


    .detail-panel-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:14px}


    .detail-panel-body label, label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-top:10px;font-weight:600}


    .modal-field{margin-bottom:10px}


    .divider{border-top:1px solid #ccc;margin:10px 0}


    .contact-card{border:1px solid #ddd;border-radius:6px;padding:8px;margin:6px 0}


    .contact-row{display:flex;gap:6px;font-size:12px;padding:2px 0}


    .c-label{color:#666;min-width:50px}


    table{width:100%;border-collapse:collapse;margin:8px 0}


    th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:12px}


    th{background:#f0f0f0}


    .print-header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:14px}


    .print-header h1{font-size:20px}


    .print-header .meta{font-size:11px;color:#555;text-align:right}


    @media print {


      html, body { height:auto !important; overflow:visible !important; background:#fff !important; color:#000 !important; }


      body { margin:12mm }


    }


  </style></head><body>


    <div class="print-header">


      <h1>${esc(title)}</h1>


      <div class="meta">MSE Tech<br>${new Date().toLocaleString()}</div>


    </div>


    ${clone.innerHTML}


  
</body></html>`;





  // Render via the same in-app iframe viewer used for saved forms


  showFormViewer(html, title);


}





// Regenerate a saved form's HTML using the current premium template.


// Used to upgrade pre-redesign invoices without re-entering data.


async function regenerateClientForm(formId) {


  if (!sb) return;


  if (!confirm('Regenerate this document with the current letterhead template?\n\nThe data stays the same; only the styling updates.')) return;


  try {


    showToast('Regeneratingâ€¦', 'info');


    // Fetch the saved row


    const { data: form, error } = await sb.from('client_forms').select('*').eq('id', formId).single();


    if (error) throw error;


    if (!form) throw new Error('Form not found');





    // Build a minimal print-form snapshot from the JSON data + form_type


    const snapshot = _buildSnapshotFromData(form);


    const fullHtml = _buildPrintableFormHTML(snapshot, form.form_number || form.form_type, form.form_type);





    // Re-upload to storage (overwrite)


    if (form.pdf_path) {


      const blob = new Blob([fullHtml], { type: 'text/html' });


      const { error: upErr } = await sb.storage.from(FORMS_BUCKET).upload(form.pdf_path, blob, {


        upsert: true, contentType: 'text/html'


      });


      if (upErr) throw upErr;


    }


    showToast('Document regenerated. Tap View to see.', 'success');


  } catch(e) {


    console.warn('Regenerate failed:', e);


    showToast('Regenerate failed: ' + (e.message || 'unknown'), 'error');


  }


}





// Build a minimal .print-form HTML structure from saved JSON data.


// Used for regenerating old saved forms with the current template.


function _buildSnapshotFromData(form) {


  const d = form.data || {};


  const lf = (d.__label_fields && typeof d.__label_fields === 'object') ? d.__label_fields : {};


  const docTypeLabel = (form.form_type === 'receipt' ? 'PAYMENT RECEIPT' : (form.form_type || 'document').toUpperCase());


  // Generic prefix-aware lookup: scan any *-suffix id, fall back to label-text,


  // fall back to legacy keys. Works for invoice/quote/proposal/etc.


  const pick = (suffixes, labels, legacy) => {


    for (const suf of (suffixes || [])) {


      for (const k of Object.keys(d)) {


        if (k.endsWith(suf) && d[k] != null && d[k] !== '') return d[k];


      }


    }


    for (const lab of (labels || [])) {


      if (lf[lab] != null && lf[lab] !== '') return lf[lab];


    }


    for (const k of (legacy || [])) {


      if (d[k] != null && d[k] !== '') return d[k];


    }


    return '';


  };





  // === Receipt rendering: payment-centric, no empty line-items table ===


  if (form.form_type === 'receipt') {


    const num = (v) => parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g,'')) || 0;


    const fmt = (n) => '$' + (Number(n)||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});


    const company      = pick(['-client-co'],     ['Client / Company','Company'],  []);


    const contactName  = pick(['-contact-name'],  ['Contact','Contact Name'],      []);


    const contactPhone = pick(['-contact-phone'], ['Phone / Email','Email','Phone'],[]);


    const dateReceived = form.form_date || pick(['-date'], ['Date Received'], []);


    const relatedInv   = pick(['-related-invoice'], ['Related Invoice'], []);


    const receivedBy   = pick(['-received-by'],     ['Received By'],     []) || form.created_by_name || '';


    const amountStr    = pick(['-amount'],          ['Amount Received'], []);


    const method       = pick(['-method'],          ['Payment Method'],  []);


    const reference    = pick(['-reference'],       ['Reference / Check #','Reference'], []);


    const paymentDate  = pick(['-payment-date'],    ['Date of Payment'], []);


    const description  = pick(['-description'],     ['Services / Description','Description'], []);


    const balanceStr   = pick(['-balance'],         ['Balance Remaining','Balance'], []);


    const amountDisplay = amountStr ? (String(amountStr).trim().startsWith('$') ? amountStr : fmt(num(amountStr))) :


                          (form.amount ? fmt(form.amount) : 'â€”');


    const balanceDisplay = balanceStr ? (String(balanceStr).trim().startsWith('$') ? balanceStr : fmt(num(balanceStr))) : '';


    const paidStatusBadge = form.status === 'paid'


      ? `<span style="display:inline-block;background:#16a34a;color:#fff;font-size:9pt;font-weight:700;letter-spacing:0.08em;padding:3px 10px;border-radius:3px;margin-left:8px;vertical-align:middle">PAID</span>` : '';





    return `<div class="print-form">


      <div class="form-print-header">


        <div class="form-print-header-left">


        <img class="form-print-header-logo" src="/assets/mse-logo.png" alt="MSE Tech"/>


        <div class="form-print-header-text"><div class="co-name">MSE McGann Systems Engineering</div><div class="co-detail">816 William S. Canning Blvd. Suite 1089, Fall River, MA 02721<br>(508) 233-3565 &nbsp;|&nbsp; info@msetech.org &nbsp;|&nbsp; msetech.org</div></div>


      </div>


        <div class="form-print-header-right">


          <div class="doc-type">PAYMENT RECEIPT</div>


          <div class="doc-num">${esc(form.form_number || '')}${paidStatusBadge}</div>


        </div>


      </div>


      <div class="pf-body">


        <div class="form-section-bar">Receipt Details</div>


        <div class="pf-fields-3">


          <div class="pf-field"><label>Receipt No</label><span class="pf-val">${esc(form.form_number || 'â€”')}</span></div>


          <div class="pf-field"><label>Date Received</label><span class="pf-val">${esc(dateReceived || 'â€”')}</span></div>


          <div class="pf-field"><label>Related Invoice</label><span class="pf-val">${esc(relatedInv || 'â€”')}</span></div>


        </div>


        <div class="form-section-bar">Payer</div>


        <div class="pf-fields-3">


          <div class="pf-field"><label>Client / Company</label><span class="pf-val">${esc(company || 'â€”')}</span></div>


          <div class="pf-field"><label>Contact</label><span class="pf-val">${esc(contactName || 'â€”')}</span></div>


          <div class="pf-field"><label>Phone / Email</label><span class="pf-val">${esc(contactPhone || 'â€”')}</span></div>


        </div>


        <div class="form-section-bar">Payment</div>


        <div class="pf-fields-3">


          <div class="pf-field"><label>Payment Method</label><span class="pf-val">${esc(method || 'â€”')}</span></div>


          <div class="pf-field"><label>Reference / Check #</label><span class="pf-val">${esc(reference || 'â€”')}</span></div>


          <div class="pf-field"><label>Date of Payment</label><span class="pf-val">${esc(paymentDate || dateReceived || 'â€”')}</span></div>


        </div>


        ${description ? `<div class="form-section-bar">Services / Description</div><div class="pf-fields-2"><div class="pf-field" style="grid-column:1/-1"><label>Description</label><span class="pf-val">${esc(description)}</span></div></div>` : ''}


        <div class="form-section-bar">Amount</div>


        <div class="pf-totals">


          <div class="pf-total-row"><span class="pf-total-label">Payment Method</span><span class="pf-total-val">${esc(method || 'â€”')}</span></div>


          ${reference ? `<div class="pf-total-row"><span class="pf-total-label">Reference</span><span class="pf-total-val">${esc(reference)}</span></div>` : ''}


          ${balanceDisplay ? `<div class="pf-total-row"><span class="pf-total-label">Balance Remaining</span><span class="pf-total-val">${esc(balanceDisplay)}</span></div>` : ''}


          <div class="pf-total-row grand"><span class="pf-total-label">Amount Received</span><span class="pf-total-val">${esc(amountDisplay)}</span></div>


        </div>


        ${receivedBy ? `<div class="pf-fields-2" style="margin-top:18px"><div class="pf-field"><label>Received By</label><span class="pf-val">${esc(receivedBy)}</span></div><div class="pf-field"><label>Date</label><span class="pf-val">${esc(dateReceived || 'â€”')}</span></div></div>` : ''}


        <div class="pf-footer">MSE McGann Systems Engineering &nbsp;|&nbsp; (508) 233-3565 &nbsp;|&nbsp; info@msetech.org &nbsp;|&nbsp; msetech.org &nbsp;|&nbsp; 816 William S. Canning Blvd. Suite 1089, Fall River, MA 02721</div>


      </div>


    </div>`;


  }





  const company      = pick(['-client-co','-client'], ['Client / Company','Bill To','Company'], ['client_company']);


  const contactName  = pick(['-contact-name'],        ['Contact Name'],                          ['contact_name']);


  const contactPhone = pick(['-contact-phone'],       ['Phone / Email','Email','Phone'],         ['phone_email']);


  const dateIssued   = form.form_date || pick(['-date'], ['Date Issued'], []);


  const dueDate      = pick(['-due'],                 ['Due Date'],                              ['due_date']);


  const terms        = pick([],                       ['Terms'],                                  []) || 'Net 30';


  const preparedBy   = pick([],                       ['Prepared By'],                            []) || form.created_by_name || 'MSE McGann Systems Engineering';


  const project      = pick([],                       ['Project / Service','Project','Description'], ['project']);


  const relatedQuote = pick([],                       ['Related Quote No'],                       []);


  const relatedWO    = pick([],                       ['Work Order No'],                          []);


  const notes        = pick([],                       ['Notes / Billing Detail','Notes'],         ['notes']);


  const payInst      = pick([],                       ['Payment Instructions'],                   []);


  const taxPctRaw    = pick(['-tax-pct'],             ['Tax %'],                                  ['tax_pct']);


  const depositRaw   = pick(['-deposit'],             ['Deposit / Credit','Deposit'],             ['deposit']);





  // Line items: prefer the structured array; fall back to a synthesized row.


  let items = [];


  if (Array.isArray(d.line_items)) items = d.line_items.slice();


  else if (Array.isArray(d.items)) items = d.items.slice();


  if (items.length === 0 && form.amount) {


    items.push({ description: project || form.title || form.form_type, qty: 1, unit_price: form.amount, amount: form.amount });


  }


  const num = (v) => parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g,'')) || 0;


  const subtotal = items.reduce((s,i) => s + (num(i.amount) || (num(i.qty) * num(i.unit_price))), 0);


  const taxPct = num(taxPctRaw);


  const taxAmt = subtotal * taxPct / 100;


  const deposit = num(depositRaw);


  const total = subtotal + taxAmt - deposit;


  const fmt = (n) => '$' + (Number(n)||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});





  const itemRows = items.map((it, i) => {


    const q = num(it.qty);


    const u = num(it.unit_price);


    const a = num(it.amount) || (q * u);


    return `


    <tr>


      <td><span class="pf-val">${i+1}</span></td>


      <td><span class="pf-val">${esc(it.description || it.desc || 'â€”')}</span></td>


      <td><span class="pf-val">${esc(String(q || 1))}</span></td>


      <td><span class="pf-val">${fmt(u)}</span></td>


      <td><span class="pf-val">${fmt(a)}</span></td>


    </tr>`;


  }).join('');





  return `<div class="print-form">


    <div class="form-print-header">


      <div class="form-print-header-left">


        <img class="form-print-header-logo" src="/assets/mse-logo.png" alt="MSE Tech"/>


        <div class="form-print-header-text"><div class="co-name">MSE McGann Systems Engineering</div><div class="co-detail">816 William S. Canning Blvd. Suite 1089, Fall River, MA 02721<br>(508) 233-3565 &nbsp;|&nbsp; info@msetech.org &nbsp;|&nbsp; msetech.org</div></div>


      </div>


      <div class="form-print-header-right">


        <div class="doc-type">${esc(docTypeLabel)}</div>


        <div class="doc-num">${esc(form.form_number || '')}${form.status === 'paid' ? ` <span style="display:inline-block;background:#16a34a;color:#fff;font-size:9pt;font-weight:700;letter-spacing:0.08em;padding:3px 10px;border-radius:3px;margin-left:8px;vertical-align:middle">PAID</span>` : ''}</div>


      </div>


    </div>


    <div class="pf-body">


      ${(d.__paid && form.status === 'paid') ? `<div style="margin:0 0 14px;padding:10px 14px;border-left:4px solid #16a34a;background:#f0fdf4;color:#14532d;border-radius:4px;font-size:10.5pt"><strong>PAID</strong>${d.__paid.receipt_number ? ` &middot; Receipt ${esc(d.__paid.receipt_number)}` : ''}${d.__paid.paid_on ? ` &middot; ${esc(d.__paid.paid_on)}` : ''}${d.__paid.method ? ` &middot; ${esc(d.__paid.method)}` : ''}${d.__paid.reference ? ` &middot; Ref ${esc(d.__paid.reference)}` : ''}</div>` : ''}


      <div class="form-section-bar">${esc(docTypeLabel)} Details</div>


      <div class="pf-fields-3">


        <div class="pf-field"><label>Number</label><span class="pf-val">${esc(form.form_number || 'â€”')}</span></div>


        <div class="pf-field"><label>Date Issued</label><span class="pf-val">${esc(dateIssued || 'â€”')}</span></div>


        <div class="pf-field"><label>Due Date</label><span class="pf-val">${esc(dueDate || 'â€”')}</span></div>


      </div>


      <div class="pf-fields-2">


        <div class="pf-field"><label>Terms</label><span class="pf-val">${esc(terms)}</span></div>


        <div class="pf-field"><label>Prepared By</label><span class="pf-val">${esc(preparedBy)}</span></div>


      </div>


      ${(relatedQuote || relatedWO) ? `<div class="pf-fields-2">


        ${relatedQuote ? `<div class="pf-field"><label>Related Quote No</label><span class="pf-val">${esc(relatedQuote)}</span></div>` : '<div></div>'}


        ${relatedWO ? `<div class="pf-field"><label>Work Order No</label><span class="pf-val">${esc(relatedWO)}</span></div>` : ''}


      </div>` : ''}


      <div class="form-section-bar">Bill To</div>


      <div class="pf-fields-3">


        <div class="pf-field"><label>Client / Company</label><span class="pf-val">${esc(company || 'â€”')}</span></div>


        <div class="pf-field"><label>Contact Name</label><span class="pf-val">${esc(contactName || 'â€”')}</span></div>


        <div class="pf-field"><label>Phone / Email</label><span class="pf-val">${esc(contactPhone || 'â€”')}</span></div>


      </div>


      ${project ? `<div class="form-section-bar">Project</div><div class="pf-fields-2"><div class="pf-field"><label>Description</label><span class="pf-val">${esc(project)}</span></div></div>` : ''}


      <div class="form-section-bar">Line Items</div>


      <table class="pf-table">


        <thead><tr><th style="width:40px">Item #</th><th>Description</th><th style="width:55px">Qty</th><th style="width:90px">Unit Price</th><th style="width:90px">Amount</th></tr></thead>


        <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;color:#999;padding:18px">No line items recorded</td></tr>'}</tbody>


      </table>


      ${(notes || payInst) ? `<div class="pf-fields-2" style="margin-top:14px">${notes ? `<div class="pf-field"><label>Notes</label><span class="pf-val">${esc(notes)}</span></div>` : '<div></div>'}${payInst ? `<div class="pf-field"><label>Payment Instructions</label><span class="pf-val">${esc(payInst)}</span></div>` : ''}</div>` : ''}


      <div class="form-section-bar">Pricing Summary</div>


      <div class="pf-totals">


        <div class="pf-total-row"><span class="pf-total-label">Subtotal</span><span class="pf-total-val">${fmt(subtotal)}</span></div>


        <div class="pf-total-row"><span class="pf-total-label">Tax (${taxPct}%)</span><span class="pf-total-val">${fmt(taxAmt)}</span></div>


        <div class="pf-total-row"><span class="pf-total-label">Deposit / Credit</span><span class="pf-total-val">${fmt(deposit)}</span></div>


        <div class="pf-total-row grand"><span class="pf-total-label">Balance Due</span><span class="pf-total-val">${fmt(form.amount || total)}</span></div>


      </div>


      <div class="pf-footer">MSE McGann Systems Engineering &nbsp;|&nbsp; (508) 233-3565 &nbsp;|&nbsp; info@msetech.org &nbsp;|&nbsp; msetech.org &nbsp;|&nbsp; 816 William S. Canning Blvd. Suite 1089, Fall River, MA 02721</div>


    </div>


  </div>`;


}





// ============================================================


// =================== EDIT SAVED FORM ========================


// ============================================================


// Edit-in-place state. While truthy, saveCurrentForm() updates the existing


// client_forms row instead of inserting a new one. Reset on close/cancel.


let _editingFormCtx = null;  // { id, modalId, form, originalNumber }





// Resolve a saved client_forms row to the modal id that owns its form_type.


function _modalIdForFormType(formType) {


  for (const [mid, meta] of Object.entries(formMeta)) {


    if (meta.key === formType) return mid;


  }


  return null;


}





// Hydrate a modal from a saved form's structured data. Best-effort; missing


// fields are left blank rather than crashing the modal.


function _hydrateModalFromData(modalEl, form) {


  const data = (form && form.data && typeof form.data === 'object') ? form.data : {};


  const lf = (data.__label_fields && typeof data.__label_fields === 'object') ? data.__label_fields : {};





  // 1. Direct id/name lookup â€” captures the bulk of fields written by


  //    _formInputsToData. Values written there are keyed by id (preferred)


  //    or name; we mirror that order here.


  modalEl.querySelectorAll('input, select, textarea').forEach(el => {


    if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return;


    let val;


    let hit = false;


    if (el.id && Object.prototype.hasOwnProperty.call(data, el.id)) {


      val = data[el.id]; hit = true;


    } else if (el.name && Object.prototype.hasOwnProperty.call(data, el.name)) {


      val = data[el.name]; hit = true;


    } else if (el.dataset && el.dataset.field && Object.prototype.hasOwnProperty.call(data, el.dataset.field)) {


      val = data[el.dataset.field]; hit = true;


    } else {


      // 2. Label-text fallback: same lookup _formInputsToData used to *save* it.


      const wrap = el.closest('.pf-field, label');


      let labelText = '';


      if (wrap) {


        const lbl = wrap.querySelector('label');


        if (lbl) labelText = (lbl.textContent || '').trim();


        if (!labelText && wrap.tagName === 'LABEL') labelText = ((wrap.firstChild && wrap.firstChild.textContent) || '').trim();


      }


      if (!labelText) labelText = (el.getAttribute('placeholder') || '').trim();


      if (labelText && Object.prototype.hasOwnProperty.call(lf, labelText)) {


        val = lf[labelText]; hit = true;


      }


    }


    if (!hit) return;


    try {


      if (el.type === 'checkbox') el.checked = !!val;


      else el.value = (val == null ? '' : String(val));


    } catch(_) { /* leave blank on failure */ }


  });





  // 3. Line-item table: rebuild rows from the structured array. We must


  //    drop the boilerplate rows the modal ships with and re-inject one row


  //    per saved item so qty/desc/unit_price line up.


  const itemsTable = modalEl.querySelector('table[id$="-items"]');


  if (itemsTable && Array.isArray(data.line_items) && data.line_items.length) {


    const tbody = itemsTable.querySelector('tbody');


    if (tbody) {


      // Keep the first row as a template; remove the rest so we don't


      // accumulate stale rows. addLineRow() clones from the first row.


      const first = tbody.querySelector('tr');


      if (first) {


        // Wipe everything after the first


        Array.from(tbody.querySelectorAll('tr')).slice(1).forEach(r => r.remove());


        // Add (n-1) more rows so we have one row per line item


        for (let i = 1; i < data.line_items.length; i++) {


          addLineRow(itemsTable.id);


        }


        // Now fill rows in order


        const rows = tbody.querySelectorAll('tr');


        data.line_items.forEach((it, i) => {


          const row = rows[i];


          if (!row) return;


          const cells = row.querySelectorAll('td');


          if (cells.length < 5) return;


          const setCellInput = (cell, val) => {


            const inp = cell.querySelector('input, textarea, select');


            if (inp) inp.value = (val == null ? '' : String(val));


          };


          // cells: [#, description, qty, unit_price, amount]


          setCellInput(cells[1], it.description || it.desc || '');


          setCellInput(cells[2], it.qty != null ? it.qty : 1);


          const u = parseFloat(String(it.unit_price == null ? 0 : it.unit_price).replace(/[^\d.\-]/g,'')) || 0;


          setCellInput(cells[3], u.toFixed(2));


          const a = parseFloat(String(it.amount == null ? 0 : it.amount).replace(/[^\d.\-]/g,'')) || (u * (parseFloat(it.qty) || 0));


          setCellInput(cells[4], a.toFixed(2));


        });


        // Recalculate totals from the freshly-injected rows


        try { calcLineItems(itemsTable.id); } catch(_) {}


        const meta = formMeta[modalEl.id];


        if (meta && meta.totals && typeof calcTotals === 'function') {


          try { calcTotals(meta.totals); } catch(_) {}


        }


      }


    }


  }





  // 4. Stamp the authoritative form number into the visible number/doc-num


  //    elements so the user sees what they're editing.


  const meta = formMeta[modalEl.id];


  if (meta) {


    if (meta.numEl) {


      const n = document.getElementById(meta.numEl);


      if (n) {


        n.value = form.form_number || '';


        n.setAttribute('value', form.form_number || '');


      }


    }


    if (meta.docNum) {


      const dn = document.getElementById(meta.docNum);


      if (dn) dn.textContent = form.form_number || '';


    }


    if (meta.dateEl && form.form_date) {


      const de = document.getElementById(meta.dateEl);


      if (de) de.value = form.form_date;


    }


  }


}





// Visual edit-mode marker on the modal header so users see they are


// editing an existing document, not creating a new one.


function _setModalEditMarker(modalEl, form) {


  if (!modalEl) return;


  const header = modalEl.querySelector('.modal-header h3');


  if (!header) return;


  // Stash original title once so cancel restores it cleanly.


  if (!header.dataset.origTitle) header.dataset.origTitle = header.textContent || '';


  const num = form && form.form_number ? form.form_number : (form && form.form_type) || '';


  header.innerHTML = (header.dataset.origTitle || '') +


    ' <span style="font-size:11px;font-weight:600;color:#fff;background:#c9303f;padding:3px 9px;border-radius:10px;margin-left:8px;letter-spacing:0.04em;vertical-align:middle">EDITING ' + esc(num) + '</span>';


}





function _clearModalEditMarker(modalEl) {


  if (!modalEl) return;


  const header = modalEl.querySelector('.modal-header h3');


  if (!header) return;


  if (header.dataset.origTitle) {


    header.textContent = header.dataset.origTitle;


    delete header.dataset.origTitle;


  }


}





// Public: open an existing client_forms row in its modal for editing.


async function editClientForm(formId) {


  if (!sb) { showToast('Not signed in', 'error'); return; }


  // Don't let a stale edit context leak between two edits.


  _editingFormCtx = null;


  try {


    const { data: form, error } = await sb.from('client_forms').select('*').eq('id', formId).single();


    if (error) throw error;


    if (!form) throw new Error('Form not found');


    const modalId = _modalIdForFormType(form.form_type);


    if (!modalId) {


      showToast('Editing not supported for ' + form.form_type, 'error');


      return;


    }


    const modalEl = document.getElementById(modalId);


    if (!modalEl) {


      showToast('Form modal not found', 'error');


      return;


    }


    // Open first (initFormModal resets fields), then hydrate.


    openModal(modalId);


    // Defer hydration a tick so initFormModal's resets land first and any


    // openModal hooks complete. Without this, our values get clobbered.


    setTimeout(() => {


      _hydrateModalFromData(modalEl, form);


      _setModalEditMarker(modalEl, form);


      _editingFormCtx = {


        id: form.id,


        modalId: modalId,


        form: form,


        originalNumber: form.form_number || ''


      };


      showToast('Editing ' + (form.form_number || form.form_type), 'info');


    }, 30);


  } catch(e) {


    console.warn('editClientForm failed:', e);


    showToast('Edit failed: ' + (e.message || 'unknown'), 'error');


  }


}





// Patch closeModal so leaving an edit-in-progress clears the edit context


// and the visual marker. Otherwise the next "New Invoice" click would land


// on top of stale state and quietly update the wrong row.


(function patchCloseModalForEdit(){


  const _origClose = window.closeModal;


  window.closeModal = function(id) {


    if (_editingFormCtx && _editingFormCtx.modalId === id) {


      const modalEl = document.getElementById(id);


      _clearModalEditMarker(modalEl);


      _editingFormCtx = null;


    }


    if (typeof _origClose === 'function') return _origClose(id);


    const el = document.getElementById(id); if (el) el.classList.remove('open');


  };


})();





async function deleteClientForm(formId) {


  if (!confirm('Delete this document? This cannot be undone.')) return;


  try {


    const { data: form } = await sb.from('client_forms').select('pdf_path,client_id').eq('id', formId).single();


    if (form?.pdf_path) {


      try { await sb.storage.from(FORMS_BUCKET).remove([form.pdf_path]); } catch(e) { /* ignore */ }


    }


    await sb.from('client_forms').delete().eq('id', formId);


    if (form?.client_id) await loadClientForms(form.client_id);


    showToast('Deleted', 'success');


    renderClientForms();


    if (typeof loadAllDocuments === 'function') loadAllDocuments();


  } catch(e) { showToast('Delete failed: ' + (e.message||'unknown'), 'error'); }


}





// Documents-page attachment actions. The ticket panel has its own


// viewTicketAttachment / deleteTicketAttachment that operate on _tpAttachments;


// these globals work off the Documents-page _allDocuments cache so the rows


// rendered by _docsRowHtml have functional View / Delete buttons regardless


// of which parent (ticket / client / form) owns the attachment.


async function viewAttachment(id) {


  const a = (_allDocuments || []).find(x => x._kind === 'attach' && String(x.id) === String(id));


  if (!a) { showToast('Attachment not found â€” try Refresh', 'error'); return; }


  const path = a.storage_path || a.path;


  // Drive-hosted files predate Supabase Storage; fall back to opening the


  // public Drive viewer URL when no storage_path is recorded.


  if (!path && a.gdrive_file_id) {


    window.open('https://drive.google.com/file/d/' + encodeURIComponent(a.gdrive_file_id) + '/view', '_blank');


    return;


  }


  if (!path) { showToast('No file path on this attachment', 'error'); return; }


  const bucket = a.bucket || TICKET_ATT_BUCKET;


  try {


    const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);


    if (error) throw error;


    if (data && data.signedUrl) window.open(data.signedUrl, '_blank');


    else throw new Error('No signed URL returned');


  } catch(e) {


    console.warn('[documents] viewAttachment failed:', e);


    showToast('Could not open file: ' + (e.message || 'unknown'), 'error');


  }


}





async function deleteAttachment(id) {


  const idx = (_allDocuments || []).findIndex(x => x._kind === 'attach' && String(x.id) === String(id));


  if (idx === -1) { showToast('Attachment not found â€” try Refresh', 'error'); return; }


  const a = _allDocuments[idx];


  // Match deleteTicketAttachment's chain-of-evidence wording so staff get the


  // same warning whether they delete from the ticket panel or the master


  // Documents page.


  if (!confirmDelete(


    'attachment "' + (a.filename || 'this attachment') + '"',


    'This may be evidence on the ticket and is logged in the audit trail.'


  )) return;


  const path = a.storage_path || a.path;


  const bucket = a.bucket || TICKET_ATT_BUCKET;


  try {


    if (path) {


      // Best-effort storage cleanup. Failure here shouldn't block the DB row


      // delete â€” orphaned bytes are recoverable, a stuck row is not.


      try { await sb.storage.from(bucket).remove([path]); } catch(_) {}


    }


    const { error } = await sb.from('attachments').delete().eq('id', a.id);


    if (error) throw error;


    _allDocuments.splice(idx, 1);


    renderAllDocuments();


    showToast('Attachment removed', 'success');


    try {


      if (a.parent_type && a.parent_id) {


        await sbInsertAudit(a.parent_type === 'ticket' ? 'tickets' : a.parent_type, a.parent_id, 'Delete', 'Removed attachment: ' + (a.filename || ''));


      }


    } catch(_) {}


  } catch(e) {


    console.warn('[documents] deleteAttachment failed:', e);


    showToast('Delete failed: ' + (e.message || 'unknown'), 'error');


  }


}





