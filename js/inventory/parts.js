// ========== INVENTORY: PARTS ==========


let DB_PARTS = [];


let activePartId = null;


let DB_PART_TRANSACTIONS = [];





// ---- Image resize helper ----


async function resizeImageBeforeUpload(file, maxDim) {


  maxDim = maxDim || 1600;


  return new Promise(function(resolve) {


    var img = new Image();


    img.onload = function() {


      var canvas = document.createElement('canvas');


      var scale = Math.min(maxDim / img.width, maxDim / img.height, 1);


      canvas.width = Math.round(img.width * scale);


      canvas.height = Math.round(img.height * scale);


      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);


      canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', 0.85);


    };


    img.src = URL.createObjectURL(file);


  });


}





// ---- Format helpers ----


function fmtPartCurrency(v) {


  var n = parseFloat(v) || 0;


  return '$' + n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});


}


function fmtPartDate(s) {


  if (!s) return 'â€”';


  var d = new Date(s);


  if (isNaN(d)) return s;


  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


  return months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();


}


function getPartStockLevel(part) {


  var qty = parseFloat(part.quantity_on_hand) || 0;


  var thresh = parseFloat(part.reorder_threshold) || 0;


  if (qty <= 0) return 'out';


  if (thresh > 0 && qty <= thresh) return 'low';


  if (thresh > 0 && qty <= thresh * 1.5) return 'warn';


  return 'ok';


}


function partStockColor(level) {


  if (level === 'out') return 'var(--primary)';


  if (level === 'low') return 'var(--primary)';


  if (level === 'warn') return 'var(--gold)';


  return 'var(--success)';


}





// ---- Load from Supabase ----


async function loadPartsFromSupabase() {


  if (!sb) return;


  try {


    var res = await sb.from('parts').select('*, vendors(company_name)').order('name');


    if (res.error) throw res.error;


    DB_PARTS = res.data || [];


    renderPartsList();


    renderPartsKPIs();


  } catch(e) {


    console.warn('Load parts failed:', e);


    showToast('Could not load parts', 'error');


    renderPartsList();


    renderPartsKPIs();


  }


}





async function loadPartTransactions(partId) {


  if (!partId) return;


  var el = document.getElementById('pp-txn-list');


  if (el) el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">Loadingâ€¦</div>';


  try {


    if (!sb) throw new Error('No Supabase');


    var res = await sb.from('part_transactions')


      .select('*')


      .eq('part_id', partId)


      .order('transaction_date', {ascending: false})


      .order('created_at', {ascending: false});


    if (res.error) throw res.error;


    DB_PART_TRANSACTIONS = res.data || [];


    renderPartTransactionList();


  } catch(e) {


    console.warn('Load part transactions failed:', e);


    if (el) el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">Could not load transactions</div>';


  }


}





// ---- KPIs ----


function renderPartsKPIs() {


  var skus = DB_PARTS.length;


  var totalValue = DB_PARTS.reduce(function(sum, p) {


    return sum + (parseFloat(p.quantity_on_hand) || 0) * (parseFloat(p.unit_cost) || 0);


  }, 0);


  var lowStock = DB_PARTS.filter(function(p) {


    var qty = parseFloat(p.quantity_on_hand) || 0;


    var thresh = parseFloat(p.reorder_threshold) || 0;


    return thresh > 0 && qty <= thresh;


  }).length;


  var skusEl = document.getElementById('parts-kpi-skus');


  var valEl = document.getElementById('parts-kpi-value');


  var lowEl = document.getElementById('parts-kpi-lowstock');


  var lowSubEl = document.getElementById('parts-kpi-lowstock-sub');


  var txnEl = document.getElementById('parts-kpi-txns');


  if (skusEl) skusEl.textContent = skus;


  var skuSubEl = document.getElementById('parts-kpi-skus-sub');


  if (skuSubEl) skuSubEl.textContent = skus === 1 ? '1 unique part' : skus + ' unique parts';


  if (valEl) valEl.textContent = fmtPartCurrency(totalValue);


  if (lowEl) lowEl.textContent = lowStock;


  if (lowSubEl) lowSubEl.textContent = lowStock === 0 ? 'All stocked OK' : lowStock + ' need reordering';


  if (txnEl) txnEl.textContent = 'â€”';


  // Load recent transaction count if connected


  if (sb && sbConnected) {


    var thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();


    sb.from('part_transactions').select('id', {count: 'exact', head: true})


      .gte('created_at', thirtyAgo)


      .then(function(res) {


        if (txnEl && res && !res.error) txnEl.textContent = res.count || 0;


      }).catch(function() {});


  }


}





// ---- List renderer ----


function renderPartsList() {


  var body = document.getElementById('parts-table-body');


  var emptyEl = document.getElementById('parts-empty');


  if (!body) return;


  var search = (document.getElementById('parts-search') || {}).value || '';


  var catFilter = (document.getElementById('parts-filter-cat') || {}).value || '';


  var stockFilter = (document.getElementById('parts-filter-stock') || {}).value || '';


  var sortVal = (document.getElementById('parts-sort') || {}).value || 'name';


  var items = DB_PARTS.slice();


  if (search) {


    var q = search.toLowerCase();


    items = items.filter(function(p) {


      return (p.name || '').toLowerCase().includes(q) ||


             (p.part_number || '').toLowerCase().includes(q) ||


             (p.manufacturer_part || '').toLowerCase().includes(q) ||


             (p.category || '').toLowerCase().includes(q);


    });


  }


  if (catFilter) {


    items = items.filter(function(p) { return p.category === catFilter; });


  }


  if (stockFilter) {


    items = items.filter(function(p) {


      var level = getPartStockLevel(p);


      if (stockFilter === 'out') return level === 'out';


      if (stockFilter === 'low') return level === 'low' || level === 'warn';


      if (stockFilter === 'in') return level === 'ok';


      return true;


    });


  }


  if (sortVal === 'name') items.sort(function(a,b) { return (a.name||'').localeCompare(b.name||''); });


  else if (sortVal === 'qty') items.sort(function(a,b) { return (parseFloat(a.quantity_on_hand)||0) - (parseFloat(b.quantity_on_hand)||0); });


  else if (sortVal === 'value') items.sort(function(a,b) { return ((parseFloat(b.quantity_on_hand)||0)*(parseFloat(b.unit_cost)||0)) - ((parseFloat(a.quantity_on_hand)||0)*(parseFloat(a.unit_cost)||0)); });


  else if (sortVal === 'part_number') items.sort(function(a,b) { return (a.part_number||'').localeCompare(b.part_number||''); });


  if (items.length === 0 && DB_PARTS.length === 0) {


    body.innerHTML = '';


    if (emptyEl) emptyEl.style.display = 'block';


    return;


  }


  if (emptyEl) emptyEl.style.display = 'none';


  body.innerHTML = items.map(function(p) {


    var qty = parseFloat(p.quantity_on_hand) || 0;


    var cost = parseFloat(p.unit_cost) || 0;


    var totalVal = qty * cost;


    var level = getPartStockLevel(p);


    var qtyColor = partStockColor(level);


    var photoHtml = p.primary_photo_url


      ? '<img src="' + esc(p.primary_photo_url) + '" style="width:36px;height:36px;object-fit:cover;border-radius:8px"/>'


      : '<div style="width:36px;height:36px;background:var(--surface2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px">ðŸ“¦</div>';


    return '<tr onclick="openPartPanel(\'' + esc(p.id) + '\')" style="border-bottom:1px solid var(--border2);cursor:pointer;transition:background .12s" onmouseenter="this.style.background=\'rgba(255,255,255,.03)\'" onmouseleave="this.style.background=\'\'">' +


      '<td style="padding:10px 12px">' + photoHtml + '</td>' +


      '<td style="padding:10px 12px;font-family:monospace;font-size:12px;color:var(--muted)">' + esc(p.part_number || 'â€”') + '</td>' +


      '<td style="padding:10px 12px"><div style="font-weight:600;font-size:13px">' + esc(p.name || 'â€”') + '</div>' +


        (p.manufacturer_part ? '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + esc(p.manufacturer_part) + '</div>' : '') +


      '</td>' +


      '<td style="padding:10px 12px"><span style="background:var(--surface2);border-radius:6px;padding:3px 8px;font-size:11px;color:var(--muted)">' + esc(p.category || 'â€”') + '</span></td>' +


      '<td style="padding:10px 12px;text-align:right;font-weight:700;color:' + qtyColor + ';font-size:14px">' + qty + ' <span style="font-size:11px;font-weight:400;color:var(--muted)">' + esc(p.unit || '') + '</span></td>' +


      '<td style="padding:10px 12px;text-align:right;color:var(--muted);font-size:13px">' + fmtPartCurrency(cost) + '</td>' +


      '<td style="padding:10px 12px;text-align:right;font-size:13px">' + fmtPartCurrency(totalVal) + '</td>' +


      '<td style="padding:10px 12px;text-align:right">' +


        '<div style="display:flex;gap:6px;justify-content:flex-end">' +


          '<button class="btn-secondary" style="padding:5px 10px;font-size:11px;border-radius:8px" onclick="event.stopPropagation();openReceivePartModal(\'' + esc(p.id) + '\')" title="Receive stock">+</button>' +


          '<button class="btn-secondary" style="padding:5px 10px;font-size:11px;border-radius:8px" onclick="event.stopPropagation();openUsePartModal(\'' + esc(p.id) + '\')" title="Use stock">âˆ’â€™</button>' +


        '</div>' +


      '</td>' +


    '</tr>';


  }).join('');


  if (items.length === 0) {


    body.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--muted);font-size:13px">No parts match your filters</td></tr>';


  }


}





// ---- Part detail panel ----


function openPartPanel(id) {


  var part = DB_PARTS.find(function(p) { return p.id === id; });


  if (!part) return;


  activePartId = id;


  // Header


  var nameEl = document.getElementById('part-name');


  var pnumEl = document.getElementById('pp-partnum');


  if (nameEl) nameEl.textContent = part.name || 'Part';


  if (pnumEl) pnumEl.textContent = part.part_number || '';


  // Qty display


  var qty = parseFloat(part.quantity_on_hand) || 0;


  var level = getPartStockLevel(part);


  var qtyEl = document.getElementById('pp-qty-display');


  var qtyUnitEl = document.getElementById('pp-qty-unit');


  if (qtyEl) { qtyEl.textContent = qty; qtyEl.style.color = partStockColor(level); }


  if (qtyUnitEl) qtyUnitEl.textContent = part.unit || '';


  // Photo


  var photoImg = document.getElementById('pp-photo');


  var photoPlaceholder = document.getElementById('pp-photo-placeholder');


  if (part.primary_photo_url && photoImg) {


    photoImg.src = part.primary_photo_url;


    photoImg.style.display = 'block';


    if (photoPlaceholder) photoPlaceholder.style.display = 'none';


  } else {


    if (photoImg) photoImg.style.display = 'none';


    if (photoPlaceholder) photoPlaceholder.style.display = 'flex';


  }


  // Form fields


  var setVal = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };


  setVal('pp-edit-name', part.name);


  setVal('pp-edit-partnum', part.part_number);


  setVal('pp-edit-mfr', part.manufacturer_part);


  setVal('pp-edit-cat', part.category);


  setVal('pp-edit-unit', part.unit);


  setVal('pp-edit-reorder-thresh', part.reorder_threshold);


  setVal('pp-edit-reorder-qty', part.reorder_quantity);


  setVal('pp-edit-cost', part.unit_cost);


  setVal('pp-edit-notes', part.notes);


  // Vendor select


  var vendorSel = document.getElementById('pp-edit-vendor');


  if (vendorSel) {


    var vendorName = (part.vendors && part.vendors.company_name) || '';


    for (var i = 0; i < vendorSel.options.length; i++) {


      if (vendorSel.options[i].text === vendorName) { vendorSel.selectedIndex = i; break; }


    }


  }


  // Show panel


  switchPartTab('overview');


  document.getElementById('partOverlay').classList.add('open');


  document.getElementById('partPanel').classList.add('open');


}





function closePartPanel() {


  document.getElementById('partOverlay').classList.remove('open');


  document.getElementById('partPanel').classList.remove('open');


  activePartId = null;


}





function switchPartTab(tab) {


  var tabs = ['overview','transactions','documents','activity'];


  tabs.forEach(function(t) {


    var btn = document.getElementById('pp-tab-' + t);


    var content = document.getElementById('pp-content-' + t);


    var isActive = t === tab;


    if (btn) {


      btn.style.borderBottomColor = isActive ? 'var(--primary)' : 'transparent';


      btn.style.color = isActive ? 'var(--text)' : 'var(--muted)';


    }


    if (content) content.style.display = isActive ? 'block' : 'none';


  });


  if (tab === 'transactions') loadPartTransactions(activePartId);


  if (tab === 'documents') loadPartDocuments(activePartId);


  if (tab === 'activity') loadPartActivity(activePartId);


}





async function savePartPanel() {


  if (!activePartId) return;


  if (!sb || !sbConnected) { showToast('Not connected to database', 'error'); return; }


  var name = (document.getElementById('pp-edit-name') || {}).value || '';


  if (!name.trim()) { showToast('Part name is required', 'error'); return; }


  var updates = {


    name: name.trim(),


    manufacturer_part: (document.getElementById('pp-edit-mfr') || {}).value || null,


    category: (document.getElementById('pp-edit-cat') || {}).value || null,


    unit: (document.getElementById('pp-edit-unit') || {}).value || 'each',


    reorder_threshold: parseFloat((document.getElementById('pp-edit-reorder-thresh') || {}).value) || null,


    reorder_quantity: parseFloat((document.getElementById('pp-edit-reorder-qty') || {}).value) || null,


    unit_cost: parseFloat((document.getElementById('pp-edit-cost') || {}).value) || null,


    notes: (document.getElementById('pp-edit-notes') || {}).value || null,


    updated_at: new Date().toISOString()


  };


  // Photo upload if a new file was selected


  var photoFile = document.getElementById('pp-photo-upload');


  if (photoFile && photoFile.files && photoFile.files[0]) {


    try {


      var url = await uploadPartPhoto(photoFile.files[0], activePartId);


      if (url) updates.primary_photo_url = url;


    } catch(pe) { console.warn('Photo upload failed:', pe); }


  }


  try {


    var res = await sb.from('parts').update(updates).eq('id', activePartId);


    if (res.error) throw res.error;


    await sbInsertAudit('parts', activePartId, 'update', 'Part details updated');


    showToast('Part saved', 'success');


    await loadPartsFromSupabase();


    // Refresh panel header


    var updatedPart = DB_PARTS.find(function(p) { return p.id === activePartId; });


    if (updatedPart) {


      var nameEl = document.getElementById('part-name');


      if (nameEl) nameEl.textContent = updatedPart.name || 'Part';


    }


  } catch(e) {


    console.error('Save part failed:', e);


    showToast('Save failed: ' + (e.message || e), 'error');


  }


}





function previewPartPhoto(input) {


  if (!input.files || !input.files[0]) return;


  var reader = new FileReader();


  reader.onload = function(ev) {


    var photoImg = document.getElementById('pp-photo');


    var placeholder = document.getElementById('pp-photo-placeholder');


    if (photoImg) { photoImg.src = ev.target.result; photoImg.style.display = 'block'; }


    if (placeholder) placeholder.style.display = 'none';


  };


  reader.readAsDataURL(input.files[0]);


}





// ---- Upload helpers ----


async function uploadPartPhoto(file, partId) {


  if (!sb || !partId) return null;


  var blob = await resizeImageBeforeUpload(file);


  var ts = Date.now();


  var ext = file.name.split('.').pop() || 'jpg';


  var path = 'parts/' + partId + '/' + ts + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');


  var uploadRes = await sb.storage.from('inventory-photos').upload(path, blob, {contentType: 'image/jpeg', upsert: true});


  if (uploadRes.error) throw uploadRes.error;


  var pubRes = sb.storage.from('inventory-photos').getPublicUrl(path);


  var url = pubRes.data && pubRes.data.publicUrl ? pubRes.data.publicUrl : null;


  // Insert part_documents row


  if (url) {


    await sb.from('part_documents').insert({


      part_id: partId,


      doc_type: 'photo_primary',


      file_name: file.name,


      file_url: url,


      file_size: blob.size,


      mime_type: 'image/jpeg',


      uploaded_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


      uploaded_at: new Date().toISOString()


    }).then(function(){}).catch(function(e) { console.warn('part_documents insert failed:', e); });


  }


  return url;


}





async function uploadPartDocument(input) {


  if (!activePartId) return;


  if (!input.files || !input.files[0]) return;


  var file = input.files[0];


  if (!sb || !sbConnected) { showToast('Not connected', 'error'); return; }


  try {


    var ts = Date.now();


    var isImage = file.type.startsWith('image/');


    var blob = isImage ? await resizeImageBeforeUpload(file) : file;


    var path = 'parts/' + activePartId + '/' + ts + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');


    var mime = isImage ? 'image/jpeg' : file.type;


    var uploadRes = await sb.storage.from('inventory-photos').upload(path, blob, {contentType: mime, upsert: true});


    if (uploadRes.error) throw uploadRes.error;


    var pubRes = sb.storage.from('inventory-photos').getPublicUrl(path);


    var url = pubRes.data && pubRes.data.publicUrl ? pubRes.data.publicUrl : null;


    var docType = isImage ? 'photo_gallery' : 'other';


    await sb.from('part_documents').insert({


      part_id: activePartId,


      doc_type: docType,


      file_name: file.name,


      file_url: url,


      file_size: blob.size,


      mime_type: mime,


      uploaded_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


      uploaded_at: new Date().toISOString()


    });


    await sbInsertAudit('part_documents', activePartId, 'upload', 'Document uploaded: ' + file.name);


    showToast('Document uploaded', 'success');


    loadPartDocuments(activePartId);


  } catch(e) {


    console.error('Upload part document failed:', e);


    showToast('Upload failed: ' + (e.message || e), 'error');


  }


  input.value = '';


}





// ---- Documents tab ----


async function loadPartDocuments(partId) {


  var el = document.getElementById('pp-doc-list');


  if (!el) return;


  if (!partId || !sb) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">No documents yet</div>';


    return;


  }


  try {


    var res = await sb.from('part_documents').select('*').eq('part_id', partId).order('uploaded_at', {ascending: false});


    if (res.error) throw res.error;


    var docs = res.data || [];


    if (docs.length === 0) {


      el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">No documents yet</div>';


      return;


    }


    el.innerHTML = docs.map(function(d) {


      var isImage = (d.mime_type || '').startsWith('image/');


      var thumb = isImage ? '<img src="' + esc(d.file_url) + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px;margin-right:12px"/>' : '<div style="width:48px;height:48px;background:var(--surface2);border-radius:8px;margin-right:12px;display:flex;align-items:center;justify-content:center;font-size:20px">ðŸ“„</div>';


      return '<div style="display:flex;align-items:center;background:var(--surface2);border-radius:10px;padding:10px;border:1px solid var(--border)">' +


        thumb +


        '<div style="flex:1;min-width:0">' +


          '<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(d.file_name || 'File') + '</div>' +


          '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + esc(d.doc_type || '') + (d.uploaded_at ? ' Â· ' + fmtPartDate(d.uploaded_at) : '') + '</div>' +


        '</div>' +


        (d.file_url ? '<a href="' + esc(d.file_url) + '" target="_blank" style="margin-left:8px;font-size:12px;color:var(--blue);text-decoration:none;flex-shrink:0">View</a>' : '') +


      '</div>';


    }).join('');


  } catch(e) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">Could not load documents</div>';


  }


}





// ---- Activity tab ----


async function loadPartActivity(partId) {


  var el = document.getElementById('pp-activity-list');


  if (!el) return;


  el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">Loadingâ€¦</div>';


  if (!partId || !sb) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">No activity yet</div>';


    return;


  }


  try {


    var res = await sb.from('accounting_audit_log').select('*')


      .eq('table_name', 'parts')


      .eq('record_id', String(partId))


      .order('created_at', {ascending: false})


      .limit(50);


    if (res.error) throw res.error;


    var rows = res.data || [];


    if (rows.length === 0) {


      el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">No activity recorded yet</div>';


      return;


    }


    el.innerHTML = rows.map(function(r) {


      return '<div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border)">' +


        '<div style="display:flex;align-items:center;justify-content:space-between">' +


          '<span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + esc(r.action || '') + '</span>' +


          '<span style="font-size:11px;color:var(--muted)">' + fmtPartDate(r.created_at) + '</span>' +


        '</div>' +


        '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + esc(r.note || r.changed_by || '') + '</div>' +


      '</div>';


    }).join('');


  } catch(e) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">Could not load activity</div>';


  }


}





// ---- Transaction list renderer ----


function renderPartTransactionList() {


  var el = document.getElementById('pp-txn-list');


  if (!el) return;


  if (DB_PART_TRANSACTIONS.length === 0) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">No transactions yet</div>';


    return;


  }


  var txnTypeColors = {


    received: 'var(--success)',


    used: 'var(--primary)',


    adjusted: 'var(--gold)',


    returned: 'var(--blue)',


    damaged: 'var(--primary)'


  };


  var txnTypeLabels = {


    received: '+ Received',


    used: 'âˆ’â€™ Used',


    adjusted: 'â‰ˆ Adjusted',


    returned: 'â†© Returned',


    damaged: 'âš Â  Damaged'


  };


  var running = 0;


  var withBalance = DB_PART_TRANSACTIONS.slice().reverse().map(function(t) {


    var q = parseFloat(t.quantity) || 0;


    if (t.transaction_type === 'received' || t.transaction_type === 'returned') running += q;


    else if (t.transaction_type === 'used' || t.transaction_type === 'damaged') running -= q;


    else if (t.transaction_type === 'adjusted') running = q;


    return Object.assign({}, t, {_running: running});


  }).reverse();


  el.innerHTML = withBalance.map(function(t) {


    var color = txnTypeColors[t.transaction_type] || 'var(--muted)';


    var label = txnTypeLabels[t.transaction_type] || t.transaction_type;


    var qty = parseFloat(t.quantity) || 0;


    return '<div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border)">' +


      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +


        '<div style="flex:1">' +


          '<span style="font-size:12px;font-weight:700;color:' + color + '">' + label + '</span>' +


          '<span style="font-size:13px;font-weight:700;margin-left:8px">' + qty + '</span>' +


          (t.performed_by ? '<span style="font-size:11px;color:var(--muted);margin-left:6px">by ' + esc(t.performed_by) + '</span>' : '') +


          (t.notes ? '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + esc(t.notes) + '</div>' : '') +


        '</div>' +


        '<div style="text-align:right;flex-shrink:0">' +


          '<div style="font-size:11px;color:var(--muted)">' + fmtPartDate(t.transaction_date || t.created_at) + '</div>' +


          '<div style="font-size:12px;color:var(--muted);margin-top:2px">Bal: ' + (t._running || 0) + '</div>' +


          (t.total_cost ? '<div style="font-size:12px;color:var(--muted)">' + fmtPartCurrency(t.total_cost) + '</div>' : '') +


        '</div>' +


      '</div>' +


    '</div>';


  }).join('');


}





// ---- Generate next part number ----


async function getNextPartNumber() {


  try {


    if (!sb) return 'MSE-P-0001';


    var res = await sb.from('parts').select('part_number').order('part_number', {ascending: false}).limit(1);


    if (res.error || !res.data || res.data.length === 0) return 'MSE-P-0001';


    var last = res.data[0].part_number || 'MSE-P-0000';


    var m = last.match(/(\d+)$/);


    var n = m ? parseInt(m[1]) + 1 : 1;


    return 'MSE-P-' + String(n).padStart(4, '0');


  } catch(e) {


    return 'MSE-P-' + String(DB_PARTS.length + 1).padStart(4, '0');


  }


}





// ---- Open modal helpers ----


async function openModal_newPart() {


  var pn = await getNextPartNumber();


  var el = document.getElementById('np-partnum');


  if (el) el.value = pn;


  // Reset fields


  ['np-mfr','np-name','np-notes'].forEach(function(id) { var e = document.getElementById(id); if(e) e.value=''; });


  ['np-cat','np-unit'].forEach(function(id) { var e = document.getElementById(id); if(e) e.selectedIndex=0; });


  ['np-reorder-thresh','np-reorder-qty','np-cost'].forEach(function(id) { var e = document.getElementById(id); if(e) e.value=''; });


  var initQty = document.getElementById('np-init-qty'); if(initQty) initQty.value='0';


  openModal('modal-new-part');


}





function openReceivePartModal(partId) {


  var part = DB_PARTS.find(function(p) { return p.id === partId; });


  if (!part) return;


  var infoEl = document.getElementById('rp-part-info');


  var qtyEl = document.getElementById('rp-current-qty');


  var hiddenEl = document.getElementById('rp-part-id');


  if (infoEl) infoEl.textContent = (part.part_number ? part.part_number + ' â€” ' : '') + (part.name || '');


  if (qtyEl) qtyEl.textContent = 'Current qty: ' + (parseFloat(part.quantity_on_hand) || 0) + ' ' + (part.unit || '');


  if (hiddenEl) hiddenEl.value = partId;


  // Default unit cost from part


  var costEl = document.getElementById('rp-unit-cost');


  if (costEl) costEl.value = parseFloat(part.unit_cost) || '';


  // Default vendor


  var vendorSel = document.getElementById('rp-vendor');


  if (vendorSel && part.vendors && part.vendors.company_name) {


    for (var i = 0; i < vendorSel.options.length; i++) {


      if (vendorSel.options[i].text === part.vendors.company_name) { vendorSel.selectedIndex = i; break; }


    }


  }


  // Default date to today


  var dateEl = document.getElementById('rp-date');


  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];


  ['rp-qty','rp-notes'].forEach(function(id) { var e = document.getElementById(id); if(e) e.value=''; });


  var receiptEl = document.getElementById('rp-receipt'); if(receiptEl) receiptEl.value='';


  calcReceivePart();


  openModal('modal-receive-part');


}





function openUsePartModal(partId) {


  var part = DB_PARTS.find(function(p) { return p.id === partId; });


  if (!part) return;


  document.getElementById('up-part-info').textContent = (part.part_number ? part.part_number + ' â€” ' : '') + (part.name || '');


  document.getElementById('up-current-qty').textContent = 'Current qty: ' + (parseFloat(part.quantity_on_hand) || 0) + ' ' + (part.unit || '');


  document.getElementById('up-part-id').value = partId;


  ['up-qty','up-ticket-id','up-notes'].forEach(function(id) { var e = document.getElementById(id); if(e) e.value=''; });


  var dateEl = document.getElementById('up-date'); if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];


  // Load assets for dropdown


  var assetSel = document.getElementById('up-asset-id');


  if (assetSel && sb && sbConnected) {


    sb.from('assets').select('id,name,asset_tag').order('name').limit(100).then(function(res) {


      if (res.data) {


        assetSel.innerHTML = '<option value="">None</option>' + res.data.map(function(a) {


          return '<option value="' + esc(a.id) + '">' + esc((a.asset_tag ? a.asset_tag + ' â€” ' : '') + (a.name || a.id)) + '</option>';


        }).join('');


      }


    }).catch(function(){});


  }


  openModal('modal-use-part');


}





function openAdjustPartModal(partId) {


  var part = DB_PARTS.find(function(p) { return p.id === partId; });


  if (!part) return;


  document.getElementById('ap-part-info').textContent = (part.part_number ? part.part_number + ' â€” ' : '') + (part.name || '');


  document.getElementById('ap-system-qty').textContent = parseFloat(part.quantity_on_hand) || 0;


  document.getElementById('ap-part-id').value = partId;


  ['ap-actual-qty','ap-notes'].forEach(function(id) { var e = document.getElementById(id); if(e) e.value=''; });


  var reasonEl = document.getElementById('ap-reason'); if(reasonEl) reasonEl.selectedIndex=0;


  openModal('modal-adjust-part');


}





function calcReceivePart() {


  var qty = parseFloat((document.getElementById('rp-qty') || {}).value) || 0;


  var cost = parseFloat((document.getElementById('rp-unit-cost') || {}).value) || 0;


  var totalEl = document.getElementById('rp-total-cost');


  if (totalEl) totalEl.value = '$' + (qty * cost).toFixed(2);


}





// ---- Open new-part modal with async part# generation ----


function openNewPartModal() {


  // Reset fields


  ['np-mfr','np-name','np-notes'].forEach(function(id) { var e = document.getElementById(id); if(e) e.value=''; });


  ['np-reorder-thresh','np-reorder-qty','np-cost'].forEach(function(id) { var e = document.getElementById(id); if(e) e.value=''; });


  var initQty = document.getElementById('np-init-qty'); if(initQty) initQty.value='0';


  var catSel = document.getElementById('np-cat'); if(catSel) catSel.selectedIndex=0;


  var unitSel = document.getElementById('np-unit'); if(unitSel) unitSel.selectedIndex=0;


  var pnEl = document.getElementById('np-partnum'); if(pnEl) pnEl.value='Generatingâ€¦';


  openModal('modal-new-part');


  getNextPartNumber().then(function(pn) {


    var el = document.getElementById('np-partnum');


    if (el) el.value = pn;


  }).catch(function(){});


}





// ---- Create Part ----


async function createPart() {


  var name = (document.getElementById('np-name') || {}).value || '';


  var cat = (document.getElementById('np-cat') || {}).value || '';


  var unit = (document.getElementById('np-unit') || {}).value || 'each';


  if (!name.trim()) { showToast('Part name is required', 'error'); return; }


  if (!cat) { showToast('Category is required', 'error'); return; }


  if (!sb || !sbConnected) { showToast('Not connected to database', 'error'); return; }


  var partNum = (document.getElementById('np-partnum') || {}).value || await getNextPartNumber();


  var payload = {


    part_number: partNum,


    manufacturer_part: (document.getElementById('np-mfr') || {}).value || null,


    name: name.trim(),


    category: cat,


    unit: unit,


    quantity_on_hand: 0,


    reorder_threshold: parseFloat((document.getElementById('np-reorder-thresh') || {}).value) || null,


    reorder_quantity: parseFloat((document.getElementById('np-reorder-qty') || {}).value) || null,


    unit_cost: parseFloat((document.getElementById('np-cost') || {}).value) || null,


    notes: (document.getElementById('np-notes') || {}).value || null,


    created_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


    created_at: new Date().toISOString(),


    updated_at: new Date().toISOString()


  };


  try {


    var res = await sb.from('parts').insert(payload).select().single();


    if (res.error) throw res.error;


    var newPart = res.data;


    var newId = newPart.id;


    // Upload photo if provided


    var photoInput = document.getElementById('np-photo');


    if (photoInput && photoInput.files && photoInput.files.length > 0) {


      try {


        var url = await uploadPartPhoto(photoInput.files[0], newId);


        if (url) {


          await sb.from('parts').update({primary_photo_url: url}).eq('id', newId);


        }


      } catch(pe) { console.warn('Photo upload failed:', pe); }


    }


    // Initial quantity transaction


    var initQty = parseFloat((document.getElementById('np-init-qty') || {}).value) || 0;


    if (initQty > 0) {


      var unitCost = parseFloat((document.getElementById('np-cost') || {}).value) || 0;


      await sb.from('part_transactions').insert({


        part_id: newId,


        transaction_type: 'received',


        quantity: initQty,


        unit_cost: unitCost || null,


        total_cost: unitCost ? initQty * unitCost : null,


        performed_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


        transaction_date: new Date().toISOString().split('T')[0],


        notes: 'Initial stock entry',


        created_at: new Date().toISOString()


      });


    }


    await sbInsertAudit('parts', newId, 'create', 'Part created: ' + partNum + ' â€” ' + name);


    showToast('Part created: ' + partNum, 'success');


    closeModal('modal-new-part');


    await loadPartsFromSupabase();


  } catch(e) {


    console.error('Create part failed:', e);


    showToast('Failed to create part: ' + (e.message || e), 'error');


  }


}





// ---- Receive Part ----


async function receivePartSubmit() {


  var partId = (document.getElementById('rp-part-id') || {}).value || '';


  var qty = parseFloat((document.getElementById('rp-qty') || {}).value) || 0;


  var unitCost = parseFloat((document.getElementById('rp-unit-cost') || {}).value) || null;


  var vendor = (document.getElementById('rp-vendor') || {}).value || null;


  var dateVal = (document.getElementById('rp-date') || {}).value || new Date().toISOString().split('T')[0];


  var notes = (document.getElementById('rp-notes') || {}).value || null;


  var autoBill = document.getElementById('rp-auto-bill') && document.getElementById('rp-auto-bill').checked;


  if (!partId) { showToast('No part selected', 'error'); return; }


  if (qty <= 0) { showToast('Quantity must be greater than 0', 'error'); return; }


  if (!sb || !sbConnected) { showToast('Not connected to database', 'error'); return; }


  var part = DB_PARTS.find(function(p) { return p.id === partId; });


  var totalCost = (unitCost && qty) ? unitCost * qty : null;


  try {


    // Insert transaction (trigger updates qty_on_hand)


    var txnRes = await sb.from('part_transactions').insert({


      part_id: partId,


      transaction_type: 'received',


      quantity: qty,


      unit_cost: unitCost,


      total_cost: totalCost,


      vendor_id: null, // simplified â€” no vendor ID lookup in this flow


      performed_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


      transaction_date: dateVal,


      notes: (vendor ? 'Vendor: ' + vendor + (notes ? '. ' + notes : '') : notes),


      created_at: new Date().toISOString()


    });


    if (txnRes.error) throw txnRes.error;


    // Upload receipt if provided


    var receiptInput = document.getElementById('rp-receipt');


    if (receiptInput && receiptInput.files && receiptInput.files[0]) {


      var file = receiptInput.files[0];


      try {


        var ts = Date.now();


        var path = 'parts/' + partId + '/receipt-' + ts + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');


        var mime = file.type || 'application/octet-stream';


        var blob = file.type.startsWith('image/') ? await resizeImageBeforeUpload(file) : file;


        var uploadRes = await sb.storage.from('inventory-photos').upload(path, blob, {contentType: mime, upsert: true});


        if (!uploadRes.error) {


          var pubRes = sb.storage.from('inventory-photos').getPublicUrl(path);


          var receiptUrl = pubRes.data && pubRes.data.publicUrl ? pubRes.data.publicUrl : null;


          if (receiptUrl) {


            await sb.from('part_documents').insert({


              part_id: partId,


              doc_type: 'invoice',


              file_name: file.name,


              file_url: receiptUrl,


              file_size: blob.size,


              mime_type: mime,


              uploaded_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


              uploaded_at: new Date().toISOString()


            });


            // Auto-create bill


            if (autoBill && vendor && totalCost) {


              var partName = part ? part.name : 'Part';


              await sb.from('vendor_files').insert({


                vendor_id: null,


                file_name: 'Receipt â€” ' + partName + ' Ã—' + qty,


                amount: totalCost,


                status: 'paid',


                paid_date: dateVal,


                notes: 'Auto-created from Parts inventory receive. Vendor: ' + vendor,


                created_at: new Date().toISOString()


              }).then(function(){}).catch(function(e){ console.warn('Auto-bill insert failed:', e); });


            }


          }


        }


      } catch(ue) { console.warn('Receipt upload failed:', ue); }


    }


    await sbInsertAudit('parts', partId, 'receive', 'Received ' + qty + ' units');


    showToast('Stock received: +' + qty + ' units', 'success');


    closeModal('modal-receive-part');


    await loadPartsFromSupabase();


    // Refresh panel if open


    if (activePartId === partId) openPartPanel(partId);


  } catch(e) {


    console.error('Receive part failed:', e);


    showToast('Receive failed: ' + (e.message || e), 'error');


  }


}





// ---- Use Part ----


async function usePartSubmit() {


  var partId = (document.getElementById('up-part-id') || {}).value || '';


  var qty = parseFloat((document.getElementById('up-qty') || {}).value) || 0;


  var performedBy = (document.getElementById('up-performed-by') || {}).value || null;


  var ticketId = (document.getElementById('up-ticket-id') || {}).value || null;


  var assetId = (document.getElementById('up-asset-id') || {}).value || null;


  var dateVal = (document.getElementById('up-date') || {}).value || new Date().toISOString().split('T')[0];


  var notes = (document.getElementById('up-notes') || {}).value || null;


  if (!partId) { showToast('No part selected', 'error'); return; }


  if (qty <= 0) { showToast('Quantity must be greater than 0', 'error'); return; }


  var part = DB_PARTS.find(function(p) { return p.id === partId; });


  if (part && qty > (parseFloat(part.quantity_on_hand) || 0)) {


    showToast('Cannot use more than on-hand quantity (' + part.quantity_on_hand + ')', 'error');


    return;


  }


  if (!sb || !sbConnected) { showToast('Not connected to database', 'error'); return; }


  try {


    var txnRes = await sb.from('part_transactions').insert({


      part_id: partId,


      transaction_type: 'used',


      quantity: qty,


      used_on_ticket_id: ticketId || null,


      used_on_asset_id: assetId || null,


      performed_by: performedBy,


      transaction_date: dateVal,


      notes: notes,


      created_at: new Date().toISOString()


    });


    if (txnRes.error) throw txnRes.error;


    await sbInsertAudit('parts', partId, 'use', 'Used ' + qty + ' units' + (ticketId ? ' on ticket ' + ticketId : ''));


    showToast('Stock used: âˆ’â€™' + qty + ' units', 'success');


    closeModal('modal-use-part');


    await loadPartsFromSupabase();


    if (activePartId === partId) openPartPanel(partId);


  } catch(e) {


    console.error('Use part failed:', e);


    showToast('Use failed: ' + (e.message || e), 'error');


  }


}





// ---- Adjust Part ----


async function adjustPartSubmit() {


  var partId = (document.getElementById('ap-part-id') || {}).value || '';


  var actualQty = parseFloat((document.getElementById('ap-actual-qty') || {}).value);


  var reason = (document.getElementById('ap-reason') || {}).value || '';


  var notes = (document.getElementById('ap-notes') || {}).value || null;


  if (!partId) { showToast('No part selected', 'error'); return; }


  if (isNaN(actualQty) || actualQty < 0) { showToast('Enter a valid actual quantity', 'error'); return; }


  if (!reason) { showToast('Reason is required', 'error'); return; }


  if (!sb || !sbConnected) { showToast('Not connected to database', 'error'); return; }


  var part = DB_PARTS.find(function(p) { return p.id === partId; });


  var systemQty = parseFloat((part && part.quantity_on_hand) || 0);


  var diff = actualQty - systemQty;


  try {


    var txnRes = await sb.from('part_transactions').insert({


      part_id: partId,


      transaction_type: 'adjusted',


      quantity: actualQty,


      performed_by: currentUser ? (currentUser.email || currentUser.id) : 'staff',


      transaction_date: new Date().toISOString().split('T')[0],


      notes: reason + (notes ? ': ' + notes : '') + ' (system was ' + systemQty + ', adjusted to ' + actualQty + ', diff: ' + (diff >= 0 ? '+' : '') + diff + ')',


      created_at: new Date().toISOString()


    });


    if (txnRes.error) throw txnRes.error;


    // Note: DB trigger sets quantity_on_hand = actualQty for 'adjusted' type


    await sbInsertAudit('parts', partId, 'adjust', 'Adjusted count: ' + systemQty + ' â†’ ' + actualQty + ' (' + reason + ')');


    showToast('Inventory adjusted to ' + actualQty, 'success');


    closeModal('modal-adjust-part');


    await loadPartsFromSupabase();


    if (activePartId === partId) openPartPanel(partId);


  } catch(e) {


    console.error('Adjust part failed:', e);


    showToast('Adjust failed: ' + (e.message || e), 'error');


  }


}







// ========== CONFIRM DELETE ==========

function confirmDelete(label, detail) {

  const lines = [];

  lines.push('Delete ' + (label || 'this item') + '?');

  lines.push('');

  if (detail) { lines.push(detail); lines.push(''); }

  lines.push('This action cannot be undone.');

  return confirm(lines.join('\n'));

}


