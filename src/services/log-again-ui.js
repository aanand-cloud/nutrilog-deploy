/**
 * HTML for the Today "Log again" strip (usual meals).
 */

import { usualMealLabel } from './usual-meals.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ template: object, count: number }[]} usualMeals
 * @param {{ formatEnergy?: (kcal: number) => string }} [opts]
 */
export function logAgainSectionHtml(usualMeals = [], { formatEnergy } = {}) {
  if (!usualMeals.length) return '';

  const chips = usualMeals.map((entry, index) => {
    const name = usualMealLabel(entry.template);
    const kcal = Math.round(Number(entry.template?.total_calories_kcal) || 0);
    const energy = formatEnergy ? formatEnergy(kcal) : `${kcal} kcal`;
    const countBadge = entry.count >= 3 ? `<span class="log-again-chip__count">×${entry.count}</span>` : '';
    const yesterdayBadge = entry.source === 'yesterday' ? `<span class="log-again-chip__badge">Yesterday</span>` : '';
    return `
      <button type="button" class="log-again-chip" data-log-again="${index}" aria-label="Log again: ${escapeHtml(name)}, ${escapeHtml(energy)}">
        <span class="log-again-chip__name">${escapeHtml(name)}${yesterdayBadge}</span>
        <span class="log-again-chip__meta">${escapeHtml(energy)}${countBadge}</span>
      </button>
    `;
  }).join('');

  return `
    <section class="log-again muted-card" aria-label="Log again">
      <div class="log-again__head">
        <h3 class="log-again__title">Quick log</h3>
        <p class="log-again__sub">Same as yesterday or your regular meals — one tap, no photo</p>
      </div>
      <div class="log-again__scroll" role="list">${chips}</div>
    </section>
  `;
}
