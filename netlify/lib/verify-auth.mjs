import { createClient } from '@supabase/supabase-js';
import { isDevEnvironment } from './is-dev.mjs';

let adminClient = null;

export function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return adminClient;
}

export function getAccessToken(body, req) {
  const authHeader = req?.headers?.get?.('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  let queryToken = '';
  try {
    if (req?.url) queryToken = new URL(req.url).searchParams.get('accessToken') || '';
  } catch (_) {}
  return body?.accessToken || bearer || queryToken || null;
}

export async function verifyAccessToken(accessToken) {
  if (!accessToken) {
    return { ok: false, error: 'Sign in required', requiresAuth: true };
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    return { ok: false, error: 'Server configuration incomplete — contact support', status: 503 };
  }
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { ok: false, error: 'Invalid or expired session — sign in again', requiresAuth: true };
  }
  return { ok: true, userId: data.user.id, supabase: sb };
}

export async function requireUserAuth(body, req, { userIdField = 'userId' } = {}) {
  if (isDevEnvironment()) {
    return { ok: true, userId: body?.[userIdField] || null, supabase: getSupabaseAdmin() };
  }
  const auth = await verifyAccessToken(getAccessToken(body, req));
  if (!auth.ok) return auth;
  const claimedId = body?.[userIdField];
  if (claimedId && claimedId !== auth.userId) {
    return { ok: false, error: 'Account mismatch — sign in again', requiresAuth: true };
  }
  return { ...auth, userId: auth.userId };
}

export function requireAuthInProduction() {
  return !isDevEnvironment();
}
