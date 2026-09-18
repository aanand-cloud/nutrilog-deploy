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

function clampPct(used, goal) {
  const g = Number(goal) || 0;
  if (g <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((Number(used) || 0) / g) * 100)));
}

export function remainingCoachHtml(coach) {
  if (!coach) return '';

  const prefs = getUnitPrefs();
  const calLeft = Number(coach.calRemaining) || 0;
  const proteinLeft = Number(coach.proteinRemaining) || 0;
  const calGoal = Number(coach.calGoal) || 0;
  const proteinGoal = Number(coach.proteinGoal) || 0;
  const calUsed = Number(coach.calUsed) || 0;
  const proteinUsed = Number(coach.proteinUsed) || 0;
  const calPct = clampPct(calUsed, calGoal);
  const proteinPct = clampPct(proteinUsed, proteinGoal);

  const metrics = [];
  if (calLeft > 0) {
    metrics.push(`
      <div class="remaining-coach__metric">
        <div class="remaining-coach__metric-top">
          <span class="remaining-coach__metric-label">Calories left</span>
          <span class="remaining-coach__metric-pct">${calPct}%</span>
        </div>
        <span class="remaining-coach__metric-value">${escapeHtml(formatEnergy(calLeft, prefs))}</span>
        <div class="remaining-coach__bar" role="presentation">
          <span class="remaining-coach__bar-fill" style="width:${calPct}%"></span>
        </div>
      </div>
    `);
  } else {
    metrics.push(`
      <div class="remaining-coach__metric remaining-coach__metric--met">
        <div class="remaining-coach__metric-top">
          <span class="remaining-coach__metric-label">Calories</span>
          <span class="remaining-coach__metric-pct">Done</span>
        </div>
        <span class="remaining-coach__metric-value">On track</span>
        <div class="remaining-coach__bar" role="presentation">
          <span class="remaining-coach__bar-fill remaining-coach__bar-fill--met" style="width:100%"></span>
        </div>
      </div>
    `);
  }
  if (proteinLeft > 5) {
    metrics.push(`
      <div class="remaining-coach__metric">
        <div class="remaining-coach__metric-top">
          <span class="remaining-coach__metric-label">Protein left</span>
          <span class="remaining-coach__metric-pct">${proteinPct}%</span>
        </div>
        <span class="remaining-coach__metric-value">${Math.round(proteinLeft)}g</span>
        <div class="remaining-coach__bar" role="presentation">
          <span class="remaining-coach__bar-fill remaining-coach__bar-fill--protein" style="width:${proteinPct}%"></span>
        </div>
      </div>
    `);
  } else if (proteinLeft <= 0) {
    metrics.push(`
      <div class="remaining-coach__metric remaining-coach__metric--met">
        <div class="remaining-coach__metric-top">
          <span class="remaining-coach__metric-label">Protein</span>
          <span class="remaining-coach__metric-pct">Done</span>
        </div>
        <span class="remaining-coach__metric-value">Goal met</span>
        <div class="remaining-coach__bar" role="presentation">
          <span class="remaining-coach__bar-fill remaining-coach__bar-fill--met" style="width:100%"></span>
        </div>
      </div>
    `);
  }

  const examples = (coach.examples || [])
    .map(
      (ex) => `
        <li class="remaining-coach__example">
          <div class="remaining-coach__example-copy">
            <span class="remaining-coach__example-name">${escapeHtml(ex.name)}</span>
            <span class="remaining-coach__example-meta">Fits what's left</span>
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
        <div class="remaining-coach__title-row">
          <div>
            <p class="remaining-coach__eyebrow">Balance</p>
            <h3 class="remaining-coach__title">Remaining today</h3>
          </div>
          ${coach.headline ? `<p class="remaining-coach__summary">${escapeHtml(coach.headline)}</p>` : ''}
        </div>
        <div class="remaining-coach__metrics">${metrics.join('')}</div>
      </header>
      <p class="remaining-coach__lead">${escapeHtml(coach.lead)}</p>
      ${examples ? `
        <div class="remaining-coach__ideas">
          <p class="remaining-coach__ideas-label">Ideas that could fit</p>
          <ul class="remaining-coach__examples">${examples}</ul>
        </div>
      ` : ''}
      <p class="remaining-coach__note">Rough guides only — check labels if accuracy matters.</p>
    </section>
  `;
}
