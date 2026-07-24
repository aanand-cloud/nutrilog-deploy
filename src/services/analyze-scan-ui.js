/** Subtle “scanning” UI while a meal photo is analysed — CSS-only motion, honest status steps. */

export const PHOTO_ANALYSIS_STEPS = [
  'Detecting foods…',
  'Estimating portions…',
  'Calculating nutrition…',
];

export const DRINK_ANALYSIS_STEPS = [
  'Identifying your drink…',
  'Estimating volume (ml)…',
  'Calculating nutrition…',
];

export function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function photoScanAnalyzingHtml(imageDataUrl, { title = 'Analysing your meal', steps = PHOTO_ANALYSIS_STEPS, photoAlt = 'Your meal photo' } = {}) {
  if (!imageDataUrl) {
    return `
      <div class="meal-scan meal-scan--no-photo" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <h2 class="meal-scan__title">${title}</h2>
        <p class="meal-scan__status" id="mealScanStatus">${steps[0]}</p>
        <p class="meal-scan__note">This usually takes a few seconds</p>
      </div>
    `;
  }

  return `
    <div class="meal-scan" role="status" aria-live="polite">
      <div class="meal-scan__frame">
        <img src="${escapeAttr(imageDataUrl)}" alt="${escapeAttr(photoAlt)}" class="meal-scan__photo"/>
        <div class="meal-scan__overlay" aria-hidden="true">
          <span class="meal-scan__corner meal-scan__corner--tl"></span>
          <span class="meal-scan__corner meal-scan__corner--tr"></span>
          <span class="meal-scan__corner meal-scan__corner--bl"></span>
          <span class="meal-scan__corner meal-scan__corner--br"></span>
          <span class="meal-scan__line"></span>
        </div>
      </div>
      <h2 class="meal-scan__title">${title}</h2>
      <p class="meal-scan__status" id="mealScanStatus">${steps[0]}</p>
      <p class="meal-scan__note">This usually takes a few seconds · AI estimate, not laboratory analysis</p>
    </div>
  `;
}

export function packagedLookupAnalyzingHtml(imageDataUrl, { title, subtitle } = {}) {
  return `
    <div class="meal-scan meal-scan--lookup" role="status" aria-live="polite">
      ${imageDataUrl ? `
        <div class="meal-scan__frame meal-scan__frame--lookup">
          <img src="${escapeAttr(imageDataUrl)}" alt="" class="meal-scan__photo"/>
        </div>
      ` : `<div class="spinner" aria-hidden="true"></div>`}
      <h2 class="meal-scan__title">${title || 'Looking up food'}</h2>
      <p class="meal-scan__status">${subtitle || 'Fetching nutrition from product database…'}</p>
    </div>
  `;
}

/** Cycle honest status lines — returns cleanup. Does not fake progress. */
export function startPhotoScanStatusCycle(root, steps = PHOTO_ANALYSIS_STEPS, intervalMs = 2800) {
  const el = root.querySelector('#mealScanStatus');
  if (!el || steps.length < 2) return () => {};

  let index = 0;
  const timer = setInterval(() => {
    index = (index + 1) % steps.length;
    el.textContent = steps[index];
  }, intervalMs);

  return () => clearInterval(timer);
}
