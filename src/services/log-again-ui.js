/**
 * HTML for the Today "Quick log" strip (usual meals).
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
    const countBadge = entry.count >= 3
      ? `<span class="log-again-chip__count">×${entry.count}</span>`
      : '';
    const sourceBadge = entry.source === 'yesterday'
      ? `<span class="log-again-chip__badge">Yesterday</span>`
      : entry.count >= 2
        ? `<span class="log-again-chip__badge log-again-chip__badge--usual">Usual</span>`
        : '';
    const top = (sourceBadge || countBadge)
      ? `<span class="log-again-chip__top">${sourceBadge}${countBadge}</span>`
      : '';
    return `
      <button type="button" class="log-again-chip" data-log-again="${index}" aria-label="Log again: ${escapeHtml(name)}, ${escapeHtml(energy)}">
        ${top}
        <span class="log-again-chip__name">${escapeHtml(name)}</span>
        <span class="log-again-chip__meta">${escapeHtml(energy)}</span>
        <span class="log-again-chip__action">Tap to add</span>
      </button>
    `;
  }).join('');

  return `
    <section class="log-again" aria-label="Quick log">
      <div class="log-again__head">
        <p class="log-again__eyebrow">Repeat</p>
        <h3 class="log-again__title">Quick log</h3>
        <p class="log-again__sub">Yesterday or your regulars — one tap, no photo</p>
      </div>
      <div class="log-again__scroll" role="list">${chips}</div>
    </section>
  `;
}
