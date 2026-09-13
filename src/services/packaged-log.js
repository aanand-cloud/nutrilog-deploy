/** Shared fields so scanned packs land on the same daily meal summary. */

import { digitsOnly, normalizeGtin } from './gtin.js';

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
