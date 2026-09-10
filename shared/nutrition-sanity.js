/**
 * Phase 2 — nutrition sanity checks (flag only; never overwrite verified data).
 */

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

const VEGETABLE_RE = /\b(?:carrot|broccoli|spinach|lettuce|cucumber|tomato|pepper|onion|cauliflower|cabbage|salad|vegetable)\b/i;
const OIL_RE = /\b(?:oil|ghee|butter|olive|sunflower|vegetable oil)\b/i;
const RICE_RE = /\b(?:rice|basmati|chawal)\b/i;
const CURRY_RE = /\b(?:curry|masala|korma|tikka|bhuna|dal|gravy)\b/i;

/**
 * @param {object} item
 * @returns {object[]} warnings
 */
export function sanityCheckItem(item = {}) {
  const warnings = [];
  const kcal100 = num(item._per100?.kcal ?? item._canonical?.kcal100);
  const refId = String(item._refId || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  const blob = `${refId} ${name}`;

  if (refId === 'oats' && kcal100 > 0 && kcal100 < 300) {
    warnings.push({
      code: 'dry_oats_low_density',
      message: `Dry oats at ${kcal100} kcal/100 g looks too low (expected ~350–390).`,
    });
  }

  if ((OIL_RE.test(blob) || refId.includes('oil')) && kcal100 > 0 && kcal100 < 800) {
    warnings.push({
      code: 'oil_low_density',
      message: `Oil/fat at ${kcal100} kcal/100 g looks too low (expected ~800+).`,
    });
  }

  if (VEGETABLE_RE.test(blob) && kcal100 > 200) {
    warnings.push({
      code: 'vegetable_high_density',
      message: `"${item.name}" at ${kcal100} kcal/100 g looks high for a plain vegetable.`,
    });
  }

  if (RICE_RE.test(blob) && !/\bfried\b|\bbiryani\b/.test(blob) && kcal100 > 180) {
    warnings.push({
      code: 'cooked_rice_high_density',
      message: `Cooked rice at ${kcal100} kcal/100 g looks implausible (expected ~110–160).`,
    });
  }

  if (CURRY_RE.test(blob) && kcal100 > 0 && num(item.nutrition?.salt_mg) > 0 && num(item.nutrition?.salt_mg) < 50
    && num(item._hiddenGrams) >= 150) {
    warnings.push({
      code: 'curry_near_zero_salt',
      message: `"${item.name}" salt looks suspiciously low for a restaurant-style curry.`,
    });
  }

  if (item._refId && !item._unmatched && num(item.calories_kcal) <= 0) {
    warnings.push({
      code: 'zero_kcal_match',
      message: `"${item.name}" matched but has zero calories.`,
    });
  }

  return warnings;
}

/**
 * @param {object} analysis
 */
export function sanityCheckMeal(analysis = {}) {
  const warnings = [];
  for (const item of analysis.items || []) {
    warnings.push(...sanityCheckItem(item));
  }
  return warnings;
}
