const RELOAD_FLAG = 'mealnova_sw_recover';

function alreadyTriedThisTab() {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch (_) {
    return false;
  }
}

function markTried() {
  try {
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch (_) {}
}

export function clearRecoveryFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch (_) {}
}

/** Unregister SW + wipe caches, then reload once — recovers blank-after-refresh. */
export async function recoverFromStaleAppShell() {
  if (alreadyTriedThisTab()) return;
  markTried();

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (_) {
    /* still reload */
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_recover', String(Date.now()));
  window.location.replace(url.toString());
}

function looksLikeStaleChunkError(message = '', filename = '') {
  const msg = String(message);
  const file = String(filename);
  if (file.includes('/assets/')) return true;
  return /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|Unexpected token '<'|error loading dynamically imported module/i.test(
    msg
  );
}

/** Call once at boot (before or with app init). */
export function installStaleChunkRecovery() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.();
    recoverFromStaleAppShell();
  });

  window.addEventListener('error', (event) => {
    if (looksLikeStaleChunkError(event?.message, event?.filename)) {
      recoverFromStaleAppShell();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    if (looksLikeStaleChunkError(msg)) {
      recoverFromStaleAppShell();
    }
  });
}
