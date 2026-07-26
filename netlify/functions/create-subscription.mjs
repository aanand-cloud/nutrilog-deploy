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
  pro: {
    monthly: {
      standard: 'STRIPE_PRO_MONTHLY_PRICE_ID',
      discount: 'STRIPE_PRO_MONTHLY_DISCOUNT_PRICE_ID',
      fallback: 'STRIPE_PRO_PRICE_ID',
      fallbackDiscount: 'STRIPE_DAILY25_DISCOUNT_PRICE_ID',
    },
    annual: {
      standard: 'STRIPE_PRO_ANNUAL_PRICE_ID',
      discount: 'STRIPE_PRO_ANNUAL_DISCOUNT_PRICE_ID',
    },
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
      return jsonResponse({ mock: true, plan: 'pro' }, 200, req);
    }
    return jsonResponse({ error: 'Payments are not configured' }, 503, req);
  }

  try {
    const body = await req.json();
    const auth = await requireUserAuth(body, req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }

    const annual = body.annual === 'yes' || body.annual === true;
    const userId = auth.userId || null;
    const email = body.email || undefined;

    let useDiscount = false;
    if (userId && auth.supabase) {
      useDiscount = await resolveDiscountEligible(auth.supabase, { userId, email });
    }

    const cycle = annual ? 'annual' : 'monthly';
    const tier = useDiscount ? 'discount' : 'standard';
    const map = PRICE_MAP.pro[cycle];
    const priceId =
      process.env[map[tier]] ||
      process.env[map.fallback] ||
      process.env[map.fallbackDiscount] ||
      process.env.STRIPE_DAILY25_PRICE_ID;

    if (!priceId) {
      return jsonResponse({ error: `Stripe price not configured for Pro ${cycle}` }, 503, req);
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
      metadata: { plan: 'pro', product: 'nutrilog', billing: cycle, discount: useDiscount ? 'yes' : 'no' },
      subscription_data: {
        metadata: { plan: 'pro', product: 'nutrilog', billing: cycle, discount: useDiscount ? 'yes' : 'no' },
      },
    });

    return jsonResponse({ url: session.url, sessionId: session.id, discountApplied: useDiscount }, 200, req);
  } catch (err) {
    await reportServerError(err, { function: 'create-subscription' });
    return jsonResponse({ error: err.message || 'Checkout failed' }, 500, req);
  }
};
