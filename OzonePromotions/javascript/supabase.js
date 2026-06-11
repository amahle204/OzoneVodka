// ── Supabase client — single source of truth ──────────────────
const SUPABASE_URL     = 'https://dkdwjxeevovzhhxspzkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZHdqeGVldm92emhoeHNwemtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODE0NzUsImV4cCI6MjA5NjY1NzQ3NX0.4LoM7DtqviYxGaRnuP6Cxsjy62l1aZ60mG760EwK6JU';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// Load accent color from DB and apply site-wide
(async () => {
  try {
    const { data } = await window.supabaseClient
      .from('system_settings')
      .select('accent_color')
      .eq('id', 1)
      .single();
    if (data?.accent_color) {
      document.documentElement.style.setProperty('--oz-accent', data.accent_color);
    }
  } catch (e) {}
})();