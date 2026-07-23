import Stripe from 'stripe';
import { requireUserAuth } from '../lib/verify-auth.mjs';
import { jsonResponse, optionsResponse } from '../lib/http-utils.mjs';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

const BUCKET = 'meal-photos';

async function cancelStripeSubscriptions(customerId) {
  if (!stripe || !customerId) return { cancelled: 0 };
  let cancelled = 0;
  const statuses = ['active', 'trialing', 'past_due'];
  for (const status of statuses) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status, limit: 100 });
    for (const sub of subs.data) {
      await stripe.subscriptions.cancel(sub.id);
      cancelled++;
    }
  }
  return { cancelled };
}

async function deleteUserPhotos(supabase, userId) {
  const paths = new Set();

  const { data: meals } = await supabase
    .from('meals')
    .select('photo_path')
    .eq('user_id', userId);
  for (const row of meals || []) {
    if (row.photo_path) paths.add(row.photo_path);
  }

  const { data: listed } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
  for (const file of listed || []) {
    if (file?.name) paths.add(`${userId}/${file.name}`);
  }

  const batch = [...paths];
  if (batch.length) {
    await supabase.storage.from(BUCKET).remove(batch);
  }
  return batch.length;
}

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
    return jsonResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  if (!body?.confirmDelete) {
    return jsonResponse({ error: 'Account deletion must be confirmed' }, 400, req);
  }

  const auth = await requireUserAuth(body, req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
  }

  const userId = auth.userId;
  const supabase = auth.supabase;
  if (!supabase) {
    return jsonResponse({ error: 'Server configuration incomplete — contact support' }, 503, req);
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    const stripeResult = await cancelStripeSubscriptions(profile?.stripe_customer_id || null);
    const photosRemoved = await deleteUserPhotos(supabase, userId);

    await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    await supabase.from('checkout_redemptions').delete().eq('user_id', userId);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new Error(deleteError.message || 'Could not delete account');
    }

    return jsonResponse({
      ok: true,
      deleted: true,
      photosRemoved,
      subscriptionsCancelled: stripeResult.cancelled,
    }, 200, req);
  } catch (err) {
    console.error('delete-account error', err);
    return jsonResponse({ error: err.message || 'Account deletion failed' }, 500, req);
  }
};
