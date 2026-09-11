/**
 * Multi-factor meal confidence — weakest important factor wins.
 */

import { getItemNutritionTrust, summarizeItemTrust } from './nutrition-item-trust.js';
import { VERIFICATION_META } from './canonical-food-model.js';
import { whyThisEstimateDetailed } from './nutrition-provenance.js';
import { isVerifiedFoodId } from './verified-nutrition.js';
import { phraseHasExplicitQuantity, parseQuantityFromText } from './quantity-parser.js';

/** Dishes that should not receive automatic high confidence. */
const VARIABLE_DISH_REFS = new Set([
  'chole_bhature', 'biryani', 'chicken_biryani', 'fish_and_chips', 'chicken_tikka_masala',
  'chicken_tikka', 'chicken_korma', 'coconut_chutney', 'bhatura', 'poha', 'battered_cod',
]);

const VARIABLE_DISH_RE = /\b(?:chole bhature|biryani|fish and chips|battered cod|tikka masala|korma|coconut chutney|chip shop|poha|bhature|chole)\b/i;

/** Dish-specific uncertainty explanations — never one generic sentence for all mixed meals. */
const DISH_UNCERTAINTY_RULES = [
  { re: /\bchole\s+bhature|\bbhature\b.*\bchole\b/i, reason: 'Bhature size and frying-oil absorption vary widely.' },
  { re: /\bbiryani\b|\bpilau\b|\bpilaf\b/i, reason: 'Restaurant biryani varies by rice-to-meat ratio, oil/ghee and recipe.' },
  { re: /\bfish\s+and\s+chips\b|\bbattered\s+cod\b|\bchip[\s-]?shop\b/i, reason: 'Chip portion, batter thickness and frying-oil absorption vary.' },
  { re: /\btikka\s+masala\b/i, reason: 'Sauce quantity, cream/butter and cooking oil affect calories.' },
  { re: /\bkorma\b/i, reason: 'Cream, coconut, nuts and oil make korma portions variable.' },
  { re: /\bcoconut\s+chutney\b/i, reason: 'Coconut concentration, serving size and tempering oil vary.' },
  { re: /\bpoha\b/i, reason: 'Peanut quantity, oil and cooked moisture change the total.' },
  { re: /\bcurry\b/i, reason: 'Sauce-to-solid ratio and cooking oil vary by recipe.' },
];

function dishSpecificUncertainty(analysis = {}) {
  const blob = `${analysis._sourceText || ''} ${analysis.meal_summary || ''}`.toLowerCase();
  for (const rule of DISH_UNCERTAINTY_RULES) {
    if (rule.re.test(blob)) return rule.reason;
  }
  if (analysis._recipeKcalRange?.reason) return analysis._recipeKcalRange.reason;
  return '';
}

/** @typedef {'high' | 'medium' | 'low'} ConfidenceBand */

/**
 * @param {object} item
 * @param {object} [analysis]
 */
export function scoreItemConfidence(item = {}, analysis = {}) {
  const trust = getItemNutritionTrust(item, analysis);
  const factors = {
    identification: trust === 'label' ? 0.95 : trust === 'matched' ? 0.82 : 0.45,
    portion: scorePortionConfidence(item),
    preparation: item._cookingMethodConfirmed ? 0.9 : (item._visionMeta?.cooking_method ? 0.65 : 0.75),
    dataQuality: scoreDataQuality(item),
    recipeCertainty: item._recipeDerived ? 0.6 : 0.85,
  };

  const weakest = Math.min(
    factors.identification,
    factors.portion,
    factors.dataQuality,
    item._recipeDerived ? factors.recipeCertainty : 1,
  );

  return {
    factors,
    score: weakest,
    band: bandFromScore(weakest),
    trust,
  };
}

function scorePortionConfidence(item = {}) {
  if (item._weightSource === 'measured' || item._userWeightConfirmed) return 0.95;
  if (item._hiddenGrams > 0 && /\d+\s*g\b|\d+\s*ml\b|\bpieces?\b/i.test(item.portion_estimate || '')) return 0.85;
  if (item._weightSource === 'inferred') return 0.55;
  if (item._nutritionFallback || item._unmatched) return 0.35;
  return 0.65;
}

function scoreDataQuality(item = {}) {
  if (item._labelBacked) return 0.98;
  if (item._unmatched || item._nutritionFallback) return 0.35;
  const verification = item._per100?.verificationStatus
    || item._canonical?.verificationStatus;
  if (verification === 'verified' && (item._authoritative || isVerifiedFoodId(item._refId))) return 0.92;
  if (verification === 'manufacturer') return 0.95;
  if (verification === 'recipe_derived' || item._recipeDerived) return 0.72;
  const basis = item._per100?.nutritionBasis || item._per100?.source;
  if (basis === 'reference_v4' || item._refId) {
    if (verification === 'estimated' || basis === 'estimated_reference') return 0.55;
    return 0.75;
  }
  return 0.45;
}

function itemEligibleForHighConfidence(item = {}, analysis = {}) {
  if (item._unmatched || item._nutritionFallback) return false;
  if (item._labelBacked) return true;
  if (item._recipeDerived) return false;
  if (VARIABLE_DISH_REFS.has(item._refId) || VARIABLE_DISH_REFS.has(item._recipeId)) return false;
  const verified = item._authoritative || item._per100?.verificationStatus === 'verified'
    || isVerifiedFoodId(item._refId);
  if (!verified) return false;
  const q = parseQuantityFromText(`${item.portion_estimate || ''} ${item.name || ''}`);
  const explicitQty = item._boundQuantity?.amount > 0 || phraseHasExplicitQuantity(q);
  return explicitQty;
}

function bandFromScore(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.55) return 'medium';
  return 'low';
}

/**
 * Context-aware kcal band for medium/low confidence meals.
 * @param {object} analysis
 * @param {'high'|'medium'|'low'} band
 */
export function computeKcalRange(analysis = {}, band = 'medium') {
  const total = Math.round(Number(analysis.total_calories_kcal) || 0);
  if (total <= 0 || band === 'high') return null;

  let spread = band === 'low' ? 0.22 : 0.12;
  const items = analysis.items || [];

  if (analysis._visionComposed || analysis.source === 'photo') {
    spread = Math.max(spread, band === 'low' ? 0.28 : 0.18);
  }
  if (analysis._recipeKcalRange?.min && analysis._recipeKcalRange?.max) {
    const min = Math.round(analysis._recipeKcalRange.min);
    const max = Math.round(analysis._recipeKcalRange.max);
    return {
      min: Math.min(min, total),
      max: Math.max(max, total),
      point: total,
      spread: (Math.max(max, total) - Math.min(min, total)) / (2 * total || 1),
      reason: analysis._recipeKcalRange.reason || null,
    };
  }
  if (analysis._recipeDecomposed || items.some((item) => item._recipeDerived)) {
    spread = Math.max(spread, band === 'low' ? 0.2 : 0.14);
  }
  if (items.some((item) => item._unmatched || item._nutritionFallback)) {
    spread = Math.max(spread, 0.26);
  }
  if (analysis._photoQualityPoor) {
    spread = Math.max(spread, band === 'low' ? 0.32 : 0.22);
  }
  if (analysis._completeness === 'hidden_missing' || analysis._completeness === 'part_of_meal') {
    spread = Math.max(spread, 0.24);
  }
  if (analysis._completeness === 'not_sure') {
    spread = Math.max(spread, 0.2);
  }
  if (analysis._notSureAnswers > 0) {
    spread = Math.max(spread, 0.18 + 0.04 * Math.min(analysis._notSureAnswers, 3));
  }
  if (analysis._unknownOil) spread = Math.max(spread, 0.22);
  if (analysis._unknownSauce) spread = Math.max(spread, 0.2);
  if (items.some((item) => item._weightSource === 'measured' || item._userWeightConfirmed)) {
    spread = Math.max(0.08, spread - 0.04);
  }

  return {
    min: Math.round(total * (1 - spread)),
    max: Math.round(total * (1 + spread)),
    point: total,
    spread,
    reason: null,
  };
}

function isVariableDishMeal(analysis = {}) {
  const items = analysis.items || [];
  if (analysis._recipeDecomposed) return true;
  const blob = `${analysis._sourceText || ''} ${analysis.meal_summary || ''}`.toLowerCase();
  if (VARIABLE_DISH_RE.test(blob)) return true;
  const refIds = new Set(items.map((item) => item._refId));
  if (refIds.has('white_fish') && refIds.has('fries')) return true;
  return items.some((item) => {
    const id = String(item._refId || '').toLowerCase();
    if (!id) return false;
    if (VARIABLE_DISH_REFS.has(id) || VARIABLE_DISH_REFS.has(item._recipeId)) return true;
    return [...VARIABLE_DISH_REFS].some((tok) => id.includes(tok.replace(/_/g, '')) || id.includes(tok));
  });
}

/** Plain-text meal total for adjust/review headers. */
export function formatMealKcalDisplay(analysis = {}, { showRange = false } = {}) {
  const scored = analysis._confidence || scoreMealConfidence(analysis);
  const total = Math.round(Number(analysis.total_calories_kcal) || 0);
  if (showRange && scored.kcalRange) {
    return `Estimated ${total} kcal · likely range ${scored.kcalRange.min}–${scored.kcalRange.max} kcal`;
  }
  return `~${total} kcal`;
}

/** HTML snippet for review confidence band. */
export function kcalRangeHtml(scored = {}) {
  if (!scored.kcalRange) return '';
  return `<span class="confidence-band__range">Estimated ${scored.kcalRange.min}–${scored.kcalRange.max} kcal</span>`;
}

/**
 * @param {object} analysis
 */
export function scoreMealConfidence(analysis = {}) {
  const items = analysis.items || [];
  if (!items.length) {
    return {
      band: 'low',
      score: 0.3,
      primaryUncertainty: 'No items detected.',
      requiresConfirmation: true,
      itemScores: [],
    };
  }

  const itemScores = items.map((item) => ({ name: item.name, ...scoreItemConfidence(item, analysis) }));
  let weakest = Math.min(...itemScores.map((s) => s.score));
  let band = bandFromScore(weakest);
  const trust = summarizeItemTrust(items, analysis);
  const validation = analysis._mealValidation;
  const reconciliation = analysis._inputOutputReconciliation;

  if (reconciliation && !reconciliation.pass) {
    weakest = Math.min(weakest, 0.72);
    band = band === 'high' ? 'medium' : band;
  }
  if (analysis._mealIncomplete || validation?.issues?.length) {
    weakest = Math.min(weakest, 0.72);
    band = band === 'high' ? 'medium' : band;
  }
  if (reconciliation?.metrics?.falseDuplicates > 0.005) {
    weakest = Math.min(weakest, 0.65);
    band = band === 'high' ? 'low' : band;
  }

  if (analysis._photoQualityPoor) {
    weakest = Math.min(weakest, 0.52);
    band = band === 'high' ? 'medium' : band;
  }
  if (analysis._completeness && analysis._completeness !== 'yes_visible') {
    weakest = Math.min(weakest, 0.62);
    if (band === 'high') band = 'medium';
  }
  if (analysis._notSureAnswers > 0) {
    weakest = Math.min(weakest, 0.6);
    if (band === 'high') band = 'medium';
  }
  if (analysis._unknownOil || analysis._unknownSauce) {
    weakest = Math.min(weakest, 0.58);
    if (band === 'high') band = 'medium';
  }

  if (isVariableDishMeal(analysis)) {
    weakest = Math.min(weakest, 0.72);
    band = 'medium';
  }

  const allEligibleHigh = items.length > 0 && items.every((item) => itemEligibleForHighConfidence(item, analysis));
  if (band === 'high' && (!allEligibleHigh || isVariableDishMeal(analysis))) {
    band = 'medium';
    weakest = Math.min(weakest, 0.72);
  }

  let primaryUncertainty = '';
  if (validation?.issues?.length) {
    primaryUncertainty = validation.issues[0].message;
  } else if (trust.estimate > 0) {
    primaryUncertainty = `${trust.estimate} item${trust.estimate === 1 ? '' : 's'} use estimated nutrition — check names and amounts.`;
  } else if (itemScores.some((s) => s.factors.portion < 0.6)) {
    primaryUncertainty = 'Portion weight is assumed — measured grams give the best accuracy.';
  } else if (analysis._visionComposed && items.some((i) => i._visionMeta?.visible_oil)) {
    primaryUncertainty = 'Hidden cooking oil may affect calories.';
  } else if (isVariableDishMeal(analysis)) {
    primaryUncertainty = dishSpecificUncertainty(analysis)
      || 'Portion size and cooking oil are the main uncertainty.';
  }

  const requiresConfirmation = band === 'low'
    || Boolean(analysis._mealIncomplete)
    || Boolean(validation?.issues?.length)
    || items.some((item) => item._unmatched);

  const kcalRange = computeKcalRange(analysis, band);
  if (kcalRange) {
    kcalRange.reason = dishSpecificUncertainty(analysis) || primaryUncertainty || 'Portion and preparation assumptions.';
    if (kcalRange.point < kcalRange.min) kcalRange.min = kcalRange.point;
    if (kcalRange.point > kcalRange.max) kcalRange.max = kcalRange.point;
  }

  return {
    band,
    score: weakest,
    primaryUncertainty,
    requiresConfirmation,
    itemScores,
    kcalRange,
    trustSummary: trust,
  };
}

export const CONFIDENCE_BAND_META = {
  high: {
    label: 'High confidence',
    className: 'confidence-band--high',
    description: 'Verified match with reliable portion.',
  },
  medium: {
    label: 'Medium confidence',
    className: 'confidence-band--medium',
    description: 'Likely match — one assumption may affect calories.',
  },
  low: {
    label: 'Low confidence',
    className: 'confidence-band--low',
    description: 'Check items and amounts before saving.',
  },
};

/**
 * Human-readable "Why this estimate?" line.
 * @param {object} analysis
 */
export function whyThisEstimate(analysis = {}) {
  const scored = scoreMealConfidence(analysis);
  const detailed = whyThisEstimateDetailed(analysis);
  const parts = [];
  if (scored.trustSummary.matched) parts.push(`${scored.trustSummary.matched} matched to database`);
  if (scored.trustSummary.estimate) parts.push(`${scored.trustSummary.estimate} estimated`);
  if (scored.trustSummary.label) parts.push(`${scored.trustSummary.label} from label`);
  if (scored.primaryUncertainty) parts.push(scored.primaryUncertainty);
  const summary = parts.join(' · ') || 'Review each line before saving.';
  return detailed ? `${detailed}\n\n—\n${summary}` : summary;
}
