import { isDevEnvironment } from './is-dev.mjs';

export function siteOrigin() {
  return (process.env.URL || process.env.DEPLOY_URL || '').replace(/\/$/, '');
}

/** Only allow redirects back to the deployed site (blocks open-redirect abuse). */
export function resolveRedirectOrigin(requestedOrigin) {
  const allowed = siteOrigin();
  if (isDevEnvironment()) {
    if (requestedOrigin && /^https?:\/\//i.test(requestedOrigin)) {
      return requestedOrigin.replace(/\/$/, '');
    }
    return allowed || 'http://localhost:5173';
  }
  if (!allowed) return 'http://localhost:5173';
  const normalized = (requestedOrigin || '').replace(/\/$/, '');
  if (normalized === allowed) return allowed;
  return allowed;
}

export function corsHeaders(req) {
  const allowed = siteOrigin();
  const origin = req?.headers?.get?.('Origin') || '';
  if (isDevEnvironment()) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    };
  }
  return {
    'Access-Control-Allow-Origin': allowed || origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

export function jsonResponse(obj, status, req) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return isDevEnvironment();
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export function isScheduledInvocation(req) {
  return (
    req.headers.get('x-netlify-scheduled') === 'true' ||
    req.headers.get('x-nf-scheduled') === 'true'
  );
}
