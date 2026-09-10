import { PLANS } from './plans.js';
import { planSummaryHtml, scansLabel } from './subscription.js';
import { BARCODE_COPY } from './product-copy.js';
import { bindModalA11y } from './modal-a11y.js';

/**
 * Post-checkout welcome modal — subscription or top-up success.
 * @param {{ type?: 'subscription'|'topup', planId?: string, scans?: number, onViewPlans?: Function, onDismiss?: Function }} opts
 */
export function openCheckoutWelcomeModal({
  type = 'subscription',
  planId,
  scans = 100,
  onViewPlans,
  onDismiss,
} = {}) {
  const isTopUp = type === 'topup';
  const plan = planId ? PLANS[planId] : null;
  const title = isTopUp
    ? 'Top-up complete'
    : `Welcome to ${plan?.name || planLabelFallback(planId)}`;

  const overlay = document.createElement('div');
  overlay.className = 'camera-modal checkout-welcome-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'checkoutWelcomeTitle');

  overlay.innerHTML = `
    <div class="camera-modal__panel checkout-welcome-modal__panel">
      <button type="button" class="auth-modal__close" id="checkoutWelcomeClose" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <p class="checkout-welcome-modal__eyebrow">${isTopUp ? 'Payment confirmed' : 'Subscription active'}</p>
      <h2 class="checkout-welcome-modal__title" id="checkoutWelcomeTitle">${escapeHtml(title)}</h2>
      ${isTopUp ? `
        <p class="checkout-welcome-modal__lead"><strong>+${scans} top-up credits</strong> added to your account.</p>
        <p class="checkout-welcome-modal__detail">Use credits for AI photo scans when your daily allowance runs out. ${BARCODE_COPY.paywallNote}.</p>
      ` : `
        <p class="checkout-welcome-modal__lead">${planSummaryHtml(planId)}</p>
        <p class="checkout-welcome-modal__detail">${escapeHtml(scansLabel(planId))}</p>
        ${plan?.bullets?.length ? `
          <ul class="checkout-welcome-modal__features">
            ${plan.bullets.slice(0, 4).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        ` : ''}
      `}
      <div class="checkout-welcome-modal__actions">
        <button type="button" class="btn btn-primary full" id="checkoutWelcomeOk">Continue</button>
        ${!isTopUp ? `<button type="button" class="btn btn-ghost full" id="checkoutWelcomePlans">View plans</button>` : ''}
      </div>
      <p class="fine-print checkout-welcome-modal__fine">Receipt sent by Stripe · Cancel anytime in Settings</p>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  let a11yCleanup = bindModalA11y(overlay, {
    onClose: () => close('dismiss'),
    titleId: 'checkoutWelcomeTitle',
    initialFocus: overlay.querySelector('#checkoutWelcomeOk'),
  });

  function close(action) {
    a11yCleanup?.();
    overlay.remove();
    document.body.style.overflow = '';
    if (action === 'plans') onViewPlans?.();
    else onDismiss?.();
  }

  overlay.querySelector('#checkoutWelcomeClose')?.addEventListener('click', () => close('dismiss'));
  overlay.querySelector('#checkoutWelcomeOk')?.addEventListener('click', () => close('dismiss'));
  overlay.querySelector('#checkoutWelcomePlans')?.addEventListener('click', () => close('plans'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close('dismiss');
  });
}

function planLabelFallback(planId) {
  return PLANS[planId]?.name || planId || 'your plan';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
