import { Capacitor } from '@capacitor/core';
import { SITE_URL } from './brand.js';

const DEFAULT_API_ORIGIN = SITE_URL;

/** Production API host for Capacitor (Android/iOS). Empty on web = same-origin /api routes. */
export function apiOrigin() {
  if (!Capacitor.isNativePlatform()) return '';
  const configured = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '');
  if (configured) return configured;
  return DEFAULT_API_ORIGIN;
}

export function apiUrl(path) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const origin = apiOrigin();
  return origin ? `${origin}${clean}` : clean;
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}
