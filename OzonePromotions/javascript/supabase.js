// ── Supabase client — single source of truth ──────────────────
const SUPABASE_URL     = 'https://dkdwjxeevovzhhxspzkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZHdqeGVldm92emhoeHNwemtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODE0NzUsImV4cCI6MjA5NjY1NzQ3NX0.4LoM7DtqviYxGaRnuP6Cxsjy62l1aZ60mG760EwK6JU';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


