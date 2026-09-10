export const LEGAL_VERSION = '2026-07';

function readEnv(key, fallback) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return fallback;
}

export const SUPPORT_EMAIL = readEnv('VITE_SUPPORT_EMAIL', 'support@mealnova.co.uk');
export const CONTROLLER_NAME = readEnv('VITE_LEGAL_ENTITY', 'MealNova');
