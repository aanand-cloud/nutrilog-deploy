import Stripe from 'stripe';
import { isDevEnvironment } from '../lib/is-dev.mjs';
import { resolveDiscountEligible } from '../lib/discount-server.mjs';
import { requireUserAuth } from '../lib/verify-auth.mjs';
import { jsonResponse, optionsResponse, resolveRedirectOrigin } from '../lib/http-utils.mjs';
import { reportServerError } from '../lib/sentry.mjs';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

const PACKS = {
  pack100: {
    scans: 100,
    dailyFreeCap: 1,
    standard: 'STRIPE_PACK100_PRICE_ID',
    discount: 'STRIPE_PACK100_DISCOUNT_PRICE_ID',
    fallback: 'STRIPE_TOPUP_PRICE_ID',
    fallbackDiscount: 'STRIPE_TOPUP_DISCOUNT_PRICE_ID',
  },
  pack150: {
    scans: 150,
    dailyFreeCap: 2,
    standard: 'STRIPE_PACK150_PRICE_ID',
    discount: 'STRIPE_PACK150_DISCOUNT_PRICE_ID',
  },
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  if (!stripe) {
    if (isDevEnvironment()) {
      const body = await req.json().catch(() => ({}));
      const packId = body.packId === 'pack150' ? 'pack150' : 'pack100';
      const pack = PACKS[packId];
      return jsonResponse({
        mock: true,
        type: 'topup',
        packId,
        scans: pack.scans,
        dailyFreeCap: pack.dailyFreeCap,
      }, 200, req);
    }
    return jsonResponse({ error: 'Payments are not configured' }, 503, req);
  }

  try {
    const body = await req.json();
    const auth = await requireUserAuth(body, req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }

    const packId = body.packId === 'pack150' ? 'pack150' : 'pack100';
    const pack = PACKS[packId];
    const userId = auth.userId || null;
    const email = body.email || undefined;

    let useDiscount = false;
    if (userId && auth.supabase) {
      useDiscount = await resolveDiscountEligible(auth.supabase, { userId, email });
    }

    const tier = useDiscount ? 'discount' : 'standard';
    const envKey = pack[tier] || pack.fallback || pack.standard;
    const priceId = process.env[envKey] || (tier === 'discount' ? process.env[pack.fallbackDiscount] : process.env[pack.fallback]);

    if (!priceId) {
      return jsonResponse({ error: `${envKey} not set in Netlify env` }, 503, req);
    }

    const origin = resolveRedirectOrigin(body.origin);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId || undefined,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {
        product: 'nutrilog',
        type: 'topup',
        packId,
        scans: String(pack.scans),
        dailyFreeCap: String(pack.dailyFreeCap),
        discount: useDiscount ? 'yes' : 'no',
      },
    });

    return jsonResponse({
      url: session.url,
      sessionId: session.id,
      packId,
      discountApplied: useDiscount,
    }, 200, req);
  } catch (err) {
    await reportServerError(err, { function: 'create-topup' });
    return jsonResponse({ error: err.message || 'Checkout failed' }, 500, req);
  }
};
