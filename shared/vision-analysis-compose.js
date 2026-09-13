/**
 * Phase 4 — recipe decomposition for photo / vision payloads.
 * Composes full analysis from Gemini identification + portions using the same
 * canonical pipeline as Describe (verified per-100g, null micros, confidence).
 */

import {
  attachPer100ToItem,
  calibrateItemWithReference,
  kcalFromAtwater,
  matchFoodReference,
  nutritionForAmount,
  parseGramsFromText,
  resolveFoodReferenceById,
} from './nutrition-density.js';
import { cookingMethodMultiplier } from './cooking-methods.js';
import { applyMealValidation, sanitizeAnalysisTotals } from './nutrition-sanitize.js';
import { decomposeVisionWithRecipes } from './vision-recipe-compose.js';
import { scoreMealConfidence } from './nutrition-confidence.js';
import { applyAuthoritativeNutritionToItem } from './authoritative-nutrition.js';
import { normalizeCanonicalFoodText } from './canonical-food-identity.js';
import { itemProvenanceSummary } from './nutrition-provenance.js';

const FALLBACK_PER100 = {
  kcal: 130,
  protein_g: 8,
  carbs_g: 10,
  fat_g: 6,
  fibre_g: null,
  sugar_g: null,
  salt_mg: null,
  refId: null,
  source: 'fallback',
};

function round1(v) {
  return Math.round(v * 10) / 10;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function scaleMicro(val, factor) {
  if (val == null || !Number.isFinite(Number(val))) return null;
  return round1(num(val) * factor);
}

/** True when Gemini returned vision-only items (no AI nutrition). */
export function isVisionAnalysis(raw = {}) {
  if (!Array.isArray(raw.items) || !raw.items.length) return false;
  const first = raw.items[0];
  if (first == null || typeof first !== 'object') return false;
  if (first.estimated_amount != null && first.unit != null) return true;
  return raw.total_calories_kcal == null && first.calories_kcal == null && first.nutrition == null;
}

function scaleItemNutrition(item, factor) {
  if (!item || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.02) return item;
  const n = item.nutrition || {};
  const nutrition = {
    protein_g: round1(num(n.protein_g) * factor),
    carbs_g: round1(num(n.carbs_g) * factor),
    fat_g: round1(num(n.fat_g) * factor),
    fibre_g: scaleMicro(n.fibre_g, factor),
    sugar_g: scaleMicro(n.sugar_g, factor),
    salt_mg: n.salt_mg != null ? Math.round(num(n.salt_mg) * factor) : null,
  };
  const calories_kcal = item._authoritative
    ? Math.round(num(item.calories_kcal) * factor)
    : (num(item.calories_kcal) > 0
      ? Math.round(num(item.calories_kcal) * factor)
      : kcalFromAtwater(nutrition));
  return {
    ...item,
    calories_kcal,
    nutrition,
  };
}

function applyCookingMethod(item, cookingMethod = '') {
  // Authoritative references already describe the stated preparation state
  // (for example steamed idli or cooked rice). Applying another multiplier
  // would double-adjust both calories and macros.
  if (item?._authoritative) return item;
  const factor = cookingMethodMultiplier(cookingMethod);
  if (factor == null) return item;
  return attachPer100ToItem(scaleItemNutrition(item, factor));
}

function buildOilLineItem(grams = 7) {
  const g = Math.max(1, Math.round(grams));
  const nutrition = {
    protein_g: 0,
    carbs_g: 0,
    fat_g: round1(g),
    fibre_g: null,
    sugar_g: null,
    salt_mg: null,
  };
  return attachPer100ToItem({
    name: 'Cooking oil',
    portion_estimate: `~${g}g`,
    calories_kcal: Math.round(g * 9),
    nutrition,
    confidence: 0.6,
    _visionOil: true,
    _nutritionSource: 'estimated',
  });
}

function oilGramsForMethod(cookingMethod = '') {
  const t = String(cookingMethod).toLowerCase();
  if (/deep/.test(t)) return 10;
  if (/pan|stir|saut|shallow|fried/.test(t)) return 7;
  return 7;
}

function calibratedVisionAmount(name = '', amount = 0, unit = 'g') {
  if (unit === 'ml') return { amount, capped: false };
  const text = String(name).toLowerCase();
  const rules = [
    { pattern: /\b(chutney|pickle|relish)\b/, max: 60 },
    { pattern: /\b(butter|ghee|mayonnaise|mayo|jam)\b/, max: 40 },
    { pattern: /\b(dip|dressing)\b/, max: 100 },
    { pattern: /\b(basil|coriander|cilantro|parsley|mint garnish|herb garnish)\b/, max: 15 },
  ];
  const rule = rules.find((candidate) => candidate.pattern.test(text));
  if (!rule || amount <= rule.max) return { amount, capped: false };
  return { amount: rule.max, capped: true, originalAmount: amount };
}

function visionItemToStub(visionItem = {}) {
  const unit = String(visionItem.unit || 'g').toLowerCase() === 'ml' ? 'ml' : 'g';
  const rawAmount = Math.max(1, Math.round(num(visionItem.estimated_amount) || (unit === 'ml' ? 250 : 120)));
  const calibrated = calibratedVisionAmount(visionItem.name, rawAmount, unit);
  const amount = calibrated.amount;
  return {
    name: String(visionItem.name || 'Food').trim() || 'Food',
    portion_estimate: unit === 'ml' ? `~${amount}ml` : `~${amount}g`,
    calories_kcal: 0,
    nutrition: {
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fibre_g: null,
      sugar_g: null,
      salt_mg: null,
    },
    confidence: num(visionItem.confidence) || 0.7,
    _visionMeta: {
      unit,
      amount,
      cooking_method: visionItem.cooking_method || '',
      visible_oil: Boolean(visionItem.visible_oil),
    },
    _portionSource: 'photo_estimated',
    ...(calibrated.capped ? {
      _portionCapped: true,
      _visionOriginalAmount: calibrated.originalAmount,
      _portionSourceDetail: 'photo_small_accompaniment_cap',
    } : {}),
    ...(visionItem._refId ? { _refId: visionItem._refId } : {}),
    ...(visionItem._visionDetectedName ? { _visionDetectedName: visionItem._visionDetectedName } : {}),
    _hiddenGrams: unit === 'g' ? amount : undefined,
    ...(unit === 'ml' ? { _volumeMl: amount } : {}),
  };
}

function displayNameFromRefId(refId = '') {
  const value = String(refId).replace(/_/g, ' ').trim();
  return value ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';
}

function preserveRegionalRiceIdentity(vision = {}) {
  const summaryRef = matchFoodReference(vision.meal_summary || '');
  if (!summaryRef?.id || !/(jollof|biryani|pilau|pilaf|paella|kabsa|mandi|nasi_goreng|arroz)/i.test(summaryRef.id)) {
    return vision.items || [];
  }

  let promoted = false;
  return (vision.items || []).map((item) => {
    if (promoted || !/\brice\b/i.test(item.name || '')) return item;
    const itemRef = matchFoodReference(item.name || '');
    if (itemRef?.id && !/^(rice|plain_rice|cooked_rice|basmati_rice|jasmine_rice|brown_rice|red_rice)$/i.test(itemRef.id)) {
      return item;
    }
    promoted = true;
    return {
      ...item,
      name: displayNameFromRefId(summaryRef.id),
      _refId: summaryRef.id,
      _visionDetectedName: item.name,
    };
  });
}

function enrichVisionItemProvenance(item = {}) {
  if (item._provenanceLabel) return item;
  const summary = itemProvenanceSummary(item);
  if (!summary) return item;
  return {
    ...item,
    _provenanceLabel: summary.split('\n').find((l) => l.startsWith('Source:'))?.replace('Source: ', '') || undefined,
  };
}

function calibrateVisionItem(item) {
  let result = calibrateItemWithReference(item);

  if (result._refId) {
    const { ref } = resolveFoodReferenceById(result._refId);
    result = applyAuthoritativeNutritionToItem(result, ref);
  }

  if (result._refId && (result._authoritative || num(result.calories_kcal) > 0)) {
    result = applyCookingMethod(result, item._visionMeta?.cooking_method);
    return enrichVisionItemProvenance(result);
  }

  const normalized = normalizeCanonicalFoodText(item.name || '');
  const ref = matchFoodReference(item.name || '')
    || (normalized !== item.name?.toLowerCase() ? matchFoodReference(normalized) : null);
  if (ref) {
    result = calibrateItemWithReference({ ...item, _refId: ref.id });
    const { ref: refRow } = resolveFoodReferenceById(ref.id);
    result = applyAuthoritativeNutritionToItem(result, refRow);
    if (result._refId && num(result.calories_kcal) > 0) {
      result = applyCookingMethod(result, item._visionMeta?.cooking_method);
      return enrichVisionItemProvenance(result);
    }
  }

  const amount = item._visionMeta?.amount
    || item._hiddenGrams
    || parseGramsFromText(item.portion_estimate)
    || 120;
  const scaled = nutritionForAmount(FALLBACK_PER100, amount);
  result = attachPer100ToItem({
    ...item,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    _nutritionFallback: true,
    _hiddenGrams: item._hiddenGrams || (item._visionMeta?.unit === 'g' ? amount : undefined),
  });
  result = applyCookingMethod(result, item._visionMeta?.cooking_method);
  return enrichVisionItemProvenance(result);
}

/** Compose only newly detected side items from an accompaniment Gemini pass. */
export function composeAccompanimentAdditions(accompanimentVision = {}, existingItems = []) {
  const existing = new Set(
    (existingItems || []).map((item) => String(item.name || '').toLowerCase().trim()),
  );
  const stubs = (accompanimentVision.items || [])
    .filter((row) => {
      const key = String(row.name || '').toLowerCase().trim();
      return key && !existing.has(key);
    })
    .map(visionItemToStub);

  return stubs.map(calibrateVisionItem).map((item) => ({
    ...item,
    _accompanimentGeminiPass: true,
  }));
}

/**
 * @param {object} vision — Gemini vision-only JSON
 * @returns {object} full analysis for existing client flow
 */
export function composeAnalysisFromVision(vision = {}) {
  const stubs = preserveRegionalRiceIdentity(vision).map(visionItemToStub);
  const { recipeItems, remainingStubs, decomposed } = decomposeVisionWithRecipes(stubs, vision);
  const oilItems = [];

  // Oil is a meal-level uncertainty, not one extra serving per detected dish.
  // Recipe decompositions already include their cooking fat.
  if (!decomposed) {
    const oilyStub = remainingStubs.find((stub) => {
      const meta = stub._visionMeta || {};
      return meta.visible_oil
        && !/steam|boil|raw|salad/.test(String(meta.cooking_method).toLowerCase());
    });
    if (oilyStub) {
      oilItems.push(buildOilLineItem(oilGramsForMethod(oilyStub._visionMeta?.cooking_method)));
    }
  }

  const calibratedRest = decomposed ? [] : remainingStubs.map(calibrateVisionItem);
  const recipeItemsEnriched = recipeItems.map((item) => {
    const { ref } = resolveFoodReferenceById(item._refId);
    return enrichVisionItemProvenance(applyAuthoritativeNutritionToItem(item, ref));
  });
  const items = [...recipeItemsEnriched, ...calibratedRest, ...oilItems];

  const sourceText = vision.meal_summary || stubs.map((s) => s.name).filter(Boolean).join(', ');

  let analysis = sanitizeAnalysisTotals({
    meal_summary: vision.meal_summary || 'Meal',
    confidence_score: num(vision.confidence_score) || 0.7,
    clarification_questions: vision.clarification_questions || [],
    items,
    total_calories_kcal: 0,
    total_nutrition: {
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fibre_g: null,
      sugar_g: null,
      salt_mg: null,
    },
    _visionComposed: true,
    _visionNotes: vision.notes || '',
    _recipeDecomposed: decomposed || items.some((item) => item._recipeDerived),
    _pipelineResolved: true,
    source: 'photo',
    _sourceText: sourceText,
  });

  analysis = applyMealValidation(analysis, { sourceText });
  analysis._confidence = scoreMealConfidence(analysis);
  return analysis;
}

function legacyItemToVisionItem(item = {}) {
  const portion = String(item.portion_estimate || '');
  const isMl = /\bml\b/i.test(portion) || item._volumeMl != null;
  const amount = item.estimated_amount
    || item._hiddenGrams
    || item.grams
    || item._volumeMl
    || parseGramsFromText(portion)
    || (isMl ? 250 : 120);
  return {
    name: item.name || 'Food',
    unit: isMl ? 'ml' : 'g',
    estimated_amount: Math.max(1, Math.round(num(amount))),
    cooking_method: item.cooking_method || item._visionMeta?.cooking_method || '',
    visible_oil: Boolean(item.visible_oil ?? item._visionMeta?.visible_oil),
    confidence: num(item.confidence) || 0.7,
  };
}

/** Accept vision-only payloads and defensively discard nutrition from legacy AI responses. */
export function normalizePhotoAnalysis(raw = {}, { forceVision = false } = {}) {
  if (isVisionAnalysis(raw)) return composeAnalysisFromVision(raw);
  if (forceVision && Array.isArray(raw.items) && raw.items.length) {
    return composeAnalysisFromVision({
      meal_summary: raw.meal_summary || 'Meal',
      confidence_score: num(raw.confidence_score) || 0.7,
      notes: raw.notes || '',
      items: raw.items.map(legacyItemToVisionItem),
      clarification_questions: raw.clarification_questions || [],
    });
  }
  return raw;
}
