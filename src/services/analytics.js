/**
 * Privacy-light funnel analytics (Plausible).
 * Enabled when VITE_PLAUSIBLE_DOMAIN is set and the user accepts the consent banner.
 */

import { APP_NAME } from './brand.js';

const CONSENT_KEY = 'nutrilog_analytics_consent';
const FIRST_MEAL_KEY = 'nutrilog_analytics_first_meal';
const GUEST_LANDING_KEY = 'nutrilog_analytics_guest_landing';
const SCAN_LIMIT_SESSION_KEY = 'nutrilog_analytics_scan_limit_session';

let scriptLoading = false;
let scriptLoaded = false;

export function isAnalyticsConfigured() {
  return Boolean(String(import.meta.env.VITE_PLAUSIBLE_DOMAIN || '').trim());
}

export function getAnalyticsConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(granted) {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch (_) {}
  if (granted) {
    loadPlausibleScript();
  } else {
    removeConsentBanner();
  }
}

export function initAnalytics() {
  if (!isAnalyticsConfigured()) return;
  const consent = getAnalyticsConsent();
  if (consent === 'granted') {
    loadPlausibleScript();
    return;
  }
  if (consent === 'denied') return;
  showConsentBanner();
}

/**
 * @param {string} name Plausible custom event name (use snake_case goals in dashboard)
 * @param {Record<string, string | number | boolean>} [props]
 */
export function trackEvent(name, props = {}) {
  if (!isAnalyticsConfigured() || getAnalyticsConsent() !== 'granted') return;
  if (import.meta.env.DEV) {
    console.debug('[analytics]', name, props);
  }
  if (typeof window.plausible !== 'function') return;
  const cleanProps = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  if (Object.keys(cleanProps).length) {
    window.plausible(name, { props: cleanProps });
  } else {
    window.plausible(name);
  }
}

/** SPA view changes — maps to Plausible pageviews with a custom path. */
export function trackPageView(view) {
  if (!isAnalyticsConfigured() || getAnalyticsConsent() !== 'granted') return;
  if (typeof window.plausible !== 'function') return;
  const path = view && view !== 'today' ? `/?view=${view}` : '/';
  window.plausible('pageview', { u: `${window.location.origin}${path}` });
}

export function trackGuestLandingView() {
  try {
    if (sessionStorage.getItem(GUEST_LANDING_KEY)) return;
    sessionStorage.setItem(GUEST_LANDING_KEY, '1');
  } catch (_) {
    return;
  }
  trackEvent('guest_landing_view');
}

export function trackSignUpStarted(source = 'unknown') {
  trackEvent('sign_up_started', { source });
}

export function trackSignUpComplete() {
  trackEvent('sign_up_complete');
}

export function trackSignInComplete() {
  trackEvent('sign_in_complete');
}

export function trackFirstMealLogged(props = {}) {
  try {
    if (localStorage.getItem(FIRST_MEAL_KEY)) return;
    localStorage.setItem(FIRST_MEAL_KEY, '1');
  } catch (_) {
    return;
  }
  trackEvent('first_meal_logged', props);
}

export function trackScanLimitHit(reason = 'photo') {
  try {
    if (sessionStorage.getItem(SCAN_LIMIT_SESSION_KEY)) return;
    sessionStorage.setItem(SCAN_LIMIT_SESSION_KEY, '1');
  } catch (_) {
    /* still track once per call if sessionStorage blocked */
  }
  trackEvent('scan_limit_hit', { reason });
}

export function trackDescribeLogStarted(location = 'log') {
  trackEvent('describe_log_started', { location });
}

export function trackDescribeLogSaved() {
  trackEvent('describe_log_saved', {});
}

export function trackCheckoutStarted(type, planOrPack = '') {
  trackEvent('checkout_started', { type, plan: planOrPack });
}

export function trackCheckoutComplete(type, planOrPack = '') {
  trackEvent('checkout_complete', { type, plan: planOrPack });
}

export function trackCheckoutCancelled() {
  trackEvent('checkout_cancelled');
}

export function trackGuestCtaClick(location = 'unknown') {
  trackEvent('guest_cta_click', { location });
}

export function trackLandingHeroCta(location = 'hero') {
  trackEvent('landing_hero_cta', { location });
}

export function trackLandingVideoPlay(action = 'play') {
  trackEvent('landing_video', { action });
}

export function trackLandingPricingViewed() {
  trackEvent('landing_pricing_viewed');
}

export function trackLandingPlanSelected(plan = '') {
  trackEvent('landing_plan_selected', { plan });
}

export function trackLandingFaqOpened(index = '0') {
  trackEvent('landing_faq_opened', { index });
}

export function trackStartFreeClick(location = 'unknown') {
  trackEvent('start_free_click', { location });
}

function loadPlausibleScript() {
  if (scriptLoaded || scriptLoading || typeof document === 'undefined') return;
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
  if (!domain) return;

  scriptLoading = true;
  const apiHost = import.meta.env.VITE_PLAUSIBLE_API_HOST || 'https://plausible.io';
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = domain;
  script.src = `${apiHost.replace(/\/$/, '')}/js/script.js`;
  script.onload = () => {
    scriptLoaded = true;
    scriptLoading = false;
  };
  script.onerror = () => {
    scriptLoading = false;
  };
  document.head.appendChild(script);
}

function showConsentBanner() {
  if (document.getElementById('analyticsConsentBanner')) return;

  const bar = document.createElement('div');
  bar.id = 'analyticsConsentBanner';
  bar.className = 'analytics-consent';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Analytics consent');
  bar.innerHTML = `
    <p class="analytics-consent__text">
      Help us improve ${APP_NAME} with anonymous usage stats (no cookies, no ads).
      <button type="button" class="link-btn" data-legal="privacy">Privacy</button>
    </p>
    <div class="analytics-consent__actions">
      <button type="button" class="btn btn-ghost btn-sm" id="analyticsConsentDecline">No thanks</button>
      <button type="button" class="btn btn-primary btn-sm" id="analyticsConsentAccept">Accept</button>
    </div>
  `;

  document.body.appendChild(bar);

  bar.querySelector('#analyticsConsentAccept')?.addEventListener('click', () => {
    setAnalyticsConsent(true);
    trackEvent('analytics_consent_granted');
  });
  bar.querySelector('#analyticsConsentDecline')?.addEventListener('click', () => {
    setAnalyticsConsent(false);
  });
  bar.querySelector('[data-legal="privacy"]')?.addEventListener('click', () => {
    import('../views/legal.js').then(({ openLegalModal }) => openLegalModal('privacy'));
  });
}

function removeConsentBanner() {
  document.getElementById('analyticsConsentBanner')?.remove();
}
