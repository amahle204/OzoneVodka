// ── auth-session.js ───────────────────────────────────────────
// Included at the top of every protected page (managerDash, promoterDash).
// Checks Supabase session, fetches the public.users row, enforces role,
// and exposes window.OZ_USER for the rest of the page to use.
// ─────────────────────────────────────────────────────────────

(async function guardPage() {
  const db = window.supabaseClient;
  if (!db) { return redirect(); }

  // 1. Supabase Auth session
  const { data: { session }, error: sessErr } = await db.auth.getSession();
  if (sessErr || !session) { return redirect(); }

  // 2. Fetch the public.users profile (role lives here)
  const { data: profile, error: profErr } = await db
    .from('users')
    .select('id, first_name, last_name, email, role, phone')
    .eq('supabase_auth_id', session.user.id)
    .single();

  if (profErr || !profile) { return redirect(); }

  // 3. Role-based page guard
  const page = window.location.pathname.split('/').pop();
  if (page === 'managerDash.html' && profile.role !== 'manager') {
    return window.location.replace('promoterDash.html');
  }
  if (page === 'promoterDash.html' && profile.role !== 'promoter') {
    return window.location.replace('managerDash.html');
  }

  // 4. Expose globally so the dashboard scripts can read it
  window.OZ_USER = {
    id:        profile.id,
    authId:    session.user.id,
    name:      profile.first_name + ' ' + profile.last_name,
    firstName: profile.first_name,
    lastName:  profile.last_name,
    initials:  profile.first_name[0] + profile.last_name[0],
    email:     profile.email,
    phone:     profile.phone,
    role:      profile.role,
  };

  // 5. Update any sidebar name/avatar elements already in the DOM
  const nameEl = document.getElementById('sb-name');
  const avEl   = document.getElementById('sb-av');
  if (nameEl) nameEl.textContent = window.OZ_USER.name;
  if (avEl)   avEl.textContent   = window.OZ_USER.initials;

})();

// Global sign-out (called by "Sign Out" button in sidebars)
async function doLogout() {
  await window.supabaseClient.auth.signOut();
  sessionStorage.clear();
  window.location.href = 'login.html';
}

function redirect() {
  sessionStorage.clear();
  window.location.href = 'login.html';
}