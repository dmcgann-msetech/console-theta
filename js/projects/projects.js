// ============================================================


// ============ PROJECTS v2: load, notes, meetings ============


// ============================================================





async function loadProjectsFromSupabase() {


  if (!sb) return;


  try {


    const { data, error } = await sb.from('mse_projects').select('*').order('created_at', { ascending: false });


    if (error) throw error;


    if (data) {


      DB.projects = data.map(r => ({


        _sbId: r.id,


        name: r.name || '',


        client: '',  // resolve from client_id below


        client_id: r.client_id || null,


        lead: r.lead_name || '',


        start: r.start_date || null,


        due: r.due_date || null,


        status: r.status || 'Planned',


        notes: r.notes || '',


        notes_log: [],   // populated on demand when panel opens


        meetings: []     // populated on demand


      }));


      // Resolve client names from DB.clients


      if (Array.isArray(DB.clients)) {


        DB.projects.forEach(p => {


          if (p.client_id) {


            const c = DB.clients.find(x => x._sbId === p.client_id);


            if (c) p.client = c.name || c.company || '';


          }


        });


      }


      setConnIndicator('connected');


    }


  } catch(e) {


    console.warn('Supabase projects fetch failed:', e);


    setConnIndicator('offline');


  }


}





// ====== Notes log ======


async function loadProjectNotes(p) {


  if (!sb || !p || !p._sbId) return;


  try {


    const { data, error } = await sb.from('project_notes')


      .select('*').eq('project_id', p._sbId).order('created_at', { ascending: false });


    if (error) throw error;


    p.notes_log = data || [];


  } catch(e) { console.warn('Notes load failed:', e); p.notes_log = []; }


}





function renderProjectNotesLog(p) {


  const el = document.getElementById('pp-notes-log');


  if (!el) return;


  const log = p.notes_log || [];


  if (!log.length) {


    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:8px;text-align:center">No notes yet. Add the first one below.</div>';


    return;


  }


  el.innerHTML = log.map(n => {


    const when = new Date(n.created_at);


    const dateStr = when.toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});


    return `


      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:10px 12px;position:relative">


        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">


          <div style="font-size:11px;color:var(--muted);font-weight:600">${esc(n.author_name || n.author_email || 'Staff')} Â· ${esc(dateStr)}</div>


          <button onclick="deleteProjectNote(${n.id})" title="Delete this note" style="background:transparent;border:none;color:var(--muted);font-size:14px;cursor:pointer;padding:0 4px;line-height:1">Ã—</button>


        </div>


        <div style="font-size:13px;color:var(--text);white-space:pre-wrap;word-wrap:break-word">${esc(n.body)}</div>


      </div>`;


  }).join('');


}





async function submitProjectNote() {


  const p = DB.projects[activeProjectIdx];


  if (!p) return;


  const ta = document.getElementById('pp-note-new');


  const body = ta.value.trim();


  if (!body) return;


  if (!p._sbId) { showToast('Save the project first before adding notes', 'error'); return; }


  if (!sb || !currentUser) { showToast('Not signed in', 'error'); return; }


  try {


    const { data, error } = await sb.from('project_notes').insert({


      project_id: p._sbId,


      author_email: currentUser.email || '',


      author_name: currentUser.user_metadata?.full_name || currentUser.email || 'Staff',


      body


    }).select().single();


    if (error) throw error;


    p.notes_log = p.notes_log || [];


    p.notes_log.unshift(data);


    ta.value = '';


    renderProjectNotesLog(p);


    showToast('Note added', 'success');


  } catch(e) {


    console.warn('Note insert failed:', e);


    showToast('Failed to add note: ' + (e.message||'unknown'), 'error');


  }


}





async function deleteProjectNote(noteId) {


  if (!confirm('Delete this note? This cannot be undone.')) return;


  const p = DB.projects[activeProjectIdx];


  if (!p) return;


  try {


    const { error } = await sb.from('project_notes').delete().eq('id', noteId);


    if (error) throw error;


    p.notes_log = (p.notes_log || []).filter(n => n.id !== noteId);


    renderProjectNotesLog(p);


    showToast('Note deleted', 'success');


  } catch(e) {


    console.warn('Note delete failed:', e);


    showToast('Failed to delete note: ' + (e.message||'unknown'), 'error');


  }


}





// ====== Meetings ======


async function loadProjectMeetings(p) {


  if (!sb || !p || !p._sbId) return;


  try {


    const { data, error } = await sb.from('project_meetings')


      .select('*').eq('project_id', p._sbId).order('meeting_at', { ascending: true });


    if (error) throw error;


    p.meetings = data || [];


  } catch(e) { console.warn('Meetings load failed:', e); p.meetings = []; }


}





function renderProjectMeetings(p) {


  const el = document.getElementById('pp-meetings-list');


  if (!el) return;


  const meetings = p.meetings || [];


  if (!meetings.length) {


    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:8px;text-align:center">No meetings scheduled.</div>';


    return;


  }


  const now = Date.now();


  el.innerHTML = meetings.map(m => {


    const when = new Date(m.meeting_at);


    const isPast = when.getTime() < now;


    const dateStr = when.toLocaleString('en-US', {weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});


    const dur = m.duration_minutes ? ` Â· ${m.duration_minutes}m` : '';


    const guests = (m.guest_emails || []).join(', ');


    const link = m.gcal_html_link ? `<a href="${esc(m.gcal_html_link)}" target="_blank" rel="noopener" style="color:var(--blue);font-size:11px;margin-left:8px">Open in Calendar â†—</a>` : '';


    return `


      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:10px 12px;${isPast?'opacity:.7':''}">


        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">


          <div style="flex:1;min-width:0">


            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">${esc(m.title)}</div>


            <div style="font-size:11px;color:var(--muted)">ðŸ“… ${esc(dateStr)}${dur}${link}</div>


            ${m.location ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">??Â ${esc(m.location)}</div>` : ''}


            ${guests ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">ðŸ‘¥ ${esc(guests)}</div>` : ''}


            ${m.notes ? `<div style="font-size:12px;color:var(--text);margin-top:4px;white-space:pre-wrap">${esc(m.notes)}</div>` : ''}


          </div>


          <button onclick="deleteProjectMeeting(${m.id})" title="Delete this meeting" style="background:transparent;border:none;color:var(--muted);font-size:14px;cursor:pointer;padding:0 4px;line-height:1">Ã—</button>


        </div>


      </div>`;


  }).join('');


}





let _mtGuests = []; // staging array for meeting guests





function openScheduleMeetingModal() {


  const p = DB.projects[activeProjectIdx];


  if (!p) return;


  if (!p._sbId) { showToast('Save the project first before scheduling meetings', 'error'); return; }





  _mtGuests = [];


  document.getElementById('mt-title').value = p.name + ' â€” Meeting';


  document.getElementById('mt-date').value = '';


  document.getElementById('mt-time').value = '09:00';


  document.getElementById('mt-duration').value = 60;


  document.getElementById('mt-location').value = '';


  document.getElementById('mt-notes').value = '';


  document.getElementById('mt-status-msg').textContent = '';


  document.getElementById('mt-guest-custom').value = '';





  // Populate guest picker: staff (skip current user) + project's client email


  const picker = document.getElementById('mt-guest-picker');


  


  (DB.staff || []).forEach(s => {


    if (s.email && s.email !== currentUser?.email) {


      opts.push(`<option value="${esc(s.email)}">${esc(s.name)} (${esc(s.email)})</option>`);


    }


  });


  // Project client email


  if (p.client_id && Array.isArray(DB.clients)) {


    const c = DB.clients.find(x => x._sbId === p.client_id);


    if (c && c.contact && c.contact.includes('@')) {


      opts.push(`<option value="${esc(c.contact)}">??Â§ ${esc(c.name)} (${esc(c.contact)})</option>`);


    }


    // Also try email field if present


    if (c && c.email && c.email.includes('@')) {


      opts.push(``);


    }


  }


  picker.innerHTML = opts.join('');


  renderMeetingGuestChips();


  openModal('modal-schedule-meeting');


}





function addMeetingGuestFromInputs() {


  const picker = document.getElementById('mt-guest-picker');


  const custom = document.getElementById('mt-guest-custom');


  const picked = picker.value.trim();


  const typed = custom.value.trim();


  let added = false;


  if (picked && !_mtGuests.includes(picked)) { _mtGuests.push(picked); added = true; }


  if (typed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed) && !_mtGuests.includes(typed)) { _mtGuests.push(typed); added = true; }


  picker.value = ''; custom.value = '';


  if (added) renderMeetingGuestChips();


  else if (typed) showToast('Invalid email', 'error');


}





function removeMeetingGuest(email) {


  _mtGuests = _mtGuests.filter(g => g !== email);


  renderMeetingGuestChips();


}





function renderMeetingGuestChips() {


  const el = document.getElementById('mt-guest-list');


  if (!el) return;


  if (!_mtGuests.length) {


    el.innerHTML = '<div style="font-size:12px;color:var(--muted)">No guests added yet.</div>';


    return;


  }


  el.innerHTML = _mtGuests.map(g => `


    <span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface3);border:1px solid var(--border);border-radius:999px;padding:4px 10px;font-size:12px;color:var(--text)">


      ${esc(g)}


      <button onclick="removeMeetingGuest('${esc(g).replace(/'/g, "\\'")}')" style="background:transparent;border:none;color:var(--muted);font-size:13px;cursor:pointer;padding:0;line-height:1">Ã—</button>


    </span>`).join('');


}





async function saveMeeting() {


  const p = DB.projects[activeProjectIdx];


  if (!p || !p._sbId) return;


  const title = document.getElementById('mt-title').value.trim();


  const date = document.getElementById('mt-date').value;


  const time = document.getElementById('mt-time').value || '09:00';


  const duration = parseInt(document.getElementById('mt-duration').value) || 60;


  const location = document.getElementById('mt-location').value.trim();


  const notes = document.getElementById('mt-notes').value.trim();


  const statusEl = document.getElementById('mt-status-msg');


  const btn = document.getElementById('mt-save-btn');





  if (!title) { showToast('Title required', 'error'); return; }


  if (!date) { showToast('Date required', 'error'); return; }





  // Build local datetime â†’ ISO


  const localDt = new Date(date + 'T' + time + ':00');


  if (isNaN(localDt)) { showToast('Invalid date/time', 'error'); return; }


  const meetingAtIso = localDt.toISOString();





  btn.disabled = true; btn.textContent = 'Schedulingâ€¦';


  statusEl.textContent = 'Saving meetingâ€¦';





  // 1. Insert into Supabase first (source of truth)


  let row = null;


  try {


    const { data, error } = await sb.from('project_meetings').insert({


      project_id: p._sbId,


      title,


      meeting_at: meetingAtIso,


      duration_minutes: duration,


      location: location || null,


      notes: notes || null,


      organizer_email: currentUser.email || '',


      organizer_name: currentUser.user_metadata?.full_name || currentUser.email || 'Staff',


      guest_emails: _mtGuests.slice(),


      status: 'scheduled'


    }).select().single();


    if (error) throw error;


    row = data;


  } catch(e) {


    console.warn('Meeting insert failed:', e);


    statusEl.textContent = 'Saving failed: ' + (e.message||'unknown');


    btn.disabled = false; btn.textContent = 'Schedule';


    return;


  }





  // 2. Try to push to Google Calendar (best-effort â€” don't block the save if it fails)


  statusEl.textContent = 'Pushing to Google Calendarâ€¦';


  try {


    const gcal = await createGoogleCalendarEvent({


      title,


      startIso: meetingAtIso,


      durationMinutes: duration,


      location,


      description: notes,


      guestEmails: _mtGuests.slice()


    });


    if (gcal && gcal.id) {


      await sb.from('project_meetings').update({


        gcal_event_id: gcal.id,


        gcal_html_link: gcal.htmlLink || null


      }).eq('id', row.id);


      row.gcal_event_id = gcal.id;


      row.gcal_html_link = gcal.htmlLink || null;


      statusEl.textContent = 'Calendar event created.';


    }


  } catch(e) {


    console.warn('Google Calendar push failed:', e);


    statusEl.textContent = 'Saved to console. Calendar push failed: ' + (e.message||'unknown') + ' â€” try re-signing in to grant calendar access.';


  }





  // 3. Update UI


  p.meetings = p.meetings || [];


  p.meetings.push(row);


  p.meetings.sort((a,b) => new Date(a.meeting_at) - new Date(b.meeting_at));


  renderProjectMeetings(p);


  btn.disabled = false; btn.textContent = 'Schedule';


  closeModal('modal-schedule-meeting');


  showToast('Meeting scheduled', 'success');


}





async function deleteProjectMeeting(meetingId) {


  if (!confirm('Delete this meeting? Calendar invites will be cancelled.')) return;


  const p = DB.projects[activeProjectIdx];


  if (!p) return;


  const m = (p.meetings || []).find(x => x.id === meetingId);


  // Cancel Google Calendar event first (best-effort)


  if (m && m.gcal_event_id) {


    try {


      await deleteGoogleCalendarEvent(m.gcal_event_id);


    } catch(e) { console.warn('GCal delete failed:', e); }


  }


  try {


    const { error } = await sb.from('project_meetings').delete().eq('id', meetingId);


    if (error) throw error;


    p.meetings = (p.meetings || []).filter(x => x.id !== meetingId);


    renderProjectMeetings(p);


    showToast('Meeting deleted', 'success');


  } catch(e) {


    console.warn('Meeting delete failed:', e);


    showToast('Failed to delete meeting: ' + (e.message||'unknown'), 'error');


  }


}





// ====== Google Calendar API helpers (using provider_token from Supabase session) ======





async function getGoogleAccessToken() {


  if (!sb || !sb.auth) return null;


  const { data: { session } } = await sb.auth.getSession();


  // Supabase exposes the Google OAuth provider_token after sign-in


  return session && session.provider_token ? session.provider_token : null;


}





async function createGoogleCalendarEvent({ title, startIso, durationMinutes, location, description, guestEmails }) {


  const token = await getGoogleAccessToken();


  if (!token) throw new Error('No Google token (re-sign in)');


  const start = new Date(startIso);


  const end = new Date(start.getTime() + (durationMinutes || 60) * 60000);


  const body = {


    summary: title,


    description: description || '',


    location: location || undefined,


    start: { dateTime: start.toISOString() },


    end: { dateTime: end.toISOString() },


    attendees: (guestEmails || []).map(e => ({ email: e })),


    reminders: { useDefault: true }


  };


  // If no explicit location given, request a Google Meet link


  if (!location) {


    body.conferenceData = {


      createRequest: { requestId: 'mse-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) }


    };


  }


  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all';


  const res = await fetch(url, {


    method: 'POST',


    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },


    body: JSON.stringify(body)


  });


  if (!res.ok) {


    const txt = await res.text();


    throw new Error('GCal API ' + res.status + ': ' + txt.slice(0, 200));


  }


  return await res.json();


}





async function deleteGoogleCalendarEvent(eventId) {


  const token = await getGoogleAccessToken();


  if (!token) throw new Error('No Google token');


  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(eventId) + '?sendUpdates=all';


  const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });


  if (res.status !== 204 && res.status !== 200 && res.status !== 410) {


    const txt = await res.text();


    throw new Error('GCal delete ' + res.status + ': ' + txt.slice(0, 200));


  }


  return true;


}





// Enter-to-submit on the new-note textarea


document.addEventListener('keydown', function(e) {


  if (e.key === 'Enter' && !e.shiftKey && document.activeElement && document.activeElement.id === 'pp-note-new') {


    e.preventDefault();


    submitProjectNote();


  }


});





