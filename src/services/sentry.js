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

export { Sentry };
