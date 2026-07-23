import Stripe from 'stripe';
import { isDevEnvironment } from '../lib/is-dev.mjs';
import { resolveDiscountEligible } from '../lib/discount-server.mjs';
import { requireUserAuth } from '../lib/verify-auth.mjs';
import { jsonResponse, optionsResponse, resolveRedirectOrigin } from '../lib/http-utils.mjs';
import { reportServerError } from '../lib/sentry.mjs';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

const PRICE_MAP = {
  daily10: {
    standard: 'STRIPE_DAILY10_PRICE_ID',
    discount: 'STRIPE_DAILY10_DISCOUNT_PRICE_ID',
  },
  daily25: {
    standard: 'STRIPE_DAILY25_PRICE_ID',
    discount: 'STRIPE_DAILY25_DISCOUNT_PRICE_ID',
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
      const plan = body.plan === 'daily25' ? 'daily25' : 'daily10';
      return jsonResponse({ mock: true, plan }, 200, req);
    }
    return jsonResponse({ error: 'Payments are not configured' }, 503, req);
  }

  try {
    const body = await req.json();
    const auth = await requireUserAuth(body, req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }

    const plan = body.plan === 'daily10' || body.plan === 'daily25' ? body.plan : 'daily10';
    const userId = auth.userId || null;
    const email = body.email || undefined;

    let useDiscount = false;
    if (userId && auth.supabase) {
      useDiscount = await resolveDiscountEligible(auth.supabase, { userId, email });
    }

    const tier = useDiscount ? 'discount' : 'standard';
    const envKey = PRICE_MAP[plan][tier];
    const priceId = process.env[envKey] || process.env.STRIPE_PRO_PRICE_ID;

    if (!priceId) {
      return jsonResponse({ error: `${envKey} not set in Netlify env` }, 503, req);
    }

    const origin = resolveRedirectOrigin(body.origin);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId || undefined,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: { plan, product: 'nutrilog', discount: useDiscount ? 'yes' : 'no' },
      subscription_data: {
        metadata: { plan, product: 'nutrilog', discount: useDiscount ? 'yes' : 'no' },
      },
    });

    return jsonResponse({ url: session.url, sessionId: session.id, discountApplied: useDiscount }, 200, req);
  } catch (err) {
    await reportServerError(err, { function: 'create-subscription' });
    return jsonResponse({ error: err.message || 'Checkout failed' }, 500, req);
  }
};
