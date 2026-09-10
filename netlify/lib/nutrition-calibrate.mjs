import {
  isEggItemName,
  nutritionForEggs,
  parseEggCount,
  parseEggCountFromItem,
  eggSummary,
  UK_MEDIUM_EGG_G,
} from '../../shared/nutrition-reference.js';
import { sanitizeAnalysisTotals } from '../../shared/nutrition-sanitize.js';
import { tightenPlateAnalysis } from '../../shared/plate-tighten.js';

function round1(v) {
  return Math.round(v * 10) / 10;
}

function countEggsInAnalysis(analysis = {}) {
  let count = 0;
  for (const item of analysis.items || []) {
    if (isEggItemName(`${item.name || ''} ${item.portion_estimate || ''}`)) {
      count += parseEggCountFromItem(item);
    }
  }
  if (count === 0 && isEggItemName(analysis.meal_summary || '')) {
    count = parseEggCount(analysis.meal_summary) || 1;
  }
  return count;
}

function hasSignificantNonEggItems(analysis = {}, eggCount = 0) {
  const items = analysis.items || [];
  if (!items.length) return false;
  const nonEgg = items.filter((item) => !isEggItemName(`${item.name || ''} ${item.portion_estimate || ''}`));
  return nonEgg.length > 0 && nonEgg.length >= items.length - eggCount;
}

/** Nudge AI estimates toward UK reference values when the meal is clearly eggs. */
function calibrateEggs(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis;

  const eggCount = countEggsInAnalysis(analysis);
  if (eggCount <= 0) return analysis;
  if (hasSignificantNonEggItems(analysis, eggCount)) return analysis;

  const expected = nutritionForEggs(eggCount);
  const current = analysis.total_nutrition || {};
  const currentKcal = Number(analysis.total_calories_kcal) || 0;
  const currentProtein = Number(current.protein_g) || 0;

  const proteinHigh = currentProtein > expected.protein_g * 1.2;
  const kcalHigh = currentKcal > expected.kcal * 1.25;
  const proteinLow = currentProtein > 0 && currentProtein < expected.protein_g * 0.6;
  const kcalLow = currentKcal > 0 && currentKcal < expected.kcal * 0.6;

  if (!proteinHigh && !kcalHigh && !proteinLow && !kcalLow) return analysis;

  const calibratedItems = (analysis.items || []).map((item) => {
    if (!isEggItemName(`${item.name || ''} ${item.portion_estimate || ''}`)) return item;
    const n = parseEggCountFromItem(item) || 1;
    const ref = nutritionForEggs(n);
    return {
      ...item,
      name: item.name || eggSummary(n),
      portion_estimate: item.portion_estimate || `${n} medium egg${n > 1 ? 's' : ''} (~${UK_MEDIUM_EGG_G * n}g)`,
      calories_kcal: ref.kcal,
      nutrition: {
        protein_g: ref.protein_g,
        carbs_g: ref.carbs_g,
        fat_g: ref.fat_g,
        fibre_g: ref.fibre_g,
        sugar_g: ref.sugar_g,
        salt_mg: ref.salt_mg,
      },
    };
  });

  return {
    ...analysis,
    meal_summary: analysis.meal_summary || eggSummary(eggCount),
    total_calories_kcal: expected.kcal,
    total_nutrition: expected,
    items: calibratedItems.length ? calibratedItems : analysis.items,
    _calibrated: true,
  };
}

/** Egg calibration + protein/macro sanity checks for all photo AI results. */
export function calibrateAnalysis(analysis) {
  return sanitizeAnalysisTotals(tightenPlateAnalysis(calibrateEggs(analysis)));
}
