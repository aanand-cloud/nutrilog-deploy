/** Monetisation — free daily scans, credit packs (never expire), Pro subscription. */

export const FREE_DAILY_SCANS = 1;
export const PRO_DAILY_FAIR_USE = 33;
export const PRO_MONTHLY_CAP = 1000;
/** Stored credit cap (packs stack; no expiry until used). */
export const MAX_TOPUP_CARRY = 50_000;

export const SCAN_PACKS = {
  pack100: {
    id: 'pack100',
    scans: 100,
    dailyFreeCap: 1,
    priceStandard: 1.99,
    priceDiscount: 1.39,
    label: '100 AI photo logs',
    tagline: 'One-off · never expires · 1 free scan every day',
  },
  pack150: {
    id: 'pack150',
    scans: 150,
    dailyFreeCap: 2,
    priceStandard: 2.99,
    priceDiscount: 2.09,
    label: '150 AI photo logs',
    tagline: 'One-off · never expires · 2 free scans every day',
  },
};

/** @deprecated use SCAN_PACKS.pack100 */
export const TOPUP_PACK = SCAN_PACKS.pack100;

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: '1 AI photo / day · barcode free',
    dailyScans: FREE_DAILY_SCANS,
    reportsAccess: false,
    priceStandard: 0,
    priceDiscount: 0,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Up to 33/day · ~1,000/month fair use',
    fairUseDailyCap: PRO_DAILY_FAIR_USE,
    monthlyCap: PRO_MONTHLY_CAP,
    reportsAccess: true,
    priceStandard: 5.99,
    priceDiscount: 4.19,
    priceAnnual: 39.99,
    priceAnnualDiscount: 27.99,
  },
};

/** Legacy Stripe / Supabase plan ids → current tier. */
export const LEGACY_PLAN_MAP = {
  daily10: 'pro',
  daily25: 'pro',
  pro: 'pro',
};

export function getPlanConfig(planId) {
  const id = LEGACY_PLAN_MAP[planId] || planId;
  return PLANS[id] || PLANS.free;
}

export function normalizePlanId(planId) {
  const id = LEGACY_PLAN_MAP[planId] || planId;
  return PLANS[id] ? id : 'free';
}

export function isProPlan(planId) {
  return normalizePlanId(planId) === 'pro';
}

export function isPaidPlan(planId) {
  return isProPlan(planId);
}

/** @deprecated alias */
export function isUnlimitedPlan(planId) {
  return isProPlan(planId);
}

export function canAccessReports(planId) {
  return getPlanConfig(planId).reportsAccess === true;
}

export function plusFairUseDailyCap() {
  return PRO_DAILY_FAIR_USE;
}

export function proFairUseDailyCap() {
  return PRO_DAILY_FAIR_USE;
}

export function proMonthlyCap() {
  return PRO_MONTHLY_CAP;
}

export function freeDailyScanLimit() {
  return PLANS.free.dailyScans;
}

export function getScanPack(packId) {
  return SCAN_PACKS[packId] || null;
}

export function formatPlanPrice(planId, discounted = false, { annual = false } = {}) {
  const p = getPlanConfig(planId);
  if (!isPaidPlan(planId)) return 'Free';
  if (annual) {
    const amount = discounted ? p.priceAnnualDiscount : p.priceAnnual;
    return `£${amount.toFixed(2)}/year`;
  }
  const amount = discounted ? p.priceDiscount : p.priceStandard;
  return `£${amount.toFixed(2)}/month`;
}

export function formatScanPackPrice(packId, discounted = false) {
  const pack = getScanPack(packId);
  if (!pack) return '';
  const amount = discounted ? pack.priceDiscount : pack.priceStandard;
  return `£${amount.toFixed(2)}`;
}

/** @deprecated */
export function formatTopUpPrice(discounted = false) {
  return formatScanPackPrice('pack100', discounted);
}

/** @deprecated */
export function monthlyScanAllowance() {
  return null;
}

/** @deprecated */
export const STANDARD_MONTHLY_SCANS = 0;

export function monthResetLabel(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
