import { signOut } from './auth.js';
import { clearAllLocalMeals } from './storage.js';
import { clearPrivacyConsentLocal } from './privacy-consent.js';
import { clearLocalDisplayName } from './profile.js';
import { clearSupplementLoggingConsentLocal } from './supplement-consent.js';
import { clearCuisineTipsCache } from './cuisine-tips.js';

const LOCAL_PREFIXES = ['nutrilog_', 'mealnova_'];

function isAppLocalKey(key = '') {
  return LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isSupabaseAuthKey(key = '') {
  return key.startsWith('sb-') && key.includes('-auth-token');
}

export function collectAppLocalStorageKeys(storage = localStorage) {
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (isAppLocalKey(key) || isSupabaseAuthKey(key)) keys.push(key);
  }
  return keys;
}

export function clearAppSessionStorage() {
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key && isAppLocalKey(key)) keys.push(key);
  }
  keys.forEach((key) => sessionStorage.removeItem(key));
}

/**
 * Clear cached app data on this device/browser. Does not delete cloud accounts or meals.
 */
export async function resetAppOnDevice({ reload = true } = {}) {
  try {
    await signOut();
  } catch (_) {
    /* still clear local state */
  }

  try {
    await clearAllLocalMeals();
  } catch (_) {}

  clearPrivacyConsentLocal();
  clearSupplementLoggingConsentLocal();
  clearLocalDisplayName();
  clearCuisineTipsCache();

  collectAppLocalStorageKeys().forEach((key) => localStorage.removeItem(key));
  clearAppSessionStorage();

  if (reload) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    window.location.replace(url.toString());
  }
}
