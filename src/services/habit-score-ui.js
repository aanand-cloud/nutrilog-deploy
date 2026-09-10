function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function habitScoreHtml(data) {
  if (!data || data.daysLogged < 1) return '';

  const pct = data.score;
  const dash = Math.round((pct / 100) * 88);

  return `
    <section class="habit-score muted-card" aria-label="Weekly habit score">
      <div class="habit-score__head">
        <div>
          <p class="habit-score__eyebrow">Weekly habit score</p>
          <p class="habit-score__label">${escapeHtml(data.label)}</p>
        </div>
        <div class="habit-score__ring" style="--score:${pct};--dash:${dash}" aria-hidden="true">
          <span class="habit-score__value">${pct}</span>
        </div>
      </div>
      <p class="habit-score__meta">${data.daysLogged} day${data.daysLogged === 1 ? '' : 's'} logged · ${data.streak}-day streak · ${data.uniqueMeals} different meal${data.uniqueMeals === 1 ? '' : 's'}</p>
      <p class="habit-score__note">Based on logging consistency — not a medical or wellness rating.</p>
    </section>
  `;
}
