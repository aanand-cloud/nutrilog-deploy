import { openLegalModal } from '../views/legal.js';
import { APP_NAME } from './brand.js';
import { DISCLAIMERS } from './disclaimers.js';
import { bindLegalLinks } from './privacy-consent.js';
import { LEGAL_VERSION } from './legal-constants.js';
import { bindModalA11y } from './modal-a11y.js';

const SUPPLEMENT_AT_KEY = 'nutrilog_supplement_consent_at';
const SUPPLEMENT_VER_KEY = 'nutrilog_supplement_consent_version';

export function hasSupplementLoggingConsent() {
  return Boolean(localStorage.getItem(SUPPLEMENT_AT_KEY));
}

export function recordSupplementLoggingConsent() {
  localStorage.setItem(SUPPLEMENT_AT_KEY, new Date().toISOString());
  localStorage.setItem(SUPPLEMENT_VER_KEY, LEGAL_VERSION);
}

export function clearSupplementLoggingConsentLocal() {
  localStorage.removeItem(SUPPLEMENT_AT_KEY);
  localStorage.removeItem(SUPPLEMENT_VER_KEY);
}

/**
 * One-time notice before first supplement log.
 * @returns {Promise<boolean>}
 */
export async function requireSupplementLoggingConsent() {
  if (hasSupplementLoggingConsent()) return true;
  return openSupplementConsentModal();
}

export function openSupplementConsentModal() {
  return new Promise((resolve) => {
    let done = false;
    let a11yCleanup = null;
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal consent-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'supplementConsentTitle');

    function finish(accepted) {
      if (done) return;
      done = true;
      a11yCleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(Boolean(accepted));
    }

    overlay.innerHTML = `
      <div class="camera-modal__panel consent-panel">
        <h2 class="consent-panel__title" id="supplementConsentTitle">Supplement logging</h2>
        <p class="consent-panel__lead">Log what you choose to take — for your own records only.</p>
        <ul class="consent-panel__list">
          <li>${APP_NAME} stores the name, dose and timing you enter. We do <strong>not</strong> verify safety, interactions, or suitability for your health.</li>
          <li>Supplements are shown <strong>separately from meals</strong> and are <strong>not</strong> added to your daily calorie ring.</li>
          <li>Always read the product label and speak to a pharmacist, GP, or registered dietitian before starting, changing, or stopping any supplement — especially if you take medication, are pregnant, or have a medical condition.</li>
        </ul>
        <p class="fine-print health-disclaimer">${DISCLAIMERS.supplementLog}</p>
        <label class="consent-row consent-row--panel">
          <input type="checkbox" id="supplementConsentCheck"/>
          <span>I understand this is personal logging only — not medical advice. I have read the <button type="button" class="consent-link" data-legal="privacy">Privacy policy</button>.</span>
        </label>
        <div class="camera-modal__actions consent-panel__actions">
          <button type="button" class="btn btn-ghost full" id="supplementConsentDecline">Not now</button>
          <button type="button" class="btn btn-primary full" id="supplementConsentAccept" disabled>Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    bindLegalLinks(overlay);

    const check = overlay.querySelector('#supplementConsentCheck');
    const acceptBtn = overlay.querySelector('#supplementConsentAccept');
    check?.addEventListener('change', () => {
      if (acceptBtn) acceptBtn.disabled = !check.checked;
    });
    overlay.querySelector('#supplementConsentDecline')?.addEventListener('click', () => finish(false));
    acceptBtn?.addEventListener('click', () => {
      if (!check?.checked) return;
      recordSupplementLoggingConsent();
      finish(true);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
    a11yCleanup = bindModalA11y(overlay, {
      onClose: () => finish(false),
      titleId: 'supplementConsentTitle',
      initialFocus: check,
    });
  });
}
