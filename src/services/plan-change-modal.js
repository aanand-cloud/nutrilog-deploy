import { PLANS, comparePlanChange, isCreditSubscriptionPlan } from './plans.js';
import { bindModalA11y } from './modal-a11y.js';

/**
 * Confirm plan change — warns that subscription scans do not carry over.
 * @returns {Promise<'checkout'|'portal'|'cancelled'>}
 */
export function openPlanChangeModal({
  fromPlanId,
  toPlanId,
  remainingSubScans = 0,
  topUpCredits = 0,
} = {}) {
  const fromPlan = PLANS[fromPlanId];
  const toPlan = PLANS[toPlanId];
  const direction = comparePlanChange(fromPlanId, toPlanId);
  const isDowngrade = direction === 'downgrade';
  const showRemaining = isCreditSubscriptionPlan(fromPlanId) && remainingSubScans > 0;

  const title = isDowngrade
    ? `Change to ${toPlan?.name || toPlanId}?`
    : direction === 'upgrade'
      ? `Upgrade to ${toPlan?.name || toPlanId}?`
      : `Switch to ${toPlan?.name || toPlanId}?`;

  const lead = isDowngrade
    ? `Downgrades are managed in Stripe and usually take effect at the <strong>end of your current billing period</strong>. You keep ${escapeHtml(fromPlan?.name || fromPlanId)} until then.`
    : `Your monthly scan allowance will reset to the ${escapeHtml(toPlan?.name || toPlanId)} plan.`;

  const detailParts = [];
  if (!isDowngrade) {
    if (showRemaining) {
      detailParts.push(
        `<strong>${remainingSubScans} unused scan${remainingSubScans === 1 ? '' : 's'}</strong> on ${escapeHtml(fromPlan?.name || fromPlanId)} will <strong>not carry over</strong>.`,
      );
    } else if (isCreditSubscriptionPlan(fromPlanId)) {
      detailParts.push(`Unused subscription scans on ${escapeHtml(fromPlan?.name || fromPlanId)} do not carry over.`);
    } else {
      detailParts.push('Your current plan allowance does not carry over when you switch.');
    }
  } else {
    detailParts.push('Unused subscription scans on your current plan do not carry over when the new plan starts.');
  }
  if (topUpCredits > 0) {
    detailParts.push(`Your <strong>${topUpCredits} top-up credit${topUpCredits === 1 ? '' : 's'}</strong> stay on your account.`);
  } else {
    detailParts.push('Top-up credits always stay on your account when you change plans.');
  }

  const primaryLabel = isDowngrade
    ? 'Open billing settings'
    : direction === 'upgrade'
      ? 'Continue to checkout'
      : 'Continue to checkout';

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal checkout-welcome-modal plan-change-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'planChangeTitle');

    overlay.innerHTML = `
      <div class="camera-modal__panel checkout-welcome-modal__panel">
        <button type="button" class="auth-modal__close" id="planChangeClose" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <p class="checkout-welcome-modal__eyebrow">Plan change</p>
        <h2 class="checkout-welcome-modal__title" id="planChangeTitle">${escapeHtml(title)}</h2>
        <p class="checkout-welcome-modal__lead">${lead}</p>
        <p class="checkout-welcome-modal__detail">${detailParts.join(' ')}</p>
        <div class="checkout-welcome-modal__actions">
          <button type="button" class="btn btn-primary full" id="planChangeConfirm">${escapeHtml(primaryLabel)}</button>
          <button type="button" class="btn btn-ghost full" id="planChangeCancel">Not now</button>
        </div>
        <p class="fine-print checkout-welcome-modal__fine">${isDowngrade ? 'Cancel or change plan in Stripe · Receipts by email' : 'Secure checkout by Stripe · Cancel anytime in Settings'}</p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    let a11yCleanup = bindModalA11y(overlay, {
      onClose: () => close('cancelled'),
      titleId: 'planChangeTitle',
      initialFocus: overlay.querySelector('#planChangeConfirm'),
    });

    function close(result) {
      a11yCleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    }

    overlay.querySelector('#planChangeClose')?.addEventListener('click', () => close('cancelled'));
    overlay.querySelector('#planChangeCancel')?.addEventListener('click', () => close('cancelled'));
    overlay.querySelector('#planChangeConfirm')?.addEventListener('click', () => {
      close(isDowngrade ? 'portal' : 'checkout');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close('cancelled');
    });
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
