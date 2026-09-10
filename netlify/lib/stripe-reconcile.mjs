import Stripe from 'stripe';
import { isCreditSubscriptionPlan, normalizePlanId, getMonthlyAllowance } from './plans.mjs';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

/** Stripe statuses that still grant paid access (incl. grace while payment retries). */
export function isStripeSubscriptionEntitled(sub) {
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
    return true;
  }
  if (sub.status === 'canceled' && sub.current_period_end * 1000 > Date.now()) {
    return true;
  }
  return false;
}

function periodEndIso(sub) {
  if (!sub?.current_period_end) return null;
  return new Date(sub.current_period_end * 1000).toISOString();
}

/**
 * Align Supabase profile with Stripe — fixes plan label, billing IDs, and expiry dates.
 * Does NOT grant or reset scan balances; those only change on checkout or invoice.paid.
 */
export async function reconcileStripeSubscription(supabase, userId) {
  if (!supabase || !userId) return { ok: false };
  if (!stripe) return { ok: true, skipped: true, reason: 'no_stripe' };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'plan, stripe_customer_id, stripe_subscription_id, sub_scan_balance, sub_scans_allowance, sub_credits_expire_at, trial_until'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: error?.message || 'Profile not found' };

  if (!profile.stripe_customer_id && !profile.stripe_subscription_id) {
    return { ok: true, skipped: true };
  }

  let sub = null;

  if (profile.stripe_subscription_id) {
    try {
      sub = await stripe.subscriptions.retrieve(String(profile.stripe_subscription_id));
    } catch (err) {
      console.warn('Stripe subscription retrieve failed', profile.stripe_subscription_id, err.message);
    }
  }

  if (!sub && profile.stripe_customer_id) {
    try {
      const listed = await stripe.subscriptions.list({
        customer: String(profile.stripe_customer_id),
        status: 'all',
        limit: 5,
      });
      sub =
        listed.data.find((s) => isStripeSubscriptionEntitled(s)) ||
        listed.data.find((s) => s.status === 'active' || s.status === 'trialing') ||
        listed.data[0] ||
        null;
    } catch (err) {
      console.warn('Stripe subscription list failed', profile.stripe_customer_id, err.message);
    }
  }

  if (!sub) {
    return { ok: true, skipped: true, reason: 'no_subscription' };
  }

  if (!isStripeSubscriptionEntitled(sub)) {
    return { ok: true, entitled: false, status: sub.status };
  }

  const planId = normalizePlanId(sub.metadata?.plan || profile.plan);
  const periodEnd = periodEndIso(sub);

  const patch = {
    plan: planId,
    stripe_customer_id: String(sub.customer),
    stripe_subscription_id: String(sub.id),
    trial_until: null,
    updated_at: new Date().toISOString(),
  };

  if (isCreditSubscriptionPlan(planId)) {
    if (periodEnd) {
      patch.sub_credits_expire_at = periodEnd;
    }
    const allowance = getMonthlyAllowance(planId);
    if (allowance && Number(profile.sub_scans_allowance) !== allowance) {
      patch.sub_scans_allowance = allowance;
    }
  } else if (planId === 'pro_annual' && periodEnd) {
    patch.subscription_expires_at = periodEnd;
  }

  await supabase.from('profiles').update(patch).eq('id', userId);

  return {
    ok: true,
    entitled: true,
    plan: planId,
    periodEnd,
    subScanBalance: Math.max(0, Number(profile.sub_scan_balance) || 0),
  };
}
