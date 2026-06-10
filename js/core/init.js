

// ========== SUPABASE INIT ==========


const SUPABASE_URL = window.THETA_CONFIG?.supabaseUrl || '';

const SUPABASE_KEY = window.THETA_CONFIG?.supabaseAnonKey || '';


let sb = null;


try {


  if (window.supabase) {


    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


  } else {


    console.warn('Supabase CDN not loaded — running in offline mode');


  }


} catch(e) {


  console.warn('Supabase init failed:', e);


}





let currentUser = null;


let sbConnected = false;


let SLA_POLICIES = {high: 4, medium: 24, low: 72};


const getUser = () => currentUser || {email: 'dmcgann@msetech.org', user_metadata: {full_name: 'D. McGann'}};


function isSuperAdmin() { const e = currentUser ? (currentUser.email || '') : ''; return !e || e === 'dmcgann@msetech.org'; }





function setConnIndicator(state) {


  const dot = document.getElementById('conn-dot');


  const label = document.getElementById('conn-label');


  if (!dot || !label) return;


  dot.className = state === 'connected' ? 'green' : state === 'offline' ? 'yellow' : '';


  label.textContent = state === 'connected' ? 'Live' : state === 'offline' ? 'Offline' : 'Connecting…';


  sbConnected = (state === 'connected');


}





// ========== AUTH ==========


async function signInWithGoogle() {


  const btn = document.getElementById('google-signin-btn');


  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }


  try {


    // Make sure Supabase is ready


    if (!sb || !sb.auth) {


      hideLoginScreen();


      navigate('dashboard');


      return;


    }


    const redirectTo = window.location.origin + window.location.pathname;


    const { error } = await sb.auth.signInWithOAuth({


      provider: 'google',


      options: {


        redirectTo: redirectTo,


        scopes: 'openid email profile https://www.googleapis.com/auth/calendar.events',


        queryParams: { hd: 'msetech.org', access_type: 'offline', prompt: 'consent' }


      }


    });


    if (error) throw error;


  } catch (e) {


    console.error('Sign in error:', e);


    if (btn) {


      btn.disabled = false;


      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.5 20-21 0-1.3-.2-2.7-.5-4z"/></svg> Sign in with Google';


    }


    // Show error on screen not just toast


    const errEl = document.getElementById('login-error');


    if (errEl) { errEl.textContent = e.message || 'Sign in failed. Please refresh and try again.'; errEl.style.display = 'block'; }


    else showToast(e.message || 'Sign in failed — refresh and try again', 'error');


  }


}





async function signOut() {


  try {


    await sb.auth.signOut();


  } catch(e) { console.error(e); }


  currentUser = null;


  showLoginScreen();


}





function showLoginScreen() {


  const ls = document.getElementById('login-screen');


  if (ls) ls.classList.remove('hidden');


}





function hideLoginScreen() {


  const ls = document.getElementById('login-screen');


  if (ls) ls.classList.add('hidden');


}











// ============================================================


// =================== SIGN-IN LOG ============================


// ============================================================


async function _lookupIPAndLocation() {


  // Free, HTTPS+CORS, no key — returns ip + city/region/country in one call.


  // Best-effort; mobile carriers/VPNs make the location approximate.


  try {


    const ctl = new AbortController();


    const t = setTimeout(() => ctl.abort(), 3500);


    const r = await fetch('https://ipwho.is/', { signal: ctl.signal, cache: 'no-store' });


    clearTimeout(t);


    if (!r.ok) return null;


    const j = await r.json();


    if (!j || j.success === false) return null;


    const ip = j.ip || '';


    const parts = [j.city, j.region, j.country_code || j.country].filter(Boolean);


    const loc = parts.join(', ');


    return { ip, loc };


  } catch(_) { return null; }


}





async function captureSignIn() {


  if (!sb || !currentUser) return;


  try {


    const ua = navigator.userAgent || '';


    let device = 'desktop';


    if (/Mobi|Android|iPhone|iPod/i.test(ua)) device = 'mobile';


    else if (/iPad|Tablet/i.test(ua)) device = 'tablet';


    // Insert immediately so the external IP/location service is not on the sign-in critical path.


    const { data: insertedRows, error: insertError } = await sb.from('sign_in_log')
      .insert({


        user_email: currentUser.email || '',


        user_name: currentUser.user_metadata?.full_name || currentUser.email || '',


        user_agent: ua.slice(0, 500),


        ip_hint: null,


        device_type: device


      })
      .select('id');


    if (insertError) throw insertError;


    const insertedId = insertedRows?.[0]?.id || null;


    _lookupIPAndLocation()
      .then(async geo => {
        if (!geo || !insertedId) return;
        const ipHint = `${geo.ip || ''}|${geo.loc || ''}`;
        const { error } = await sb.from('sign_in_log')
          .update({ ip_hint: ipHint })
          .eq('id', insertedId);
        if (error) console.warn('IP/location enrichment update failed:', error);
      })
      .catch(e => console.warn('IP/location enrichment failed:', e));


  } catch(e) {


    // Don't toast — silent on failure (don't want to scare users)


    console.warn('Sign-in capture failed:', e);


  }


}





function _parseIpHint(v) {


  if (!v) return { ip: '', loc: '' };


  const s = String(v);


  const i = s.indexOf('|');


  if (i === -1) return { ip: s, loc: '' };


  return { ip: s.slice(0, i), loc: s.slice(i + 1) };


}





let _signInLog = [];


async function loadSignInLog() {


  const body = document.getElementById('signin-log-body');


  if (!sb) {


    if (body) body.innerHTML = '<tr><td colspan="6" class="empty-state">No Supabase connection — try refreshing.</td></tr>';


    return;


  }


  if (!currentUser) {


    if (body) body.innerHTML = '<tr><td colspan="6" class="empty-state">Not signed in. Sign out and back in.</td></tr>';


    return;


  }


  if (body) body.innerHTML = '<tr><td colspan="6" class="empty-state">Loading…</td></tr>';


  try {


    const { data, error } = await sb.from('sign_in_log')


      .select('*').order('signed_in_at', { ascending: false }).limit(1000);


    if (error) throw error;


    _signInLog = data || [];


    if (!_signInLog.length) {


      if (body) body.innerHTML = '<tr><td colspan="6" class="empty-state">Query returned 0 rows. (DB has rows but RLS blocked them — your account may not be admin in the auth context. Email seen: ' + esc(currentUser.email||'?') + ')</td></tr>';


      return;


    }


    renderSignInLog();


  } catch(e) {


    console.warn('Sign-in log load failed:', e);


    if (body) body.innerHTML = '<tr><td colspan="6" class="empty-state">Error: ' + esc(e.message || 'unknown') + '</td></tr>';


    _signInLog = [];


  }


}





function renderSignInLog() {


  const body = document.getElementById('signin-log-body');


  if (!body) return;


  if (!_signInLog.length) {


    body.innerHTML = '<tr><td colspan="6" class="empty-state">No sign-in events recorded yet.</td></tr>';


    return;


  }


  const search = (document.getElementById('signin-log-search')?.value || '').toLowerCase();


  let list = _signInLog;


  if (search) list = list.filter(r => {


    const { ip, loc } = _parseIpHint(r.ip_hint);


    return (r.user_email || '').toLowerCase().includes(search) ||


      (r.user_name || '').toLowerCase().includes(search) ||


      ip.toLowerCase().includes(search) ||


      loc.toLowerCase().includes(search);


  });


  body.innerHTML = list.map(r => {


    const dt = new Date(r.signed_in_at);


    const when = dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });


    const deviceIcon = r.device_type === 'mobile' ? '\u{1F4F1}' : r.device_type === 'tablet' ? '\u{1F4DA}' : '\u{1F4BB}';


    const browser = (r.user_agent || '').match(/(Safari|Chrome|Firefox|Edge|Opera)\b/i);


    const browserName = browser ? browser[1] : '\u2014';


    const { ip, loc } = _parseIpHint(r.ip_hint);


    const ipCell = ip || '\u2014';


    const locCell = loc ? `${esc(loc)} <span style="font-size:10px;color:var(--muted)">approx.</span>` : '\u2014';


    return `<tr>


      <td>${esc(when)}</td>


      <td><strong>${esc(r.user_name || r.user_email || '\u2014')}</strong><br><span style="font-size:11px;color:var(--muted)">${esc(r.user_email || '')}</span></td>


      <td>${deviceIcon} ${esc(r.device_type || '\u2014')}</td>


      <td style="color:var(--muted)">${esc(browserName)}</td>


      <td style="font-family:monospace;font-size:12px">${esc(ipCell)}</td>


      <td style="color:var(--muted)">${locCell}</td>


    </tr>`;


  }).join('');


}





function exportSignInLogCSV() {


  if (!_signInLog.length) { showToast('No data to export', 'info'); return; }


  const headers = ['Signed In At', 'Email', 'Name', 'Device', 'IP', 'Approx Location', 'User Agent'];


  const escapeCSV = v => {


    if (v === null || v === undefined) return '';


    const s = String(v).replace(/"/g, '""');


    return /[",\n]/.test(s) ? '"' + s + '"' : s;


  };


  const rows = _signInLog.map(r => {


    const { ip, loc } = _parseIpHint(r.ip_hint);


    return [


      r.signed_in_at, r.user_email, r.user_name, r.device_type, ip, loc, r.user_agent


    ].map(escapeCSV).join(',');


  });


  const csv = headers.join(',') + '\n' + rows.join('\n');


  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });


  const url = URL.createObjectURL(blob);


  const a = document.createElement('a');


  a.href = url;


  a.download = `signin-log-${new Date().toISOString().slice(0,10)}.csv`;


  document.body.appendChild(a); a.click(); document.body.removeChild(a);


  URL.revokeObjectURL(url);


  showToast('Sign-in log downloaded', 'success');


}





function updateUserAvatar(user) {


  const avatar = document.getElementById('user-avatar');


  if (!avatar || !user) return;


  const name = user.user_metadata?.full_name || user.email || 'U';


  // Expose for notification system


  const fullName = user.user_metadata?.full_name || '';


  // Map full name → short staff label (matches STAFF_EMAIL_MAP keys)


  const SHORT = {


    'Darren McGann':'D. McGann','Joey Pacheco':'J. Pacheco',


    'Andrew Piva':'A. Piva','Blyth Egan':'B. Egan','Karim Hilmy':'K. Hilmy'


  };


  window.SESSION_USER = {


    email: user.email || '',


    name: SHORT[fullName] || (user.email === 'dmcgann@msetech.org' ? 'D. McGann' : (fullName || user.email))


  };


  avatar.textContent = name.charAt(0).toUpperCase();


  avatar.title = name + ' — ' + (user.email || '') + ' (tap for menu)';


  // Update the dropdown menu contents


  const nameEl = document.getElementById('user-menu-name');


  const emailEl = document.getElementById('user-menu-email');


  const roleEl = document.getElementById('user-menu-role');


  const sessionEl = document.getElementById('user-menu-session');


  if (nameEl) nameEl.textContent = name;


  if (emailEl) emailEl.textContent = user.email || '—';


  if (roleEl) {


    const isAdmin = (user.email || '') === 'dmcgann@msetech.org';


    roleEl.textContent = 'Role: ' + (isAdmin ? 'Super Admin' : 'Staff');


  }


  if (sessionEl) {


    const t = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });


    sessionEl.textContent = 'Signed in · ' + t;


  }


  // Set a deterministic color based on name


  const colors = ['#2a7a3c','#7a2a3c','#2a3a7c','#7c6a2a','#5c2a7a'];


  const idx = name.charCodeAt(0) % colors.length;


  avatar.style.background = colors[idx];


}





function toggleUserMenu(e) {


  if (e) e.stopPropagation();


  const menu = document.getElementById('user-menu');


  if (!menu) return;


  const opening = menu.style.display === 'none';


  menu.style.display = opening ? 'block' : 'none';


  if (opening && typeof refreshUserMenuFieldStatus === 'function') {


    try { refreshUserMenuFieldStatus(); } catch(_) {}


  }


}





// Close menu when clicking outside


document.addEventListener('click', function(e) {


  const menu = document.getElementById('user-menu');


  const avatar = document.getElementById('user-avatar');


  if (!menu || menu.style.display === 'none') return;


  if (avatar && (avatar === e.target || avatar.contains(e.target))) return;


  if (menu === e.target || menu.contains(e.target)) return;


  menu.style.display = 'none';


});





