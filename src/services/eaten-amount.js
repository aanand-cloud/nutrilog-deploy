/**
 * Amount-eaten scaling — full precision until display rounding.
 */

export const EATEN_OPTIONS = [
  { id: 'all', label: 'All — 100%', factor: 1 },
  { id: 'most', label: 'Most — approximately 75%', factor: 0.75 },
  { id: 'half', label: 'About half — 50%', factor: 0.5 },
  { id: 'quarter', label: 'About a quarter — 25%', factor: 0.25 },
  { id: 'taste', label: 'Small taste — 10%', factor: 0.1 },
  { id: 'custom', label: 'Enter a different amount', factor: null },
];

export function getEatenOption(id) {
  return EATEN_OPTIONS.find((o) => o.id === id) || EATEN_OPTIONS[0];
}

export function parseMealWeight(value, unit = 'g') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: 'Enter a weight greater than zero.' };
  }
  const grams = toGrams(n, unit);
  if (grams < 5) return { ok: false, message: 'That weight is too small for a meal. Check the number and unit.' };
  if (grams > 8000) return { ok: false, message: 'That weight is unusually large. Check the number and unit.' };
  return { ok: true, grams, display: `${roundDisplay(grams)} g` };
}

function toGrams(n, unit) {
  switch (String(unit).toLowerCase()) {
    case 'kg': return n * 1000;
    case 'lb': return n * 453.59237;
    case 'oz': return n * 28.349523125;
    default: return n;
  }
}

export function roundDisplay(n, digits = 0) {
  const f = 10 ** digits;
  return Math.round(Number(n) * f) / f;
}

export function scaleItemsByEatenFactor(items = [], factor = 1) {
  const safe = Number.isFinite(Number(factor)) ? Math.max(0, Number(factor)) : 1;
  return items.map((item) => {
    const originalGrams = Number(item._originalGrams ?? item.grams) || 0;
    const originalKcal = Number(item._originalCalories ?? item.calories_kcal) || 0;
    const originalNutrition = item._originalNutrition || item.nutrition || {};
    const consumedGrams = originalGrams * safe;
    return {
      ...item,
      _originalGrams: originalGrams,
      _originalCalories: originalKcal,
      _originalNutrition: { ...originalNutrition },
      grams: consumedGrams,
      calories_kcal: originalKcal * safe,
      nutrition: scaleNutritionPrecise(originalNutrition, safe),
      _eatenFactor: safe,
      portion_estimate: consumedLabel(originalGrams, consumedGrams, item.portion_estimate),
    };
  });
}

export function scaleNutritionPrecise(n = {}, factor = 1) {
  const out = {};
  for (const [k, v] of Object.entries(n)) {
    if (v == null || !Number.isFinite(Number(v))) out[k] = v ?? null;
    else out[k] = Number(v) * factor;
  }
  return out;
}

function consumedLabel(originalGrams, consumedGrams, fallback) {
  if (!(originalGrams > 0)) return fallback || '';
  if (Math.abs(consumedGrams - originalGrams) < 0.05) {
    return `Entered serving: ${roundDisplay(originalGrams)} g`;
  }
  const pct = roundDisplay((consumedGrams / originalGrams) * 100);
  return `Amount eaten: ${roundDisplay(consumedGrams)} g — ${pct}% of ${roundDisplay(originalGrams)} g`;
}

export function sumConsumedGrams(items = []) {
  return items.reduce((sum, item) => sum + (Number(item.grams) || 0), 0);
}

export function sumOriginalGrams(items = []) {
  return items.reduce((sum, item) => sum + (Number(item._originalGrams ?? item.grams) || 0), 0);
}

export function sumCaloriesPrecise(items = []) {
  return items.reduce((sum, item) => sum + (Number(item.calories_kcal) || 0), 0);
}

export function sumNutritionHonest(items = []) {
  const keys = ['protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'sugar_g', 'salt_mg'];
  const totals = {};
  for (const key of keys) {
    let sum = 0;
    let seen = 0;
    let missing = 0;
    for (const item of items) {
      const v = item.nutrition?.[key];
      if (v == null || !Number.isFinite(Number(v))) missing += 1;
      else {
        sum += Number(v);
        seen += 1;
      }
    }
    totals[key] = seen === 0 ? null : sum;
    totals[`_${key}_partial`] = seen > 0 && missing > 0;
    totals[`_${key}_unavailable`] = seen === 0 && missing > 0;
  }
  return totals;
}

/**
 * Scale every component so the original weights sum to a measured meal weight.
 * Full precision — no intermediate rounding. Does not invent High confidence.
 */
export function applyMeasuredMealWeight(analysis = {}, grams) {
  const items = analysis.items || [];
  const current = items.reduce((sum, item) => {
    const g = Number(item._originalGrams ?? item.grams);
    if (Number.isFinite(g) && g > 0) return sum + g;
    const fromPortion = String(item.portion_estimate || '').match(/(\d+(?:\.\d+)?)\s*g\b/i);
    return sum + (fromPortion ? Number(fromPortion[1]) : 0);
  }, 0);
  const target = Number(grams);
  if (!(current > 0) || !(target > 0)) return analysis;
  const factor = target / current;
  const scaledItems = items.map((item) => {
    const originalGrams = Number(item._originalGrams ?? item.grams) || 0;
    const nextGrams = originalGrams > 0 ? originalGrams * factor : 0;
    return {
      ...item,
      grams: nextGrams,
      _originalGrams: nextGrams,
      calories_kcal: (Number(item.calories_kcal) || 0) * factor,
      _originalCalories: (Number(item._originalCalories ?? item.calories_kcal) || 0) * factor,
      nutrition: scaleNutritionPrecise(item.nutrition, factor),
      _originalNutrition: scaleNutritionPrecise(item._originalNutrition || item.nutrition, factor),
      portion_estimate: `Measured ${roundDisplay(nextGrams)} g`,
      _weightSource: 'measured',
      _userWeightConfirmed: true,
      _measuredWeight: true,
    };
  });
  return {
    ...analysis,
    items: scaledItems,
    total_calories_kcal: (Number(analysis.total_calories_kcal) || 0) * factor,
    total_nutrition: scaleNutritionPrecise(analysis.total_nutrition, factor),
    _mealWeightGrams: target,
    _measuredMealWeight: true,
  };
}

export function formatNutrientLine(nutrition = {}) {
  const fibre = formatNutrient(nutrition.fibre_g, nutrition._fibre_g_unavailable, 'g');
  const sugar = formatNutrient(nutrition.sugar_g, nutrition._sugar_g_unavailable, 'g');
  const salt = formatSalt(nutrition.salt_mg, nutrition._salt_mg_unavailable, nutrition._salt_mg_partial);
  const notes = [];
  if (nutrition._salt_mg_partial) notes.push('Salt is estimated.');
  if (nutrition._sugar_g_unavailable) notes.push('Sugar data is unavailable for one or more foods.');
  if (nutrition._fibre_g_unavailable) notes.push('Fibre data is unavailable for one or more foods.');
  return { line: `Fibre: ${fibre} · Sugar: ${sugar} · Salt: ${salt}`, notes: notes.join(' ') };
}

function formatNutrient(value, unavailable, unit) {
  if (unavailable || value == null || !Number.isFinite(Number(value))) return 'unavailable';
  return `${roundDisplay(value, 1)} ${unit}`;
}

function formatSalt(mg, unavailable, partial) {
  if (unavailable || mg == null || !Number.isFinite(Number(mg))) return 'unavailable';
  const text = `${roundDisplay(mg)} mg`;
  return partial ? `approximately ${text}` : text;
}
