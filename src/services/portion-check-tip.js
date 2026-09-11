/**
 * One-time + contextual hints encouraging a quick portion check before saving.
 */

import { needsMatchCheckEmphasis } from '../../shared/nutrition-match-confidence.js';

const TIP_SEEN_KEY = 'nutrilog_portion_check_tip_seen';

export function shouldShowPortionCheckTip() {
  try {
    return localStorage.getItem(TIP_SEEN_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markPortionCheckTipSeen() {
  try {
    localStorage.setItem(TIP_SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** True when AI seems less sure about portion, dish breakdown, or reference matching. */
export function needsPortionEmphasis(analysis = {}) {
  if (needsMatchCheckEmphasis(analysis)) return true;
  const score = Number(analysis.confidence_score);
  if (score > 0 && score < 0.72) return true;
  return (analysis.items || []).some((item) => {
    const c = Number(item.confidence);
    return c > 0 && c < 0.7;
  });
}

/**
 * @param {object} analysis
 * @param {'label' | 'ai_estimate' | 'quick_estimate'} sourceType
 */
export function portionCheckLeadText(analysis = {}, sourceType = 'ai_estimate') {
  if (sourceType === 'label') {
    if (analysis._packServingKnown) {
      return 'Serving size from the pack label — adjust grams or ml if you ate a different amount.';
    }
    return 'Nutrition is per 100 g from the product data — enter how much you ate.';
  }
  if (needsPortionEmphasis(analysis)) {
    return 'Quick check: does the portion look about right? Tweak grams or ml — even a small change helps here.';
  }
  return 'Quick check: does the portion look about right? Tweak grams or ml if needed.';
}

export function portionCheckFirstTipHtml() {
  if (!shouldShowPortionCheckTip()) return '';
  return `
    <div class="meal-review-first-tip" role="note">
      <p class="meal-review-first-tip__text">
        <strong>5-second tip:</strong> glance at each portion size before saving — small tweaks make photo logs much more accurate.
      </p>
      <button type="button" class="meal-review-first-tip__dismiss" id="reviewPortionTipDismiss">Got it</button>
    </div>
  `;
}
