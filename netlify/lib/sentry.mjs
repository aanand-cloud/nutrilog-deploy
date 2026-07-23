import * as Sentry from '@sentry/node';

let initialized = false;

function sentryEnvironment() {
  return (
    process.env.SENTRY_ENVIRONMENT
    || process.env.VERCEL_ENV
    || process.env.CONTEXT
    || process.env.NODE_ENV
    || 'development'
  );
}

export function initSentry() {
  if (initialized) return Boolean(process.env.SENTRY_DSN);
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
  return true;
}

/**
 * Report a server/API error to Sentry (no-op when SENTRY_DSN is unset).
 * Always logs to stderr as a fallback.
 */
export async function reportServerError(error, context = {}) {
  initSentry();
  const logMessage = context.logMessage || context.function || 'Server error';
  console.error(logMessage, error);

  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context.function) scope.setTag('function', context.function);
    if (context.route) scope.setTag('route', context.route);
    if (context.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value);
      }
    }
    if (context.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), context.level || 'error');
    }
  });

  await Sentry.flush(Number(process.env.SENTRY_FLUSH_TIMEOUT_MS || 2000));
}
