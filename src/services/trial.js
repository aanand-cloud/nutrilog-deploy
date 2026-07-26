export function isTrialActive(profile) {
  if (!profile?.trial_until) return false;
  return new Date(profile.trial_until) > new Date();
}

export function formatTrialUntil(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function trialPlanLabel(profile) {
  if (!isTrialActive(profile)) return '';
  const plan = profile.plan === 'pro' || profile.plan === 'daily25' || profile.plan === 'daily10' ? 'Pro' : 'Paid';
  return `${plan} trial until ${formatTrialUntil(profile.trial_until)}`;
}
