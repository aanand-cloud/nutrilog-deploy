/** Monetisation — Daily Free Scan + Top up plan (phase 1). */



export const FREE_DAILY_SCANS = 1;

export const PRO_DAILY_FAIR_USE = 33;

export const PRO_MONTHLY_CAP = 1000;

export const MAX_TOPUP_CARRY = 50_000;



/** Primary one-off pack (phase 1). */

export const PAYG_PACK_ID = 'pack100';



export const SCAN_PACKS = {

  pack100: {

    id: 'pack100',

    name: 'Top up plan',

    scans: 100,

    dailyFreeCap: 1,

    priceStandard: 1.99,

    priceDiscount: 1.39,

    label: 'Top up plan',

    tagline: '100 scan credits · top up anytime · no subscription',

    bullets: [

      '100 scan credits added instantly',

      'Top up when your scan allowance runs out',

      'Credits never expire until used',

      'Used after your Daily Free Scan each day (resets at midnight)',

    ],

  },

  pack150: {

    id: 'pack150',

    name: 'Top up plan — 150',

    scans: 150,

    dailyFreeCap: 2,

    priceStandard: 2.99,

    priceDiscount: 2.09,

    label: '150 AI photo credits',

    tagline: 'Coming soon',

    bullets: [],

  },

};



/** @deprecated use SCAN_PACKS.pack100 */

export const TOPUP_PACK = SCAN_PACKS.pack100;



export const PLANS = {

  free: {

    id: 'free',

    name: 'Daily Free Scan',

    tagline: '1 scan per day · resets at midnight',

    dailyScans: FREE_DAILY_SCANS,

    reportsAccess: false,

    priceStandard: 0,

    priceDiscount: 0,

    bullets: [

      '1 scan per day when signed in',

      'Resets every day at midnight (12:00 AM local time)',

      'Unlimited barcode logging',

    ],

  },

  essential: {

    id: 'essential',

    name: 'Essential',

    tagline: '200 photo scans / month · weekly macros',

    monthlyScans: 200,

    reportsAccess: true,

    reportTier: 'weekly',

    aiTips: false,

    priceStandard: 2.49,

    priceDiscount: 1.74,

    billing: 'monthly',

    bullets: [

      '200 AI photo scans per month',

      'Weekly macro report',

      'Barcode, search and Describe stay free',

    ],

  },

  plus: {

    id: 'plus',

    name: 'Plus',

    tagline: '300 photo scans / month · reports & AI coach',

    monthlyScans: 300,

    reportsAccess: true,

    reportTier: 'plus',

    aiTips: true,

    priceStandard: 3.49,

    priceDiscount: 2.44,

    billing: 'monthly',

    bullets: [

      '300 AI photo scans per month',

      '7- and 30-day reports including fibre, sugar and salt',

      'AI coach tips',

    ],

  },

  pro: {

    id: 'pro',

    name: 'Pro',

    tagline: 'Fair-use AI scans · full reports',

    fairUseDailyCap: PRO_DAILY_FAIR_USE,

    monthlyCap: PRO_MONTHLY_CAP,

    reportsAccess: true,

    reportTier: 'full',

    aiTips: true,

    priceStandard: 5.99,

    priceDiscount: 4.19,

    priceAnnual: 39.99,

    priceAnnualDiscount: 27.99,

    billing: 'monthly',

    bullets: [

      `Up to ${PRO_DAILY_FAIR_USE} AI photo scans per day`,

      'Full reports and AI coach',

      `About ${PRO_MONTHLY_CAP.toLocaleString()} scans / month fair use`,

    ],

  },

  pro_annual: {

    id: 'pro_annual',

    name: 'Pro Annual',

    tagline: 'Pro billed yearly',

    fairUseDailyCap: PRO_DAILY_FAIR_USE,

    monthlyCap: PRO_MONTHLY_CAP,

    reportsAccess: true,

    reportTier: 'full',

    aiTips: true,

    priceStandard: 39.99,

    priceDiscount: 27.99,

    priceAnnual: 39.99,

    priceAnnualDiscount: 27.99,

    billing: 'annual',

    bullets: [

      `Up to ${PRO_DAILY_FAIR_USE} AI photo scans per day`,

      'Full reports and AI coach',

      'Billed once a year',

    ],

  },

};



export const LEGACY_PLAN_MAP = {

  daily10: 'pro',

  daily25: 'pro',

};



export function getPlanConfig(planId) {

  const id = LEGACY_PLAN_MAP[planId] || planId;

  return PLANS[id] || PLANS.free;

}



export function normalizePlanId(planId) {

  const id = LEGACY_PLAN_MAP[planId] || planId;

  if (id === 'essential' || id === 'plus' || id === 'pro' || id === 'pro_annual' || id === 'free') {

    return id;

  }

  return PLANS[id] ? id : 'free';

}



export function isProPlan(planId) {

  const id = normalizePlanId(planId);

  return id === 'pro' || id === 'pro_annual';

}



export function isPaidPlan(planId) {

  const id = normalizePlanId(planId);

  return id === 'essential' || id === 'plus' || id === 'pro' || id === 'pro_annual';

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

  const id = normalizePlanId(planId);

  if (!isPaidPlan(id)) return 'Free';

  if (id === 'pro_annual' || (annual && (id === 'pro' || id === 'pro_annual'))) {

    const p = getPlanConfig('pro');

    const amount = discounted ? p.priceAnnualDiscount : p.priceAnnual;

    return `£${amount.toFixed(2)}/year`;

  }

  const p = getPlanConfig(id);

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

  return formatScanPackPrice(PAYG_PACK_ID, discounted);

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

export const SUBSCRIPTION_PLAN_IDS = ['essential', 'plus', 'pro', 'pro_annual'];

export function isUnlimitedPlan(planId) {
  return isProPlan(planId);
}

export function isCreditSubscriptionPlan(planId) {
  const id = normalizePlanId(planId);
  return id === 'essential' || id === 'plus';
}

export function isSubscriptionPlan(planId) {
  const id = normalizePlanId(planId);
  return id === 'essential' || id === 'plus' || id === 'pro' || id === 'pro_annual';
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

export function getReportTier(planId) {
  const id = normalizePlanId(planId);
  return getPlanConfig(id).reportTier || (id === 'free' ? 'daily' : 'full');
}

export function topUpCreditUsageNote(planId) {
  if (isCreditSubscriptionPlan(planId)) {
    return 'Top-up credits are used after your monthly subscription scans run out. They never expire until used.';
  }
  if (isUnlimitedPlan(planId)) {
    return 'Top-up credits are not required on Pro — fair-use daily scans apply.';
  }
  return 'Top-up credits are used after your Daily Free Scan. They never expire until used.';
}


