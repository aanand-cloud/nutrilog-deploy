import Stripe from 'stripe';
import { isDevEnvironment } from '../lib/is-dev.mjs';
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
      return jsonResponse(
        {
          error:
            'Billing portal needs Stripe configured. In local dev, change plan via checkout mock or reset in browser storage.',
        },
        503,
        req
      );
    }
    return jsonResponse({ error: 'Payments are not configured' }, 503, req);
  }

  try {
    const body = await req.json();
    const auth = await requireUserAuth(body, req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }

    const userId = auth.userId;
    const email = body.email || undefined;
    const supabase = auth.supabase;

    let customerId = null;

    if (userId && supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('stripe_customer_id, email')
        .eq('id', userId)
        .maybeSingle();
      customerId = data?.stripe_customer_id || null;
      if (!email && data?.email) {
        body.email = data.email;
      }
    }

    if (!customerId && email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data[0]?.id || null;
    }

    if (!customerId) {
      return jsonResponse(
        { error: 'No subscription found for this account. Subscribe first, then manage billing here.' },
        404,
        req
      );
    }

    const origin = resolveRedirectOrigin(body.origin);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?view=settings`,
    });

    return jsonResponse({ url: session.url }, 200, req);
  } catch (err) {
    console.error('create-billing-portal error', err);
    return jsonResponse({ error: err.message || 'Could not open billing portal' }, 500, req);
  }
};
