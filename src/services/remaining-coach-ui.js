/**
 * Today screen — remaining calories & protein coach card.
 */

import { formatEnergy, getUnitPrefs } from './goals.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function remainingCoachHtml(coach) {
  if (!coach) return '';

  const prefs = getUnitPrefs();
  const calLeft = Number(coach.calRemaining) || 0;
  const proteinLeft = Number(coach.proteinRemaining) || 0;

  const metrics = [];
  if (calLeft > 0) {
    metrics.push(`
      <div class="remaining-coach__metric">
        <span class="remaining-coach__metric-value">${escapeHtml(formatEnergy(calLeft, prefs))}</span>
        <span class="remaining-coach__metric-label">calories left</span>
      </div>
    `);
  } else {
    metrics.push(`
      <div class="remaining-coach__metric remaining-coach__metric--met">
        <span class="remaining-coach__metric-value">On track</span>
        <span class="remaining-coach__metric-label">calories</span>
      </div>
    `);
  }
  if (proteinLeft > 5) {
    metrics.push(`
      <div class="remaining-coach__metric">
        <span class="remaining-coach__metric-value">${Math.round(proteinLeft)}g</span>
        <span class="remaining-coach__metric-label">protein left</span>
      </div>
    `);
  } else if (proteinLeft <= 0) {
    metrics.push(`
      <div class="remaining-coach__metric remaining-coach__metric--met">
        <span class="remaining-coach__metric-value">Met</span>
        <span class="remaining-coach__metric-label">protein goal</span>
      </div>
    `);
  }

  const examples = (coach.examples || [])
    .map(
      (ex) => `
        <li class="remaining-coach__example">
          <div class="remaining-coach__example-copy">
            <span class="remaining-coach__example-name">${escapeHtml(ex.name)}</span>
            <span class="remaining-coach__example-meta">Rough fit for what's left</span>
          </div>
          <div class="remaining-coach__example-tags" aria-label="Approx nutrition">
            <span>~${Math.round(ex.cal)} kcal</span>
            <span>${Math.round(ex.protein)}g protein</span>
          </div>
        </li>
      `,
    )
    .join('');

  return `
    <section class="remaining-coach" aria-label="Remaining today">
      <header class="remaining-coach__head">
        <p class="remaining-coach__eyebrow">Remaining today</p>
        <div class="remaining-coach__metrics">${metrics.join('')}</div>
      </header>
      <p class="remaining-coach__lead">${escapeHtml(coach.lead)}</p>
      ${examples ? `<ul class="remaining-coach__examples">${examples}</ul>` : ''}
      <p class="remaining-coach__note">Rough guides only — check labels if accuracy matters.</p>
    </section>
  `;
}
