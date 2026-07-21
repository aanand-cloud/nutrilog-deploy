/** User-friendly messages for Supabase auth errors. */
export function friendlyAuthError(message = '') {
  const msg = String(message);
  if (/fetch|Failed to fetch|NetworkError/i.test(msg)) {
    return 'Cannot reach the server — check your internet connection and try again';
  }
  if (/Email not confirmed/i.test(msg)) {
    return 'Please confirm your email first — check your inbox, then sign in';
  }
  if (/User already registered/i.test(msg)) {
    return 'That email is already registered — try Sign in instead';
  }
  if (/Invalid login credentials/i.test(msg)) {
    return 'Wrong email or password — double-check and try again';
  }
  if (/42703|discount_senior|schema cache/i.test(msg)) {
    return import.meta.env.DEV
      ? 'Database needs an update — run supabase/migration-fix-missing-columns.sql in Supabase SQL Editor'
      : 'Account setup incomplete — please try again in a few minutes';
  }
  return msg || 'Something went wrong';
}
