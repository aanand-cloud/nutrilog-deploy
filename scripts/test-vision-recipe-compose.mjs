import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';
import { decomposeVisionWithRecipes, stubsCoverRecipe } from '../shared/vision-recipe-compose.js';
import { getMealNovaFlags } from '../shared/feature-flags.js';
import { lookupRecipeByText } from '../shared/recipe-engine.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('recipeEngine flag on', getMealNovaFlags().recipeEngine === true);
assert('visionSecondPass flag on', getMealNovaFlags().visionSecondPass === true);

const fishVision = {
  meal_summary: 'Fish and chips',
  confidence_score: 0.84,
  items: [{
    name: 'Fish and chips',
    unit: 'g',
    estimated_amount: 430,
    cooking_method: 'deep_fried',
    visible_oil: true,
    confidence: 0.82,
  }],
  clarification_questions: [],
};

const fishComposed = composeAnalysisFromVision(fishVision);
assert('fish and chips decomposes to 2+ items', fishComposed.items.length >= 2, `${fishComposed.items.length} items`);
assert('fish and chips recipe derived', fishComposed._recipeDecomposed === true);
assert('fish and chips kcal realistic', fishComposed.total_calories_kcal > 900, `${fishComposed.total_calories_kcal} kcal`);
assert('includes cod/chips names', fishComposed.items.some((i) => /cod|chip/i.test(i.name)), fishComposed.items.map((i) => i.name).join(', '));

const roastVision = {
  meal_summary: 'Sunday roast',
  confidence_score: 0.8,
  items: [{ name: 'Roast dinner', unit: 'g', estimated_amount: 490, cooking_method: 'grilled', visible_oil: false, confidence: 0.78 }],
  clarification_questions: [],
};
const roastComposed = composeAnalysisFromVision(roastVision);
assert('sunday roast decomposes', roastComposed.items.length >= 4, `${roastComposed.items.length} items`);

const splitCurry = {
  meal_summary: 'Chicken curry with rice',
  confidence_score: 0.86,
  items: [
    { name: 'Chicken curry', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.9 },
    { name: 'Steamed rice', unit: 'g', estimated_amount: 150, cooking_method: 'steamed', visible_oil: false, confidence: 0.88 },
  ],
  clarification_questions: [],
};
const splitComposed = composeAnalysisFromVision(splitCurry);
assert('already split curry+rce stays 2 items', splitComposed.items.length === 2, `${splitComposed.items.length} items`);
assert('split plate not recipe lump', !splitComposed._recipeDecomposed || splitComposed.items.every((i) => !i._recipeDerived));

const recipe = lookupRecipeByText('fish and chips');
const stubs = [{ name: 'Fish and chips', _visionMeta: { unit: 'g', amount: 430 } }];
assert('stubsCoverRecipe false for single lump', !stubsCoverRecipe(stubs, recipe));
const decomposed = decomposeVisionWithRecipes(stubs, fishVision);
assert('decomposeVisionWithRecipes returns items', decomposed.decomposed === true && decomposed.recipeItems.length >= 2);

console.log('\nDone.');
