import * as Sentry from '@sentry/browser';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    beforeSend(event) {
      // Avoid sending meal photo data URLs if they ever appear in breadcrumbs.
      if (event.request?.data && typeof event.request.data === 'string') {
        if (event.request.data.length > 500 || event.request.data.includes('data:image')) {
          event.request.data = '[redacted]';
        }
      }
      return event;
    },
  });
}

export function isSentryConfigured() {
  return Boolean(import.meta.env.VITE_SENTRY_DSN);
}

/** Dev builds, or production when VITE_SENTRY_TEST_UI=true (remove after verifying). */
export function showSentryTestButton() {
  if (!isSentryConfigured()) return false;
  return import.meta.env.DEV || import.meta.env.VITE_SENTRY_TEST_UI === 'true';
}

/** Send a harmless test error — check your Sentry Issues dashboard. */
export async function sendSentryTestError() {
  if (!isSentryConfigured()) {
    throw new Error('VITE_SENTRY_DSN is not configured');
  }
  initSentry();
  Sentry.captureException(new Error('NutriLog Sentry test — safe to ignore'));
  await Sentry.flush(2000);
}

export { Sentry };
