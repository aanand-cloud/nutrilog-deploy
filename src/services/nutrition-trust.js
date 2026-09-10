/**
 * Nutrition source labelling & lightweight accuracy hints (no extra user steps).
 */

import {
  getItemNutritionTrust,
  ITEM_TRUST_META,
  photoScanTrustLead,
  summarizeItemTrust,
} from '../../shared/nutrition-item-trust.js';
import {
  matchCheckLeadText,
  needsMatchCheckEmphasis,
} from '../../shared/nutrition-match-confidence.js';
import { scoreMealConfidence, formatMealKcalDisplay } from '../../shared/nutrition-confidence.js';
import { isFlagEnabled } from '../../shared/feature-flags.js';
import { reconcileTotalNutrition } from '../../shared/nutrition-sanitize.js';
import { buildLabel } from '../../shared/build-info.js';

/** @typedef {'label' | 'ai_estimate' | 'quick_estimate'} NutritionSourceType */

const SOURCE_META = {
  label: {
    badge: 'Label-backed',
    badgeClass: 'nutrition-trust--label',
    short: 'Pack label data — best for sugar & salt when listed.',
    reviewHint: '',
  },
  ai_estimate: {
    badge: 'Photo scan',
    badgeClass: 'nutrition-trust--ai',
    short: 'Identified from your photo — macros from our reference database where matched.',
    reviewHint: 'Tip: tweak grams or ml on review if a portion looks off.',
  },
  quick_estimate: {
    badge: 'Quick estimate',
    badgeClass: 'nutrition-trust--quick',
    short: 'Rough estimate — check every detected food and portion before saving.',
    reviewHint: 'Review each line’s food name and amount — describe estimates need your confirmation before saving.',
  },
};

const LABEL_PARTIAL_HINT =
  'Sugar or salt wasn\'t listed for this product in our database — check your pack if it matters. You can add values when editing the meal.';

const DESCRIBE_SECTION_HINT =
  'Rough estimate — check every detected food and portion before saving.';

/**
 * @param {object} analysisOrMeal
 * @returns {NutritionSourceType}
 */
export function getNutritionSourceType(analysisOrMeal = {}) {
  const source = analysisOrMeal.source || '';
  if (source === 'barcode' || source === 'food_search') return 'label';
  if (source === 'voice' || analysisOrMeal._voiceEstimate) return 'quick_estimate';
  if (source === 'photo' || analysisOrMeal.photo_path || analysisOrMeal.photoDataUrl) return 'ai_estimate';
  if (analysisOrMeal.barcode) return 'label';
  return 'ai_estimate';
}

export function getNutritionSourceMeta(type) {
  return SOURCE_META[type] || SOURCE_META.ai_estimate;
}

export function hasMicroNutrients(n = {}) {
  return (Number(n.fibre_g) || 0) > 0
    || (Number(n.sugar_g) || 0) > 0
    || (Number(n.salt_mg) || 0) > 0;
}

/** True when barcode label had sugar, fibre, or salt/sodium fields. */
export function labelHasCompleteMicros(analysis = {}) {
  if (analysis.microsFromLabel === true) return true;
  if (analysis.microsFromLabel === false) return false;
  return hasMicroNutrients(analysis.total_nutrition);
}

export function formatMicroSummary(n = {}, availability = {}) {
  const parts = [];
  const fmtVal = (key, label, unit) => {
    const avail = availability[key] || (n[key] == null ? 'not_available' : 'known');
    if (avail === 'not_available' || n[key] == null) {
      parts.push(`${label}: Not available`);
      return;
    }
    if (key === 'salt_mg') parts.push(`${label} ${Math.round(n[key])}${unit}`);
    else parts.push(`${label} ${round1(n[key])}${unit}`);
  };
  fmtVal('fibre_g', 'Fibre', 'g');
  fmtVal('sugar_g', 'Sugar', 'g');
  fmtVal('salt_mg', 'Salt', 'mg');
  return parts.join(' · ');
}

export function nutritionTrustBadgeHtml(type, { compact = false } = {}) {
  const meta = getNutritionSourceMeta(type);
  return `<span class="nutrition-trust ${meta.badgeClass}${compact ? ' nutrition-trust--compact' : ''}">${meta.badge}</span>`;
}

export function itemNutritionTrustBadgeHtml(item = {}, analysis = {}, { compact = true } = {}) {
  const trust = getItemNutritionTrust(item, analysis);
  const meta = ITEM_TRUST_META[trust] || ITEM_TRUST_META.estimate;
  const cls = trust === 'matched'
    ? 'nutrition-trust--matched'
    : trust === 'label'
      ? 'nutrition-trust--label'
      : 'nutrition-trust--estimate';
  return `<span class="nutrition-trust ${cls}${compact ? ' nutrition-trust--compact' : ''}" title="${meta.title}">${meta.badge}</span>`;
}

export function itemTrustSummaryHtml(analysis = {}) {
  const { matched, estimate } = summarizeItemTrust(analysis.items || [], analysis);
  if (!matched && !estimate) return '';
  const parts = [];
  if (matched > 0) parts.push(`<span class="nutrition-trust nutrition-trust--matched nutrition-trust--compact">${matched} matched</span>`);
  if (estimate > 0) parts.push(`<span class="nutrition-trust nutrition-trust--estimate nutrition-trust--compact">${estimate} estimate</span>`);
  const emphasis = needsMatchCheckEmphasis(analysis) ? ' nutrition-trust-summary--warn' : '';
  return `<div class="nutrition-trust-summary${emphasis}" aria-label="Item match summary">${parts.join(' ')}</div>`;
}

export function matchCheckBannerHtml(analysis = {}) {
  const lead = matchCheckLeadText(analysis);
  if (!lead) return '';
  return `
    <div class="match-check-banner" role="note">
      <p class="match-check-banner__text">${lead}</p>
    </div>
  `;
}

export function mealAdjustTotalHtml(analysis = {}) {
  const showRange = isFlagEnabled('uncertaintyRanges');
  const label = formatMealKcalDisplay(analysis, { showRange });
  const rangeClass = showRange && (analysis._confidence || scoreMealConfidence(analysis)).kcalRange
    ? ' log-adjust-total--range'
    : '';
  return `<p class="log-adjust-total${rangeClass}" id="logAdjustTotal" aria-live="polite">Estimated total · ${label}</p>`;
}

export function nutritionReviewTrustHtml(analysis = {}) {
  const type = getNutritionSourceType(analysis);
  const meta = getNutritionSourceMeta(type);
  const microLine = formatMicroSummary(analysis.total_nutrition);
  const partialLabel = type === 'label' && analysis.microsFromLabel === false;
  const lead = type === 'ai_estimate' ? photoScanTrustLead(analysis) : meta.short;
  const matchLead = type === 'ai_estimate' ? matchCheckLeadText(analysis) : '';

  let hint = '';
  if (partialLabel) hint = LABEL_PARTIAL_HINT;
  else if (!microLine && meta.reviewHint) hint = meta.reviewHint;
  else if (type === 'quick_estimate' && microLine) hint = 'Sugar & salt here are rough guides — scan the barcode for label accuracy.';

  return `
    <div class="nutrition-review-trust">
      ${nutritionTrustBadgeHtml(type)}
      ${itemTrustSummaryHtml(analysis)}
      <p class="nutrition-review-trust__lead${needsMatchCheckEmphasis(analysis) ? ' nutrition-review-trust__lead--warn' : ''}">${lead}</p>
      ${matchLead ? `<p class="nutrition-review-trust__match-check">${matchLead}</p>` : ''}
      ${microLine ? `<p class="nutrition-review-trust__micros">${microLine}</p>` : ''}
      ${hint ? `<p class="nutrition-review-trust__hint fine-print">${hint}</p>` : ''}
    </div>
  `;
}

export function describeSectionAccuracyHintHtml() {
  return `<p class="log-section__accuracy fine-print">${DESCRIBE_SECTION_HINT} <span class="build-id">${buildLabel()}</span></p>`;
}

/**
 * Prefer item sums; keep meal-level values when a nutrient is missing from all items.
 */
export function mergeTotalNutrition(items, fallbackNutrition = {}, portionFactor = 1) {
  const keys = ['protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'sugar_g', 'salt_mg'];
  const fromItems = { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugar_g: 0, salt_mg: 0 };
  for (const item of items || []) {
    for (const key of keys) {
      fromItems[key] += Number(item.nutrition?.[key]) || 0;
    }
  }
  return reconcileTotalNutrition(fromItems, fallbackNutrition, { portionFactor });
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
