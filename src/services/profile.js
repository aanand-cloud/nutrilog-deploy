import { getSupabase, getUser } from './auth.js';
import { isPublicSectorEmail } from './discount.js';
import { markVoucherRedeemedLocally } from './voucher.js';

const LOCAL_NAME_KEY = 'nutrilog_display_name';

export function getLocalDisplayName() {
  return localStorage.getItem(LOCAL_NAME_KEY) || '';
}

export function saveLocalDisplayName(name) {
  if (name) localStorage.setItem(LOCAL_NAME_KEY, name.trim());
}

export async function getProfile() {
  const user = await getUser();
  if (!user) {
    return {
      loggedIn: false,
      displayName: getLocalDisplayName(),
      email: null,
    };
  }

  const sb = getSupabase();
  if (!sb) {
    return {
      loggedIn: true,
      displayName: getLocalDisplayName() || firstNameFromEmail(user.email),
      email: user.email,
    };
  }

  const coreSelect = 'display_name, plan, goals, unit_prefs, topup_balance, scan_month, scan_used, trial_until';
  const fullSelect = `${coreSelect}, discount_senior, discount_work_email, discount_public_sector, discount_voucher_redeemed`;

  let { data, error } = await sb
    .from('profiles')
    .select(fullSelect)
    .eq('id', user.id)
    .maybeSingle();

  // Older Supabase projects may be missing discount columns — fall back gracefully.
  if (error?.code === '42703') {
    ({ data, error } = await sb
      .from('profiles')
      .select(coreSelect)
      .eq('id', user.id)
      .maybeSingle());
  }

  if (error && error.code !== 'PGRST116') throw error;

  if (!data) {
    const displayName =
      user.user_metadata?.display_name ||
      getLocalDisplayName() ||
      firstNameFromEmail(user.email);
    if (displayName) saveLocalDisplayName(displayName);
    return {
      loggedIn: true,
      displayName,
      email: user.email,
      plan: 'free',
      goals: undefined,
      unit_prefs: undefined,
      discount_senior: false,
      discount_work_email: null,
      discount_public_sector: isPublicSectorEmail(user.email),
      discount_voucher_redeemed: false,
      topup_balance: 0,
      scan_month: null,
      scan_used: 0,
      trial_until: null,
    };
  }

  const displayName =
    data?.display_name ||
    user.user_metadata?.display_name ||
    getLocalDisplayName() ||
    firstNameFromEmail(user.email);

  saveLocalDisplayName(displayName);

  return {
    loggedIn: true,
    displayName,
    email: user.email,
    plan: data?.plan === 'pro' ? 'daily25' : data?.plan,
    goals: data?.goals,
    unit_prefs: data?.unit_prefs,
    discount_senior: data?.discount_senior,
    discount_work_email: data?.discount_work_email,
    discount_public_sector: data?.discount_public_sector || isPublicSectorEmail(user.email),
    discount_voucher_redeemed: Boolean(data?.discount_voucher_redeemed),
    topup_balance: data?.topup_balance ?? 0,
    scan_month: data?.scan_month ?? null,
    scan_used: data?.scan_used ?? 0,
    trial_until: data?.trial_until ?? null,
  };
}

export async function saveDisplayName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Please enter your name');

  saveLocalDisplayName(trimmed);

  const user = await getUser();
  const sb = getSupabase();
  if (user && sb) {
    const { error } = await sb
      .from('profiles')
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
  }

  return trimmed;
}

/** Create or update cloud profile after sign-in / sign-up. */
export async function ensureUserProfile(displayName = '') {
  const user = await getUser();
  const sb = getSupabase();
  if (!user || !sb) return null;

  const trimmed = String(
    displayName || user.user_metadata?.display_name || getLocalDisplayName() || ''
  ).trim();
  if (trimmed) saveLocalDisplayName(trimmed);

  const { data: existing, error: readErr } = await sb
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();
  if (readErr && readErr.code !== 'PGRST116') throw readErr;

  if (!existing) {
    const { error } = await sb.from('profiles').insert({
      id: user.id,
      email: user.email,
      display_name: trimmed || null,
    });
    if (error && error.code !== '23505') throw error;
  } else if (trimmed) {
    const { error } = await sb
      .from('profiles')
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
  }

  return trimmed || existing?.display_name || null;
}

export async function saveDiscountPrefs({ senior, workEmail } = {}) {
  const user = await getUser();
  const sb = getSupabase();
  if (!user || !sb) throw new Error('Sign in to save discount preferences');

  const patch = {
    updated_at: new Date().toISOString(),
  };
  if (senior !== undefined) {
    patch.discount_senior = Boolean(senior);
  }
  if (workEmail !== undefined) {
    patch.discount_work_email = workEmail || null;
    patch.discount_public_sector = isPublicSectorEmail(workEmail) || isPublicSectorEmail(user.email);
  }

  if (Object.keys(patch).length <= 1) {
    throw new Error('Nothing to save');
  }

  const { error } = await sb.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
  return patch;
}

export async function saveVoucherRedemption() {
  markVoucherRedeemedLocally();
  return { savedToCloud: true };
}

export function getGreeting(displayName) {
  const h = new Date().getHours();
  const period = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return displayName ? `${period}, ${displayName}` : period;
}

function firstNameFromEmail(email) {
  if (!email) return '';
  const local = email.split('@')[0] || '';
  const part = local.split(/[._-]/)[0] || local;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}
