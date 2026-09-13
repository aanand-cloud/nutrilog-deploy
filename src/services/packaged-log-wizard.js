/** One question after a barcode lookup: grams or ml, then save. Photo review is unchanged. */

import { defaultMealType } from './meal-types.js';
import { DISCLAIMERS, disclaimerBlock } from './disclaimers.js';
import { bindModalA11y } from './modal-a11y.js';
import { scoreMealConfidence } from '../../shared/nutrition-confidence.js';
import { applyPackagedAmount, packagedAmountUnit, packagedServingAmount } from './packaged-log.js';

export function packagedAmountPrompt(analysis = {}) {
  const unit = packagedAmountUnit(analysis);
  const amount = Math.round(packagedServingAmount(analysis));
  if (unit === 'ml') {
    return {
      unit,
      question: 'How many ml did you have?',
      fieldLabel: 'Millilitres (ml)',
      helper: `Pack serving ${amount} ml`,
      defaultAmount: String(amount),
    };
  }
  return {
    unit: 'g',
    question: 'How many grams did you have?',
    fieldLabel: 'Grams',
    helper: `Pack serving ${amount} g`,
    defaultAmount: String(amount),
  };
}

export function openPackagedLogWizard(analysis, {
  mealType = defaultMealType(),
  imageDataUrl = null,
} = {}) {
  return new Promise((resolve) => {
    const currentMealType = mealType;
    const prompt = packagedAmountPrompt(analysis);
    let amount = prompt.defaultAmount;
    let a11yCleanup = null;

    const overlay = document.createElement('div');
    overlay.className = 'camera-modal packaged-log-wizard';
    document.body.appendChild(overlay);

    function close(value) {
      a11yCleanup?.();
      overlay.remove();
      resolve(value);
    }

    function preview() {
      try {
        return applyPackagedAmount(analysis, { amountId: 'custom', customGrams: amount });
      } catch {
        return applyPackagedAmount(analysis, { amountId: 'serving' });
      }
    }

    function finish() {
      if (!(Number(amount) > 0)) return;
      const next = applyPackagedAmount(analysis, { amountId: 'custom', customGrams: amount });
      const scored = scoreMealConfidence(next);
      close({
        saveNow: true,
        mealType: currentMealType,
        analysis: {
          ...next,
          _confidence: scored,
          confidence_score: scored.score,
          confidence_band: scored.band,
        },
      });
    }

    function render() {
      const item = analysis.items?.[0] || {};
      const next = preview();
      const packKcal = Math.round(Number(analysis.total_calories_kcal) || 0);
      overlay.innerHTML = `
        <div class="camera-modal__panel packaged-log-panel">
          <h2 class="barcode-title" id="packagedLogTitle">${escapeHtml(prompt.question)}</h2>
          ${imageDataUrl ? `<img src="${escapeAttr(imageDataUrl)}" alt="" class="preview-img preview-img--small"/>` : ''}
          <p class="packaged-log-product">${escapeHtml(analysis.meal_summary || item.name || 'Packaged food')}</p>
          <p class="fine-print">${escapeHtml(prompt.helper)} · ${packKcal} kcal</p>
          <label class="field">
            <span>${escapeHtml(prompt.fieldLabel)}</span>
            <input type="number" id="packCustomAmount" min="1" step="1" inputmode="decimal" value="${escapeAttr(amount)}" autofocus/>
          </label>
          <p class="review-kcal" id="packKcalPreview">${Math.round(next.total_calories_kcal || 0)} kcal</p>
          <button type="button" class="btn btn-primary full" id="packSave">Save</button>
          <button type="button" class="btn btn-ghost full" id="packCancel">Cancel</button>
          ${disclaimerBlock(DISCLAIMERS.packagedFood, 'fine-print health-disclaimer')}
        </div>
      `;
      a11yCleanup?.();
      a11yCleanup = bindModalA11y(overlay, {
        onClose: () => close(null),
        titleId: 'packagedLogTitle',
        initialFocus: overlay.querySelector('#packCustomAmount'),
      });
      overlay.querySelector('#packCustomAmount')?.addEventListener('input', (event) => {
        amount = event.target.value;
        const kcal = overlay.querySelector('#packKcalPreview');
        if (!kcal) return;
        try {
          kcal.textContent = `${applyPackagedAmount(analysis, { amountId: 'custom', customGrams: amount }).total_calories_kcal} kcal`;
        } catch {
          kcal.textContent = `${packKcal} kcal`;
        }
      });
      overlay.querySelector('#packSave')?.addEventListener('click', finish);
      overlay.querySelector('#packCancel')?.addEventListener('click', () => close(null));
    }

    render();
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
