import { formatMealSummaryLine } from './meal-duplicates.js';
import { bindModalA11y } from './modal-a11y.js';

/**
 * Warn before saving a possible duplicate meal.
 * @returns {Promise<'save'|'cancel'>}
 */
export function openDuplicateMealModal({ candidate, duplicates = [] } = {}) {
  const first = duplicates[0]?.meal;
  const mealName = candidate?.meal_summary || first?.meal_summary || 'this meal';
  const earlierLine = first ? formatMealSummaryLine(first) : '';

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal checkout-welcome-modal duplicate-meal-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'duplicateMealTitle');

    overlay.innerHTML = `
      <div class="camera-modal__panel checkout-welcome-modal__panel">
        <button type="button" class="auth-modal__close" id="duplicateMealClose" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <p class="checkout-welcome-modal__eyebrow">Duplicate meal</p>
        <h2 class="checkout-welcome-modal__title" id="duplicateMealTitle">You may have logged this twice</h2>
        <p class="checkout-welcome-modal__lead">
          <strong>${escapeHtml(mealName)}</strong> is already on Today. If this was a mistake, go back — saving again will count the calories twice.
        </p>
        ${earlierLine ? `<p class="checkout-welcome-modal__detail">Already logged: ${escapeHtml(earlierLine)}</p>` : ''}
        <div class="checkout-welcome-modal__actions">
          <button type="button" class="btn btn-primary full" id="duplicateMealCancel">Go back — don&apos;t save again</button>
          <button type="button" class="btn btn-ghost full" id="duplicateMealSave">Save anyway</button>
        </div>
        <p class="fine-print checkout-welcome-modal__fine">Tip: on Today, tap Remove on the extra entry if it was logged by mistake.</p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    let a11yCleanup = bindModalA11y(overlay, {
      onClose: () => close('cancel'),
      titleId: 'duplicateMealTitle',
      initialFocus: overlay.querySelector('#duplicateMealCancel'),
    });

    function close(result) {
      a11yCleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    }

    overlay.querySelector('#duplicateMealClose')?.addEventListener('click', () => close('cancel'));
    overlay.querySelector('#duplicateMealCancel')?.addEventListener('click', () => close('cancel'));
    overlay.querySelector('#duplicateMealSave')?.addEventListener('click', () => close('save'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close('cancel');
    });
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
