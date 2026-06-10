// ============================================================


// ============ KANBAN: load/save/delete in Supabase ==========


// ============================================================





// Kanban: state for active board + column UUIDs


let _kanbanColMap = {};    // { ci: column_uuid } for active board


let _kanbanBoardId = null;  // active board uuid


let _kanbanBoards = [];    // full list, populated on first load





// Render the board switcher pills. Active board highlighted in primary color.


function renderKanbanSwitcher() {


  const el = document.getElementById('kanban-board-switcher');


  if (!el) return;


  if (!_kanbanBoards || _kanbanBoards.length <= 1) {


    el.innerHTML = '';


    return;


  }


  el.innerHTML = _kanbanBoards.map(b => {


    const active = b.id === _kanbanBoardId;


    const bg = active ? 'var(--primary)' : 'var(--surface2)';


    const color = active ? '#fff' : 'var(--text)';


    const border = active ? 'var(--primary)' : 'var(--border)';


    return `<button onclick="switchKanbanBoard('${b.id}')" style="background:${bg};color:${color};border:1px solid ${border};border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s">${esc(b.name)}</button>`;


  }).join('');


}





// Load (or re-load) cards for a specific board id. Defaults to first board.


async function loadKanbanFromSupabase(targetBoardId) {


  if (!sb) return;


  try {


    // First load: fetch all boards


    if (!_kanbanBoards.length) {


      const { data: boards, error: bErr } = await sb.from('kanban_boards').select('*').order('position', { ascending: true });


      if (bErr) throw bErr;


      if (!boards || !boards.length) return;


      _kanbanBoards = boards;


    }





    // Pick active board: targetBoardId > existing _kanbanBoardId > first board


    if (targetBoardId && _kanbanBoards.find(b => b.id === targetBoardId)) {


      _kanbanBoardId = targetBoardId;


    } else if (!_kanbanBoardId) {


      _kanbanBoardId = _kanbanBoards[0].id;


    }





    const { data: cols, error: cErr } = await sb.from('kanban_columns')


      .select('*').eq('board_id', _kanbanBoardId).order('position', { ascending: true });


    if (cErr) throw cErr;


    const { data: cards, error: kErr } = await sb.from('kanban_cards')


      .select('*').eq('board_id', _kanbanBoardId).order('position', { ascending: true });


    if (kErr) throw kErr;





    // Update boardCols + column UUID map for the ACTIVE board


    if (cols && cols.length) {


      window.boardCols = cols.map(c => c.name);


      _kanbanColMap = {};


      cols.forEach((c, i) => { _kanbanColMap[i] = c.id; });


    } else {


      window.boardCols = [];


      _kanbanColMap = {};


    }


    DB.kanban = {};


    (cols || []).forEach((c, i) => { DB.kanban[i] = []; });


    (cards || []).forEach(card => {


      const ci = (cols || []).findIndex(c => c.id === card.column_id);


      if (ci < 0) return;


      DB.kanban[ci] = DB.kanban[ci] || [];


      DB.kanban[ci].push({


        _sbId: card.id,


        title: card.title || '',


        desc: card.description || '',


        assign: card.assignee || '',


        due: card.due_date || '',


        priority: card.priority || '',


        labels: card.labels || [],


        checklist: card.checklist || [],


        members: card.members || []


      });


    });


    renderKanbanSwitcher();


    if (typeof renderKanban === 'function') renderKanban();


    setConnIndicator('connected');


  } catch(e) {


    console.warn('Kanban load failed:', e);


    setConnIndicator('offline');


  }


}





// User clicks a board pill — reload that board.


async function switchKanbanBoard(boardId) {


  if (boardId === _kanbanBoardId) return;


  await loadKanbanFromSupabase(boardId);


}





async function persistKanbanCard(card, ci) {


  if (!sb || !_kanbanBoardId) return;


  const colUuid = _kanbanColMap[ci];


  if (!colUuid) return;


  const payload = {


    board_id: _kanbanBoardId,


    column_id: colUuid,


    title: card.title || '',


    description: card.desc || '',


    assignee: card.assign || null,


    due_date: card.due || null,


    priority: card.priority || 'medium',


    labels: card.labels || [],


    checklist: card.checklist || [],


    members: card.members || []


  };


  try {


    if (card._sbId) {


      const { error } = await sb.from('kanban_cards').update(payload).eq('id', card._sbId);


      if (error) throw error;


    } else {


      const { data, error } = await sb.from('kanban_cards').insert(payload).select().single();


      if (error) throw error;


      if (data) card._sbId = data.id;


    }


  } catch(e) { console.warn('Kanban card persist failed:', e); }


}





async function deleteKanbanCard(card) {


  if (!sb || !card || !card._sbId) return;


  try {


    const { error } = await sb.from('kanban_cards').delete().eq('id', card._sbId);


    if (error) throw error;


  } catch(e) { console.warn('Kanban card delete failed:', e); }


}








function fmtProjectDate(val) {


  if (!val || val === '—') return '—';


  // ISO date → "Apr 25" (or include year if not current year)


  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {


    const d = new Date(val + 'T00:00:00');


    if (isNaN(d)) return val;


    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


    const yr = d.getFullYear();


    const cur = new Date().getFullYear();


    return months[d.getMonth()] + ' ' + d.getDate() + (yr !== cur ? ', ' + yr : '');


  }


  return val;


}





function renderProjects() {


  const body = document.getElementById('projects-body');


  if (!body) return;


  if (!DB.projects || DB.projects.length === 0) {


    body.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:24px">No projects yet. Click "New Project" to create one.</td></tr>';


    return;


  }


  body.innerHTML = DB.projects.map((p,i) => `


    <tr onclick="openProjectPanel(${i})">


      <td><strong>${esc(p.name)}</strong></td>


      <td style="color:var(--muted)">${esc(p.client||'—')}</td>


      <td style="color:var(--muted)">${esc(p.lead||'—')}</td>


      <td style="color:var(--soft)">${esc(fmtProjectDate(p.start))}</td>


      <td style="color:var(--soft)">${esc(fmtProjectDate(p.due))}</td>


      <td>${projectStatusBadge(p.status)}</td>


    </tr>`).join('');


}





function renderStaff() {


  const body = document.getElementById('staff-body');


  if (!body) return;


  body.innerHTML = DB.staff.map((s, i) => `


    <tr onclick="openDetailPanel('${esc(s.name)}','${esc(s.role)} · ${esc(s.dept)}',[['Email','${esc(s.email)}'],['Role','${esc(s.role)}'],['Department','${esc(s.dept)}'],['Status','${esc(s.status)}']])">


      <td><div style="display:flex;align-items:center;gap:10px"><div class="staff-avatar" style="background:${s.color}">${s.initial}</div><strong>${esc(s.name)}</strong></div></td>


      <td><span class="badge badge-gray">${esc(s.role)}</span></td>


      <td style="color:var(--muted)">${esc(s.email)}</td>


      <td style="color:var(--muted)">${esc(s.dept)}</td>


      <td><span class="badge badge-green">${esc(s.status)}</span></td>


      <td style="display:flex;gap:6px;align-items:center">


        <select onchange="updateStaffRole(${i},this.value)" onclick="event.stopPropagation()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;font-family:inherit;outline:none">


          <option ${s.role==='Technician'?'selected':''}>Technician</option>


          <option ${s.role==='Dispatcher'?'selected':''}>Dispatcher</option>


          <option ${s.role==='Accounting'?'selected':''}>Accounting</option>


          <option ${s.role==='Manager'?'selected':''}>Manager</option>


          <option ${s.role==='Admin'?'selected':''}>Admin</option>


          <option ${s.role==='Super Admin'?'selected':''}>Super Admin</option>


        </select>


        <button class="btn-danger" style="padding:6px 12px;font-size:12px" onclick="event.stopPropagation();deleteStaff(${i})">Remove</button>


      </td>


    </tr>`).join('');


}





// ========== PROJECT BOARD ==========


let boardCols = ['Backlog','In Progress','Review','Done'];


let dragSrc = null;


let activeCardRef = null; // {col, idx}





// Seed cards with richer data


DB.kanban = {


  0: [],


  1: [],


  2: [],


  3: [],


};





function renderKanban() {


  const board = document.getElementById('kanban-board');


  if (!board) return;





  board.innerHTML = boardCols.map((col, ci) => {


    const cards = DB.kanban[ci] || [];


    return `


    <div class="kanban-col" id="kcol-${ci}" ondragover="kDragOver(event,${ci})" ondragleave="kDragLeave(event,${ci})" ondrop="kDrop(event,${ci})">


      <div class="kanban-col-header">


        <span class="kcol-name" onclick="renameColumn(${ci})" title="Click to rename">${esc(col)}</span>


        <span class="count">${cards.length}</span>


        <span class="kcol-menu" onclick="removeBoardCol(${ci})" title="Remove list">×</span>


      </div>


      <div class="kanban-cards" id="kcards-${ci}">


        ${cards.map((card, i) => buildCard(card, ci, i)).join('')}


      </div>


      <div class="kcard-add" onclick="quickAddCard(${ci})">


        <span style="font-size:16px;line-height:1">+</span> Add a card


      </div>


    </div>`;


  }).join('') +


  `<button class="kcol-add" onclick="addBoardColumn()" title="Add list">+</button>`;


}





function buildCard(card, ci, i) {


  const labels = (card.labels||[]).map(l =>


    `<span class="kcard-label" style="background:${l.color}22;color:${l.color}">${esc(l.text)}</span>`).join('');


  const checks = card.checklist || [];


  const done = checks.filter(c=>c.done).length;


  const checkMeta = checks.length ? `<span class="kcard-meta-item ${done===checks.length?'':'due-soon'}">✓ ${done}/${checks.length}</span>` : '';


  const dueMeta = card.due ? `<span class="kcard-meta-item ${isDueSoon(card.due)?'due-soon':''} ${isOverdue(card.due)?'overdue':''}">&#128197; ${card.due}</span>` : '';


  const assignMeta = card.assign ? `<span class="kcard-meta-item">?? ${esc(card.assign)}</span>` : '';


  const membersMeta = (card.members && card.members.length) ?


    `<span class="kcard-meta-item" title="${esc(card.members.join(', '))}">+${card.members.length} 👥</span>` : '';


  const coverColor = (card.labels||[])[0]?.color;


  const cover = coverColor ? `<div class="kcard-cover" style="background:${coverColor}55"></div>` : '';


  return `


  <div class="kanban-card" draggable="true"


    ondragstart="kDragStart(event,${ci},${i})"


    ondragend="kDragEnd(event)"


    onclick="openCardDetail(${ci},${i})">


    ${cover}


    ${labels ? `<div class="kcard-labels">${labels}</div>` : ''}


    <div class="kcard-title">${esc(card.title)}</div>


    ${card.desc ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;line-height:1.4">${esc(card.desc.length>80?card.desc.slice(0,80)+'…':card.desc)}</div>` : ''}


    <div class="kcard-meta">${checkMeta}${dueMeta}${assignMeta}${membersMeta}</div>


    <span class="kcard-drag-handle" ondragstart="kDragStart(event,${ci},${i})" onclick="event.stopPropagation()">⠿</span>


  </div>`;


}





function isDueSoon(due) { if(!due) return false; const d=new Date(due),n=new Date(); return d-n < 86400000*3 && d>n; }


function isOverdue(due) { if(!due) return false; return new Date(due) < new Date(); }





// Card detail


function openCardDetail(ci, i) {


  const card = (DB.kanban[ci]||[])[i];


  if (!card) return;


  activeCardRef = {col:ci, idx:i};


  document.getElementById('cd-title-display').textContent = card.title;


  document.getElementById('cd-title').value = card.title || '';


  document.getElementById('cd-desc').value = card.desc || '';


  document.getElementById('cd-priority').value = card.priority || '';


  document.getElementById('cd-assign').value = card.assign || '';


  document.getElementById('cd-due').value = card.due || '';


  // col select


  const colSel = document.getElementById('cd-col');


  colSel.innerHTML = boardCols.map((c,idx) => `<option value="${idx}" ${idx===ci?'selected':''}>${esc(c)}</option>`).join('');


  // labels


  renderCardLabels(card.labels||[]);


  // checklist


  renderChecklist(card.checklist||[]);


  // members


  card.members = card.members || [];


  renderCardMembers();


  openModal('modal-card-detail');


}





// Map short name → email so notifications can target the right inbox.


// Update when staff list changes.


const STAFF_EMAIL_MAP = {


  'D. McGann': 'dmcgann@msetech.org',


  'J. Pacheco': 'joey@msetech.org',


  'A. Piva':   'apiva@msetech.org',


  'B. Egan':   'began@msetech.org',


  'K. Hilmy':  'khilmy@msetech.org'


};


function staffEmail(name) { return STAFF_EMAIL_MAP[name] || null; }





function renderCardMembers() {


  if (!activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  const wrap = document.getElementById('cd-members-chips');


  if (!wrap) return;


  const members = card.members || [];


  wrap.innerHTML = members.map(m => {


    const safe = esc(m).replace(/'/g, "\\'");


    return `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:3px 4px 3px 10px;font-size:12px;color:var(--text)">?? ${esc(m)}<button onclick="removeCardMember('${safe}')" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:14px;line-height:1;padding:0 4px;margin-left:4px" title="Remove">×</button></span>`;


  }).join('');


}





function addCardMember(name) {


  if (!name || !activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  card.members = card.members || [];


  if (!card.members.includes(name)) card.members.push(name);


  renderCardMembers();


}





function removeCardMember(name) {


  if (!activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  card.members = (card.members || []).filter(m => m !== name);


  renderCardMembers();


}





function renderCardLabels(labels) {


  document.getElementById('cd-labels').innerHTML = labels.map(l =>


    `<span class="kcard-label" style="background:${l.color}33;color:${l.color};padding:4px 12px">${esc(l.text)}</span>`).join('');


}





function toggleCardLabel(el, color, text) {


  if (!activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  card.labels = card.labels || [];


  const existing = card.labels.findIndex(l => l.color === color);


  if (existing > -1) { card.labels.splice(existing,1); el.style.outline=''; }


  else { card.labels.push({color,text}); el.style.outline=`2px solid ${color}`; }


  renderCardLabels(card.labels);


}





function renderChecklist(items) {


  const done = items.filter(c=>c.done).length;


  const pct = items.length ? Math.round(done/items.length*100) : 0;


  document.getElementById('cd-progress-bar').style.width = pct+'%';


  document.getElementById('cd-progress-text').textContent = items.length ? `${done} / ${items.length} (${pct}%)` : '';


  document.getElementById('cd-checklist').innerHTML = items.map((c,i) => `


    <div class="checklist-item">


      <input type="checkbox" id="chk-${i}" ${c.done?'checked':''} onchange="toggleCheck(${i})">


      <label for="chk-${i}" class="${c.done?'done':''}">${esc(c.text)}</label>


      <button style="color:var(--soft);font-size:12px;padding:0 4px" onclick="removeCheck(${i})">×</button>


    </div>`).join('');


}





function toggleCheck(i) {


  if (!activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  card.checklist[i].done = !card.checklist[i].done;


  renderChecklist(card.checklist);


}





function removeCheck(i) {


  if (!activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  card.checklist.splice(i,1);


  renderChecklist(card.checklist);


}





function addChecklistItem() {


  if (!activeCardRef) return;


  const input = document.getElementById('cd-new-check');


  const text = input.value.trim();


  if (!text) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  card.checklist = card.checklist || [];


  card.checklist.push({text, done:false});


  input.value = '';


  renderChecklist(card.checklist);


}





async function saveCardDetail() {


  if (!activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  const newTitle = document.getElementById('cd-title').value.trim();


  if (!newTitle) { showToast('Title required','error'); return; }


  card.title   = newTitle;


  card.desc    = document.getElementById('cd-desc').value;


  card.priority= document.getElementById('cd-priority').value;


  // capture old state for notification diff


  const oldAssign = card.assign || '';


  const oldMembers = (card.members || []).slice();


  card.assign  = document.getElementById('cd-assign').value;


  card.due     = document.getElementById('cd-due').value;


  card.members = card.members || [];


  // move to new col if changed


  const newCol = parseInt(document.getElementById('cd-col').value);


  let targetCol = activeCardRef.col;


  if (newCol !== activeCardRef.col) {


    const moved = DB.kanban[activeCardRef.col].splice(activeCardRef.idx,1)[0];


    DB.kanban[newCol] = DB.kanban[newCol] || [];


    DB.kanban[newCol].push(moved);


    targetCol = newCol;


  }


  // Persist to Supabase


  await persistKanbanCard(card, targetCol);


  // Fire notifications for newly added assignee/members


  await fireCardAssignNotifications(card, oldAssign, oldMembers);


  closeModal('modal-card-detail');


  renderKanban();


  showToast('Card saved','success');


}





// Diff old vs new and create a notification row for each newly assigned person.


async function fireCardAssignNotifications(card, oldAssign, oldMembers) {


  if (!sb) return;


  const newPeople = new Set();


  if (card.assign && card.assign !== oldAssign) newPeople.add(card.assign);


  for (const m of (card.members || [])) {


    if (!oldMembers.includes(m)) newPeople.add(m);


  }


  // Don't notify the person who is doing the assigning


  const me = (window.SESSION_USER && SESSION_USER.name) || 'D. McGann';


  const meEmail = (window.SESSION_USER && SESSION_USER.email) || 'dmcgann@msetech.org';


  newPeople.delete(me);


  if (newPeople.size === 0) return;


  const rows = [];


  for (const person of newPeople) {


    const email = staffEmail(person);


    if (!email) continue;


    rows.push({


      recipient_email: email,


      recipient_name: person,


      type: 'card_assigned',


      title: `${me} assigned you to a card`,


      body: card.title,


      link_url: '/console/projects',


      source_table: 'kanban_cards',


      source_id: card._sbId || null,


      triggered_by_email: meEmail,


      triggered_by_name: me


    });


  }


  if (rows.length === 0) return;


  try {


    const { error } = await sb.from('notifications').insert(rows);


    if (error) throw error;


    showToast(`Notified ${rows.length} ${rows.length===1?'person':'people'}`, 'success');


  } catch(e) {


    console.warn('Notification insert failed:', e);


  }


}





async function deleteCurrentCard() {


  if (!activeCardRef) return;


  const card = DB.kanban[activeCardRef.col][activeCardRef.idx];


  const title = (card && (card.title || card.name)) ? (card.title || card.name) : 'this card';


  if (!confirmDelete('card "' + title + '"')) return;


  await deleteKanbanCard(card);


  DB.kanban[activeCardRef.col].splice(activeCardRef.idx,1);


  closeModal('modal-card-detail');


  renderKanban();


  showToast('Card deleted','success');


}





async function openBoardCardNew() {


  // open card detail for a new card in col 0


  const col = 0;


  DB.kanban[col] = DB.kanban[col] || [];


  const card = {title:'New Card',desc:'',labels:[],assign:'',due:'',priority:'',checklist:[]};


  DB.kanban[col].push(card);


  renderKanban();


  await persistKanbanCard(card, col);


  openCardDetail(col, DB.kanban[col].length-1);


}





function renameColumn(ci) {


  const current = boardCols[ci];


  const el = document.querySelector(`#kcol-${ci} .kcol-name`);


  if (!el) return;


  const input = document.createElement('input');


  input.value = current;


  input.style.cssText = 'background:var(--surface2);border:1px solid var(--primary);border-radius:6px;padding:2px 8px;color:var(--text);font-size:14px;font-weight:700;font-family:inherit;outline:none;width:100%;max-width:180px';


  el.replaceWith(input);


  input.focus(); input.select();


  const commit = async () => {


    const newName = input.value.trim() || current;


    boardCols[ci] = newName;


    renderKanban();


    // Persist if we have a UUID for this column


    const uuid = _kanbanColMap[ci];


    if (uuid && newName !== current) {


      try { await sb.from('kanban_columns').update({ name: newName }).eq('id', uuid); }


      catch(e) { console.warn('Column rename persist failed:', e); }


    }


  };


  input.addEventListener('blur', commit);


  input.addEventListener('keydown', e => { if(e.key==='Enter') commit(); if(e.key==='Escape'){boardCols[ci]=current;renderKanban();}});


}





async function addBoardColumn() {


  if (!_kanbanBoardId) { showToast('No active board', 'error'); return; }


  const newName = 'New List';


  boardCols.push(newName);


  const ci = boardCols.length - 1;


  DB.kanban[ci] = [];


  renderKanban();


  // Persist to Supabase


  try {


    const { data, error } = await sb.from('kanban_columns').insert({


      board_id: _kanbanBoardId,


      name: newName,


      position: ci


    }).select().single();


    if (error) throw error;


    if (data) _kanbanColMap[ci] = data.id;


  } catch(e) {


    console.warn('Column insert failed:', e);


    showToast('Column saved locally only: ' + (e.message||'unknown'), 'error');


  }


  setTimeout(() => renameColumn(ci), 30);


}





async function removeBoardCol(ci) {


  if ((DB.kanban[ci]||[]).length && !confirm(`Remove "${boardCols[ci]}" and its ${DB.kanban[ci].length} card(s)?`)) return;


  const removedUuid = _kanbanColMap[ci];


  const removedCards = (DB.kanban[ci] || []).slice();


  boardCols.splice(ci,1);


  const newKanban = {};


  const newColMap = {};


  Object.keys(DB.kanban).filter(k=>parseInt(k)!==ci).forEach((k,newIdx) => {


    newKanban[newIdx] = DB.kanban[k];


    if (_kanbanColMap[k]) newColMap[newIdx] = _kanbanColMap[k];


  });


  DB.kanban = newKanban;


  _kanbanColMap = newColMap;


  renderKanban();


  // Persist deletion to Supabase


  if (removedUuid && sb) {


    try {


      // Delete cards first (FK ordering)


      for (const c of removedCards) {


        if (c._sbId) await sb.from('kanban_cards').delete().eq('id', c._sbId);


      }


      await sb.from('kanban_columns').delete().eq('id', removedUuid);


    } catch(e) { console.warn('Column delete persist failed:', e); }


  }


}





async function quickAddCard(ci) {


  DB.kanban[ci] = DB.kanban[ci] || [];


  const card = {title:'New Card',desc:'',labels:[],assign:'',due:'',priority:'',checklist:[]};


  DB.kanban[ci].push(card);


  renderKanban();


  // Persist immediately so it survives refresh even before user opens detail


  await persistKanbanCard(card, ci);


  openCardDetail(ci, DB.kanban[ci].length-1);


}





function kDragStart(e, col, idx) {


  dragSrc = {col, idx};


  e.dataTransfer.effectAllowed = 'move';


  setTimeout(() => {


    const cards = document.querySelectorAll(`#kcards-${col} .kanban-card`);


    if (cards[idx]) cards[idx].classList.add('dragging');


  }, 0);


}


function kDragEnd() { document.querySelectorAll('.kanban-card.dragging').forEach(c => c.classList.remove('dragging')); }


function kDragOver(e, col) { e.preventDefault(); document.getElementById('kcol-'+col).classList.add('drag-over'); }


function kDragLeave(e, col) { document.getElementById('kcol-'+col).classList.remove('drag-over'); }


async function kDrop(e, col) {


  e.preventDefault();


  document.getElementById('kcol-'+col).classList.remove('drag-over');


  if (!dragSrc) return;


  const card = DB.kanban[dragSrc.col].splice(dragSrc.idx,1)[0];


  DB.kanban[col] = DB.kanban[col] || [];


  DB.kanban[col].push(card);


  const movedSrc = dragSrc;


  dragSrc = null;


  renderKanban();


  // Persist column change to Supabase (only if card already has _sbId)


  if (card && card._sbId) {


    await persistKanbanCard(card, col);


  }


  showToast(`Moved to ${boardCols[col]}`, 'success');


}





// ===== MOBILE TOUCH DRAG FOR KANBAN =====


(function() {


  let touchDragSrc = null;


  let touchClone = null;


  let touchStartX = 0, touchStartY = 0;


  let longPressTimer = null;


  let isDragging = false;





  // Prevent context menu on kanban cards


  document.addEventListener('contextmenu', function(e) {


    if (e.target.closest('.kanban-card')) e.preventDefault();


  });





  document.addEventListener('touchstart', function(e) {


    const handle = e.target.closest('.kcard-drag-handle');


    const card = e.target.closest('.kanban-card');


    if (!handle && !card) return;


    const el = card;


    if (!el) return;


    isDragging = false;


    // Long press to initiate drag (200ms)


    longPressTimer = setTimeout(() => {


      isDragging = true;


      initTouchDrag(e, el);


    }, 200);


    touchStartX = e.touches[0].clientX;


    touchStartY = e.touches[0].clientY;


  }, {passive: true});





  function initTouchDrag(e, el) {


    const colEl = el.closest('[id^="kcol-"]');


    if (!colEl) return;


    const ci = parseInt(colEl.id.replace('kcol-',''));


    const cards = Array.from(colEl.querySelectorAll('.kanban-card'));


    const idx = cards.indexOf(el);


    if (idx === -1) return;


    touchDragSrc = {col: ci, idx};


    // Create ghost clone


    touchClone = el.cloneNode(true);


    touchClone.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.8;width:${el.offsetWidth}px;transform:rotate(2deg);transition:none;left:${el.getBoundingClientRect().left}px;top:${el.getBoundingClientRect().top}px;`;


    document.body.appendChild(touchClone);


    el.classList.add('dragging');


    // Vibrate to confirm drag started


    if (navigator.vibrate) navigator.vibrate(30);


  }





  document.addEventListener('touchmove', function(e) {


    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }


    if (!isDragging || !touchDragSrc || !touchClone) return;


    e.preventDefault();


    const t = e.touches[0];


    touchClone.style.left = (t.clientX - touchClone.offsetWidth/2) + 'px';


    touchClone.style.top = (t.clientY - 30) + 'px';


    // Highlight target column


    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));


    const el = document.elementFromPoint(t.clientX, t.clientY);


    if (el) {


      const col = el.closest('[id^="kcol-"]');


      if (col) col.classList.add('drag-over');


    }


  }, {passive: false});





  document.addEventListener('touchend', function(e) {


    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }


    if (!isDragging || !touchDragSrc) { isDragging = false; return; }


    const t = e.changedTouches[0];


    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));


    document.querySelectorAll('.kanban-card.dragging').forEach(c => c.classList.remove('dragging'));


    if (touchClone) { touchClone.remove(); touchClone = null; }


    // Find drop target


    const el = document.elementFromPoint(t.clientX, t.clientY);


    if (el) {


      const colEl = el.closest('[id^="kcol-"]');


      if (colEl) {


        const targetCol = parseInt(colEl.id.replace('kcol-',''));


        if (targetCol !== touchDragSrc.col) {


          const card = DB.kanban[touchDragSrc.col].splice(touchDragSrc.idx, 1)[0];


          DB.kanban[targetCol] = DB.kanban[targetCol] || [];


          DB.kanban[targetCol].push(card);


          renderKanban();


          // Persist column change to Supabase


          if (card && card._sbId) { persistKanbanCard(card, targetCol); }


          showToast('Moved to ' + boardCols[targetCol], 'success');


        }


      }


    }


    touchDragSrc = null;


    isDragging = false;


  }, {passive: true});


})();





function createTask() {


  // legacy stub — board uses quickAddCard now


  openBoardCardNew();


}





