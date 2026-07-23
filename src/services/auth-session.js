import { getSession } from './auth.js';
import { ensureUserProfile } from './profile.js';
import { fullSync } from './sync.js';
import { setPlan } from './subscription.js';

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

  try {
    const result = await fullSync();
    if (result.plan) setPlan(result.plan);
    return { ok: true, syncFailed: false };
  } catch (err) {
    console.warn('Sync after sign-in', err);
    return { ok: true, syncFailed: true };
  }
}
