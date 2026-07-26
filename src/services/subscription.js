import {
  MAX_TOPUP_CARRY,
  SCAN_PACKS,
  formatPlanPrice,
  formatScanPackPrice,
  getPlanConfig,
  getScanPack,
  isProPlan,
  isPaidPlan,
  canAccessReports,
  proFairUseDailyCap,
  proMonthlyCap,
  LEGACY_PLAN_MAP,
  normalizePlanId,
  PLANS,
  FREE_DAILY_SCANS,
} from './plans.js';
import { getDiscountEligibility } from './discount.js';
import { getUser, getSession, isSupabaseConfigured } from './auth.js';
import { getProfile } from './profile.js';

const PLAN_KEY = 'nutrilog_plan';
const USAGE_KEY = 'nutrilog_monthly_usage';
const TOPUP_KEY = 'nutrilog_topup_balance';
const DAILY_KEY = 'nutrilog_daily_usage';
const DAILY_CAP_KEY = 'nutrilog_daily_free_cap';
const PRO_MONTH_KEY = 'nutrilog_pro_month_usage';
const REDEEMED_KEY = 'nutrilog_redeemed_checkouts';

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local calendar day (YYYY-MM-DD) — resets at midnight on the user's device. */
export function getLocalDayKey(date = new Date()) {
  return todayKey(date);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getPlan() {
  const p = localStorage.getItem(PLAN_KEY) || 'free';
  return normalizePlanId(p);
}

export function setPlan(plan) {
  localStorage.setItem(PLAN_KEY, normalizePlanId(plan));
}

export function isPro() {
  return isProPlan(getPlan());
}

export { canAccessReports };

function isDevOfflineMode() {
  return import.meta.env.DEV && !isSupabaseConfigured();
}

export function getDailyFreeCap() {
  const stored = Number(localStorage.getItem(DAILY_CAP_KEY));
  if (stored === 2) return 2;
  return FREE_DAILY_SCANS;
}

export function setDailyFreeCap(cap) {
  localStorage.setItem(DAILY_CAP_KEY, String(cap === 2 ? 2 : 1));
}

export function getScanBudget(planId = getPlan()) {
  const usedToday = getScansToday();
  const dailyCap = getDailyFreeCap();
  const credits = getTopUpBalance();

  if (isDevOfflineMode() && !isProPlan(planId)) {
    const freeRemaining = Math.max(0, dailyCap - usedToday);
    const remaining = freeRemaining + credits;
    return {
      allowed: remaining > 0,
      remaining,
      limit: dailyCap + credits,
      used: usedToday,
      dailyFreeCap: dailyCap,
      dailyFreeRemaining: freeRemaining,
      creditRemaining: credits,
      topUpStored: credits,
      usedToday,
      reason: remaining <= 0 ? 'daily_limit' : null,
      resetsOn: 'midnight',
      isDaily: true,
      devOffline: true,
    };
  }

  if (!isProPlan(planId)) {
    const freeRemaining = Math.max(0, dailyCap - usedToday);
    const remaining = freeRemaining + credits;
    const allowed = remaining > 0;
    return {
      allowed,
      remaining,
      limit: dailyCap + credits,
      used: usedToday,
      dailyFreeCap: dailyCap,
      dailyFreeRemaining: freeRemaining,
      creditRemaining: credits,
      topUp: credits,
      topUpStored: credits,
      usedToday,
      dailyCapHit: allowed ? false : freeRemaining <= 0 && credits <= 0,
      reason: allowed ? null : 'daily_limit',
      resetsOn: 'midnight',
      isDaily: true,
    };
  }

  const dailyCapPro = proFairUseDailyCap();
  const monthUsed = getProScansThisMonth();
  const monthCap = proMonthlyCap();
  const dailyCapHit = usedToday >= dailyCapPro;
  const monthCapHit = monthUsed >= monthCap;
  const allowed = !dailyCapHit && !monthCapHit;

  return {
    allowed,
    remaining: Math.max(0, dailyCapPro - usedToday),
    limit: dailyCapPro,
    used: usedToday,
    monthUsed,
    monthLimit: monthCap,
    monthRemaining: Math.max(0, monthCap - monthUsed),
    topUpStored: 0,
    usedToday,
    dailyCapHit,
    monthCapHit,
    reason: monthCapHit ? 'monthly_cap' : dailyCapHit ? 'daily_cap' : null,
    resetsOn: 'midnight',
    isDaily: true,
    unlimitedMonthly: true,
  };
}

export function getTopUpBalance() {
  return Math.min(MAX_TOPUP_CARRY, Number(localStorage.getItem(TOPUP_KEY)) || 0);
}

export function getScansToday() {
  const daily = readJson(DAILY_KEY, {});
  return daily[todayKey()] || 0;
}

export function getProScansThisMonth() {
  const usage = readJson(PRO_MONTH_KEY, {});
  return usage[monthKey()] || 0;
}

export function canScan(planId = getPlan()) {
  return getScanBudget(planId);
}

export function recordScan() {
  const daily = readJson(DAILY_KEY, {});
  const dk = todayKey();
  daily[dk] = (daily[dk] || 0) + 1;
  writeJson(DAILY_KEY, daily);

  if (isProPlan(getPlan())) {
    const monthly = readJson(PRO_MONTH_KEY, {});
    const mk = monthKey();
    monthly[mk] = (monthly[mk] || 0) + 1;
    writeJson(PRO_MONTH_KEY, monthly);
  }
}

export function addScanPackCredits(packId = 'pack100') {
  const pack = getScanPack(packId) || SCAN_PACKS.pack100;
  const next = Math.min(MAX_TOPUP_CARRY, getTopUpBalance() + pack.scans);
  localStorage.setItem(TOPUP_KEY, String(next));
  if (pack.dailyFreeCap === 2) setDailyFreeCap(2);
  return next;
}

/** @deprecated */
export function addTopUpCredits(amount = SCAN_PACKS.pack100.scans) {
  const next = Math.min(MAX_TOPUP_CARRY, getTopUpBalance() + amount);
  localStorage.setItem(TOPUP_KEY, String(next));
  return next;
}

export function syncTopUpFromCloud(balance) {
  if (balance == null) return;
  localStorage.setItem(TOPUP_KEY, String(Math.min(MAX_TOPUP_CARRY, Number(balance) || 0)));
}

/** Apply authoritative scan counts returned by the server after AI analysis. */
export function syncScanUsageFromServer(usage) {
  if (!usage?.ok && usage?.used == null) return;
  if (usage.plan) setPlan(usage.plan);

  if (usage.dailyFreeCap != null) setDailyFreeCap(usage.dailyFreeCap);

  if (usage.isDaily || usage.plan === 'free' || usage.plan === 'pro') {
    const daily = readJson(DAILY_KEY, {});
    daily[todayKey()] = usage.used ?? 0;
    writeJson(DAILY_KEY, daily);
  }

  if (usage.monthUsed != null) {
    const monthly = readJson(PRO_MONTH_KEY, {});
    monthly[monthKey()] = usage.monthUsed;
    writeJson(PRO_MONTH_KEY, monthly);
  }

  if (usage.topup != null || usage.creditRemaining != null) {
    const bal = usage.creditRemaining ?? usage.topup;
    localStorage.setItem(TOPUP_KEY, String(Math.min(MAX_TOPUP_CARRY, Number(bal) || 0)));
  }
}

/** Mirror cloud profile scan counters into local UI state. */
export function syncScanStateFromProfile(profile) {
  if (!profile) return;

  let plan = profile.plan;
  if (profile.trial_until && new Date(profile.trial_until) <= new Date()) {
    plan = 'free';
  }
  if (profile.daily_free_cap != null) setDailyFreeCap(profile.daily_free_cap);
  if (plan) setPlan(normalizePlanId(plan));
  if (profile.topup_balance != null) syncTopUpFromCloud(profile.topup_balance);
  if (profile.daily_free_cap != null) setDailyFreeCap(profile.daily_free_cap);

  const used = Number(profile.scan_used) || 0;
  const period = profile.scan_month || '';
  const localToday = todayKey();
  if (/^\d{4}-\d{2}-\d{2}$/.test(period) && period === localToday) {
    const daily = readJson(DAILY_KEY, {});
    daily[localToday] = used;
    writeJson(DAILY_KEY, daily);
  }

  if (profile.pro_scans_month && /^\d{4}-\d{2}$/.test(profile.pro_scans_month)) {
    const monthly = readJson(PRO_MONTH_KEY, {});
    monthly[profile.pro_scans_month] = Number(profile.pro_scans_month_used) || 0;
    writeJson(PRO_MONTH_KEY, monthly);
  }
}

function readRedeemedSessions() {
  try {
    return new Set(JSON.parse(localStorage.getItem(REDEEMED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markSessionRedeemed(sessionId) {
  if (!sessionId) return;
  const set = readRedeemedSessions();
  set.add(sessionId);
  localStorage.setItem(REDEEMED_KEY, JSON.stringify([...set].slice(-50)));
}

async function checkoutAuthPayload(extra = {}) {
  const session = await getSession();
  const user = await getUser();
  const payload = {
    origin: window.location.origin,
    email: user?.email || '',
    userId: user?.id || '',
    ...extra,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    payload.accessToken = session.access_token;
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return { payload, headers };
}

export async function startPlanCheckout(planId, { annual = false } = {}) {
  const id = normalizePlanId(planId);
  if (id !== 'pro') throw new Error('Unknown plan');

  const { payload, headers } = await checkoutAuthPayload({ plan: 'pro', annual: annual ? 'yes' : 'no' });
  const res = await fetch('/api/create-subscription', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.mock) {
    if (import.meta.env.PROD) throw new Error('Payments are not configured');
    setPlan('pro');
    return { mock: true, plan: 'pro' };
  }
  if (!res.ok) throw new Error(data.error || 'Checkout failed');
  if (data.url) {
    window.location.href = data.url;
    return data;
  }
  throw new Error('No checkout URL returned');
}

export async function startScanPackCheckout(packId = 'pack100') {
  const pack = getScanPack(packId);
  if (!pack) throw new Error('Unknown scan pack');

  const { payload, headers } = await checkoutAuthPayload({ packId: pack.id });
  const res = await fetch('/api/create-topup', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.mock) {
    if (import.meta.env.PROD) throw new Error('Payments are not configured');
    const balance = addScanPackCredits(pack.id);
    return { mock: true, balance, packId: pack.id };
  }
  if (!res.ok) throw new Error(data.error || 'Checkout failed');
  if (data.url) {
    window.location.href = data.url;
    return data;
  }
  throw new Error('No checkout URL returned');
}

/** @deprecated use startScanPackCheckout */
export async function startTopUpCheckout(opts = {}) {
  return startScanPackCheckout(opts.packId || 'pack100');
}

export async function openBillingPortal() {
  const user = await getUser();
  if (!user?.id) throw new Error('Sign in to manage your subscription');

  const { payload, headers } = await checkoutAuthPayload();
  const res = await fetch('/api/create-billing-portal', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not open billing portal');
  if (data.url) {
    window.location.href = data.url;
    return data;
  }
  throw new Error('No billing portal URL returned');
}

export async function verifyCheckoutSession(sessionId) {
  const session = await getSession();
  const params = new URLSearchParams({ session_id: sessionId });
  if (session?.access_token) params.set('accessToken', session.access_token);
  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const res = await fetch(`/api/verify-subscription?${params}`, { headers });
  const data = await res.json();
  if (data.mock && import.meta.env.PROD) {
    throw new Error('Payments are not configured');
  }
  if (!res.ok && !data.mock) throw new Error(data.error || 'Verification failed');

  if (data.ok && data.type === 'topup') {
    if (!data.alreadyRedeemed) {
      if (data.appliedToCloud) {
        const profile = await getProfile();
        syncScanStateFromProfile(profile);
      } else {
        addScanPackCredits(data.packId || 'pack100');
      }
    }
    markSessionRedeemed(sessionId);
    return data;
  }

  if ((data.ok || data.mock) && data.plan) {
    setPlan(data.plan);
    markSessionRedeemed(sessionId);
  }

  return data;
}

export function planLabel(planId = getPlan()) {
  return getPlanConfig(planId).name;
}

/** One-line description for Settings → Plans “Your plan”. */
export function planSummaryHtml(planId = getPlan()) {
  if (isProPlan(planId)) {
    return `<strong>Pro</strong> — up to ${proFairUseDailyCap()} AI photos / day · ~${proMonthlyCap()} / month fair use · reports included.`;
  }

  const dailyCap = getDailyFreeCap();
  const credits = getTopUpBalance();
  const dailyLine = `${dailyCap} AI photo${dailyCap === 1 ? '' : 's'} / day`;

  if (dailyCap >= 2 && credits > 0) {
    return `<strong>Free + scan pack</strong> — ${dailyLine} · ${credits} credits · unlimited barcode.`;
  }
  if (dailyCap >= 2) {
    return `<strong>Free + scan pack</strong> — ${dailyLine} · unlimited barcode.`;
  }
  if (credits > 0) {
    return `<strong>Free + credits</strong> — ${dailyLine} · ${credits} credits · unlimited barcode.`;
  }
  return `<strong>Free</strong> — ${dailyLine} · unlimited barcode.`;
}

export function planBadgeLabel(planId = getPlan()) {
  if (isProPlan(planId)) return planLabel(planId);
  const dailyCap = getDailyFreeCap();
  const credits = getTopUpBalance();
  if (dailyCap >= 2) return 'Free + scan pack';
  if (credits > 0) return 'Free + credits';
  return 'Free plan';
}

export function scansLabel(planId = getPlan()) {
  const b = getScanBudget(planId);

  if (!isProPlan(planId)) {
    if (b.dailyFreeRemaining > 0 && b.creditRemaining > 0) {
      return `${b.dailyFreeRemaining} free today · ${b.creditRemaining} credits · resets midnight`;
    }
    if (b.dailyFreeRemaining > 0) {
      return `${b.dailyFreeRemaining} free photo log${b.dailyFreeRemaining === 1 ? '' : 's'} today · resets at midnight`;
    }
    if (b.creditRemaining > 0) {
      const cap = getDailyFreeCap();
      return `${b.creditRemaining} scan credits left · ${cap} free tomorrow at midnight`;
    }
    return 'No AI scans left today · buy a pack or go Pro · barcode still free';
  }

  if (!b.allowed) {
    if (b.reason === 'monthly_cap') {
      return 'Monthly fair use reached (~1,000) · resets next month';
    }
    return `0/${b.limit} photo logs left today · resets at midnight`;
  }
  return `${b.remaining}/${b.limit} photo logs left today · Pro fair use · resets midnight`;
}

export function usageMeterPercent(planId = getPlan()) {
  const b = getScanBudget(planId);
  if (!b.limit) return 0;
  return Math.min(100, Math.round((b.used / b.limit) * 100));
}

export function usageMeterRemainingPercent(planId = getPlan()) {
  const b = getScanBudget(planId);
  if (!b.limit) return 100;
  return Math.min(100, Math.round((b.remaining / b.limit) * 100));
}

export function paywallMessage(budget = getScanBudget()) {
  if (budget.reason === 'daily_limit') {
    return 'You have used today\'s free scan and credits. Buy a scan pack (never expires), upgrade to Pro, or try again after midnight. Barcode logging stays free.';
  }
  if (budget.reason === 'daily_cap') {
    return `You have logged ${proFairUseDailyCap()} meals today — Pro fair use limit. Try again tomorrow.`;
  }
  if (budget.reason === 'monthly_cap') {
    return 'You have reached the monthly fair use limit (~1,000 photo logs). Try again next month.';
  }
  return 'AI photo logging limit reached. Buy a scan pack or upgrade to Pro — barcode scan is still free.';
}

export function planPriceLabel(planId, profile, accountEmail, { annual = false } = {}) {
  const disc = getDiscountEligibility(profile, accountEmail);
  return formatPlanPrice(planId, disc.eligible, { annual });
}

export function scanPackPriceLabel(packId, profile, accountEmail) {
  const disc = getDiscountEligibility(profile, accountEmail);
  return formatScanPackPrice(packId, disc.eligible);
}

/** @deprecated */
export function topUpPriceLabel(profile, accountEmail) {
  return scanPackPriceLabel('pack100', profile, accountEmail);
}

export function resetScansForTesting() {
  const daily = readJson(DAILY_KEY, {});
  delete daily[todayKey()];
  writeJson(DAILY_KEY, daily);
  const monthly = readJson(PRO_MONTH_KEY, {});
  delete monthly[monthKey()];
  writeJson(PRO_MONTH_KEY, monthly);
}

/** @deprecated */
export function resetScansToday() {
  resetScansForTesting();
}

export { SCAN_PACKS, formatScanPackPrice, getScanPack };
