/** Server-side promo redemption — one use per account per code. */

export async function hasRedeemedVoucher(supabase, userId, code) {
  if (!supabase || !userId || !code) return { redeemed: false, error: null };

  const { data, error } = await supabase
    .from('voucher_redemptions')
    .select('code')
    .eq('user_id', userId)
    .eq('code', String(code).trim().toUpperCase())
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      console.warn('voucher_redemptions table missing — run migration-voucher-redemptions.sql');
      return { redeemed: false, error: 'Promo tracking is not set up — contact support' };
    }
    console.warn('voucher_redemptions lookup failed', error.message);
    return { redeemed: false, error: 'Could not verify promo history — try again' };
  }

  return { redeemed: Boolean(data), error: null };
}

function redemptionTableMissing(error) {
  return error?.code === '42P01';
}

export async function recordVoucherRedemption(supabase, userId, { code, type, scansAdded = null }) {
  if (!supabase || !userId || !code) return { ok: false };

  const { error } = await supabase.from('voucher_redemptions').insert({
    user_id: userId,
    code: String(code).trim().toUpperCase(),
    redemption_type: type,
    scans_added: scansAdded,
  });

  if (error?.code === '23505') {
    return { ok: false, duplicate: true };
  }

  if (error) {
    if (redemptionTableMissing(error)) {
      console.warn('voucher_redemptions table missing — promo applied but not logged server-side');
      return { ok: false, error: 'Promo tracking is not set up — contact support' };
    }
    console.warn('voucher_redemptions insert failed', error.message);
    return { ok: false, error };
  }

  return { ok: true };
}
