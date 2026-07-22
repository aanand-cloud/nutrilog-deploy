import { validateVoucherCode } from '../lib/voucher.mjs';
import { isTrialActive } from '../lib/trial-enforcement.mjs';
import { verifyAccessToken, requireAuthInProduction, getAccessToken } from '../lib/verify-auth.mjs';
import { jsonResponse, optionsResponse } from '../lib/http-utils.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
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

    const { data: profile } = await auth.supabase
      .from('profiles')
      .select('plan, trial_until, stripe_customer_id')
      .eq('id', auth.userId)
      .maybeSingle();

    if (result.type === 'trial') {
      if (profile?.stripe_customer_id) {
        return jsonResponse(
          { error: 'Free trials are for users without an active subscription. Use billing settings to change plan.' },
          400,
          req
        );
      }
      if (isTrialActive(profile)) {
        return jsonResponse({ error: 'You already have an active trial on this account' }, 400, req);
      }

      const until = new Date();
      until.setDate(until.getDate() + result.trialDays);

      const { error } = await auth.supabase
        .from('profiles')
        .update({
          plan: result.trialPlan,
          trial_until: until.toISOString(),
          scan_month: null,
          scan_used: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auth.userId);

      if (error) {
        console.error('trial voucher profile update failed', error);
        return jsonResponse({ error: 'Could not start trial — contact support if this persists' }, 500, req);
      }

      return jsonResponse(
        {
          ...result,
          savedToProfile: true,
          trialUntil: until.toISOString(),
        },
        200,
        req
      );
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
