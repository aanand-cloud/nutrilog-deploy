import Stripe from 'stripe';
import { isDevEnvironment } from '../lib/is-dev.mjs';
import { resolveDiscountEligible } from '../lib/discount-server.mjs';
import { requireUserAuth } from '../lib/verify-auth.mjs';
import { corsHeaders, jsonResponse, resolveRedirectOrigin } from '../lib/http-utils.mjs';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  if (!stripe) {
    if (isDevEnvironment()) {
      return jsonResponse({ mock: true, type: 'topup', scans: 100 }, 200, req);
    }
    return jsonResponse({ error: 'Payments are not configured' }, 503, req);
  }

  try {
    const body = await req.json();
    const auth = await requireUserAuth(body, req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }

    const userId = auth.userId || null;
    const email = body.email || undefined;

    let useDiscount = false;
    if (userId && auth.supabase) {
      useDiscount = await resolveDiscountEligible(auth.supabase, { userId, email });
    }

    const envKey = useDiscount ? 'STRIPE_TOPUP_DISCOUNT_PRICE_ID' : 'STRIPE_TOPUP_PRICE_ID';
    const priceId = process.env[envKey];

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
        scans: '100',
        discount: useDiscount ? 'yes' : 'no',
      },
    });

    return jsonResponse({ url: session.url, sessionId: session.id, discountApplied: useDiscount }, 200, req);
  } catch (err) {
    console.error('create-topup error', err);
    return jsonResponse({ error: err.message || 'Checkout failed' }, 500, req);
  }
};
