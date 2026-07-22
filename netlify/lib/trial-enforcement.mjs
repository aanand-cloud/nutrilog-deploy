/** Expire time-limited plan trials (promo codes, no Stripe). */

export function isTrialActive(profile) {
  if (!profile?.trial_until) return false;
  return new Date(profile.trial_until) > new Date();
}

export async function expireTrialIfNeeded(supabase, userId) {
  if (!supabase || !userId) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, trial_until, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) return profile;

  if (!profile.trial_until || profile.stripe_customer_id) return profile;

  if (new Date(profile.trial_until) > new Date()) return profile;

  const { data: updated } = await supabase
    .from('profiles')
    .update({
      plan: 'free',
      trial_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('plan, trial_until, stripe_customer_id')
    .maybeSingle();

  return updated || { ...profile, plan: 'free', trial_until: null };
}
