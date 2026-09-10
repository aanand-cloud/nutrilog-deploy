import { Capacitor } from '@capacitor/core';
import { apiOrigin } from './api-base.js';
import { SITE_URL } from './brand.js';

const DEFAULT_WEB_ORIGIN = SITE_URL;

/** Live site used for Stripe checkout (web only — not inside Play WebView). */
export function webBillingOrigin() {
  if (!Capacitor.isNativePlatform()) {
    return window.location.origin.replace(/\/$/, '');
  }
  const configured = (
    import.meta.env.VITE_BILLING_WEB_ORIGIN
    || import.meta.env.VITE_API_ORIGIN
    || ''
  ).replace(/\/$/, '');
  if (configured) return configured;
  return DEFAULT_WEB_ORIGIN;
}

/** All paid plans use Stripe on the website (not Google Play Billing). */
export function billingRunsOnWebStripe() {
  return true;
}

export function nativeAppUsesExternalWebBilling() {
  return Capacitor.isNativePlatform();
}

export function webPlansUrl({ tab = 'plans' } = {}) {
  const url = new URL(`${webBillingOrigin()}/`);
  url.searchParams.set('view', 'settings');
  if (tab) url.searchParams.set('tab', tab);
  return url.toString();
}

export function webBillingPortalHint() {
  return 'Manage your subscription on our website (Stripe). Sign in with the same email as the app.';
}

/** Opens the live site in the system browser on native; same tab on web. */
export async function openWebBilling({ tab = 'plans' } = {}) {
  const url = webPlansUrl({ tab });
  if (nativeAppUsesExternalWebBilling()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return { external: true, url };
  }
  window.location.href = url;
  return { external: false, url };
}
