import { getSupabaseAdmin } from '../lib/supabase-admin.mjs';
import { isDevEnvironment } from '../lib/is-dev.mjs';
import {
  isCronAuthorized,
  isScheduledInvocation,
  jsonResponse,
} from '../lib/http-utils.mjs';
import { MEALNOVA_BUILD } from '../../shared/build-info.js';

function isHealthProbe(req) {
  const url = new URL(req.url);
  return url.searchParams.get('health') === '1' || /\/health\/?$/i.test(url.pathname);
}

async function probeSupabase(supabase) {
  if (!supabase) return { ok: false };
  const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' });
  return { ok: !error };
}

/** Daily Supabase ping + public health probe (?health=1 or /api/health rewrite). */
export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const healthProbe = isHealthProbe(req);
  if (!healthProbe && !isDevEnvironment() && !isScheduledInvocation(req) && !isCronAuthorized(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, req);
  }

  const supabase = getSupabaseAdmin();
  const started = Date.now();

  if (healthProbe) {
    const supabaseCheck = await probeSupabase(supabase);
    const checks = {
      supabase: supabaseCheck.ok,
      sentry: Boolean(process.env.SENTRY_DSN),
      vapid: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    };
    const ok = checks.supabase;
    const body = {
      ok,
      service: 'mealnova',
      build: MEALNOVA_BUILD.build,
      version: MEALNOVA_BUILD.version,
      checks,
      ms: Date.now() - started,
    };
    if (req.method === 'HEAD') {
      return new Response(null, { status: ok ? 200 : 503 });
    }
    return jsonResponse(body, ok ? 200 : 503, req);
  }

  if (!supabase) {
    return jsonResponse({ ok: false, reason: 'Supabase not configured' }, 503, req);
  }

  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  let pruned = null;
  try {
    const { error: pruneError } = await supabase
      .from('api_rate_limits')
      .delete()
      .lt('window_start', new Date(Date.now() - 2 * 86400000).toISOString());
    if (!pruneError) pruned = true;
  } catch {
    /* table may not exist yet */
  }

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500, req);
  }

  return jsonResponse(
    {
      ok: true,
      purpose: 'supabase-keep-alive',
      profiles: count ?? 0,
      rateLimitsPruned: pruned === true,
      ms: Date.now() - started,
    },
    200,
    req,
  );
}
