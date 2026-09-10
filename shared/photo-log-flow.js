/**
 * Post-photo analysis steps: weight confirm, hidden items, side dishes.
 */

import {
  parseGramsFromText,
  matchFoodReference,
  nutritionForAmount,
  per100FromReference,
  calibrateItemWithReference,
  shouldSkipReferenceCalibration,
  attachPer100ToItem,
  rescaleItemFromPer100,
} from './nutrition-density.js';
import { sanitizeAnalysisTotals } from './nutrition-sanitize.js';
import { detectPlateGaps } from './plate-tighten.js';
import { refDisplayName } from './description-anchor.js';

function round1(v) {
  return Math.round(v * 10) / 10;
}

const DEFAULT_ITEM_GRAMS = 120;
const DEFAULT_DRINK_ML = 250;

const DRINK_REF_PREFIX = /^(coffee|tea|beer|wine|soft_drink|juice|lassi|chai|water|irn_bru|pimms|gin_tonic|bubble_tea|hot_chocolate|protein_shake|spirits)/;

/** True when item looks like a beverage (ml, not solid grams). */
export function isDrinkItem(item = {}) {
  const text = `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
  if (item._refId && DRINK_REF_PREFIX.test(item._refId)) return true;
  if (item._volumeMl > 0) return true;
  if (/\b(ml|millilitre|milliliter|cup|glass|pint|shot)\b/i.test(text)) return true;
  if (/\b(coffee|tea|latte|cappuccino|espresso|chai|karak|juice|smoothie|cola|soda|wine|beer|water|drink|beverage|milk|shake|lassi|horlicks|ovaltine)\b/i.test(text)) return true;
  return false;
}

/** Best volume guess for drinks (ml). Falls back to gram parser when AI used g for a drink. */
export function inferItemVolumeMl(item = {}) {
  if (item._volumeMl > 0) return Math.round(item._volumeMl);
  const fromPortion = parseGramsFromText(item.portion_estimate);
  if (fromPortion > 0) return Math.round(fromPortion);
  const fromName = parseGramsFromText(item.name);
  if (fromName > 0) return Math.round(fromName);
  return DEFAULT_DRINK_ML;
}

/** Parse grams from AI item name + portion_estimate. */
export function inferItemGrams(item = {}) {
  const fromPortion = parseGramsFromText(item.portion_estimate);
  if (fromPortion > 0) return Math.round(fromPortion);
  const fromName = parseGramsFromText(item.name);
  if (fromName > 0) return Math.round(fromName);
  if (item._hiddenGrams > 0) return Math.round(item._hiddenGrams);
  return DEFAULT_ITEM_GRAMS;
}

function scaleItemNutritionLinear(item, factor, portionEstimate, extras = {}) {
  const n = item.nutrition || {};
  return {
    ...item,
    portion_estimate: portionEstimate,
    calories_kcal: Math.round((Number(item.calories_kcal) || 0) * factor),
    nutrition: {
      protein_g: round1((Number(n.protein_g) || 0) * factor),
      carbs_g: round1((Number(n.carbs_g) || 0) * factor),
      fat_g: round1((Number(n.fat_g) || 0) * factor),
      fibre_g: round1((Number(n.fibre_g) || 0) * factor),
      sugar_g: round1((Number(n.sugar_g) || 0) * factor),
      salt_mg: Math.round((Number(n.salt_mg) || 0) * factor),
    },
    _weightConfirmed: true,
    ...extras,
  };
}

/** Scale drink line item to a new volume (ml) using per-100g anchor when available. */
export function rescaleItemToVolume(item, newMl) {
  const ml = Math.max(1, Math.round(Number(newMl) || DEFAULT_DRINK_ML));
  if (!shouldSkipReferenceCalibration(item)) {
    if (item._per100) {
      const rescaled = rescaleItemFromPer100(item, ml, 'ml');
      if (rescaled) return { ...rescaled, _weightConfirmed: true, _volumeMl: ml };
    }
    const calibrated = calibrateItemWithReference({
      ...item,
      portion_estimate: `~${ml}ml`,
      _volumeMl: ml,
    });
    if (calibrated._refId) {
      return { ...calibrated, _weightConfirmed: true, _volumeMl: ml };
    }
  }

  const oldMl = inferItemVolumeMl(item);
  return attachPer100ToItem(scaleItemNutritionLinear(item, ml / oldMl, `~${ml}ml`, { _volumeMl: ml }));
}

/** Scale one line item to a new gram weight using per-100g anchor when available. */
export function rescaleItemToGrams(item, newGrams) {
  const grams = Math.max(1, Math.round(Number(newGrams) || DEFAULT_ITEM_GRAMS));
  if (!shouldSkipReferenceCalibration(item)) {
    if (item._per100) {
      const rescaled = rescaleItemFromPer100(item, grams, 'g');
      if (rescaled) return { ...rescaled, _weightConfirmed: true, _hiddenGrams: grams };
    }
    const calibrated = calibrateItemWithReference({
      ...item,
      portion_estimate: `~${grams}g`,
      _hiddenGrams: item._hiddenGrams ?? grams,
    });
    if (calibrated._refId) {
      return { ...calibrated, _weightConfirmed: true, _hiddenGrams: grams };
    }
  }

  const oldGrams = inferItemGrams(item);
  return attachPer100ToItem(scaleItemNutritionLinear(
    item,
    grams / oldGrams,
    `~${grams}g`,
    { _hiddenGrams: item._hiddenGrams ?? grams },
  ));
}

/** Apply per-item gram/ml edits and recalculate meal totals with reference calibration. */
export function applyWeightEditsToAnalysis(analysis, gramByIndex = {}) {
  if (!analysis?.items?.length) return analysis;
  const labelBacked = analysis._labelBacked
    || analysis.source === 'barcode'
    || analysis.source === 'food_search'
    || Boolean(analysis.barcode);
  const items = analysis.items.map((item, idx) => {
    const amount = gramByIndex[idx];
    if (amount == null || !Number.isFinite(Number(amount))) return item;
    const protectedItem = labelBacked || shouldSkipReferenceCalibration(item);
    if (protectedItem) {
      if (isDrinkItem(item)) return rescaleItemToVolume({ ...item, _labelBacked: true }, Number(amount));
      return rescaleItemToGrams({ ...item, _labelBacked: true }, Number(amount));
    }
    if (isDrinkItem(item)) return rescaleItemToVolume(item, Number(amount));
    return rescaleItemToGrams(item, Number(amount));
  });
  return sanitizeAnalysisTotals({ ...analysis, items, _weightsConfirmed: true });
}

const SIDE_PRESETS = [
  { gapKey: 'missingBread', label: 'Roti / bread / dosa', defaultGrams: 60, refQuery: 'roti' },
  { gapKey: 'missingRiceSide', label: 'Steamed rice (side)', defaultGrams: 150, refQuery: 'steamed rice' },
  { gapKey: 'missingCurry', label: 'Curry / dal / gravy', defaultGrams: 200, refQuery: 'dal tadka' },
  { gapKey: 'missingEgg', label: 'Egg', defaultGrams: 58, refQuery: 'egg' },
  { gapKey: 'missingProtein', label: 'Protein (meat/fish/paneer)', defaultGrams: 120, refQuery: 'chicken curry' },
  { gapKey: 'missingSalad', label: 'Salad / slaw', defaultGrams: 80, refQuery: 'salad' },
  { gapKey: 'missingFries', label: 'Fries / chips', defaultGrams: 120, refQuery: 'fries' },
];

/** Suggested side dishes the photo may have missed. */
export function getSideSuggestions(analysis = {}) {
  const gaps = detectPlateGaps(analysis);
  return SIDE_PRESETS
    .filter((preset) => gaps[preset.gapKey])
    .map((preset) => {
      const ref = matchFoodReference(preset.refQuery);
      if (!ref) return null;
      return {
        id: preset.gapKey,
        label: preset.label,
        defaultGrams: preset.defaultGrams,
        refId: ref.id,
        refQuery: preset.refQuery,
        displayName: refDisplayName(ref.id),
      };
    })
    .filter(Boolean);
}

/** Build a side line item from preset + grams. */
export function buildSideLineItem({ displayName, refId, refQuery, grams }) {
  const ref = matchFoodReference(refQuery || displayName || refId || '');
  if (!ref) return null;
  const g = Math.max(1, Math.round(Number(grams) || DEFAULT_ITEM_GRAMS));
  const scaled = nutritionForAmount(per100FromReference(ref), g);
  return {
    name: displayName || refDisplayName(ref.id),
    portion_estimate: `side (~${g}g)`,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    confidence: 0.78,
    _fromSideStep: true,
    _refId: ref.id,
  };
}

const PORTION_CLARIFY_TOPICS = new Set([
  'portion_rice',
  'portion_solid',
  'portion_starter',
  'portion_snack',
  'portion_takeaway',
  'dessert_portion',
  'bread_count',
  'generic_portion',
]);

const FAT_CLARIFY_TOPICS = new Set([
  'oil_fat',
  'cooking_method',
  'sauce_gravy',
  'cheese_cream',
]);

/** Drop clarify topics already covered by weight confirm, sides, or high confidence. */
export function filterClarificationStepsAfterAdjust(analysis, steps = []) {
  if (!steps.length || !analysis) return steps;
  let out = [...steps];

  if (analysis._weightsConfirmed) {
    out = out.filter((step) => !PORTION_CLARIFY_TOPICS.has(step.topic));
  }
  if (analysis._sidesAdded?.length) {
    out = out.filter((step) => step.topic !== 'bread_count' && step.topic !== 'portion_rice');
  }

  const confidence = Number(analysis.confidence)
    || Number(analysis.items?.[0]?.confidence)
    || 0.8;
  if (analysis._weightsConfirmed && confidence >= 0.72) {
    out = out.filter((step) => !FAT_CLARIFY_TOPICS.has(step.topic));
  }

  return out;
}

/** Append selected sides to analysis. */
export function applySideSelectionsToAnalysis(analysis, selections = []) {
  if (!selections.length) return analysis;
  const extra = selections
    .map((sel) => buildSideLineItem(sel))
    .filter(Boolean);
  if (!extra.length) return analysis;
  return sanitizeAnalysisTotals({
    ...analysis,
    items: [...(analysis.items || []), ...extra],
    _sidesAdded: extra.map((i) => i.name),
  });
}
