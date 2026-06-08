// ========== NOTIFICATIONS (Supabase-backed) ==========


let NOTIFS = [];


let _notifPollHandle = null;





function _notifTime(ts) {


  if (!ts) return '';


  const d = new Date(ts);


  const diff = (Date.now() - d.getTime()) / 1000;


  if (diff < 60) return 'just now';


  if (diff < 3600) return Math.floor(diff/60) + 'm ago';


  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';


  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});


}





async function loadNotifs() {


  if (!sb) return;


  const me = (window.SESSION_USER && SESSION_USER.email) || 'dmcgann@msetech.org';


  try {


    const { data, error } = await sb.from('notifications')


      .select('*')


      .eq('recipient_email', me)


      .order('created_at', { ascending: false })


      .limit(50);


    if (error) throw error;


    NOTIFS = (data || []).map(n => ({


      id: n.id,


      unread: !n.read_at,


      icon: n.type === 'card_assigned' ? 'ðŸ“‹' : 'ðŸ””',


      iconBg: n.type === 'card_assigned' ? '#2870d4' : 'var(--surface2)',


      title: n.title,


      text: n.body || '',


      time: _notifTime(n.created_at),


      link: n.link_url


    }));


    renderNotifs();


  } catch(e) { console.warn('Notif load failed:', e); }


}





function renderNotifs() {


  const list = document.getElementById('notifItems');


  if (!list) return;


  const unread = NOTIFS.filter(n => n.unread);


  const dot = document.getElementById('notifDot');


  if (dot) dot.classList.toggle('show', unread.length > 0);


  if (!NOTIFS.length) {


    list.innerHTML = '<div class="notif-empty">You\'re all caught up âœ“</div>';


    return;


  }


  list.innerHTML = NOTIFS.map(n => `


    <div class="notif-item ${n.unread?'unread':''}" onclick="notifClick('${n.id}')">


      <div class="notif-icon" style="background:${n.iconBg}">${n.icon}</div>


      <div class="notif-item-body">


        <div class="notif-item-title">${esc(n.title)}</div>


        <div class="notif-item-text">${esc(n.text)}</div>


        <div class="notif-item-time">${esc(n.time)}</div>


      </div>


    </div>`).join('');


}





async function notifClick(id) {


  const n = NOTIFS.find(x => x.id === id);


  if (!n) return;


  if (n.unread && sb) {


    try { await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); } catch(_){}


    n.unread = false;


  }


  closeNotifTray();


  renderNotifs();


  if (n.link && n.link.startsWith('/console/')) {


    const page = n.link.replace('/console/','');


    if (typeof renderPage === 'function') renderPage(page);


  }


}





async function clearNotifs() {


  if (sb) {


    const me = (window.SESSION_USER && SESSION_USER.email) || 'dmcgann@msetech.org';


    try {


      await sb.from('notifications').update({ read_at: new Date().toISOString() })


        .eq('recipient_email', me).is('read_at', null);


    } catch(_){}


  }


  NOTIFS.forEach(n => n.unread = false);


  renderNotifs();


  closeNotifTray();


  showToast('All notifications marked read', 'success');


}





// Poll every 60s while the tab is visible


function startNotifPolling() {


  if (_notifPollHandle) return;


  loadNotifs();


  _notifPollHandle = setInterval(() => {


    if (document.visibilityState === 'visible') loadNotifs();


  }, 60000);


}





function toggleNotifTray(e) {


  e.stopPropagation();


  const tray = document.getElementById('notifTray');


  tray.classList.toggle('open');


  if (tray.classList.contains('open')) renderNotifs();


}





function closeNotifTray() {


  document.getElementById('notifTray').classList.remove('open');


}





document.getElementById('notifBtn').addEventListener('click', toggleNotifTray);


document.addEventListener('click', e => {


  const tray = document.getElementById('notifTray');


  const btn = document.getElementById('notifBtn');


  if (tray && !tray.contains(e.target) && !btn.contains(e.target)) closeNotifTray();


});





// ========== SETTINGS + SLA VISIBILITY ==========


function applySettingsVisibility() {


  const userEmail = currentUser ? (currentUser.email || '') : '';


  const isAdmin = !userEmail || userEmail === 'dmcgann@msetech.org';


  const settingsLink = document.querySelector('.nav-link[data-page="settings"]');


  if (settingsLink) {


    // Show settings nav only for super admin (or when no user is logged in â€” login screen shown anyway)


    settingsLink.style.display = isAdmin ? '' : 'none';


  }


  // SLA Dashboard nav â€” super admin only


  const slaLink = document.getElementById('nav-sla');


  if (slaLink) slaLink.style.display = isAdmin ? '' : 'none';


  // Reports nav â€” super admin only


  const reportsLink = document.getElementById('nav-reports');


  if (reportsLink) reportsLink.style.display = isAdmin ? '' : 'none';


  // HR nav â€” super admin only


  const hrLink = document.getElementById('nav-hr');


  if (hrLink) hrLink.style.display = isAdmin ? '' : 'none';


  // Sign-In Log nav â€” super admin only


  const signInLink = document.getElementById('nav-signin-log');


  if (signInLink) signInLink.style.display = isAdmin ? '' : 'none';


}





