/**
 * Miss-only nutrition fallback for photo items with no proper table row.
 * Official lookup of AI-decomposed parts wins; whole-dish AI macros are last resort.
 * Never writes verified / V4 catalogs and never overlays CoFID / IFCT / USDA rows.
 */

import { isFlagEnabled } from './feature-flags.js';
import { isVerifiedFoodId } from './verified-nutrition.js';
import {
  attachPer100ToItem,
  nutritionForAmount,
  per100FromReference,
  resolveFoodReferenceById,
} from './nutrition-density.js';
import { resolveVisionFoodMatch } from './vision-analysis-compose.js';
import { scoreItemConfidence } from './nutrition-confidence.js';

const WEAK_COMPONENT_IDS = new Set([
  'rice', 'plain_rice', 'cooked_rice', 'dal', 'chicken', 'bread', 'oil',
  'cooking_oil', 'curry', 'sauce', 'gravy', 'potato', 'egg', 'doughnut',
  'fritter', 'paneer',
]);

const OFFICIAL_SOURCES = new Set(['cofid', 'ifct', 'usda', 'manufacturer', 'restaurant']);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function itemGrams(item = {}) {
  return Math.max(1, Math.round(
    num(item._hiddenGrams || item._visionMeta?.amount || item._originalGrams || item.grams) || 120,
  ));
}

function hasOfficialNutrition(item = {}) {
  if (item._authoritative || item._labelBacked || item._brandedServing) return true;
  if (isVerifiedFoodId(item._refId)) return true;
  const source = String(item._nutritionSource || item._per100?.dataSource || '').toLowerCase();
  if (OFFICIAL_SOURCES.has(source)) return true;
  const status = item._per100?.verificationStatus || item._canonical?.verificationStatus;
  return status === 'verified' || status === 'manufacturer';
}

/**
 * True only when MealNova has no proper table row and confidence is weak.
 * Matched catalog dishes (even estimated V4 / L2.3) are left alone.
 */
export function itemNeedsAiNutritionFallback(item = {}, analysis = {}) {
  if (!isFlagEnabled('aiNutritionFallback')) return false;
  if (!item || item._visionOil || item._labelBacked || item._fromBarcode) return false;
  if (item._aiNutritionFallback || item._aiDecomposed) return false;
  if (hasOfficialNutrition(item)) return false;
  if (item._recipeDerived && item._refId && !item._nutritionFallback) return false;

  const fallbackBlob = Boolean(item._nutritionFallback || item._unmatched);
  const noRef = !item._refId;
  const per100IsBlob = item._per100?.source === 'fallback' || item._per100?.refId == null && fallbackBlob;
  if (!fallbackBlob && !noRef && !per100IsBlob) return false;

  const scored = scoreItemConfidence(item, analysis);
  const visionConf = num(item.confidence);
  const lowVision = visionConf > 0 && visionConf < 0.55;
  const lowData = scored.band === 'low' || scored.factors.dataQuality < 0.5;
  return fallbackBlob || noRef || lowVision || lowData;
}

export function listAiNutritionFallbackItems(analysis = {}) {
  return (analysis.items || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => itemNeedsAiNutritionFallback(item, analysis))
    .slice(0, 4);
}

export function sanitizeAiPer100(raw = {}) {
  const kcal = num(raw.kcal);
  const protein_g = num(raw.protein_g);
  const carbs_g = num(raw.carbs_g);
  const fat_g = num(raw.fat_g);
  if (kcal < 15 || kcal > 900) return null;
  if (protein_g < 0 || protein_g > 80) return null;
  if (carbs_g < 0 || carbs_g > 95) return null;
  if (fat_g < 0 || fat_g > 95) return null;
  const atwater = protein_g * 4 + carbs_g * 4 + fat_g * 9;
  if (atwater > 0 && Math.abs(atwater - kcal) > Math.max(80, kcal * 0.45)) return null;
  const fibreRaw = Number(raw.fibre_g);
  const fibre_g = Number.isFinite(fibreRaw) && fibreRaw > 0 && fibreRaw <= 45 ? fibreRaw : null;
  return {
    kcal,
    protein_g,
    carbs_g,
    fat_g,
    fibre_g,
    sugar_g: null,
    salt_mg: null,
    source: 'ai_estimate',
    refId: null,
  };
}

export function lookupComponentNutrition(component = {}) {
  const name = String(component.name || '').trim();
  const grams = Math.max(0, Math.round(num(component.grams)));
  if (!name || grams <= 0) return null;
  const picked = resolveVisionFoodMatch(name, component.usda_search_term || '');
  if (!picked?.ref?.id) return null;
  const resolved = resolveFoodReferenceById(picked.ref.id);
  const row = resolved?.ref || picked.ref;
  const per100 = per100FromReference(row);
  if (!per100?.kcal) return null;
  const scaled = nutritionForAmount(per100, grams);
  const official = Boolean(row._verified || row.verificationStatus === 'verified' || isVerifiedFoodId(row.id));
  return {
    name,
    grams,
    refId: row.id,
    official,
    weak: WEAK_COMPONENT_IDS.has(row.id) && !official,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    per100,
  };
}

function scaleNutrition(nutrition = {}, factor = 1) {
  return {
    protein_g: round1(num(nutrition.protein_g) * factor),
    carbs_g: round1(num(nutrition.carbs_g) * factor),
    fat_g: round1(num(nutrition.fat_g) * factor),
    fibre_g: nutrition.fibre_g == null ? null : round1(num(nutrition.fibre_g) * factor),
    sugar_g: nutrition.sugar_g == null ? null : round1(num(nutrition.sugar_g) * factor),
    salt_mg: nutrition.salt_mg == null ? null : Math.round(num(nutrition.salt_mg) * factor),
  };
}

/**
 * Apply decomposed parts that MealNova can look up. Returns null if coverage is too weak.
 */
export function applyDecomposedLookup(item = {}, components = []) {
  const grams = itemGrams(item);
  const lookedUp = (components || []).map(lookupComponentNutrition).filter(Boolean);
  if (!lookedUp.length) return null;
  const matchedGrams = lookedUp.reduce((sum, row) => sum + row.grams, 0);
  if (matchedGrams < grams * 0.55) return null;
  const useful = lookedUp.filter((row) => row.official || !row.weak);
  if (!useful.length) return null;

  const factor = grams / matchedGrams;
  const nutrition = lookedUp.reduce((acc, row) => {
    const n = scaleNutrition(row.nutrition, factor);
    return {
      protein_g: round1(acc.protein_g + n.protein_g),
      carbs_g: round1(acc.carbs_g + n.carbs_g),
      fat_g: round1(acc.fat_g + n.fat_g),
      fibre_g: acc.fibre_g == null && n.fibre_g == null ? null : round1(num(acc.fibre_g) + num(n.fibre_g)),
      sugar_g: acc.sugar_g == null && n.sugar_g == null ? null : round1(num(acc.sugar_g) + num(n.sugar_g)),
      salt_mg: acc.salt_mg == null && n.salt_mg == null ? null : Math.round(num(acc.salt_mg) + num(n.salt_mg)),
    };
  }, { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sugar_g: null, salt_mg: null });

  const calories_kcal = lookedUp.reduce((sum, row) => sum + Math.round(row.calories_kcal * factor), 0);
  const allOfficial = lookedUp.every((row) => row.official);
  const per100 = {
    kcal: calories_kcal * (100 / grams),
    protein_g: nutrition.protein_g * (100 / grams),
    carbs_g: nutrition.carbs_g * (100 / grams),
    fat_g: nutrition.fat_g * (100 / grams),
    fibre_g: nutrition.fibre_g == null ? null : nutrition.fibre_g * (100 / grams),
    sugar_g: null,
    salt_mg: null,
    source: 'decomposed_lookup',
    refId: lookedUp.length === 1 ? lookedUp[0].refId : null,
  };

  return attachPer100ToItem({
    ...item,
    calories_kcal,
    nutrition,
    _per100: per100,
    _nutritionFallback: undefined,
    _unmatched: false,
    _aiDecomposed: true,
    _aiComponents: lookedUp.map((row) => ({ name: row.name, grams: row.grams, refId: row.refId })),
    _authoritative: allOfficial,
    _nutritionSource: allOfficial ? (lookedUp[0]?.per100?.dataSource || 'decomposed_lookup') : 'decomposed_lookup',
    _provenanceLabel: allOfficial ? 'Looked up from parts' : 'Looked up from parts · some estimated',
  });
}

export function applyAiEstimatePer100(item = {}, rawPer100 = {}) {
  const per100 = sanitizeAiPer100(rawPer100);
  if (!per100) return null;
  const grams = itemGrams(item);
  const scaled = nutritionForAmount(per100, grams);
  return attachPer100ToItem({
    ...item,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    _per100: per100,
    _nutritionFallback: undefined,
    _unmatched: false,
    _aiNutritionFallback: true,
    _authoritative: false,
    _nutritionSource: 'ai_estimate',
    _provenanceLabel: 'AI estimate',
  });
}

export function applyLowConfidenceNutritionResult(item = {}, result = {}) {
  if (!item || !result) return item;
  const decomposed = applyDecomposedLookup(item, result.components);
  if (decomposed) return decomposed;
  return applyAiEstimatePer100(item, result.per100) || item;
}

/** Re-apply a stored AI / decomposed per-100 profile after a gram change. */
export function restoreStoredFallbackNutrition(item = {}, prior = {}) {
  if (!prior || !item) return item;
  if (!prior._aiNutritionFallback && !prior._aiDecomposed) return item;
  if (prior._aiDecomposed && prior._aiComponents?.length) {
    const restored = applyDecomposedLookup(item, prior._aiComponents.map((row) => ({
      name: row.name,
      grams: row.grams,
      usda_search_term: row.name,
    })));
    if (restored) return restored;
  }
  if (prior._per100 && (prior._aiNutritionFallback || prior._per100.source === 'ai_estimate')) {
    return applyAiEstimatePer100(item, prior._per100) || item;
  }
  return item;
}
