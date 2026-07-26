import { expireTrialIfNeeded } from './trial-enforcement.mjs';
import { MONETIZATION_PAUSED } from './monetization.mjs';

const FREE_DAILY_DEFAULT = 1;
const PRO_DAILY_FAIR_USE = 33;
const PRO_MONTHLY_CAP = 1000;
const MAX_TOPUP_CARRY = 50_000;

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDayKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return value;
}

function dayDiff(a, b) {
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  return Math.round((da - db) / 86400000);
}

/** Client local day for free-tier reset (midnight on user's device). */
export function resolveClientLocalDay(clientDay, now = new Date()) {
  const parsed = parseDayKey(clientDay);
  const serverDay = dayKey(now);
  if (!parsed) return serverDay;
  const diff = dayDiff(parsed, serverDay);
  if (diff >= -1 && diff <= 1) return parsed;
  return serverDay;
}

function normalizePlan(plan) {
  if (plan === 'pro' || plan === 'daily25' || plan === 'daily10') return 'pro';
  return 'free';
}

function dailyFreeCap(profile) {
  return Math.max(1, Math.min(2, Number(profile?.daily_free_cap) || FREE_DAILY_DEFAULT));
}

function scansUsedToday(profile, dk) {
  return profile.scan_month === dk ? profile.scan_used || 0 : 0;
}

function proScansUsedThisMonth(profile, mk) {
  return profile.pro_scans_month === mk ? profile.pro_scans_month_used || 0 : 0;
}

/** Validate clarification refinement payload (blocks fake context bypass). */
export function isValidRefinementContext(context) {
  if (!context || typeof context !== 'object') return false;
  const prev = context.previous;
  if (!prev || typeof prev !== 'object') return false;
  if (typeof prev.meal_summary !== 'string' || !prev.meal_summary.trim()) return false;
  if (!Array.isArray(prev.items) || prev.items.length === 0) return false;
  if (!Array.isArray(context.answers)) return false;
  return true;
}

function buildFreeScanState(profile, dk) {
  const cap = dailyFreeCap(profile);
  const usedToday = scansUsedToday(profile, dk);
  const credits = profile.topup_balance || 0;
  const freeRemaining = Math.max(0, cap - usedToday);
  const allowed = freeRemaining > 0 || credits > 0;

  return {
    ok: allowed,
    plan: 'free',
    scan_month: dk,
    scan_used: usedToday,
    dailyFreeCap: cap,
    dailyFreeRemaining: freeRemaining,
    topup: credits,
    creditRemaining: credits,
    remaining: freeRemaining + credits,
    limit: cap + credits,
    isDaily: true,
    error: allowed
      ? undefined
      : 'No photo logs left today. Buy Pay as you go credits or try again after midnight.',
  };
}

/** Read-only check before calling AI (fail fast, save Gemini cost). */
export async function checkScanAllowed(supabase, userId, clientLocalDay) {
  if (!supabase || !userId) {
    return { ok: false, error: 'Sign in required to log meals with AI' };
  }

  if (MONETIZATION_PAUSED) {
    return { ok: true, plan: 'free', paused: true, isDaily: true };
  }

  await expireTrialIfNeeded(supabase, userId);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, scan_month, scan_used, topup_balance, daily_free_cap, pro_scans_month, pro_scans_month_used')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { ok: false, error: 'Could not verify scan allowance' };
  if (!profile) return { ok: false, error: 'Account profile not found' };

  const plan = normalizePlan(profile.plan);
  const dk = resolveClientLocalDay(clientLocalDay);
  const mk = dk.slice(0, 7);

  if (plan === 'pro') {
    const usedToday = scansUsedToday(profile, dk);
    const monthUsed = proScansUsedThisMonth(profile, mk);

    if (monthUsed >= PRO_MONTHLY_CAP) {
      return {
        ok: false,
        error: 'Monthly fair use limit reached (~1,000 photo logs). Try again next month.',
      };
    }
    if (usedToday >= PRO_DAILY_FAIR_USE) {
      return {
        ok: false,
        error: `Fair use limit of ${PRO_DAILY_FAIR_USE} photo logs per day reached. Try again tomorrow.`,
      };
    }

    return {
      ok: true,
      plan,
      scan_month: dk,
      scan_used: usedToday,
      remaining: PRO_DAILY_FAIR_USE - usedToday,
      limit: PRO_DAILY_FAIR_USE,
      monthUsed,
      monthLimit: PRO_MONTHLY_CAP,
      monthRemaining: PRO_MONTHLY_CAP - monthUsed,
      unlimited: true,
      isDaily: true,
    };
  }

  const state = buildFreeScanState(profile, dk);
  if (!state.ok) return state;
  return state;
}

/** Refinements are free only after today's scan was already consumed (same meal flow). */
export async function checkRefinementAllowed(supabase, userId, clientLocalDay) {
  if (!supabase || !userId) {
    return { ok: false, error: 'Sign in required to log meals with AI' };
  }

  const state = await getProfileScanState(supabase, userId);
  if (!state) return { ok: false, error: 'Account profile not found' };

  const plan = normalizePlan(state.plan);
  const dk = resolveClientLocalDay(clientLocalDay);

  if (plan === 'pro') {
    const usedToday = scansUsedToday(state, dk);
    if (usedToday > 0) return { ok: true, plan, refinement: true };
    return checkScanAllowed(supabase, userId, clientLocalDay);
  }

  if (scansUsedToday(state, dk) > 0) {
    return { ok: true, plan: 'free', refinement: true };
  }

  return checkScanAllowed(supabase, userId, clientLocalDay);
}

/** Atomic consume after successful AI — uses DB RPC with row lock. */
export async function consumeMealScan(supabase, userId, clientLocalDay) {
  if (!supabase || !userId) {
    return { ok: false, error: 'Sign in required' };
  }

  if (MONETIZATION_PAUSED) {
    return { ok: true, usage: { ok: true, paused: true } };
  }

  const dk = resolveClientLocalDay(clientLocalDay);
  await expireTrialIfNeeded(supabase, userId);

  const { data, error } = await supabase.rpc('consume_meal_scan', {
    p_user_id: userId,
    p_local_day: dk,
  });

  if (error) {
    console.error('consume_meal_scan RPC error', error);
    return { ok: false, error: 'Could not record scan usage' };
  }

  if (!data?.ok) {
    return { ok: false, error: data?.error || 'Scan limit reached' };
  }

  return { ok: true, usage: data };
}

/** @deprecated use consumeMealScan */
export async function recordScanUsage(supabase, userId) {
  return consumeMealScan(supabase, userId);
}

/** @deprecated use checkScanAllowed + consumeMealScan */
export async function assertScanAllowed(supabase, userId) {
  const check = await checkScanAllowed(supabase, userId);
  if (!check.ok) return check;
  return consumeMealScan(supabase, userId);
}

/** Apply a one-off scan pack after Stripe / voucher redemption. */
export async function applyScanPackToProfile(
  supabase,
  userId,
  { scans = 100, dailyFreeCap = 1 } = {}
) {
  if (!supabase || !userId) return { ok: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('topup_balance, daily_free_cap')
    .eq('id', userId)
    .maybeSingle();

  const nextBalance = Math.min(MAX_TOPUP_CARRY, (profile?.topup_balance || 0) + scans);
  const nextCap = Math.max(dailyFreeCap(profile), Math.min(2, dailyFreeCap));

  await supabase
    .from('profiles')
    .update({
      topup_balance: nextBalance,
      daily_free_cap: nextCap,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return { ok: true, balance: nextBalance, dailyFreeCap: nextCap };
}

/** @deprecated use applyScanPackToProfile */
export async function applyTopUpToProfile(supabase, userId, scans = 100) {
  return applyScanPackToProfile(supabase, userId, { scans, dailyFreeCap: 1 });
}

export async function getProfileScanState(supabase, userId) {
  if (!supabase || !userId) return null;

  const { data } = await supabase
    .from('profiles')
    .select('plan, scan_month, scan_used, topup_balance, daily_free_cap, pro_scans_month, pro_scans_month_used')
    .eq('id', userId)
    .maybeSingle();

  return data;
}
