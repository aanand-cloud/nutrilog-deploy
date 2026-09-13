/** Shared fields so scanned packs land on the same daily meal summary. */

import { digitsOnly, normalizeGtin } from './gtin.js';
import { scaleItemsByEatenFactor, sumCaloriesPrecise, sumConsumedGrams, sumNutritionHonest } from './eaten-amount.js';

export function barcodeFieldForMeal(analysis = {}) {
  const digits = digitsOnly(analysis.barcode);
  if (digits.length < 8) return null;
  return normalizeGtin(digits);
}

export function analysisToDailyMealFields(analysis = {}, extras = {}) {
  return {
    meal_summary: analysis.meal_summary,
    total_calories_kcal: Math.round(Number(analysis.total_calories_kcal) || 0),
    total_nutrition: analysis.total_nutrition,
    items: analysis.items,
    source: analysis.source || extras.source || 'barcode',
    barcode: barcodeFieldForMeal(analysis),
    confidence_score: analysis.confidence_score,
  };
}

const LIQUID_NAME_RE = /\b(water|juice|cola|soda|pop|milk|latte|coffee|tea|beer|wine|cider|smoothie|shake|lassi|kefir|kombucha|tonic|lemonade|squash|broth|soup|stock|oil|vinegar|syrup|cordial|nectar|espresso|americano|cappuccino|hot chocolate|energy drink|sports drink|protein shake|soft drink|yogurt drink|yoghurt drink|drink)\b/i;

function parseGrams(text = '') {
  const m = String(text).match(/(\d+(?:\.\d+)?)\s*g\b/i);
  return m ? Number(m[1]) : null;
}

function parseMl(text = '') {
  const raw = String(text || '');
  const ml = raw.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (ml) return Number(ml[1]);
  const cl = raw.match(/(\d+(?:\.\d+)?)\s*cl\b/i);
  if (cl) return Number(cl[1]) * 10;
  const litres = raw.match(/(\d+(?:\.\d+)?)\s*(?:l|litres?|liters?)\b/i);
  if (litres) return Number(litres[1]) * 1000;
  return null;
}

function unitLooksLiquid(unit = '') {
  return /^(ml|cl|l|litre|liter|fl\.?\s*oz)$/i.test(String(unit).trim());
}

/** Label-first: ml when the pack is a drink / liquid, otherwise grams. */
export function resolvePackagedServing(product = {}) {
  const servingSize = String(product.serving_size || '');
  const quantity = String(product.quantity || '');
  const name = String(product.product_name || '');
  const unitRaw = String(product.serving_quantity_unit || '').toLowerCase();
  const qty = Number(product.serving_quantity);
  const servingMl = parseMl(servingSize);
  const servingG = parseGrams(servingSize);
  const packMl = parseMl(quantity);
  const packG = parseGrams(quantity);

  let liquid = false;
  if (unitLooksLiquid(unitRaw)) liquid = true;
  else if (servingMl && !servingG) liquid = true;
  else if (servingG && !servingMl) liquid = false;
  else if (packMl && !packG) liquid = true;
  else if (packG && !packMl) liquid = false;
  else if (LIQUID_NAME_RE.test(name) && !servingG && !packG) liquid = true;

  if (liquid) {
    let amount = Number.isFinite(qty) && qty > 0 ? qty : null;
    if (amount && unitRaw === 'cl') amount *= 10;
    if (amount && /^(l|litre|liter)$/i.test(unitRaw) && amount <= 20) amount *= 1000;
    amount = amount || servingMl || packMl || 250;
    return { unit: 'ml', liquid: true, amount, label: `${Math.round(amount)} ml` };
  }

  const amount = (Number.isFinite(qty) && qty > 0 && !unitLooksLiquid(unitRaw) ? qty : null)
    || servingG
    || packG
    || 100;
  return { unit: 'g', liquid: false, amount, label: `${Math.round(amount)} g` };
}

export function packagedAmountUnit(analysis = {}) {
  if (analysis._amountUnit === 'ml' || analysis.items?.[0]?._displayUnit === 'ml') return 'ml';
  return 'g';
}

export function packagedServingAmount(analysis = {}) {
  const item = analysis.items?.[0] || {};
  if (Number(analysis._servingAmount) > 0) return Number(analysis._servingAmount);
  if (Number(item._volumeMl) > 0 && packagedAmountUnit(analysis) === 'ml') return Number(item._volumeMl);
  if (Number(item._originalGrams) > 0) return Number(item._originalGrams);
  const portion = item.portion_estimate || '';
  return parseMl(portion) || parseGrams(portion) || Number(item.grams) || 100;
}

export function packagedServingGrams(analysis = {}) {
  return packagedServingAmount(analysis);
}

export function packagedAmountChoices(analysis = {}) {
  const grams = packagedServingGrams(analysis);
  const kcal = Math.round(Number(analysis.total_calories_kcal) || 0);
  if (analysis._packServingKnown) {
    return [
      { id: 'serving', label: 'This serving', helper: `${Math.round(grams)} g · ${kcal} kcal`, factor: 1 },
      { id: 'half', label: 'About half', helper: `${Math.round(grams / 2)} g · ${Math.round(kcal / 2)} kcal`, factor: 0.5 },
      { id: 'custom', label: 'I’ll type the grams', helper: 'Use the pack or a scale', factor: null },
    ];
  }
  return [
    { id: 'serving', label: '100 g', helper: `As on a typical label · ${kcal} kcal`, factor: 1 },
    { id: 'half', label: '50 g', helper: `${Math.round(kcal / 2)} kcal`, factor: 0.5 },
    { id: 'custom', label: 'I’ll type the grams', helper: 'Use the pack or a scale', factor: null },
  ];
}

function baseItems(analysis = {}) {
  const fallbackGrams = packagedServingGrams(analysis);
  return (analysis.items || []).map((item, idx) => {
    const grams = Number(item._originalGrams) || parseGrams(item.portion_estimate) || Number(item.grams) || fallbackGrams;
    const calories = Number(item._originalCalories ?? item.calories_kcal) || 0;
    const nutrition = { ...(item._originalNutrition || item.nutrition || {}) };
    return {
      ...item,
      id: item.id || `pack-${idx}`,
      grams,
      _originalGrams: grams,
      _originalCalories: calories,
      _originalNutrition: { ...nutrition },
      calories_kcal: calories,
      nutrition,
    };
  });
}

export function applyPackagedAmount(analysis = {}, { amountId = 'serving', customGrams = null } = {}) {
  const items = baseItems(analysis);
  const baseGrams = packagedServingGrams({ ...analysis, items });
  let factor = 1;
  if (amountId === 'half') factor = 0.5;
  else if (amountId === 'custom') {
    const grams = Number(customGrams);
    if (!(grams > 0)) {
      throw new Error(packagedAmountUnit(analysis) === 'ml'
        ? 'Enter how many ml you had'
        : 'Enter how many grams you ate');
    }
    factor = grams / (baseGrams || grams);
  }
  const unit = packagedAmountUnit(analysis);
  const scaled = scaleItemsByEatenFactor(items, factor).map((item) => {
    const eaten = Number(item.grams) || 0;
    if (unit !== 'ml') return item;
    return {
      ...item,
      _displayUnit: 'ml',
      _volumeMl: eaten,
      portion_estimate: `Amount drunk: ${Math.round(eaten)} ml`,
    };
  });
  return {
    ...analysis,
    items: scaled,
    total_calories_kcal: Math.round(sumCaloriesPrecise(scaled)),
    total_nutrition: sumNutritionHonest(scaled),
    _amountUnit: unit,
    _eatenFactor: factor,
    _consumedGrams: sumConsumedGrams(scaled),
    _consumedAmount: sumConsumedGrams(scaled),
    _originalGrams: baseGrams,
    _servingAmount: baseGrams,
  };
}

export function isPackagedLogSource(source = '') {
  return source === 'barcode' || source === 'food_search';
}
