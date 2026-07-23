/** Progressive profile column selects — tolerate older Supabase schemas. */

const PROFILE_SELECTS = [
  'display_name, plan, goals, unit_prefs, topup_balance, scan_month, scan_used, trial_until, discount_senior, discount_work_email, discount_public_sector, discount_voucher_redeemed',
  'display_name, plan, goals, unit_prefs, topup_balance, scan_month, scan_used, trial_until',
  'display_name, plan, goals, unit_prefs, topup_balance, scan_month, scan_used',
  'display_name, plan, goals, unit_prefs',
];

export async function fetchProfileRow(sb, userId) {
  let lastError = null;

  for (const select of PROFILE_SELECTS) {
    const { data, error } = await sb.from('profiles').select(select).eq('id', userId).maybeSingle();
    if (!error) return { data, error: null };
    if (error.code === 'PGRST116') return { data: null, error: null };
    if (error.code === '42703') {
      lastError = error;
      continue;
    }
    return { data: null, error };
  }

  return { data: null, error: lastError };
}
