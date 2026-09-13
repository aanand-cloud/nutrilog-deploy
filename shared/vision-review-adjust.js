/**
 * Phase 2 — review-screen portion / oil edits for photo meals.
 * Re-runs Phase 1 composeVerifiedNutrition. No new calorie formulas.
 */

import { composeVerifiedNutrition } from '../netlify/lib/nutrition-db.mjs';

export const LOW_CONFIDENCE_THRESHOLD = 0.9;
export const OIL_TBSP_STEP = 0.5;
export const OIL_TBSP_MAX = 4;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function isVisionReviewMeal(analysis = {}) {
  if (analysis.source === 'barcode' || analysis.source === 'food_search') return false;
  if (analysis._labelBacked) return false;
  return Boolean(analysis._visionComposed || (analysis.items || []).some((item) => item?._visionMeta));
}

export function isLowConfidenceItem(item = {}) {
  if (item._visionOil) return false;
  const conf = num(item.confidence);
  if (conf > 0 && conf < LOW_CONFIDENCE_THRESHOLD) return true;
  return Boolean(item._nutritionFallback || item._unmatched);
}

export function mealOilTbspFromItems(items = []) {
  const oilLine = items.find((item) => item._visionOil);
  if (oilLine) {
    const grams = num(oilLine._hiddenGrams || oilLine.grams || oilLine._originalGrams);
    if (grams > 0) return Math.round((grams / 14) * 2) / 2;
  }
  let maxTbsp = 0;
  for (const item of items) {
    const tbsp = num(item._visionMeta?.estimated_oil_tbsp);
    if (tbsp > maxTbsp) maxTbsp = tbsp;
  }
  return Math.min(OIL_TBSP_MAX, Math.max(0, maxTbsp));
}

export function clampOilTbsp(value) {
  const n = num(value);
  if (n <= 0) return 0;
  const stepped = Math.round(n / OIL_TBSP_STEP) * OIL_TBSP_STEP;
  return Math.min(OIL_TBSP_MAX, Math.max(0, stepped));
}

function visionItemFromReview(item = {}, oilTbsp = 0, oilOnThisItem = false) {
  const unit = item._visionMeta?.unit || (item._volumeMl ? 'ml' : 'g');
  const amount = Math.max(1, Math.round(
    num(item._hiddenGrams || item._visionMeta?.amount || item._originalGrams || item.grams) || (unit === 'ml' ? 250 : 120),
  ));
  return {
    name: item._visionDetectedName || item.name || 'Food',
    usda_search_term: item._usdaSearchTerm || item._visionMeta?.usda_search_term || '',
    estimated_amount: amount,
    unit,
    cooking_method: item._visionMeta?.cooking_method || '',
    estimated_oil_tbsp: oilOnThisItem ? oilTbsp : 0,
    visible_oil: oilOnThisItem ? oilTbsp > 0 : Boolean(item._visionMeta?.visible_oil && oilTbsp > 0),
    confidence: num(item.confidence) || 0.7,
    _refId: item._refId,
  };
}

export function rebuildVisionReview(analysis = {}, items = [], oilTbsp = 0) {
  const foods = items.filter((item) => !item._visionOil && !item._userEnteredWeight && !item._labelBacked);
  const extras = items.filter((item) => item._userEnteredWeight || item._labelBacked);
  const tbsp = clampOilTbsp(oilTbsp);
  const firstOily = foods.find((item) => {
    const method = String(item._visionMeta?.cooking_method || item.cooking_method || '');
    return item._visionMeta?.visible_oil || /fry|fried|saut|roast|curry/i.test(method);
  }) || foods[0];

  const vision = {
    meal_summary: analysis.meal_summary || 'Meal',
    confidence_score: num(analysis.confidence_score) || 0.7,
    notes: analysis._visionNotes || analysis.notes || '',
    items: foods.map((item) => visionItemFromReview(item, tbsp, item === firstOily)),
    clarification_questions: [],
  };

  const composed = composeVerifiedNutrition(vision);
  const nextFoods = (composed.items || []).map((item, idx) => {
    const prior = foods[idx] && foods[idx].name === item.name ? foods[idx] : foods.find((row) => row.name === item.name);
    return {
      ...item,
      id: prior?.id || item.id || `vision-${idx}`,
    };
  });

  return {
    analysis: {
      ...analysis,
      ...composed,
      items: [...nextFoods, ...extras],
    },
    items: [...nextFoods, ...extras],
  };
}
