import { saveMeal, todayKey } from './storage.js';
import {
  SUPPLEMENT_TIME_OPTIONS,
  buildSupplementMealRecord,
  supplementMetaFromMeal,
  formatMicronutrientLine,
} from './supplements.js';
import { requireSupplementLoggingConsent } from './supplement-consent.js';
import { lookupSupplementProduct } from './supplement-barcode.js';
import { openBarcodeScannerModal } from './barcode-scanner.js';
import { DISCLAIMERS, disclaimerBlock } from './disclaimers.js';
import { bindModalA11y } from './modal-a11y.js';

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/**
 * Log or edit a supplement entry for a given day.
 * @param {{ meal?: object, dateKey?: string, showToast?: Function, prefill?: object }} opts
 * @returns {Promise<object|null>}
 */
export async function openSupplementLogModal({ meal = null, dateKey, showToast, prefill } = {}) {
  if (!(await requireSupplementLoggingConsent())) {
    showToast?.('Supplement logging cancelled');
    return null;
  }

  const existing = meal ? supplementMetaFromMeal(meal) : null;
  const seed = prefill || existing || {};
  const targetDate = dateKey || meal?.date || todayKey();
  const isEdit = Boolean(meal?.id);

  let pendingBarcode = seed.barcode || '';
  let pendingMicros = seed.micronutrients || null;

  return new Promise((resolve) => {
    let done = false;
    let a11yCleanup = null;
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal supplement-log-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'supplementLogTitle');

    function finish(result) {
      if (done) return;
      done = true;
      a11yCleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result ?? null);
    }

    function renderNutrientPreview() {
      const el = overlay.querySelector('#supplementNutrientPreview');
      if (!el) return;
      const line = formatMicronutrientLine(pendingMicros);
      el.innerHTML = line
        ? `<p class="supplement-log-modal__nutrients"><strong>From label:</strong> ${escapeHtml(line)}</p>`
        : '';
    }

    function renderPanel() {
      overlay.innerHTML = `
        <div class="camera-modal__panel supplement-log-modal__panel">
          <button type="button" class="auth-modal__close" id="supplementLogClose" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <h2 class="barcode-title" id="supplementLogTitle">${isEdit ? 'Edit supplement' : 'Log supplement'}</h2>
          <p class="supplement-log-modal__lead">Personal diary only — not added to your meal calories.</p>
          <button type="button" class="btn btn-ghost full supplement-log-modal__scan" id="supplementModalScan">Scan barcode on pack</button>
          <div id="supplementNutrientPreview"></div>
          <form id="supplementLogForm" class="auth-form supplement-log-form">
            <label class="field full">
              <span>Supplement name</span>
              <input type="text" name="name" required maxlength="80" autocomplete="off"
                placeholder="e.g. Vitamin D3, Omega-3, Multivitamin"
                value="${escapeAttr(seed.name || '')}"/>
            </label>
            <label class="field full">
              <span>Brand (optional)</span>
              <input type="text" name="brand" maxlength="60" autocomplete="organization"
                placeholder="e.g. Holland &amp; Barrett"
                value="${escapeAttr(seed.brand || '')}"/>
            </label>
            <label class="field full">
              <span>Dose (optional)</span>
              <input type="text" name="dose" maxlength="60" autocomplete="off"
                placeholder="e.g. 1 tablet, 5 ml, 2 capsules"
                value="${escapeAttr(seed.dose || '')}"/>
            </label>
            <label class="field full">
              <span>When today</span>
              <select name="time_of_day">
                ${SUPPLEMENT_TIME_OPTIONS.map(
                  (o) =>
                    `<option value="${o.id}" ${seed.timeOfDay === o.id || (!seed.timeOfDay && o.id === 'anytime') ? 'selected' : ''}>${o.label}</option>`,
                ).join('')}
              </select>
            </label>
            <label class="field full">
              <span>Notes (optional)</span>
              <textarea name="notes" rows="2" maxlength="240" placeholder="Anything else you want to remember">${escapeHtml(seed.notes || '')}</textarea>
            </label>
            ${disclaimerBlock(DISCLAIMERS.supplementLogShort, 'fine-print health-disclaimer supplement-log-modal__disclaimer')}
            <div class="camera-modal__actions">
              <button type="button" class="btn btn-ghost" id="supplementLogCancel">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Save supplement'}</button>
            </div>
          </form>
        </div>
      `;
      renderNutrientPreview();
      bindPanelEvents();
    }

    function bindPanelEvents() {
      overlay.querySelector('#supplementLogClose')?.addEventListener('click', () => finish(null));
      overlay.querySelector('#supplementLogCancel')?.addEventListener('click', () => finish(null));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(null);
      });

      overlay.querySelector('#supplementModalScan')?.addEventListener('click', async () => {
        const code = await openBarcodeScannerModal();
        if (!code) return;
        const scanBtn = overlay.querySelector('#supplementModalScan');
        if (scanBtn) {
          scanBtn.disabled = true;
          scanBtn.textContent = 'Looking up…';
        }
        try {
          const product = await lookupSupplementProduct(code);
          pendingBarcode = product.barcode;
          pendingMicros = product.micronutrients;
          const form = overlay.querySelector('#supplementLogForm');
          if (form) {
            form.name.value = product.name || form.name.value;
            if (product.brand) form.brand.value = product.brand;
            if (product.dose) form.dose.value = product.dose;
          }
          renderNutrientPreview();
          showToast?.('Product found — check details and save');
        } catch (err) {
          showToast?.(err.message || 'Product not found', 5000);
        } finally {
          if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan barcode on pack';
          }
        }
      });

      overlay.querySelector('#supplementLogForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const name = form.name.value.trim();
        if (!name) {
          showToast?.('Enter a supplement name');
          return;
        }
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving…';
        }
        try {
          const record = buildSupplementMealRecord({
            name,
            brand: form.brand.value,
            dose: form.dose.value,
            timeOfDay: form.time_of_day.value,
            notes: form.notes.value,
            date: targetDate,
            id: meal?.id,
            createdAt: meal?.createdAt,
            barcode: pendingBarcode,
            micronutrients: pendingMicros,
          });
          const saved = await saveMeal(record);
          showToast?.(isEdit ? 'Supplement updated' : 'Supplement logged');
          finish(saved);
        } catch (err) {
          showToast?.(err.message || 'Could not save supplement');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = isEdit ? 'Save changes' : 'Save supplement';
          }
        }
      });

      a11yCleanup?.();
      a11yCleanup = bindModalA11y(overlay, {
        onClose: () => finish(null),
        titleId: 'supplementLogTitle',
        initialFocus: overlay.querySelector('#supplementLogForm input[name="name"]'),
      });
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    renderPanel();
  });
}
