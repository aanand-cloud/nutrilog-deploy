import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client = null;
const listeners = new Set();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export function onAuthChange(cb) {
  listeners.add(cb);
  const sb = getSupabase();
  if (!sb) return () => listeners.delete(cb);
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    listeners.forEach((fn) => fn(session, event));
  });
  return () => {
    listeners.delete(cb);
    data.subscription.unsubscribe();
  };
}

export async function signUp(email, password, displayName = '') {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync not configured');
  const trimmedEmail = normalizeEmail(email);
  const trimmedPassword = String(password || '');
  if (!trimmedEmail || !trimmedPassword) throw new Error('Enter email and password');
  if (trimmedPassword.length < 6) throw new Error('Password must be at least 6 characters');

  const { data, error } = await sb.auth.signUp({
    email: trimmedEmail,
    password: trimmedPassword,
    options: {
      data: { display_name: String(displayName || '').trim() },
      emailRedirectTo: `${window.location.origin}/?view=today`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync not configured');
  const trimmedEmail = normalizeEmail(email);
  const trimmedPassword = String(password || '');
  if (!trimmedEmail || !trimmedPassword) throw new Error('Enter email and password');

  const { data, error } = await sb.auth.signInWithPassword({
    email: trimmedEmail,
    password: trimmedPassword,
  });
  if (error) throw error;
  if (!data.session) {
    throw new Error('Sign in did not complete — please try again');
  }
  return data;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function resetPassword(email) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync not configured');
  const trimmed = normalizeEmail(email);
  if (!trimmed) throw new Error('Enter your email address first');
  const { error } = await sb.auth.resetPasswordForEmail(trimmed, {
    redirectTo: `${window.location.origin}/?view=settings&reset=1`,
  });
  if (error) throw error;
}

export async function resendConfirmationEmail(email) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync not configured');
  const trimmed = normalizeEmail(email);
  if (!trimmed) throw new Error('Enter your email address first');
  const { error } = await sb.auth.resend({ type: 'signup', email: trimmed });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud sync not configured');
  const trimmed = String(newPassword || '');
  if (trimmed.length < 6) throw new Error('Password must be at least 6 characters');
  const { error } = await sb.auth.updateUser({ password: trimmed });
  if (error) throw error;
}
