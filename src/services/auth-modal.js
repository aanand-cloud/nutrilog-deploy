import {
  signIn,
  signUp,
  resetPassword,
  resendConfirmationEmail,
  isSupabaseConfigured,
} from './auth.js';
import { ensureUserProfile, saveLocalDisplayName } from './profile.js';
import { fullSync } from './sync.js';
import { setPlan } from './subscription.js';
import { friendlyAuthError } from './auth-errors.js';

/**
 * Clean sign-in / sign-up modal (used from Today, Log, header).
 * @param {{ mode?: 'signin'|'signup', showToast?: Function, onSuccess?: Function }} opts
 */
export function openAuthModal({ mode = 'signup', showToast, onSuccess } = {}) {
  if (!isSupabaseConfigured()) {
    showToast?.('Sign-in is not available right now — try again later');
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let currentMode = mode === 'signin' ? 'signin' : 'signup';
    let done = false;

    const overlay = document.createElement('div');
    overlay.className = 'camera-modal auth-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'authModalTitle');

    function finish(success) {
      if (done) return;
      done = true;
      overlay.remove();
      document.body.style.overflow = '';
      resolve(Boolean(success));
    }

    function renderPanel() {
      const isSignup = currentMode === 'signup';
      overlay.innerHTML = `
        <div class="camera-modal__panel auth-modal__panel${isSignup ? '' : ' auth-modal__panel--signin'}">
          <button type="button" class="auth-modal__close" id="authModalClose" aria-label="Close">×</button>
          <p class="auth-modal__eyebrow">Free account</p>
          <h2 class="auth-modal__title" id="authModalTitle">${isSignup ? 'Get started' : 'Welcome back'}</h2>
          <p class="auth-modal__sub">${isSignup
            ? 'Sync meals across devices and unlock AI photo logging.'
            : 'Sign in to sync your meals and use AI photo logging.'}</p>
          <form id="authModalForm" class="auth-form" novalidate>
            <label class="field full field--optional-name">
              <span>First name</span>
              <input type="text" name="display_name" id="authModalFirstName" maxlength="40" autocomplete="given-name" placeholder="e.g. Sarah" ${isSignup ? 'required' : ''}/>
            </label>
            <label class="field full">
              <span>Email</span>
              <input type="email" name="email" id="authModalEmail" required autocomplete="email" inputmode="email" placeholder="you@email.com"/>
            </label>
            <label class="field full">
              <span>Password</span>
              <input type="password" name="password" id="authModalPassword" required minlength="6" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="At least 6 characters"/>
            </label>
            <p class="auth-status" id="authModalStatus" hidden role="status"></p>
            <button type="button" class="btn btn-primary full" id="authModalPrimary">${isSignup ? 'Create free account' : 'Sign in'}</button>
            <button type="button" class="btn btn-ghost full auth-modal__switch" id="authModalSwitch">
              ${isSignup ? 'Already have an account? Sign in' : 'New here? Create a free account'}
            </button>
            <button type="button" class="btn btn-ghost btn-sm full" id="authModalForgot">Forgot password?</button>
            <button type="button" class="btn btn-ghost btn-sm full" id="authModalResend" hidden>Resend confirmation email</button>
          </form>
          <p class="auth-modal__fine">Packaged food logging works without an account.</p>
        </div>
      `;

      overlay.querySelector('#authModalClose')?.addEventListener('click', () => finish(false));
      overlay.querySelector('#authModalSwitch')?.addEventListener('click', () => {
        currentMode = isSignup ? 'signin' : 'signup';
        renderPanel();
      });
      overlay.querySelector('#authModalForm')?.addEventListener('submit', (e) => e.preventDefault());
      overlay.querySelector('#authModalPrimary')?.addEventListener('click', () => {
        if (currentMode === 'signup') submitSignup();
        else submitSignIn();
      });
      overlay.querySelector('#authModalForgot')?.addEventListener('click', submitForgot);
      overlay.querySelector('#authModalResend')?.addEventListener('click', submitResend);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(false);
      });
    }

    function readForm() {
      return {
        firstName: overlay.querySelector('#authModalFirstName')?.value?.trim() || '',
        email: overlay.querySelector('#authModalEmail')?.value?.trim() || '',
        password: overlay.querySelector('#authModalPassword')?.value || '',
      };
    }

    function setStatus(message, { tone = 'info', showResend = false } = {}) {
      const el = overlay.querySelector('#authModalStatus');
      const resend = overlay.querySelector('#authModalResend');
      if (!el) return;
      el.classList.remove('auth-status--error', 'auth-status--success');
      if (tone === 'error') el.classList.add('auth-status--error');
      if (tone === 'success') el.classList.add('auth-status--success');
      if (message) {
        el.textContent = message;
        el.hidden = false;
      } else {
        el.textContent = '';
        el.hidden = true;
      }
      if (resend) resend.hidden = !showResend;
    }

    function setBusy(busy) {
      overlay.querySelectorAll('#authModalPrimary, #authModalForgot, #authModalResend, #authModalSwitch').forEach((btn) => {
        if (btn) btn.disabled = busy;
      });
    }

    async function afterAuth(firstName) {
      await ensureUserProfile(firstName);
      try {
        const result = await fullSync();
        if (result.plan) setPlan(result.plan);
        showToast?.(firstName ? `Welcome, ${firstName}!` : 'Signed in');
      } catch (_) {
        showToast?.('Signed in — open Settings → Account to sync if needed');
      }
      onSuccess?.();
      finish(true);
    }

    async function submitSignIn() {
      const { firstName, email, password } = readForm();
      if (!email || !password) {
        setStatus('Enter your email and password.', { tone: 'error' });
        return;
      }
      setBusy(true);
      setStatus('Signing in…');
      try {
        await signIn(email, password);
        await afterAuth(firstName);
      } catch (err) {
        const msg = friendlyAuthError(err.message) || 'Sign in failed';
        setStatus(msg, { tone: 'error', showResend: /confirm your email/i.test(msg) });
        showToast?.(msg, 5000);
      } finally {
        setBusy(false);
      }
    }

    async function submitSignup() {
      const { firstName, email, password } = readForm();
      if (!firstName) {
        setStatus('Please enter your first name.', { tone: 'error' });
        overlay.querySelector('#authModalFirstName')?.focus();
        return;
      }
      if (!email || !password) {
        setStatus('Enter email and password (6+ characters).', { tone: 'error' });
        return;
      }
      if (password.length < 6) {
        setStatus('Password must be at least 6 characters.', { tone: 'error' });
        return;
      }
      setBusy(true);
      setStatus('Creating your account…');
      try {
        saveLocalDisplayName(firstName);
        const data = await signUp(email, password, firstName);
        if (data.session) {
          await afterAuth(firstName);
          return;
        }
        const msg = data.user
          ? 'Account created! Check your email to confirm, then sign in.'
          : 'Account created — you can sign in now.';
        setStatus(msg, { tone: 'success', showResend: Boolean(data.user) });
        showToast?.(msg, 6000);
        currentMode = 'signin';
        renderPanel();
      } catch (err) {
        const msg = friendlyAuthError(err.message) || 'Could not create account';
        setStatus(msg, { tone: 'error' });
        showToast?.(msg, 5000);
      } finally {
        setBusy(false);
      }
    }

    async function submitForgot() {
      const email = readForm().email;
      if (!email) {
        setStatus('Enter your email first.', { tone: 'error' });
        return;
      }
      setBusy(true);
      setStatus('Sending reset link…');
      try {
        await resetPassword(email);
        const msg = 'Check your email for a password reset link (check spam too).';
        setStatus(msg, { tone: 'success' });
        showToast?.(msg, 5000);
      } catch (err) {
        const msg = friendlyAuthError(err.message) || 'Could not send reset email';
        setStatus(msg, { tone: 'error' });
        showToast?.(msg, 5000);
      } finally {
        setBusy(false);
      }
    }

    async function submitResend() {
      const email = readForm().email;
      if (!email) {
        setStatus('Enter your email first.', { tone: 'error' });
        return;
      }
      setBusy(true);
      setStatus('Sending confirmation email…');
      try {
        await resendConfirmationEmail(email);
        const msg = 'Confirmation email sent — check inbox and spam.';
        setStatus(msg, { tone: 'success', showResend: true });
        showToast?.(msg, 5000);
      } catch (err) {
        const msg = friendlyAuthError(err.message) || 'Could not resend email';
        setStatus(msg, { tone: 'error' });
        showToast?.(msg, 5000);
      } finally {
        setBusy(false);
      }
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    renderPanel();
    overlay.querySelector('#authModalEmail')?.focus();
  });
}
