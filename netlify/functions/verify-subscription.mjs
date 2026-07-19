import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { isDevEnvironment } from '../lib/is-dev.mjs';
import { redeemCheckoutSession } from '../lib/redeem-checkout.mjs';
import { applyTopUpToProfile } from '../lib/scan-enforcement.mjs';
import { requireUserAuth } from '../lib/verify-auth.mjs';
import { corsHeaders, jsonResponse } from '../lib/http-utils.mjs';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return jsonResponse({ error: 'session_id required' }, 400, req);
  }

  if (!stripe) {
    if (isDevEnvironment()) {
      return jsonResponse({ mock: true, ok: true, type: 'topup', scans: 100, sessionId }, 200, req);
    }
    return jsonResponse({ error: 'Payments are not configured' }, 503, req);
  }

  try {
    const auth = await requireUserAuth({}, req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const paid =
      session.payment_status === 'paid' ||
      session.status === 'complete' ||
      session.subscription?.status === 'active' ||
      session.subscription?.status === 'trialing';

    if (!paid) {
      return jsonResponse({ ok: false, status: session.payment_status }, 402, req);
    }

    const userId = session.client_reference_id || null;
    if (auth.userId && userId && auth.userId !== userId) {
      return jsonResponse({ error: 'This payment belongs to a different account' }, 403, req);
    }

    const metaType = session.metadata?.type;

    if (metaType === 'topup') {
      const scans = Number(session.metadata?.scans) || 100;
      const redemption = await redeemCheckoutSession(supabase, {
        sessionId: session.id,
        userId,
        type: 'topup',
        scans,
      });

      if (!redemption.ok) {
        return jsonResponse({ error: redemption.error || 'Could not redeem purchase' }, 500, req);
      }

      if (redemption.fresh && userId && supabase) {
        await applyTopUpToProfile(supabase, userId, scans);
      }

      return jsonResponse(
        {
          ok: true,
          type: 'topup',
          scans,
          sessionId: session.id,
          alreadyRedeemed: Boolean(redemption.alreadyRedeemed),
          appliedToCloud: Boolean(redemption.fresh && userId && supabase),
        },
        200,
        req
      );
    }

    await redeemCheckoutSession(supabase, {
      sessionId: session.id,
      userId,
      type: 'subscription',
      scans: 0,
    });

    const plan = ['daily10', 'daily25'].includes(session.metadata?.plan)
      ? session.metadata.plan
      : 'free';

    if (userId && supabase && plan !== 'free') {
      await supabase
        .from('profiles')
        .update({
          plan,
          stripe_customer_id: String(session.customer || ''),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return jsonResponse(
      {
        ok: true,
        type: 'subscription',
        sessionId: session.id,
        plan,
        customerId: session.customer,
        subscriptionId: session.subscription?.id || session.subscription,
      },
      200,
      req
    );
  } catch (err) {
    console.error('verify-subscription error', err);
    return jsonResponse({ error: err.message || 'Verification failed' }, 500, req);
  }
};
