/**
 * Today screen — evening wrap-up card.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function dayWrapUpCardHtml(wrapUp) {
  if (!wrapUp) return '';

  const details = (wrapUp.details || [])
    .map((line) => `<p class="day-wrap-up__detail">${escapeHtml(line)}</p>`)
    .join('');

  const stats = wrapUp.stats || {};
  const statsHtml = stats.mealsLogged
    ? `
      <div class="day-wrap-up__stats" aria-label="Today's summary">
        <div class="day-wrap-up__stat">
          <span class="day-wrap-up__stat-value">${escapeHtml(String(stats.caloriesLogged ?? '—'))}</span>
          <span class="day-wrap-up__stat-label">kcal logged</span>
        </div>
        <div class="day-wrap-up__stat">
          <span class="day-wrap-up__stat-value">${escapeHtml(String(stats.proteinLogged ?? '—'))}g</span>
          <span class="day-wrap-up__stat-label">protein</span>
        </div>
        <div class="day-wrap-up__stat">
          <span class="day-wrap-up__stat-value">${escapeHtml(String(stats.proteinPct ?? '—'))}%</span>
          <span class="day-wrap-up__stat-label">protein goal</span>
        </div>
      </div>
    `
    : '';

  const coach = wrapUp.coachLine
    ? `<p class="day-wrap-up__coach"><span class="day-wrap-up__coach-label">Tip</span> ${escapeHtml(wrapUp.coachLine)}</p>`
    : '';

  return `
    <section class="day-wrap-up muted-card" aria-label="How was today?" id="dayWrapUpCard">
      <div class="day-wrap-up__head">
        <div>
          <p class="day-wrap-up__eyebrow">Evening check-in</p>
          <h3 class="day-wrap-up__title">${escapeHtml(wrapUp.title)}</h3>
        </div>
        <button type="button" class="day-wrap-up__dismiss" id="dayWrapUpDismiss" aria-label="Dismiss for today">✕</button>
      </div>
      <p class="day-wrap-up__insight">${escapeHtml(wrapUp.insight)}</p>
      ${statsHtml}
      ${details}
      <p class="day-wrap-up__suggestion">${escapeHtml(wrapUp.suggestion)}</p>
      ${coach}
    </section>
  `;
}
