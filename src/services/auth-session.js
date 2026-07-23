import { getSession, getSupabase } from './auth.js';
async function syncConsentMetadataToCloud() {
  const termsAt = localStorage.getItem('nutrilog_terms_accepted_at');
  const aiAt = localStorage.getItem('nutrilog_ai_consent_at');
  if (!termsAt && !aiAt) return;
  const sb = getSupabase();
  if (!sb) return;
  const data = {};
  if (termsAt) {
    data.terms_accepted_at = termsAt;
    data.terms_version = localStorage.getItem('nutrilog_terms_version') || undefined;
  }
  if (aiAt) {
    data.ai_consent_at = aiAt;
    data.ai_consent_version = localStorage.getItem('nutrilog_ai_consent_version') || undefined;
  }
  try {
    await sb.auth.updateUser({ data });
  } catch (_) {
    /* non-blocking */
  }
}

/** Run after a successful sign-in or sign-up with an active session. */
export async function finalizeAuthSession(firstName = '') {
  const session = await getSession();
  if (!session) {
    return { ok: false, syncFailed: true, reason: 'no_session' };
  }

  try {
    await ensureUserProfile(firstName);
  } catch (err) {
    console.warn('Profile setup after sign-in', err);
  }

  await syncConsentMetadataToCloud();
  try {
    const result = await fullSync();
    if (result.plan) setPlan(result.plan);
    return { ok: true, syncFailed: false };
  } catch (err) {
    console.warn('Sync after sign-in', err);
    return { ok: true, syncFailed: true };
  }
}
