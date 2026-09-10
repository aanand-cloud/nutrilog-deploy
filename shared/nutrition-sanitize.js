/** Shared nutrition sanity checks for AI, voice, and barcode estimates. */

import {
  calibrateItemWithReference,
  matchFoodReference,
  matchFoodReferenceDetailed,
  resolveFoodReferenceById,
  parseGramsFromText,
  nutritionForAmount,
  per100FromReference,
  attachPer100ToItem,
} from './nutrition-density.js';
import { splitMealPhrases, phraseHasExplicitQuantity, parseQuantityFromText } from './quantity-parser.js';
import { isImplausibleKcalPer100, isAllowedZeroKcal } from './canonical-food-model.js';
import { scoreMealConfidence } from './nutrition-confidence.js';

const NUTRITION_KEYS = ['protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'sugar_g', 'salt_mg'];
const MACRO_KEYS = ['protein_g', 'carbs_g', 'fat_g'];
const MICRO_KEYS = ['fibre_g', 'sugar_g', 'salt_mg'];

function round1(v) {
  return Math.round(v * 10) / 10;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sumMicroField(items = [], key = '') {
  const vals = items
    .map((item) => item.nutrition?.[key])
    .filter((v) => v != null && Number.isFinite(Number(v)));
  if (!vals.length) return null;
  const total = vals.reduce((s, v) => s + num(v), 0);
  return key === 'salt_mg' ? Math.round(total) : round1(total);
}

function sumItems(items = []) {
  const totals = {
    calories_kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fibre_g: null,
    sugar_g: null,
    salt_mg: null,
  };
  for (const item of items) {
    if (item._unmatched) continue;
    totals.calories_kcal += num(item.calories_kcal);
    const n = item.nutrition || {};
    for (const key of MACRO_KEYS) totals[key] += num(n[key]);
  }
  const matched = items.filter((i) => !i._unmatched);
  totals.fibre_g = sumMicroField(matched, 'fibre_g');
  totals.sugar_g = sumMicroField(matched, 'sugar_g');
  totals.salt_mg = sumMicroField(matched, 'salt_mg');
  return totals;
}

/**
 * Sum line items into meal totals — micros stay null when unknown.
 * @param {object[]} items
 */
export function sumItemNutritionTotals(items = []) {
  return sumItems(items);
}

/**
 * Prefer item sums; keep meal-level values when a nutrient is missing from all items.
 * @param {object} fromItems
 * @param {object} fallback
 * @param {{ portionFactor?: number }} [opts]
 */
export function reconcileTotalNutrition(fromItems = {}, fallback = {}, { portionFactor = 1 } = {}) {
  const scale = Math.max(0, num(portionFactor) || 1);
  const out = {};
  for (const key of MACRO_KEYS) {
    let v = num(fromItems[key]);
    const fb = num(fallback[key]) * scale;
    if (v <= 0 && fb > 0) v = fb;
    out[key] = round1(v);
  }
  for (const key of MICRO_KEYS) {
    const fromVal = fromItems[key];
    const fbVal = fallback[key];
    if (fromVal != null && Number.isFinite(Number(fromVal))) {
      out[key] = key === 'salt_mg' ? Math.round(num(fromVal)) : round1(num(fromVal));
    } else if (fbVal != null && Number.isFinite(Number(fbVal)) && num(fbVal) > 0) {
      out[key] = key === 'salt_mg' ? Math.round(num(fbVal) * scale) : round1(num(fbVal) * scale);
    } else {
      out[key] = null;
    }
  }
  return out;
}

/** Spread meal-level micros onto items when line items omit them (photo AI / barcode). */
function distributeUnallocatedMicrosToItems(items = [], targetNutrition = {}) {
  if (!items.length) return items;

  const calTotal = items.reduce((s, item) => s + num(item.calories_kcal), 0);
  const shareOf = (item) => (calTotal > 0 ? num(item.calories_kcal) / calTotal : 1 / items.length);

  let updated = items.map((item) => ({
    ...item,
    nutrition: { ...(item.nutrition || {}) },
  }));

  for (const key of MICRO_KEYS) {
    const itemSum = updated.reduce((s, item) => s + num(item.nutrition?.[key]), 0);
    const target = targetNutrition[key];
    if (target == null || target <= 0 || itemSum >= num(target) * 0.85) continue;

    const gap = target - itemSum;
    updated = updated.map((item) => {
      const cur = num(item.nutrition?.[key]);
      const add = gap * shareOf(item);
      return {
        ...item,
        nutrition: {
          ...item.nutrition,
          [key]: key === 'salt_mg' ? Math.round(cur + add) : round1(cur + add),
        },
      };
    });
  }

  return updated;
}

/** Hard cap when no reference match — cooked meat rarely exceeds 31g protein per 100g. */
function capItemProtein(item) {
  const grams = parseGramsFromText(item.portion_estimate) || parseGramsFromText(item.name);
  if (!grams || grams <= 0) return item;

  const ref = matchFoodReference(`${item.name} ${item.portion_estimate}`);
  const maxPer100 = ref?.protein100 || 31;
  const maxProtein = round1(grams * (maxPer100 / 100) * 1.08);

  const protein = num(item.nutrition?.protein_g);
  if (protein <= maxProtein) return item;

  const factor = maxProtein / protein;
  return {
    ...item,
    calories_kcal: Math.round(num(item.calories_kcal) * factor),
    nutrition: {
      ...(item.nutrition || {}),
      protein_g: round1(protein * factor),
      carbs_g: round1(num(item.nutrition?.carbs_g) * factor),
      fat_g: round1(num(item.nutrition?.fat_g) * factor),
    },
  };
}

/** Max relative drift before kcal is corrected to 4P + 4C + 9F. */
export const MACRO_KCAL_TOLERANCE = 0.08;

export function macroKcalFromNutrition(nutrition = {}) {
  return num(nutrition.protein_g) * 4 + num(nutrition.carbs_g) * 4 + num(nutrition.fat_g) * 9;
}

/** Align line-item kcal with macro math when AI drifts beyond tolerance. */
export function reconcileItemKcalWithMacros(item = {}) {
  if (item._authoritative || item._labelBacked) return item;
  const nutrition = item.nutrition || {};
  const protein = num(nutrition.protein_g);
  const carbs = num(nutrition.carbs_g);
  const fat = num(nutrition.fat_g);
  if (protein <= 0 && carbs <= 0 && fat <= 0) return item;

  const calculated = Math.round(macroKcalFromNutrition(nutrition));
  const stated = Math.round(num(item.calories_kcal));

  if (stated <= 0 && calculated > 0) {
    return { ...item, calories_kcal: calculated, _kcalFromMacros: true };
  }
  if (stated <= 0 || calculated <= 0) return item;

  if (Math.abs(calculated - stated) > stated * MACRO_KCAL_TOLERANCE) {
    return {
      ...item,
      calories_kcal: calculated,
      _kcalCorrected: true,
      _kcalWas: stated,
    };
  }
  return item;
}

function reconcileMealKcalWithMacros(statedKcal, totalNutrition = {}) {
  const protein = num(totalNutrition.protein_g);
  const carbs = num(totalNutrition.carbs_g);
  const fat = num(totalNutrition.fat_g);
  if (protein <= 0 && carbs <= 0 && fat <= 0) return statedKcal;

  const calculated = Math.round(macroKcalFromNutrition(totalNutrition));
  const stated = Math.round(num(statedKcal));

  if (stated <= 0 && calculated > 0) return calculated;
  if (stated <= 0 || calculated <= 0) return stated;
  if (Math.abs(calculated - stated) > stated * MACRO_KCAL_TOLERANCE) return calculated;
  return stated;
}

function capMacroEnergy(nutrition = {}, kcal = 0) {
  const totalKcal = Math.max(0, num(kcal));
  if (totalKcal <= 0) return nutrition;

  const macroKcal = num(nutrition.protein_g) * 4
    + num(nutrition.carbs_g) * 4
    + num(nutrition.fat_g) * 9;
  if (macroKcal <= totalKcal * 1.12) return nutrition;

  const factor = (totalKcal * 1.05) / macroKcal;
  return {
    ...nutrition,
    protein_g: round1(num(nutrition.protein_g) * factor),
    carbs_g: round1(num(nutrition.carbs_g) * factor),
    fat_g: round1(num(nutrition.fat_g) * factor),
  };
}

function calibrateItems(items = []) {
  return items.map((item) => {
    if (item._authoritative) return attachPer100ToItem(item);
    const refCalibrated = calibrateItemWithReference(item);
    const ref = matchFoodReference(`${refCalibrated.name} ${refCalibrated.portion_estimate}`);
    const calibrated = ref ? refCalibrated : capItemProtein(refCalibrated);
    return attachPer100ToItem(calibrated);
  });
}

/**
 * Reconcile totals from line items with reference-based calibration.
 * @param {object} analysis
 * @returns {object}
 */
export function sanitizeAnalysisTotals(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis;

  const labelBacked = analysis._labelBacked
    || analysis.source === 'barcode'
    || analysis.source === 'food_search'
    || Boolean(analysis.barcode);

  // Pattern-based voice describe already uses full-serving kcal — don't shrink to 120g ref defaults.
  if (analysis._voiceEstimate && !analysis._anchored && !analysis._pipelineResolved) {
    return applyMealValidation({ ...analysis, _sanitized: true });
  }

  try {
    let items = labelBacked
      ? (analysis.items || []).map((item) => attachPer100ToItem({ ...item, _labelBacked: item._labelBacked ?? true }))
      : calibrateItems(analysis.items || []);
    const summed = sumItems(items);
    let kcal = Math.round(summed.calories_kcal) || Math.round(num(analysis.total_calories_kcal));
    let total_nutrition = reconcileTotalNutrition(
      {
        protein_g: summed.protein_g,
        carbs_g: summed.carbs_g,
        fat_g: summed.fat_g,
        fibre_g: summed.fibre_g,
        sugar_g: summed.sugar_g,
        salt_mg: summed.salt_mg,
      },
      analysis.total_nutrition || {},
    );
    const skipMacroKcalFix = analysis._userNotesApplied
      || analysis._voiceEstimate
      || analysis._clarifiedLocally;
    if (!labelBacked && !skipMacroKcalFix) {
      items = items.map(reconcileItemKcalWithMacros).map(attachPer100ToItem);
      const resummed = sumItems(items);
      kcal = Math.round(resummed.calories_kcal) || kcal;
      items = distributeUnallocatedMicrosToItems(items, total_nutrition);
      total_nutrition = reconcileTotalNutrition(sumItems(items), total_nutrition);
      total_nutrition = capMacroEnergy(total_nutrition, kcal);
      kcal = reconcileMealKcalWithMacros(kcal, total_nutrition);
    }

    return applyMealValidation({
      ...analysis,
      total_calories_kcal: kcal,
      total_nutrition,
      items,
      _sanitized: true,
    });
  } catch (_) {
    return analysis;
  }
}

/** Macro–kcal drift tolerance for meal-level validation (slightly looser than line-item fix). */
export const MEAL_MACRO_KCAL_TOLERANCE = 0.15;

/**
 * Universal validation — incomplete meals, zero-kcal surprises, macro drift, silent omissions.
 * @param {object} analysis
 * @param {{ sourceText?: string, sourcePhrases?: string[] }} [opts]
 */
export function validateMealAnalysis(analysis, { sourceText = '', sourcePhrases = [] } = {}) {
  const issues = [];
  const warnings = [];
  const items = analysis?.items || [];
  const phrases = sourcePhrases.length
    ? sourcePhrases
    : (sourceText ? splitMealPhrases(sourceText) : []);

  const unmatched = items.filter((i) => i._unmatched);
  if (unmatched.length) {
    issues.push({
      code: 'unmatched_items',
      severity: 'error',
      count: unmatched.length,
      message: `${unmatched.length} item(s) could not be matched to nutrition data.`,
    });
  }

  const zeroKcal = items.filter((i) => !i._unmatched && !i._labelBacked && num(i.calories_kcal) <= 0);
  if (zeroKcal.length) {
    issues.push({
      code: 'zero_kcal_items',
      severity: 'error',
      count: zeroKcal.length,
      message: `${zeroKcal.length} item(s) have no calorie estimate.`,
    });
  }

  if (phrases.length > 1 && items.length < phrases.length) {
    issues.push({
      code: 'missing_phrase_items',
      severity: 'error',
      expected: phrases.length,
      got: items.length,
      message: `Expected at least ${phrases.length} logged item(s) from the description, found ${items.length}.`,
    });
  }

  const seenNames = new Map();
  for (const item of items) {
    const key = String(item.name || '').toLowerCase().trim();
    if (!key) continue;
    seenNames.set(key, (seenNames.get(key) || 0) + 1);
  }
  for (const [name, count] of seenNames) {
    if (count > 1) {
      warnings.push({
        code: 'duplicate_component',
        severity: 'warning',
        name,
        count,
        message: `"${name}" appears ${count} times — check for accidental duplication.`,
      });
    }
  }

  for (const item of items) {
    const grams = num(item._hiddenGrams) || parseGramsFromText(item.portion_estimate || '');
    if (grams > 2000) {
      warnings.push({
        code: 'extreme_serving',
        severity: 'warning',
        item: item.name,
        grams,
        message: `${item.name} portion (~${Math.round(grams)}g) looks unusually large.`,
      });
    }

    if (item._per100?.kcal && isImplausibleKcalPer100(item._per100.kcal)) {
      warnings.push({
        code: 'implausible_kcal_per100',
        severity: 'warning',
        item: item.name,
        kcal100: item._per100.kcal,
      });
    }

    if (item._refId && !item._unmatched && !item._labelBacked
      && !isAllowedZeroKcal(item._refId, item.calories_kcal)
      && num(item.calories_kcal) <= 0) {
      issues.push({
        code: 'zero_kcal_matched',
        severity: 'error',
        item: item.name,
        refId: item._refId,
        message: `"${item.name}" matched but has zero calories — blocked.`,
      });
    }

    if (item._refId && /generic|portion|unknown/.test(item._refId) && item.name
      && !/generic|portion/.test(String(item.name).toLowerCase())) {
      warnings.push({
        code: 'generic_match',
        severity: 'warning',
        item: item.name,
        refId: item._refId,
        message: `"${item.name}" matched a generic reference — a more specific food may exist.`,
      });
    }
  }

  for (const item of items) {
    if (item._unmatched || item._labelBacked) continue;
    const macroKcal = macroKcalFromNutrition(item.nutrition || {});
    const stated = num(item.calories_kcal);
    if (stated > 20 && macroKcal > 0 && Math.abs(macroKcal - stated) > stated * MEAL_MACRO_KCAL_TOLERANCE) {
      warnings.push({
        code: 'item_macro_drift',
        severity: 'warning',
        item: item.name,
        stated,
        macroKcal: Math.round(macroKcal),
      });
    }
  }

  const totalMacro = macroKcalFromNutrition(analysis.total_nutrition || {});
  const totalStated = num(analysis.total_calories_kcal);
  if (totalStated > 30 && totalMacro > 0 && Math.abs(totalMacro - totalStated) > totalStated * MEAL_MACRO_KCAL_TOLERANCE) {
    warnings.push({
      code: 'meal_macro_drift',
      severity: 'warning',
      stated: totalStated,
      macroKcal: Math.round(totalMacro),
    });
  }

  if (phrases.length) {
    for (const phrase of phrases) {
      const q = parseQuantityFromText(phrase);
      if (!phraseHasExplicitQuantity(q)) continue;
      const boundItems = items.filter((item) => item._sourcePhrase === phrase);
      const pool = boundItems.length ? boundItems : items;
      const matched = pool.some((item) => {
        if (item._boundQuantity?.amount != null && item._boundQuantity?.unit === q.unit) {
          return Math.abs(num(item._boundQuantity.amount) - num(q.amount)) < 0.01;
        }
        const blob = `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
        const food = String(q.foodText || phrase).toLowerCase();
        if (q.unit === 'g' && blob.includes(`${Math.round(q.quantity)}g`)) return true;
        if (q.unit === 'ml' && blob.includes(`${Math.round(q.quantity)}ml`)) return true;
        if (q.unit === 'piece' && new RegExp(`\\b${Math.round(q.quantity)}\\s*piece`, 'i').test(item.portion_estimate || '')) return true;
        return food.length > 3 && blob.includes(food.slice(0, Math.min(food.length, 12)));
      });
      if (!matched && !items.some((i) => i._unmatched && String(i.name).toLowerCase().includes(String(q.foodText || phrase).toLowerCase().slice(0, 8)))) {
        warnings.push({
          code: 'quantity_not_reflected',
          severity: 'warning',
          phrase,
          message: `Quantity in "${phrase}" may not be reflected in logged items.`,
        });
      }
    }
  }

  const complete = issues.length === 0;
  const status = complete ? (warnings.length ? 'uncertain' : 'complete') : 'incomplete';

  return {
    valid: issues.length === 0,
    complete,
    status,
    issues,
    warnings,
  };
}

/**
 * Attach validation metadata to an analysis object.
 * @param {object} analysis
 * @param {{ sourceText?: string, sourcePhrases?: string[] }} [opts]
 */
export function applyMealValidation(analysis, opts = {}) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const sourceText = opts.sourceText || analysis._sourceText || '';
  const sourcePhrases = opts.sourcePhrases || analysis._sourcePhrases || [];
  const validation = validateMealAnalysis(analysis, { sourceText, sourcePhrases });
  return {
    ...analysis,
    _mealValidation: validation,
    _mealIncomplete: !validation.complete,
    _mealStatus: validation.status,
    _confidence: scoreMealConfidence({ ...analysis, _mealValidation: validation }),
  };
}

export {
  matchFoodReference,
  matchFoodReferenceDetailed,
  resolveFoodReferenceById,
  parseGramsFromText,
  nutritionForAmount,
  per100FromReference,
};
