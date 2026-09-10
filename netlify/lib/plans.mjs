/** Keep in sync with src/services/plans.js */

export const PRO_DAILY_FAIR_USE = 33;
export const PRO_MONTHLY_CAP = 1000;

export const PLAN_ALLOWANCE = {
  essential: 200,
  plus: 300,
};

export const SUBSCRIPTION_PLAN_IDS = ['essential', 'plus', 'pro', 'pro_annual'];

const LEGACY = {
  daily10: 'pro',
  daily25: 'pro',
};

export function normalizePlanId(planId) {
  const id = LEGACY[planId] || planId;
  if (id === 'essential' || id === 'plus' || id === 'pro' || id === 'pro_annual' || id === 'free') {
    return id;
  }
  return 'free';
}

export function isUnlimitedPlan(planId) {
  const id = normalizePlanId(planId);
  return id === 'pro' || id === 'pro_annual';
}

export function isCreditSubscriptionPlan(planId) {
  const id = normalizePlanId(planId);
  return id === 'essential' || id === 'plus';
}

const PLAN_TIER_RANK = {
  free: 0,
  essential: 1,
  plus: 2,
  pro: 3,
  pro_annual: 3,
};

/** @returns {'same'|'upgrade'|'downgrade'|'lateral'} */
export function comparePlanChange(fromPlanId, toPlanId) {
  const from = normalizePlanId(fromPlanId);
  const to = normalizePlanId(toPlanId);
  if (from === to) return 'same';
  const fromRank = PLAN_TIER_RANK[from] ?? 0;
  const toRank = PLAN_TIER_RANK[to] ?? 0;
  if (toRank > fromRank) return 'upgrade';
  if (toRank < fromRank) return 'downgrade';
  return 'lateral';
}

export function getMonthlyAllowance(planId) {
  return PLAN_ALLOWANCE[normalizePlanId(planId)] || 0;
}

/** Midnight UTC on the date `daysFromNow` days ahead (for credit expiry). */
export function expiryAtMidnight(daysFromNow, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** One year from purchase at midnight UTC. */
export function annualExpiryAtMidnight(from = new Date()) {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** ~1 calendar month from purchase at midnight UTC. */
export function monthlyExpiryAtMidnight(from = new Date()) {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
