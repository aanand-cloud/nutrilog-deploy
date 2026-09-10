/** Ensure a profiles row exists before server-side promo or billing updates. */

export async function ensureProfileRow(supabase, userId, email = null) {
  if (!supabase || !userId) return { ok: false, error: 'Missing account' };

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (readError && readError.code !== 'PGRST116') {
    return { ok: false, error: readError.message };
  }
  if (existing?.id) return { ok: true, created: false };

  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    email: email || null,
    plan: 'free',
    topup_balance: 0,
    daily_free_cap: 1,
  });

  if (insertError && insertError.code !== '23505') {
    return { ok: false, error: insertError.message };
  }

  return { ok: true, created: true };
}
