import { validateVoucherCode } from '../lib/voucher.mjs';
import { verifyAccessToken, requireAuthInProduction, getAccessToken } from '../lib/verify-auth.mjs';
import { corsHeaders, jsonResponse } from '../lib/http-utils.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, req);
  }

  const result = validateVoucherCode(body.code);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, 400, req);
  }

  if (requireAuthInProduction()) {
    const auth = await verifyAccessToken(getAccessToken(body, req));
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }
    const { error } = await auth.supabase
      .from('profiles')
      .update({
        discount_voucher_redeemed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.userId);
    if (error) {
      console.error('voucher profile update failed', error);
      return jsonResponse({ error: 'Could not save voucher to your account' }, 500, req);
    }
  }

  return jsonResponse({ ...result, savedToProfile: requireAuthInProduction() }, 200, req);
};
