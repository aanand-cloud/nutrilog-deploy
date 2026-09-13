/**
 * Phase 1 nutrition lookup for photo vision payloads.
 *
 * Gemini returns names, grams, usda_search_term, and oil tablespoons only.
 * This module maps those onto MealNova's existing verified references
 * (V4 match → CoFID / IFCT / USDA overlay). It does not invent per-100g
 * values and does not write food-ref-v4.
 */

import {
  composeAnalysisFromVision,
  normalizePhotoAnalysis,
  resolveVisionFoodMatch,
  toVisionIdentification,
} from '../../shared/vision-analysis-compose.js';
import { nutritionForAmount, per100FromReference, resolveFoodReferenceById } from '../../shared/nutrition-density.js';

const HIGH_IMPACT_TOPICS = new Set([
  'protein_type',
  'drink_soft_type',
  'oil_fat',
  'sauce_gravy',
]);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function needsClarificationByConfidence(vision = {}) {
  const mealConf = num(vision.confidence_score);
  if (mealConf > 0 && mealConf < 0.9) return true;
  return (vision.items || []).some((item) => {
    const conf = num(item.confidence);
    return conf > 0 && conf < 0.9;
  });
}

export function capClarificationQuestions(vision = {}) {
  const raw = Array.isArray(vision.clarification_questions)
    ? vision.clarification_questions.filter((q) => q && (q.question || q.topic))
    : [];
  const keep = needsClarificationByConfidence(vision)
    ? raw
    : raw.filter((q) => HIGH_IMPACT_TOPICS.has(String(q.topic || '')));
  return {
    ...vision,
    clarification_questions: keep.slice(0, 3),
  };
}

/**
 * Scale a verified per-100g profile to the estimated grams.
 * The "multiplier" is amount/100 against MealNova's reference row — not a Gemini guess.
 */
export function lookupReferenceNutrition({
  name = '',
  usda_search_term = '',
  estimated_amount = 0,
} = {}) {
  const grams = Math.max(0, Math.round(num(estimated_amount)));
  const picked = resolveVisionFoodMatch(name, usda_search_term);
  if (!picked?.ref?.id) {
    return {
      refId: null,
      source: null,
      grams,
      calories_kcal: null,
      nutrition: null,
    };
  }
  const { ref } = resolveFoodReferenceById(picked.ref.id);
  const per100 = per100FromReference(ref || picked.ref);
  if (!per100?.kcal) {
    return {
      refId: picked.ref.id,
      source: picked.source,
      matchMethod: picked.meta?.match_method || null,
      grams,
      calories_kcal: null,
      nutrition: null,
    };
  }
  const scaled = grams > 0 ? nutritionForAmount(per100, grams) : {
    calories_kcal: 0,
    nutrition: { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sugar_g: null, salt_mg: null },
  };
  return {
    refId: picked.ref.id,
    source: picked.source,
    matchMethod: picked.meta?.match_method || null,
    grams,
    ...scaled,
  };
}

/** Prepare Gemini vision JSON, then compose verified macros through the photo pipeline. */
export function composeVerifiedNutrition(raw = {}) {
  if (!raw || raw._visionComposed) return raw;
  const prepared = capClarificationQuestions(toVisionIdentification(raw));
  return normalizePhotoAnalysis(prepared, { forceVision: true })
    || composeAnalysisFromVision(prepared);
}
