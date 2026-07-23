import { getSupabase, getUser } from './auth.js';
import { openLegalModal } from '../views/legal.js';
import { LEGAL_VERSION } from './legal-constants.js';

export { LEGAL_VERSION, SUPPORT_EMAIL, CONTROLLER_NAME } from './legal-constants.js';

const TERMS_AT_KEY = 'nutrilog_terms_accepted_at';
const TERMS_VER_KEY = 'nutrilog_terms_version';
const AI_AT_KEY = 'nutrilog_ai_consent_at';
const AI_VER_KEY = 'nutrilog_ai_consent_version';

export function signupConsentFieldsHtml({ idPrefix = 'auth' } = {}) {
  return `
    <label class="consent-row">
      <input type="checkbox" name="terms_consent" id="${idPrefix}TermsConsent" required/>
      <span>I agree to the <button type="button" class="consent-link" data-legal="terms">Terms of use</button> and <button type="button" class="consent-link" data-legal="privacy">Privacy policy</button>.</span>
    </label>
    <label class="consent-row">
      <input type="checkbox" name="age_consent" id="${idPrefix}AgeConsent" required/>
      <span>I confirm I am <strong>16 years of age or older</strong>.</span>
    </label>
  `;
}

export function bindLegalLinks(container) {
  if (!container) return;
  container.querySelectorAll('[data-legal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openLegalModal(btn.dataset.legal === 'terms' ? 'terms' : 'privacy');
    });
  });
}

export function readSignupConsent(container) {
  const terms = Boolean(container?.querySelector('[name="terms_consent"]')?.checked);
  const age = Boolean(container?.querySelector('[name="age_consent"]')?.checked);
  return { terms, age, ok: terms && age };
}

export function signupConsentError({ terms, age }) {
  if (!terms && !age) return 'Please accept the Terms & Privacy policy and confirm you are 16 or older.';
  if (!terms) return 'Please accept the Terms of use and Privacy policy.';
  if (!age) return 'You must be 16 or older to create an account.';
  return '';
}

export async function recordTermsAcceptance() {
  const at = new Date().toISOString();
  localStorage.setItem(TERMS_AT_KEY, at);
  localStorage.setItem(TERMS_VER_KEY, LEGAL_VERSION);
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      await sb.auth.updateUser({
        data: { terms_accepted_at: at, terms_version: LEGAL_VERSION },
      });
    }
  } catch (_) {
    /* non-blocking */
  }
}

export async function hasAiProcessingConsent(user = null) {
  if (localStorage.getItem(AI_AT_KEY)) return true;
  const u = user || await getUser();
  if (u?.user_metadata?.ai_consent_at) {
    localStorage.setItem(AI_AT_KEY, u.user_metadata.ai_consent_at);
    if (u.user_metadata.ai_consent_version) {
      localStorage.setItem(AI_VER_KEY, u.user_metadata.ai_consent_version);
    }
    return true;
  }
  return false;
}

export async function recordAiProcessingConsent() {
  const at = new Date().toISOString();
  localStorage.setItem(AI_AT_KEY, at);
  localStorage.setItem(AI_VER_KEY, LEGAL_VERSION);
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.auth.updateUser({
      data: { ai_consent_at: at, ai_consent_version: LEGAL_VERSION },
    });
  } catch (_) {
    /* non-blocking */
  }
}

export function clearPrivacyConsentLocal() {
  localStorage.removeItem(TERMS_AT_KEY);
  localStorage.removeItem(TERMS_VER_KEY);
  localStorage.removeItem(AI_AT_KEY);
  localStorage.removeItem(AI_VER_KEY);
}

/**
 * First-time consent before sending meal data to Google Gemini (photo AI + coaching tips).
 * @returns {Promise<boolean>}
 */
export async function requireAiProcessingConsent() {
  if (await hasAiProcessingConsent()) return true;
  return openAiConsentModal();
}

export function openAiConsentModal() {
  return new Promise((resolve) => {
    let done = false;
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal consent-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'aiConsentTitle');

    function finish(accepted) {
      if (done) return;
      done = true;
      overlay.remove();
      document.body.style.overflow = '';
      resolve(Boolean(accepted));
    }

    overlay.innerHTML = `
      <div class="camera-modal__panel consent-panel">
        <h2 class="consent-panel__title" id="aiConsentTitle">AI meal processing</h2>
        <p class="consent-panel__lead">Before your first AI meal log, please read how we process your data.</p>
        <ul class="consent-panel__list">
          <li><strong>Meal photos</strong> you choose to log are sent to <strong>Google Gemini</strong> to estimate calories and nutrition.</li>
          <li><strong>Meal summaries</strong> (not photos) may be sent to Gemini for personalised coaching tips in Reports.</li>
          <li>We do <strong>not</strong> use your photos for advertising. Google processes data under their own terms as a sub-processor.</li>
          <li>You can still log <strong>packaged food</strong> by barcode or search without using AI photo logging.</li>
        </ul>
        <p class="fine-print health-disclaimer">NutriLog provides estimates only — not medical or dietary advice.</p>
        <label class="consent-row consent-row--panel">
          <input type="checkbox" id="aiConsentCheck"/>
          <span>I understand and consent to AI processing of my meal photos and summaries as described in the <button type="button" class="consent-link" data-legal="privacy">Privacy policy</button>.</span>
        </label>
        <div class="camera-modal__actions consent-panel__actions">
          <button type="button" class="btn btn-ghost full" id="aiConsentDecline">Not now</button>
          <button type="button" class="btn btn-primary full" id="aiConsentAccept" disabled>Continue with AI logging</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    bindLegalLinks(overlay);
    const check = overlay.querySelector('#aiConsentCheck');
    const acceptBtn = overlay.querySelector('#aiConsentAccept');
    check?.addEventListener('change', () => {
      if (acceptBtn) acceptBtn.disabled = !check.checked;
    });
    overlay.querySelector('#aiConsentDecline')?.addEventListener('click', () => finish(false));
    overlay.querySelector('#aiConsentAccept')?.addEventListener('click', async () => {
      if (!check?.checked) return;
      await recordAiProcessingConsent();
      finish(true);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
  });
}
