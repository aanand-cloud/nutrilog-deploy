/**
 * Refer a friend — share link (rewards handled when backend referral flow exists).
 */

import { APP_NAME } from './brand.js';

const REF_STORAGE = 'mealnova_referral_code';

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36).toUpperCase().slice(0, 6);
}

export function getReferralCode(userId, email = '') {
  const seed = userId || email || 'guest';
  try {
    const stored = localStorage.getItem(`${REF_STORAGE}_${seed}`);
    if (stored) return stored;
    const code = hashCode(String(seed));
    localStorage.setItem(`${REF_STORAGE}_${seed}`, code);
    return code;
  } catch {
    return hashCode(String(seed));
  }
}

export function getReferralShareUrl(code) {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://www.mealnova.co.uk';
  return `${origin.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`;
}

export function getReferralShareText(code) {
  return `I've been using ${APP_NAME} to track meals — photo or barcode, really quick. Try it free: ${getReferralShareUrl(code)}`;
}

export async function shareReferral({ code, showToast } = {}) {
  const text = getReferralShareText(code);
  const url = getReferralShareUrl(code);

  if (navigator.share) {
    try {
      await navigator.share({ title: APP_NAME, text, url });
      showToast?.('Thanks for sharing!');
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast?.('Invite link copied');
    return true;
  } catch {
    showToast?.('Copy the link from the box below');
    return false;
  }
}
