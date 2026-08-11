import { initSentry } from './services/sentry.js';
import {
  installStaleChunkRecovery,
  clearRecoveryFlag,
  recoverFromStaleAppShell,
} from './services/sw-recovery.js';
import { initApp } from './app.js';

installStaleChunkRecovery();
initSentry();

try {
  initApp();
  clearRecoveryFlag();
  // Drop one-shot recovery query param from the address bar.
  if (typeof window !== 'undefined' && window.location.search.includes('_recover=')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('_recover');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
} catch (err) {
  console.error(err);
  recoverFromStaleAppShell();
}
