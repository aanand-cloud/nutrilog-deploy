/** Shared modal accessibility: Escape, focus trap, restore focus. */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Set dialog ARIA attrs and wire keyboard/focus behaviour.
 * @param {HTMLElement} overlay
 * @param {{ onClose?: () => void, initialFocus?: HTMLElement | null, panelSelector?: string, titleId?: string, label?: string }} opts
 * @returns {() => void} cleanup
 */
export function bindModalA11y(overlay, opts = {}) {
  const { onClose, initialFocus = null, panelSelector, titleId, label } = opts;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  if (titleId) {
    overlay.setAttribute('aria-labelledby', titleId);
    overlay.removeAttribute('aria-label');
  } else if (label) {
    overlay.setAttribute('aria-label', label);
    overlay.removeAttribute('aria-labelledby');
  }
  return setupModalA11y(overlay, { onClose, initialFocus, panelSelector });
}

/**
 * @param {HTMLElement} overlay
 * @param {{ onClose?: () => void, initialFocus?: HTMLElement | null, panelSelector?: string }} [opts]
 * @returns {() => void} cleanup
 */
export function setupModalA11y(overlay, opts = {}) {
  const { onClose, initialFocus = null, panelSelector = '.camera-modal__panel' } = opts;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const backgroundRoots = [
    document.getElementById('main'),
    document.querySelector('.app-header'),
    document.querySelector('.bottom-nav'),
    document.getElementById('siteHeader'),
  ].filter(Boolean);
  backgroundRoots.forEach((el) => { el.inert = true; });

  function getFocusables() {
    const panel = overlay.querySelector(panelSelector) || overlay;
    return [...panel.querySelectorAll(FOCUSABLE)].filter(
      (el) => el instanceof HTMLElement && !el.hidden && el.offsetParent !== null,
    );
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = getFocusables();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  overlay.addEventListener('keydown', onKeyDown);
  const focusTarget = initialFocus || getFocusables()[0];
  focusTarget?.focus();

  return () => {
    overlay.removeEventListener('keydown', onKeyDown);
    backgroundRoots.forEach((el) => { el.inert = false; });
    if (previousFocus?.focus) {
      try {
        previousFocus.focus();
      } catch (_) {}
    }
  };
}
