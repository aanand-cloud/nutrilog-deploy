import {
  MAX_TOPUP_CARRY,
  TOPUP_PACK,
  formatPlanPrice,
  formatTopUpPrice,
  getPlanConfig,
  isPaidPlan,
  isUnlimitedPlan,
  canAccessReports,
  plusFairUseDailyCap,
  LEGACY_PLAN_MAP,
  monthResetLabel,
  monthlyScanAllowance,
  PLANS,
  STANDARD_MONTHLY_SCANS,
} from './plans.js';
import { getDiscountEligibility } from './discount.js';
import { getUser, getSession, isSupabaseConfigured } from './auth.js';
import { getProfile } from './profile.js';

const PLAN_KEY = 'nutrilog_plan';
const USAGE_KEY = 'nutrilog_monthly_usage';
const TOPUP_KEY = 'nutrilog_topup_balance';
const DAILY_KEY = 'nutrilog_daily_usage';
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
  const id = LEGACY_PLAN_MAP[p] || p;
  return PLANS[id] ? id : 'free';
}

export function setPlan(plan) {
  const id = LEGACY_PLAN_MAP[plan] || plan;
  localStorage.setItem(PLAN_KEY, PLANS[id] ? id : 'free');
}

export function isPro() {
  return isPaidPlan(getPlan());
}

export { canAccessReports };

function isDevOfflineMode() {
  return import.meta.env.DEV && !isSupabaseConfigured();
}

export function getScanBudget(planId = getPlan()) {
  const usedToday = getScansToday();

  if (!isPaidPlan(planId)) {
    if (isDevOfflineMode()) {
      const limit = STANDARD_MONTHLY_SCANS;
      const used = getScansUsedThisMonth();
      const remaining = Math.max(0, limit - used);
      return {
        allowed: remaining > 0,
        remaining,
        limit,
        used,
        allowance: limit,
        topUp: 0,
        topUpStored: 0,
        usedToday,
        dailyCapHit: false,
        reason: remaining <= 0 ? 'monthly_limit' : null,
        resetsOn: monthResetLabel(),
        isDaily: false,
        devOffline: true,
      };
    }
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      allowance: 0,
      topUp: 0,
      topUpStored: 0,
      usedToday,
      dailyCapHit: false,
      reason: 'upgrade_required',
      resetsOn: monthResetLabel(),
      isDaily: false,
    };
  }

  if (isUnlimitedPlan(planId)) {
    const dailyCap = plusFairUseDailyCap();
    const dailyCapHit = usedToday >= dailyCap;
    const remainingToday = Math.max(0, dailyCap - usedToday);
    return {
      allowed: !dailyCapHit,
      remaining: remainingToday,
      limit: dailyCap,
      used: usedToday,
      allowance: null,
      topUp: 0,
      topUpStored: getTopUpBalance(),
      usedToday,
      dailyCapHit,
      reason: dailyCapHit ? 'daily_cap' : null,
      resetsOn: 'midnight',
      isDaily: true,
      unlimitedMonthly: true,
    };
  }

  const allowance = monthlyScanAllowance(planId);
  const topUpStored = getTopUpBalance();
  const used = getScansUsedThisMonth();
  const usedFromTopUp = Math.max(0, used - allowance);
  const topUpRemaining = Math.max(0, topUpStored - usedFromTopUp);
  const total = allowance + topUpStored;
  const remaining = Math.max(0, total - used);

  let allowed = remaining > 0;
  let reason = null;
  if (remaining <= 0) reason = 'monthly_limit';

  return {
    allowed,
    remaining,
    limit: total,
    used,
    allowance,
    topUp: topUpRemaining,
    topUpStored,
    usedToday,
    dailyCapHit: false,
    reason,
    resetsOn: monthResetLabel(),
    isDaily: false,
  };
}

export function getTopUpBalance() {
  return Math.min(MAX_TOPUP_CARRY, Number(localStorage.getItem(TOPUP_KEY)) || 0);
}

export function getScansUsedThisMonth() {
  const usage = readJson(USAGE_KEY, {});
  return usage[monthKey()] || 0;
}

export function getScansToday() {
  const daily = readJson(DAILY_KEY, {});
  return daily[todayKey()] || 0;
}

export function canScan(planId = getPlan()) {
  return getScanBudget(planId);
}

export function recordScan() {
  const daily = readJson(DAILY_KEY, {});
  const dk = todayKey();
  daily[dk] = (daily[dk] || 0) + 1;
  writeJson(DAILY_KEY, daily);

  if (isPaidPlan(getPlan()) && !isUnlimitedPlan(getPlan())) {
    const usage = readJson(USAGE_KEY, {});
    const mk = monthKey();
    usage[mk] = (usage[mk] || 0) + 1;
    writeJson(USAGE_KEY, usage);
  }
}

export function addTopUpCredits(amount = TOPUP_PACK.scans) {
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

  if (usage.isDaily) {
    const daily = readJson(DAILY_KEY, {});
    daily[todayKey()] = usage.used ?? 0;
    writeJson(DAILY_KEY, daily);
    return;
  }

  const monthly = readJson(USAGE_KEY, {});
  monthly[monthKey()] = usage.used ?? 0;
  writeJson(USAGE_KEY, monthly);
  if (usage.topup != null) {
    localStorage.setItem(TOPUP_KEY, String(Math.min(MAX_TOPUP_CARRY, Number(usage.topup) || 0)));
  }
}

/** Mirror cloud profile scan counters into local UI state. */
export function syncScanStateFromProfile(profile) {
  if (!profile) return;

  let plan = profile.plan;
  if (profile.trial_until && new Date(profile.trial_until) <= new Date()) {
    plan = 'free';
  }
  if (plan) setPlan(plan === 'pro' ? 'daily25' : plan);
  if (profile.topup_balance != null) syncTopUpFromCloud(profile.topup_balance);

  const used = Number(profile.scan_used) || 0;
  const period = profile.scan_month || '';
  const localToday = todayKey();
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const daily = readJson(DAILY_KEY, {});
    // Only mirror server usage when it matches the user's local today (midnight reset).
    if (period === localToday) {
      daily[localToday] = used;
      writeJson(DAILY_KEY, daily);
    }
  } else if (/^\d{4}-\d{2}$/.test(period)) {
    const monthly = readJson(USAGE_KEY, {});
    monthly[period] = used;
    writeJson(USAGE_KEY, monthly);
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

function isSessionRedeemed(sessionId) {
  return sessionId && readRedeemedSessions().has(sessionId);
}

async function checkoutIdentity() {
  const user = await getUser();
  return { userId: user?.id || '', email: user?.email || '' };
}

async function checkoutAuthPayload(extra = {}) {
  const session = await getSession();
  const identity = await checkoutIdentity();
  const payload = {
    origin: window.location.origin,
    email: identity.email,
    userId: identity.userId,
    ...extra,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    payload.accessToken = session.access_token;
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return { payload, headers };
}

export async function startPlanCheckout(planId, { email = '', userId = '', discount = false } = {}) {
  const identity = await checkoutIdentity();
  const { payload, headers } = await checkoutAuthPayload({
    email: email || identity.email,
    userId: userId || identity.userId,
    plan: planId,
  });
  const res = await fetch('/api/create-subscription', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.mock) {
    if (import.meta.env.PROD) throw new Error('Payments are not configured');
    setPlan(planId);
    return { mock: true, plan: planId };
  }
  if (!res.ok) throw new Error(data.error || 'Checkout failed');
  if (data.url) {
    window.location.href = data.url;
    return data;
  }
  throw new Error('No checkout URL returned');
}

export async function startTopUpCheckout({ email = '', discount = false } = {}) {
  const identity = await checkoutIdentity();
  const { payload, headers } = await checkoutAuthPayload({
    email: email || identity.email,
    userId: identity.userId,
  });
  const res = await fetch('/api/create-topup', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.mock) {
    if (import.meta.env.PROD) throw new Error('Payments are not configured');
    const balance = addTopUpCredits(TOPUP_PACK.scans);
    return { mock: true, balance };
  }
  if (!res.ok) throw new Error(data.error || 'Checkout failed');
  if (data.url) {
    window.location.href = data.url;
    return data;
  }
  throw new Error('No checkout URL returned');
}

export async function openBillingPortal() {
  const identity = await checkoutIdentity();
  if (!identity.userId) {
    throw new Error('Sign in to manage your subscription');
  }

  const { payload, headers } = await checkoutAuthPayload({
    email: identity.email,
    userId: identity.userId,
  });
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
  if (isSessionRedeemed(sessionId)) {
    return { ok: true, alreadyRedeemed: true, sessionId };
  }

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
        syncTopUpFromCloud(profile.topup_balance);
      } else {
        addTopUpCredits(data.scans || TOPUP_PACK.scans);
      }
    }
    markSessionRedeemed(sessionId);
    return data;
  }

  if ((data.ok || data.mock) && data.plan && PLANS[data.plan]) {
    setPlan(data.plan);
    markSessionRedeemed(sessionId);
  } else if (data.mock && data.type === 'topup') {
    if (!data.alreadyRedeemed) addTopUpCredits(TOPUP_PACK.scans);
    markSessionRedeemed(sessionId);
  }

  return data;
}

export function planLabel(planId = getPlan()) {
  return getPlanConfig(planId).name;
}

export function scansLabel(planId = getPlan()) {
  const b = getScanBudget(planId);
  if (!isPaidPlan(planId) && !b.devOffline) {
    return 'Free plan · barcode logging · upgrade for AI photos & reports';
  }
  if (b.unlimitedMonthly) {
    if (b.remaining <= 0) {
      return `0/${b.limit} photo logs left today · fair use · resets at midnight`;
    }
    return `${b.remaining}/${b.limit} photo logs left today · fair use · resets at midnight`;
  }
  if (b.isDaily && b.devOffline) {
    const parts = [`${b.remaining} of ${b.limit} meal logs left`];
    parts.push(`resets ${b.resetsOn}`);
    return parts.join(' · ');
  }
  const parts = [`${b.remaining} of ${b.limit} meal logs left`];
  if (b.topUp > 0) parts.push(`${b.topUp} bonus`);
  parts.push(`resets ${b.resetsOn}`);
  return parts.join(' · ');
}

export function usageMeterPercent(planId = getPlan()) {
  const b = getScanBudget(planId);
  if (!b.limit) return 0;
  return Math.min(100, Math.round((b.used / b.limit) * 100));
}

/** Bar fill matching “X left” label (remaining allowance). */
export function usageMeterRemainingPercent(planId = getPlan()) {
  const b = getScanBudget(planId);
  if (!b.limit) return 100;
  return Math.min(100, Math.round((b.remaining / b.limit) * 100));
}

export function paywallMessage(budget = getScanBudget()) {
  if (budget.reason === 'upgrade_required') {
    return 'AI photo logging is on paid plans. Barcode scan is free with your account — upgrade for 300 logs/month or unlimited with a 30/day fair use limit.';
  }
  if (budget.reason === 'daily_cap') {
    return `You've logged ${plusFairUseDailyCap()} meals today — our fair use limit on the Plus plan. Try again tomorrow.`;
  }
  return `You've used your meal logs for this month. Top up with +100 logs, upgrade your plan, or wait until ${budget.resetsOn}.`;
}

export function planPriceLabel(planId, profile, accountEmail) {
  const disc = getDiscountEligibility(profile, accountEmail);
  return formatPlanPrice(planId, disc.eligible);
}

export function topUpPriceLabel(profile, accountEmail) {
  const disc = getDiscountEligibility(profile, accountEmail);
  return formatTopUpPrice(disc.eligible);
}

export function resetScansForTesting() {
  const usage = readJson(USAGE_KEY, {});
  delete usage[monthKey()];
  writeJson(USAGE_KEY, usage);
  const daily = readJson(DAILY_KEY, {});
  delete daily[todayKey()];
  writeJson(DAILY_KEY, daily);
}

/** @deprecated */
export function resetScansToday() {
  resetScansForTesting();
}
