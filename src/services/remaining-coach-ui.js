/**
 * Today screen — remaining calories & protein coach card.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function remainingCoachHtml(coach) {
  if (!coach) return '';

  const examples = (coach.examples || [])
    .map(
      (ex) => `
        <li class="remaining-coach__example">
          <span class="remaining-coach__example-name">${escapeHtml(ex.name)}</span>
          <span class="remaining-coach__example-meta">~${Math.round(ex.cal)} kcal · ${Math.round(ex.protein)}g protein</span>
        </li>
      `,
    )
    .join('');

  return `
    <section class="remaining-coach muted-card" aria-label="Remaining today">
      <p class="remaining-coach__eyebrow">Remaining today</p>
      <h3 class="remaining-coach__headline">${escapeHtml(coach.headline)}</h3>
      <p class="remaining-coach__lead">${escapeHtml(coach.lead)}</p>
      ${examples ? `<ul class="remaining-coach__examples">${examples}</ul>` : ''}
      <p class="remaining-coach__note">Rough guides only — check labels if accuracy matters.</p>
    </section>
  `;
}
