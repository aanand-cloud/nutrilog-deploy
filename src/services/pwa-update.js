/** Prompt users when a new app bundle is available (avoids stale PWA cache). */

import { registerSW } from 'virtual:pwa-register';
import { MEALNOVA_BUILD } from '../../shared/build-info.js';

let applyUpdate = null;
let swRegistration = null;
let updateInFlight = false;
let bannerShownForBuild = null;
let lastUpdateCheckMs = 0;
const UPDATE_CHECK_MIN_MS = 5 * 60 * 1000;

const DISMISS_KEY = 'pwaUpdateDismissedBuild';
const DESCRIBE_ACTIVE_KEY = 'mealDescribeActive';

function currentBuildId() {
  return MEALNOVA_BUILD?.build || MEALNOVA_BUILD?.version || 'unknown';
}

function isDescribeInProgress() {
  return sessionStorage.getItem(DESCRIBE_ACTIVE_KEY) === '1';
}

/** Call from Describe flow so SW refresh does not interrupt meal entry. */
export function setDescribeSessionActive(active = false) {
  if (active) sessionStorage.setItem(DESCRIBE_ACTIVE_KEY, '1');
  else sessionStorage.removeItem(DESCRIBE_ACTIVE_KEY);
}

function isUpdateDismissedForBuild() {
  return sessionStorage.getItem(DISMISS_KEY) === currentBuildId();
}

async function getRegistration() {
  if (swRegistration) return swRegistration;
  return navigator.serviceWorker.getRegistration();
}

async function postSkipWaiting(registration) {
  if (!registration?.waiting) return false;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

async function activateWaitingWorker() {
  const registration = await getRegistration();
  if (!registration) return false;

  if (await postSkipWaiting(registration)) return true;

  const installing = registration.installing;
  if (!installing) return false;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 4000);
    installing.addEventListener('statechange', () => {
      if (registration.waiting) {
        window.clearTimeout(timeout);
        postSkipWaiting(registration).then(resolve);
      } else if (installing.state === 'activated' || installing.state === 'redundant') {
        window.clearTimeout(timeout);
        resolve(false);
      }
    });
  });
}

async function clearWorkboxCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

/**
 * Apply a waiting service worker and reload the page once.
 */
export async function runPwaUpdate(updateBtn = null) {
  if (updateInFlight) return;
  updateInFlight = true;

  if (updateBtn) {
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating…';
  }

  sessionStorage.removeItem(DISMISS_KEY);

  let reloaded = false;
  const reload = async ({ bustCache = false } = {}) => {
    if (reloaded) return;
    reloaded = true;
    if (bustCache) {
      try {
        await clearWorkboxCaches();
      } catch (_) {
        /* ignore */
      }
    }
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => { reload(); },
    { once: true },
  );

  try {
    if (typeof applyUpdate === 'function') {
      await applyUpdate(true);
    }
  } catch (_) {
    /* workbox helper may fail — fall through */
  }

  try {
    await activateWaitingWorker();
  } catch (_) {
    /* ignore */
  }

  // Single fallback reload if controllerchange never fires.
  window.setTimeout(() => { reload({ bustCache: true }); }, 1500);
}

async function hasWaitingUpdate() {
  try {
    const registration = await getRegistration();
    return Boolean(registration?.waiting);
  } catch (_) {
    return false;
  }
}

function showUpdateBanner() {
  if (isDescribeInProgress()) return;
  if (document.getElementById('pwaUpdateBanner')) return;
  if (isUpdateDismissedForBuild()) return;

  const buildId = currentBuildId();
  if (bannerShownForBuild === buildId) return;
  bannerShownForBuild = buildId;

  const bar = document.createElement('div');
  bar.id = 'pwaUpdateBanner';
  bar.className = 'pwa-update-banner';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.dataset.buildId = buildId;

  const text = document.createElement('p');
  text.className = 'pwa-update-banner__text';
  text.textContent = `A new version of MealNova is ready (build ${buildId}) — update for the latest fixes.`;

  const actions = document.createElement('div');
  actions.className = 'pwa-update-banner__actions';

  const updateBtn = document.createElement('button');
  updateBtn.type = 'button';
  updateBtn.id = 'pwaUpdateBtn';
  updateBtn.className = 'btn btn-primary btn-sm pwa-update-banner__btn pwa-update-banner__btn--update';
  updateBtn.textContent = 'Update now';
  updateBtn.setAttribute('aria-label', 'Update MealNova now');

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.id = 'pwaUpdateDismiss';
  dismissBtn.className = 'btn btn-ghost btn-sm pwa-update-banner__btn pwa-update-banner__btn--dismiss';
  dismissBtn.textContent = 'Later';
  dismissBtn.setAttribute('aria-label', 'Dismiss update for now');

  actions.append(updateBtn, dismissBtn);
  bar.append(text, actions);
  document.body.appendChild(bar);

  updateBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    runPwaUpdate(updateBtn);
  });

  dismissBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, buildId);
    bar.remove();
  });
}

export function initPwaUpdatePrompt() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (isDescribeInProgress()) return;
      if (isUpdateDismissedForBuild()) return;
      hasWaitingUpdate().then((waiting) => {
        if (waiting) showUpdateBanner();
      });
    },
    onOfflineReady() {
      /* optional — app works offline after first load */
    },
    onRegisteredSW(_url, registration) {
      swRegistration = registration;
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (isDescribeInProgress()) return;
    if (isUpdateDismissedForBuild()) return;
    const now = Date.now();
    if (now - lastUpdateCheckMs < UPDATE_CHECK_MIN_MS) return;
    lastUpdateCheckMs = now;
    navigator.serviceWorker?.ready
      .then((registration) => {
        swRegistration = registration;
        return registration.update().then(() => registration);
      })
      .then((registration) => {
        if (registration?.waiting && !isDescribeInProgress() && !isUpdateDismissedForBuild()) {
          showUpdateBanner();
        }
      })
      .catch(() => {});
  });
}
