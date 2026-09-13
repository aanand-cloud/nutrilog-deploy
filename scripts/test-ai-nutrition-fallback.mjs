import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';
import {
  applyAiEstimatePer100,
  applyDecomposedLookup,
  applyLowConfidenceNutritionResult,
  itemNeedsAiNutritionFallback,
  restoreStoredFallbackNutrition,
  sanitizeAiPer100,
} from '../shared/low-confidence-nutrition.js';
import { rebuildVisionReview } from '../shared/vision-review-adjust.js';
import { matchFoodReferenceDetailed } from '../shared/food-match-engine.js';
import { resetMealNovaFlagsCache, setMealNovaFlags } from '../shared/feature-flags.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

resetMealNovaFlagsCache();
setMealNovaFlags({ aiNutritionFallback: true });

const banana = composeAnalysisFromVision({
  meal_summary: 'Banana',
  confidence_score: 0.9,
  items: [{ name: 'Banana', unit: 'g', estimated_amount: 120, confidence: 0.92 }],
});
assert('banana does not need AI fallback', !itemNeedsAiNutritionFallback(banana.items[0], banana));
assert('banana stays official', banana.items[0]?._authoritative === true, banana.items[0]?._provenanceLabel);

const almonds = composeAnalysisFromVision({
  meal_summary: 'Almonds',
  confidence_score: 0.88,
  items: [{ name: 'roasted almonds', unit: 'g', estimated_amount: 30, confidence: 0.8 }],
});
assert('almonds match almonds', matchFoodReferenceDetailed('roasted almonds').ref?.id === 'almonds');
assert('almonds official overlay', almonds.items[0]?._refId === 'almonds' && almonds.items[0]?._authoritative === true, almonds.items[0]?._refId);
assert('almonds do not need AI fallback', !itemNeedsAiNutritionFallback(almonds.items[0], almonds));

const unknown = composeAnalysisFromVision({
  meal_summary: 'Mystery regional stew',
  confidence_score: 0.5,
  items: [{
    name: 'Unusual stew xyz123',
    unit: 'g',
    estimated_amount: 200,
    cooking_method: 'unknown',
    confidence: 0.4,
  }],
});
const mystery = unknown.items[0];
assert('unknown food still uses local fallback first', mystery?._nutritionFallback === true);
assert('unknown food needs AI fallback', itemNeedsAiNutritionFallback(mystery, unknown) === true);

const decomposed = applyDecomposedLookup(mystery, [
  { name: 'chicken', grams: 80, usda_search_term: 'chicken, cooked' },
  { name: 'basmati rice', grams: 120, usda_search_term: 'rice, white, cooked' },
]);
assert('decompose looks up parts', Boolean(decomposed) && decomposed._aiDecomposed === true, decomposed?._provenanceLabel);
assert('decompose not the 130 kcal blob', decomposed?.calories_kcal > 200, String(decomposed?.calories_kcal));
assert('decompose not labelled verified catalog write', decomposed?._nutritionSource !== 'verified');

const ai = applyAiEstimatePer100(mystery, {
  kcal: 160,
  protein_g: 8,
  carbs_g: 12,
  fat_g: 8,
  fibre_g: 0,
});
assert('AI estimate labelled', ai?._nutritionSource === 'ai_estimate' && ai?._aiNutritionFallback === true);
assert('AI fibre 0 stays unavailable', ai?.nutrition?.fibre_g == null);
assert('AI kcal scales to 200 g', ai?.calories_kcal === 320, String(ai?.calories_kcal));
assert('bad AI per100 rejected', sanitizeAiPer100({ kcal: 12, protein_g: 1, carbs_g: 1, fat_g: 0 }) == null);

const preferParts = applyLowConfidenceNutritionResult(mystery, {
  components: [
    { name: 'chicken', grams: 80 },
    { name: 'basmati rice', grams: 120 },
  ],
  per100: { kcal: 900, protein_g: 10, carbs_g: 10, fat_g: 80 },
});
assert('parts beat whole-dish AI guess', preferParts?._aiDecomposed === true && !preferParts._aiNutritionFallback);

const rebuilt = rebuildVisionReview(unknown, [{
  ...ai,
  name: mystery.name,
  _hiddenGrams: 250,
  _visionMeta: { ...mystery._visionMeta, amount: 250 },
}], 0);
const rebuiltItem = rebuilt.items.find((item) => item.name === mystery.name);
assert('review keeps AI estimate after gram change', rebuiltItem?._nutritionSource === 'ai_estimate', rebuiltItem?._nutritionSource);
assert('review rescales AI kcal', rebuiltItem?.calories_kcal === 400, String(rebuiltItem?.calories_kcal));

const restored = restoreStoredFallbackNutrition({ ...mystery, _hiddenGrams: 100 }, ai);
assert('restore uses stored AI per100', restored?._nutritionSource === 'ai_estimate' && restored?.calories_kcal === 160);

setMealNovaFlags({ aiNutritionFallback: false });
assert('flag off skips AI', itemNeedsAiNutritionFallback(mystery, unknown) === false);
resetMealNovaFlagsCache();

console.log('\nDone.');
