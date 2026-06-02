// Theta inventory-assets module
// Extracted from index.html as a classic global script.
// Keep function names stable because inline HTML handlers and routing call them directly.

// ========== INVENTORY: ASSETS ==========


let DB_ASSETS = [];


let activeAssetId = null;





async function loadAssetsFromSupabase() {


  if (!sb) return;


  try {


    const { data, error } = await sb.from('assets').select('*, vendors(company_name)').order('created_at', { ascending: false });


    if (error) throw error;


    DB_ASSETS = data || [];


    renderAssetsList();


    renderAssetsKPIs();


  } catch(e) {


    console.warn('Load assets failed:', e);


    DB_ASSETS = [];


    renderAssetsList();


    renderAssetsKPIs();


    showToast('Could not load assets', 'error');


  }


}





function renderAssetsKPIs() {


  var total = DB_ASSETS.length;


  var active = DB_ASSETS.filter(function(a){ return a.status === 'active'; }).length;


  var inRepair = DB_ASSETS.filter(function(a){ return a.status === 'in_repair'; }).length;


  var totalValue = DB_ASSETS.reduce(function(sum, a){ return sum + (parseFloat(a.purchase_price) || 0); }, 0);


  var elTotal = document.getElementById('asset-kpi-total');


  var elActive = document.getElementById('asset-kpi-active');


  var elRepair = document.getElementById('asset-kpi-repair');


  var elValue = document.getElementById('asset-kpi-value');


  if (elTotal) elTotal.textContent = total;


  if (elActive) elActive.textContent = active;


  if (elRepair) elRepair.textContent = inRepair;


  if (elValue) elValue.textContent = '$' + totalValue.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0});


}





var ASSET_CAT_ICONS = {


  'Computing': '??',


  'Network': '??? ',


  'Tools': '?',


  'Vehicle': '🚗',


  'Equipment': '⚙️',


  'Software': '📦',


  'Other': '📦'


};





function assetStatusBadge(status) {


  var map = {


    'active': '<span class="badge" style="background:var(--success-soft);color:var(--success);border:1px solid var(--success)">Active</span>',


    'in_repair': '<span class="badge" style="background:var(--gold-soft);color:var(--gold);border:1px solid var(--gold)">In Repair</span>',


    'retired': '<span class="badge" style="background:rgba(100,108,120,.2);color:var(--muted);border:1px solid var(--border)">Retired</span>',


    'lost': '<span class="badge" style="background:var(--primary-soft);color:var(--primary);border:1px solid var(--primary)">Lost</span>',


    'sold': '<span class="badge" style="background:var(--blue-soft);color:var(--blue);border:1px solid var(--blue)">Sold</span>'


  };


  return map[status] || '<span class="badge">' + esc(status) + '</span>';


}





function renderAssetsList() {


  var tbody = document.getElementById('assets-table-body');


  if (!tbody) return;


  var search = (document.getElementById('asset-search') || {}).value || '';


  var catFilter = (document.getElementById('asset-cat-filter') || {}).value || '';


  var statusFilter = (document.getElementById('asset-status-filter') || {}).value || '';


  var sort = (document.getElementById('asset-sort') || {}).value || 'newest';


  var filtered = DB_ASSETS.filter(function(a) {


    if (catFilter && a.category !== catFilter) return false;


    if (statusFilter && a.status !== statusFilter) return false;


    if (search) {


      var q = search.toLowerCase();


      var hay = ((a.name || '') + ' ' + (a.asset_tag || '') + ' ' + (a.serial_number || '') + ' ' + (a.manufacturer || '') + ' ' + (a.model || '')).toLowerCase();


      if (hay.indexOf(q) === -1) return false;


    }


    return true;


  });


  filtered.sort(function(a, b) {


    if (sort === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);


    if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);


    if (sort === 'name') return (a.name || '').localeCompare(b.name || '');


    if (sort === 'value-high') return (parseFloat(b.purchase_price) || 0) - (parseFloat(a.purchase_price) || 0);


    if (sort === 'value-low') return (parseFloat(a.purchase_price) || 0) - (parseFloat(b.purchase_price) || 0);


    if (sort === 'tag') return (a.asset_tag || '').localeCompare(b.asset_tag || '');


    return 0;


  });


  if (!filtered.length) {


    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:40px"><div style="font-size:28px;margin-bottom:8px">📦</div><div>No assets found</div></td></tr>';


    return;


  }


  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


  function fmtDate(s) {


    if (!s) return '—';


    var d = new Date(s);


    if (isNaN(d)) return s;


    return months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();


  }


  function fmtMoney(v) {


    if (!v && v !== 0) return '—';


    return '$' + parseFloat(v).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0});


  }


  tbody.innerHTML = filtered.map(function(a) {


    var icon = ASSET_CAT_ICONS[a.category] || '📦';


    var thumbHtml = a.primary_photo_url


      ? '<div class="asset-thumb"><img src="' + esc(a.primary_photo_url) + '" alt="" onerror="this.parentNode.innerHTML=\'' + icon + '\'"></div>'


      : '<div class="asset-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px">' + icon + '</div>';


    return '<tr onclick="openAssetPanel(\'' + esc(a.id) + '\')" style="cursor:pointer">'


      + '<td>' + thumbHtml + '</td>'


      + '<td style="font-family:monospace;font-size:12px;color:var(--soft)">' + esc(a.asset_tag || '') + '</td>'


      + '<td><strong>' + esc(a.name || '') + '</strong>'


        + (a.manufacturer ? '<br><span style="font-size:11px;color:var(--muted)">' + esc(a.manufacturer) + (a.model ? ' ' + esc(a.model) : '') + '</span>' : '') + '</td>'


      + '<td style="color:var(--muted);font-size:13px">' + esc(a.category || '') + '</td>'


      + '<td>' + assetStatusBadge(a.status) + '</td>'


      + '<td style="color:var(--muted);font-size:13px">' + fmtDate(a.purchase_date) + '</td>'


      + '<td style="font-size:13px">' + fmtMoney(a.purchase_price) + '</td>'


      + '<td><button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="event.stopPropagation();openAssetPanel(\'' + esc(a.id) + '\')">✏️ Edit</button></td>'


      + '</tr>';


  }).join('');


}





function switchAssetTab(tab) {


  document.querySelectorAll('.ap-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === tab); });


  document.querySelectorAll('.ap-tab-content').forEach(function(c){ c.style.display = 'none'; });


  var el = document.getElementById('ap-tab-' + tab);


  if (el) el.style.display = 'block';


}





function populateVendorDropdowns() {


  var vendors = DB.vendors || [];


  ['na-vendor', 'ap-vendor', 'lr-vendor'].forEach(function(id) {


    var sel = document.getElementById(id);


    if (!sel) return;


    var cur = sel.value;


    while (sel.options.length > 1) sel.remove(1);


    vendors.forEach(function(v) {


      var opt = document.createElement('option');


      opt.value = v._sbId || v.name;


      opt.textContent = v.name;


      sel.appendChild(opt);


    });


    if (cur) sel.value = cur;


  });


}





function openAssetPanel(id) {


  var a = DB_ASSETS.find(function(x){ return x.id === id || String(x.id) === String(id); });


  if (!a) return;


  activeAssetId = id;


  document.getElementById('ap-tag').textContent = a.asset_tag || 'MSE-A-????';


  document.getElementById('ap-subtitle').textContent = (a.category || '') + (a.manufacturer ? ' · ' + a.manufacturer : '') + (a.model ? ' ' + a.model : '');


  document.getElementById('ap-name').value = a.name || '';


  document.getElementById('ap-asset-tag').value = a.asset_tag || '';


  document.getElementById('ap-serial').value = a.serial_number || '';


  document.getElementById('ap-category').value = a.category || 'Computing';


  document.getElementById('ap-status').value = a.status || 'active';


  document.getElementById('ap-manufacturer').value = a.manufacturer || '';


  document.getElementById('ap-model').value = a.model || '';


  document.getElementById('ap-purchase-date').value = a.purchase_date ? a.purchase_date.substring(0,10) : '';


  document.getElementById('ap-purchase-price').value = a.purchase_price || '';


  document.getElementById('ap-warranty').value = a.warranty_expires ? a.warranty_expires.substring(0,10) : '';


  document.getElementById('ap-notes').value = a.notes || '';


  // Photo


  var photoWrap = document.getElementById('ap-photo-wrap');


  var photoImg = document.getElementById('ap-primary-photo');


  if (a.primary_photo_url && photoWrap && photoImg) {


    photoImg.src = a.primary_photo_url;


    photoWrap.style.display = 'block';


  } else if (photoWrap) {


    photoWrap.style.display = 'none';


  }


  // Clear file input


  var fi = document.getElementById('ap-photo-file');


  if (fi) fi.value = '';


  // Vendor dropdown


  populateVendorDropdowns();


  var apVendor = document.getElementById('ap-vendor');


  if (apVendor && a.vendor_id) apVendor.value = a.vendor_id;


  // Switch to overview tab


  switchAssetTab('overview');


  // Open overlay


  document.getElementById('assetOverlay').classList.add('open');


  document.getElementById('assetPanel').classList.add('open');


  // Load related data


  loadAssetRepairs(id);


  loadAssetMaintenance(id);


  loadAssetDocuments(id);


  loadAssetActivity(id);


}





function closeAssetPanel() {


  document.getElementById('assetOverlay').classList.remove('open');


  document.getElementById('assetPanel').classList.remove('open');


  activeAssetId = null;


}





async function saveAssetPanel() {


  if (!activeAssetId) return;


  var a = DB_ASSETS.find(function(x){ return String(x.id) === String(activeAssetId); });


  if (!a) return;


  var updates = {


    name: document.getElementById('ap-name').value.trim(),


    serial_number: document.getElementById('ap-serial').value.trim(),


    category: document.getElementById('ap-category').value,


    status: document.getElementById('ap-status').value,


    manufacturer: document.getElementById('ap-manufacturer').value.trim(),


    model: document.getElementById('ap-model').value.trim(),


    purchase_date: document.getElementById('ap-purchase-date').value || null,


    purchase_price: parseFloat(document.getElementById('ap-purchase-price').value) || null,


    vendor_id: document.getElementById('ap-vendor').value || null,


    warranty_expires: document.getElementById('ap-warranty').value || null,


    notes: document.getElementById('ap-notes').value.trim(),


    updated_at: new Date().toISOString()


  };


  if (!updates.name) { showToast('Asset name is required', 'error'); return; }


  try {


    // Handle photo upload first


    var photoFile = document.getElementById('ap-photo-file');


    if (photoFile && photoFile.files && photoFile.files[0]) {


      var url = await uploadAssetPhoto(photoFile.files[0], activeAssetId);


      if (url) {


        updates.primary_photo_url = url;


        await sb.from('asset_documents').insert({


          asset_id: activeAssetId,


          doc_type: 'photo_primary',


          file_name: photoFile.files[0].name,


          file_url: url,


          uploaded_by: getUser().email,


          uploaded_at: new Date().toISOString()


        });


      }


    }


    if (!sb) throw new Error('Offline');


    var { error } = await sb.from('assets').update(updates).eq('id', activeAssetId);


    if (error) throw error;


    // Update local cache


    Object.assign(a, updates);


    sbInsertAudit('assets', activeAssetId, 'update', 'Asset updated: ' + updates.name);


    showToast('Asset saved', 'success');


    renderAssetsList();


    renderAssetsKPIs();


    closeAssetPanel();


  } catch(e) {


    console.warn('Save asset failed:', e);


    showToast('Could not save asset: ' + (e.message || e), 'error');


  }


}





async function resizeImageToCanvas(file, maxPx) {


  return new Promise(function(resolve, reject) {


    var img = new Image();


    var url = URL.createObjectURL(file);


    img.onload = function() {


      var w = img.naturalWidth, h = img.naturalHeight;


      if (w > maxPx || h > maxPx) {


        var ratio = Math.min(maxPx / w, maxPx / h);


        w = Math.round(w * ratio);


        h = Math.round(h * ratio);


      }


      var canvas = document.createElement('canvas');


      canvas.width = w; canvas.height = h;


      var ctx = canvas.getContext('2d');


      ctx.drawImage(img, 0, 0, w, h);


      URL.revokeObjectURL(url);


      canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', 0.88);


    };


    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };


    img.src = url;


  });


}





async function uploadAssetPhoto(file, assetId) {


  try {


    var resized = await resizeImageToCanvas(file, 1600);


    var ext = 'jpg';


    var fname = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '') + '.' + ext;


    var path = 'assets/' + assetId + '/' + fname;


    var { error } = await sb.storage.from('inventory-photos').upload(path, resized, { contentType: 'image/jpeg', upsert: true });


    if (error) throw error;


    var { data } = sb.storage.from('inventory-photos').getPublicUrl(path);


    return data && data.publicUrl ? data.publicUrl : null;


  } catch(e) {


    console.warn('Photo upload failed:', e);


    showToast('Photo upload failed: ' + (e.message || e), 'error');


    return null;


  }


}





async function getNextAssetTag() {


  try {


    if (!sb) return 'MSE-A-0001';


    var { data } = await sb.from('assets').select('asset_tag').order('asset_tag', { ascending: false }).limit(50);


    var max = 0;


    if (data && data.length) {


      data.forEach(function(r) {


        var m = (r.asset_tag || '').match(/MSE-A-(\d+)/);


        if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }


      });


    }


    var next = String(max + 1).padStart(4, '0');


    return 'MSE-A-' + next;


  } catch(e) {


    return 'MSE-A-0001';


  }


}





async function openNewAssetModal() {


  // Pre-populate tag


  var tag = await getNextAssetTag();


  var el = document.getElementById('na-tag');


  if (el) el.value = tag;


  // Populate vendor dropdown


  populateVendorDropdowns();


  openModal('modal-new-asset');


}





async function createAsset() {


  var name = (document.getElementById('na-name') || {}).value || '';


  if (!name.trim()) { showToast('Asset name is required', 'error'); return; }


  var assetTag = (document.getElementById('na-tag') || {}).value || await getNextAssetTag();


  var newAsset = {


    asset_tag: assetTag,


    serial_number: (document.getElementById('na-serial') || {}).value.trim() || null,


    name: name.trim(),


    category: (document.getElementById('na-category') || {}).value || 'Other',


    status: (document.getElementById('na-status') || {}).value || 'active',


    manufacturer: (document.getElementById('na-manufacturer') || {}).value.trim() || null,


    model: (document.getElementById('na-model') || {}).value.trim() || null,


    purchase_date: (document.getElementById('na-purchase-date') || {}).value || null,


    purchase_price: parseFloat((document.getElementById('na-purchase-price') || {}).value) || null,


    vendor_id: (document.getElementById('na-vendor') || {}).value || null,


    warranty_expires: (document.getElementById('na-warranty') || {}).value || null,


    notes: (document.getElementById('na-notes') || {}).value.trim() || null,


    created_by: getUser().email,


    created_at: new Date().toISOString(),


    updated_at: new Date().toISOString()


  };


  try {


    if (!sb) throw new Error('Offline — connect to save assets');


    var { data, error } = await sb.from('assets').insert(newAsset).select().single();


    if (error) throw error;


    var assetId = data.id;


    // Upload photos


    var photoInput = document.getElementById('na-photos');


    var photos = photoInput && photoInput.files ? Array.from(photoInput.files) : [];


    var primaryUrl = null;


    for (var i = 0; i < photos.length; i++) {


      var url = await uploadAssetPhoto(photos[i], assetId);


      if (url) {


        var docType = i === 0 ? 'photo_primary' : 'photo_gallery';


        await sb.from('asset_documents').insert({


          asset_id: assetId,


          doc_type: docType,


          file_name: photos[i].name,


          file_url: url,


          file_size: photos[i].size,


          mime_type: photos[i].type,


          uploaded_by: getUser().email,


          uploaded_at: new Date().toISOString()


        });


        if (i === 0) primaryUrl = url;


      }


    }


    if (primaryUrl) {


      await sb.from('assets').update({ primary_photo_url: primaryUrl }).eq('id', assetId);


      data.primary_photo_url = primaryUrl;


    }


    DB_ASSETS.unshift(data);


    sbInsertAudit('assets', assetId, 'create', 'Asset created: ' + name);


    closeModal('modal-new-asset');


    showToast('Asset saved: ' + name, 'success');


    renderAssetsList();


    renderAssetsKPIs();


    // Reset form


    ['na-serial','na-name','na-manufacturer','na-model','na-purchase-date','na-purchase-price','na-warranty','na-notes'].forEach(function(id){


      var el = document.getElementById(id); if (el) el.value = '';


    });


    if (photoInput) photoInput.value = '';


  } catch(e) {


    console.warn('Create asset failed:', e);


    showToast('Could not create asset: ' + (e.message || e), 'error');


  }


}





async function loadAssetRepairs(assetId) {


  var el = document.getElementById('ap-repairs-list');


  if (!el) return;


  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Loading…</div>';


  try {


    if (!sb) throw new Error('Offline');


    var { data, error } = await sb.from('asset_repairs').select('*').eq('asset_id', assetId).order('repair_date', { ascending: false });


    if (error) throw error;


    if (!data || !data.length) { el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px">No repair records yet</div>'; return; }


    el.innerHTML = data.map(function(r) {


      return '<div class="repair-item">'


        + '<h4>' + esc(r.repair_type || 'Repair') + ' — ' + (r.repair_date ? new Date(r.repair_date).toLocaleDateString() : '—') + '</h4>'


        + '<p>' + esc(r.description || '') + '</p>'


        + (r.cost ? '<p style="margin-top:4px">Cost: $' + parseFloat(r.cost).toFixed(2) + '</p>' : '')


        + (r.performed_by_staff ? '<p style="margin-top:4px">Staff: ' + esc(r.performed_by_staff) + '</p>' : '')


        + '</div>';


    }).join('');


  } catch(e) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Could not load repairs</div>';


  }


}





async function loadAssetMaintenance(assetId) {


  var el = document.getElementById('ap-maintenance-list');


  if (!el) return;


  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Loading…</div>';


  try {


    if (!sb) throw new Error('Offline');


    var { data, error } = await sb.from('asset_maintenance_schedule').select('*').eq('asset_id', assetId).order('next_due', { ascending: true });


    if (error) throw error;


    if (!data || !data.length) { el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px">No maintenance scheduled</div>'; return; }


    el.innerHTML = data.map(function(r) {


      var overdue = r.next_due && new Date(r.next_due) < new Date();


      return '<div class="maint-item" style="' + (overdue ? 'border-color:var(--primary)' : '') + '">'


        + '<h4>' + esc(r.task || '') + (overdue ? ' <span style="color:var(--primary);font-size:11px">⚠  Overdue</span>' : '') + '</h4>'


        + '<p>Frequency: ' + esc(r.frequency || '') + (r.frequency_days ? ' (' + r.frequency_days + ' days)' : '') + '</p>'


        + '<p>Next due: ' + (r.next_due ? new Date(r.next_due).toLocaleDateString() : '—') + '</p>'


        + (r.last_completed ? '<p>Last done: ' + new Date(r.last_completed).toLocaleDateString() + '</p>' : '')


        + '</div>';


    }).join('');


  } catch(e) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Could not load maintenance</div>';


  }


}





async function loadAssetDocuments(assetId) {


  var el = document.getElementById('ap-documents-list');


  if (!el) return;


  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Loading…</div>';


  try {


    if (!sb) throw new Error('Offline');


    var { data, error } = await sb.from('asset_documents').select('*').eq('asset_id', assetId).order('uploaded_at', { ascending: false });


    if (error) throw error;


    if (!data || !data.length) { el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px">No documents attached</div>'; return; }


    var isImg = function(mime) { return mime && mime.startsWith('image/'); };


    el.innerHTML = data.map(function(d) {


      return '<div class="doc-item" style="display:flex;gap:12px;align-items:flex-start">'


        + (isImg(d.mime_type) ? '<img src="' + esc(d.file_url || '') + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0">' : '<div style="width:56px;height:56px;background:var(--surface3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📄</div>')


        + '<div style="flex:1;min-width:0">'


        + '<div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(d.file_name || '') + '</div>'


        + '<p style="margin-top:3px">' + esc(d.doc_type || '') + (d.uploaded_by ? ' · ' + esc(d.uploaded_by) : '') + '</p>'


        + (d.file_url ? '<a href="' + esc(d.file_url) + '" target="_blank" style="font-size:12px;color:var(--blue)">View</a>' : '')


        + '</div></div>';


    }).join('');


  } catch(e) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Could not load documents</div>';


  }


}





async function loadAssetActivity(assetId) {


  var el = document.getElementById('ap-activity-list');


  if (!el) return;


  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Loading…</div>';


  try {


    if (!sb) throw new Error('Offline');


    var { data, error } = await sb.from('asset_audit_log').select('*').eq('asset_id', assetId).order('created_at', { ascending: false }).limit(50);


    if (error) throw error;


    if (!data || !data.length) { el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px">No activity recorded</div>'; return; }


    el.innerHTML = '<div class="audit-list">' + data.map(function(r) {


      return '<div class="audit-item">'


        + '<div class="audit-dot" style="background:var(--blue)"></div>'


        + '<div class="audit-copy">'


        + '<strong>' + esc(r.action || '') + '</strong>' + (r.field_changed ? ' · ' + esc(r.field_changed) : '')


        + '<span>' + esc(r.changed_by || '') + ' · ' + new Date(r.created_at).toLocaleString() + '</span>'


        + '</div></div>';


    }).join('') + '</div>';


  } catch(e) {


    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Could not load activity</div>';


  }


}





async function logRepair(assetId) {


  if (!assetId) { showToast('No asset selected', 'error'); return; }


  var repairType = (document.getElementById('lr-type') || {}).value || 'repair';


  var repairDate = (document.getElementById('lr-date') || {}).value || '';


  var description = (document.getElementById('lr-description') || {}).value || '';


  var cost = parseFloat((document.getElementById('lr-cost') || {}).value) || null;


  var staff = (document.getElementById('lr-staff') || {}).value || null;


  var vendorId = (document.getElementById('lr-vendor') || {}).value || null;


  var notes = (document.getElementById('lr-notes') || {}).value || null;


  if (!repairDate) { showToast('Repair date is required', 'error'); return; }


  if (!description.trim()) { showToast('Description is required', 'error'); return; }


  try {


    if (!sb) throw new Error('Offline');


    var rec = {


      asset_id: assetId,


      repair_type: repairType,


      repair_date: repairDate,


      description: description.trim(),


      cost: cost,


      performed_by_staff: staff || null,


      performed_by_vendor_id: vendorId || null,


      notes: notes ? notes.trim() : null,


      created_by: getUser().email,


      created_at: new Date().toISOString()


    };


    var { error } = await sb.from('asset_repairs').insert(rec);


    if (error) throw error;


    // Audit log


    await sb.from('asset_audit_log').insert({


      asset_id: assetId,


      action: 'repair_logged',


      field_changed: 'repair_type',


      new_value: repairType,


      changed_by: getUser().email,


      notes: description.trim(),


      created_at: new Date().toISOString()


    });


    closeModal('modal-log-repair');


    showToast('Repair logged', 'success');


    loadAssetRepairs(assetId);


    // Clear form


    ['lr-date','lr-description','lr-cost','lr-notes'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });


    var st = document.getElementById('lr-staff'); if (st) st.value = '';


  } catch(e) {


    showToast('Could not log repair: ' + (e.message || e), 'error');


  }


}





async function scheduleMaintenance(assetId) {


  if (!assetId) { showToast('No asset selected', 'error'); return; }


  var task = (document.getElementById('sm-task') || {}).value || '';


  var frequency = (document.getElementById('sm-frequency') || {}).value || 'monthly';


  var freqDays = parseInt((document.getElementById('sm-freq-days') || {}).value) || null;


  var nextDue = (document.getElementById('sm-next-due') || {}).value || '';


  var lastCompleted = (document.getElementById('sm-last-completed') || {}).value || null;


  var notes = (document.getElementById('sm-notes') || {}).value || null;


  if (!task.trim()) { showToast('Task description is required', 'error'); return; }


  if (!nextDue) { showToast('Next due date is required', 'error'); return; }


  var freqDaysMap = { weekly: 7, monthly: 30, quarterly: 91, 'semi-annual': 182, annual: 365 };


  if (!freqDays && freqDaysMap[frequency]) freqDays = freqDaysMap[frequency];


  try {


    if (!sb) throw new Error('Offline');


    var rec = {


      asset_id: assetId,


      task: task.trim(),


      frequency: frequency,


      frequency_days: freqDays,


      next_due: nextDue,


      last_completed: lastCompleted || null,


      active: true,


      notes: notes ? notes.trim() : null,


      created_at: new Date().toISOString()


    };


    var { error } = await sb.from('asset_maintenance_schedule').insert(rec);


    if (error) throw error;


    await sb.from('asset_audit_log').insert({


      asset_id: assetId,


      action: 'maintenance_scheduled',


      field_changed: 'task',


      new_value: task.trim(),


      changed_by: getUser().email,


      notes: 'Next due: ' + nextDue,


      created_at: new Date().toISOString()


    });


    closeModal('modal-schedule-maintenance');


    showToast('Maintenance scheduled', 'success');


    loadAssetMaintenance(assetId);


    ['sm-task','sm-freq-days','sm-next-due','sm-last-completed','sm-notes'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });


  } catch(e) {


    showToast('Could not schedule maintenance: ' + (e.message || e), 'error');


  }


}





async function handleAssetDocUpload(input) {


  if (!activeAssetId || !input.files || !input.files[0]) return;


  var file = input.files[0];


  var isImg = file.type.startsWith('image/');


  try {


    var blob = isImg ? await resizeImageToCanvas(file, 1600) : file;


    var ext = file.name.split('.').pop();


    var fname = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');


    var path = 'assets/' + activeAssetId + '/' + fname;


    var contentType = isImg ? 'image/jpeg' : file.type;


    if (!sb) throw new Error('Offline');


    var { error: upErr } = await sb.storage.from('inventory-photos').upload(path, blob, { contentType: contentType, upsert: true });


    if (upErr) throw upErr;


    var { data: pubData } = sb.storage.from('inventory-photos').getPublicUrl(path);


    var fileUrl = pubData && pubData.publicUrl ? pubData.publicUrl : '';


    var docType = isImg ? 'photo_gallery' : 'other';


    var { error: dbErr } = await sb.from('asset_documents').insert({


      asset_id: activeAssetId,


      doc_type: docType,


      file_name: file.name,


      file_url: fileUrl,


      file_size: file.size,


      mime_type: file.type,


      uploaded_by: getUser().email,


      uploaded_at: new Date().toISOString()


    });


    if (dbErr) throw dbErr;


    showToast('Document uploaded', 'success');


    loadAssetDocuments(activeAssetId);


    input.value = '';


  } catch(e) {


    showToast('Upload failed: ' + (e.message || e), 'error');


    input.value = '';


  }


}





// ========== END INVENTORY: ASSETS ==========
