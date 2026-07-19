import { getSupabaseAdmin } from '../lib/supabase-admin.mjs';
import { requireUserAuth } from '../lib/verify-auth.mjs';
import { jsonResponse, optionsResponse } from '../lib/http-utils.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json({ ok: true, stored: false, reason: 'Supabase not configured' });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = await req.json();
    if (endpoint) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
    return json({ ok: true });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = await req.json();
  const { subscription, userAgent } = body;
  if (!subscription?.endpoint) {
    return json({ error: 'subscription required' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  let userId = null;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id || null;
  }

  const row = {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh,
    auth: subscription.keys?.auth,
    user_id: userId,
    user_agent: userAgent || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, stored: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
