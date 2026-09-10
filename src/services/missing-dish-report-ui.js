/**
 * "Report missing dish" on Estimate items — feeds local coverage queue.
 */

import { getItemNutritionTrust } from '../../shared/nutrition-item-trust.js';
import { shouldOfferMissingDishReport } from '../../shared/missing-dish-report.js';
import { reportMissingDish } from './missing-dish-report.js';

export function reportMissingDishLinkHtml(item = {}, analysis = {}, itemIndex = 0) {
  if (!shouldOfferMissingDishReport(getItemNutritionTrust(item, analysis))) return '';
  const name = item.name || 'Item';
  return `
    <button
      type="button"
      class="missing-dish-report link-btn"
      data-report-dish="${itemIndex}"
      data-dish-name="${escapeAttr(name)}"
    >Report missing dish</button>
  `;
}

/** @param {(msg: string, ms?: number) => void} [showToast] */
export function bindReportMissingDish(root, analysis = {}, showToast) {
  if (!root) return;
  root.querySelectorAll('[data-report-dish]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = reportMissingDish({
        dishName: btn.dataset.dishName,
        mealSummary: analysis.meal_summary,
        screen: 'log',
        itemIndex: Number(btn.dataset.reportDish),
      });
      if (result === 'added') {
        showToast?.('Thanks — noted for our food database', 4500);
        btn.disabled = true;
        btn.textContent = 'Reported ✓';
        return;
      }
      if (result === 'duplicate') {
        showToast?.('Already noted — thank you', 3500);
        btn.disabled = true;
        btn.textContent = 'Reported ✓';
        return;
      }
      showToast?.('Enter a dish name first', 3000);
    });
  });
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}
