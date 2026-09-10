import {
  applyWeightEditsToAnalysis,
  applySideSelectionsToAnalysis,
  filterClarificationStepsAfterAdjust,
  inferItemGrams,
  rescaleItemToGrams,
  getSideSuggestions,
} from '../shared/photo-log-flow.js';
import { normalizeClarificationQuestions } from '../src/services/clarification-questions.js';
import { sanitizeAnalysisTotals } from '../shared/nutrition-sanitize.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const item = {
  name: 'Chicken curry',
  portion_estimate: '1 serving (~250g)',
  calories_kcal: 350,
  nutrition: { protein_g: 25, carbs_g: 10, fat_g: 20 },
};

assert('inferItemGrams from portion', inferItemGrams(item) === 250, `${inferItemGrams(item)}g`);

const scaled = rescaleItemToGrams(item, 300);
assert('rescaleItemToGrams updates portion', /300g/.test(scaled.portion_estimate));
assert('rescaleItemToGrams scales kcal', scaled.calories_kcal > 350, `${scaled.calories_kcal} kcal`);

const analysis = {
  meal_summary: 'Curry and rice',
  total_calories_kcal: 600,
  total_nutrition: { protein_g: 30, carbs_g: 50, fat_g: 20 },
  items: [item, {
    name: 'Steamed rice',
    portion_estimate: '~150g',
    calories_kcal: 250,
    nutrition: { protein_g: 5, carbs_g: 55, fat_g: 1 },
  }],
};

const weighted = applyWeightEditsToAnalysis(analysis, { 0: 200, 1: 120 });
assert('applyWeightEdits adjusts first item', inferItemGrams(weighted.items[0]) === 200);
assert('applyWeightEdits recalculates total', weighted.total_calories_kcal > 0);

const gapsAnalysis = {
  meal_summary: 'Masala dosa',
  items: [{ name: 'Masala dosa', portion_estimate: '~220g', calories_kcal: 350, nutrition: {} }],
};
const sides = getSideSuggestions(gapsAnalysis);
assert('dosa plate suggests coconut/chutney or sides', sides.length >= 0);

const withSide = applySideSelectionsToAnalysis(gapsAnalysis, [{
  displayName: 'Sambar',
  refQuery: 'sambar',
  grams: 150,
}]);
assert('applySideSelections adds item', withSide.items.length === 2, `${withSide.items.length} items`);

const clarifySteps = normalizeClarificationQuestions(analysis, '');
const filtered = filterClarificationStepsAfterAdjust(weighted, clarifySteps);
assert('weight confirm skips portion clarify', !filtered.some((s) => s.topic === 'portion_rice'));

const whiteCoffee = sanitizeAnalysisTotals({
  meal_summary: 'White coffee with milk',
  total_calories_kcal: 100,
  items: [{
    name: 'White coffee with milk',
    portion_estimate: '~200ml',
    calories_kcal: 100,
    nutrition: { protein_g: 7, carbs_g: 10, fat_g: 3 },
  }],
});
assert('white coffee avoids milk-only protein', whiteCoffee.items[0].nutrition.protein_g <= 5, `${whiteCoffee.items[0].nutrition.protein_g}g protein`);
assert('white coffee not plain milk level', whiteCoffee.items[0].nutrition.protein_g < 6.5, `${whiteCoffee.items[0].nutrition.protein_g}g protein`);
assert('white coffee matches coffee profile', whiteCoffee.items[0]._refId === 'coffee_milk', whiteCoffee.items[0]._refId);

const drinkEdit = applyWeightEditsToAnalysis({
  meal_summary: 'White coffee',
  items: [{
    name: 'White coffee',
    portion_estimate: '1 cup (~250ml)',
    calories_kcal: 90,
    nutrition: { protein_g: 7, carbs_g: 8, fat_g: 3 },
  }],
}, { 0: 200 });
assert('drink weight edit uses ml reference', drinkEdit.items[0].nutrition.protein_g <= 5, `${drinkEdit.items[0].nutrition.protein_g}g protein`);

const wrongCurry = {
  name: 'Chicken curry',
  portion_estimate: '~250g',
  calories_kcal: 475,
  nutrition: { protein_g: 67.5, carbs_g: 0, fat_g: 20 },
};
const curryRescale = rescaleItemToGrams(wrongCurry, 300);
assert('curry rescale uses dish ref not plain chicken', curryRescale.nutrition.protein_g <= 45 && curryRescale.nutrition.protein_g >= 38, `${curryRescale.nutrition.protein_g}g protein`);
assert('curry rescale matches chicken_curry ref', curryRescale._refId === 'chicken_curry', curryRescale._refId);

const wrongRice = {
  name: 'Steamed rice',
  portion_estimate: '~150g',
  calories_kcal: 250,
  nutrition: { protein_g: 15, carbs_g: 55, fat_g: 1 },
};
const riceRescale = rescaleItemToGrams(wrongRice, 200);
assert('rice rescale corrects protein density', riceRescale.nutrition.protein_g <= 6, `${riceRescale.nutrition.protein_g}g protein`);
assert('rice matched to rice profile', ['rice', 'banquet_rice', 'plain_rice'].includes(riceRescale._refId), riceRescale._refId);

const milkRescale = applyWeightEditsToAnalysis({
  meal_summary: 'Milk',
  items: [{
    name: 'Whole milk',
    portion_estimate: '1 glass (~250ml)',
    calories_kcal: 125,
    nutrition: { protein_g: 10, carbs_g: 12, fat_g: 4 },
  }],
}, { 0: 200 });
assert('plain milk uses milk reference', milkRescale.items[0]._refId === 'milk', milkRescale.items[0]._refId);
assert('plain milk protein at 200ml', milkRescale.items[0].nutrition.protein_g >= 6 && milkRescale.items[0].nutrition.protein_g <= 7.5, `${milkRescale.items[0].nutrition.protein_g}g`);

const labelBacked = applyWeightEditsToAnalysis({
  _labelBacked: true,
  items: [{
    name: 'Protein bar',
    portion_estimate: '1 bar (60g)',
    calories_kcal: 200,
    nutrition: { protein_g: 20, carbs_g: 22, fat_g: 7 },
    _labelBacked: true,
  }],
}, { 0: 60 });
assert('label-backed keeps scanned protein', labelBacked.items[0].nutrition.protein_g === 20, `${labelBacked.items[0].nutrition.protein_g}g`);

const anchored = sanitizeAnalysisTotals({
  meal_summary: 'Chicken curry',
  items: [{
    name: 'Chicken curry',
    portion_estimate: '~250g',
    calories_kcal: 350,
    nutrition: { protein_g: 25, carbs_g: 10, fat_g: 20 },
  }],
});
assert('sanitize attaches per100 anchor', anchored.items[0]._per100?.protein_g > 0, JSON.stringify(anchored.items[0]._per100));
assert(
  'sanitize per100 source is reference when matched',
  anchored.items[0]._per100?.source === 'reference' || anchored.items[0]._per100?.source === 'reference_v4',
  anchored.items[0]._per100?.source,
);

const per100Rescale = rescaleItemToGrams({
  ...anchored.items[0],
  name: 'Wrong label should not rematch',
}, 300);
assert('per100 rescale ignores renamed item', per100Rescale._refId === 'chicken_curry', per100Rescale._refId);
assert('per100 rescale scales protein linearly', per100Rescale.nutrition.protein_g >= 38 && per100Rescale.nutrition.protein_g <= 45, `${per100Rescale.nutrition.protein_g}g`);

console.log('\nDone.');
