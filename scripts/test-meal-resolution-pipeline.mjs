import { resolveMealFromText, resolvePhraseToItem } from '../shared/meal-resolution-pipeline.js';
import { parseQuantityFromText } from '../shared/quantity-parser.js';
import { scoreMealConfidence } from '../shared/nutrition-confidence.js';
import { getMealNovaFlags, resetMealNovaFlagsCache } from '../shared/feature-flags.js';
import { estimatedKcalFromMacros, sodiumMgToSaltMg } from '../shared/canonical-food-model.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

resetMealNovaFlagsCache();
assert('unified pipeline flag default on', getMealNovaFlags().unifiedMealPipeline === true);

const fish = resolveMealFromText('180g battered cod, 250g chips, 80g mushy peas');
assert('fish+chips 3 items', fish.items.length >= 3, `${fish.items.length} items`);
assert('fish+chips not incomplete', fish._mealStatus !== 'incomplete', fish._mealStatus);
assert('fish+chips kcal plausible', fish.total_calories_kcal >= 500, `${fish.total_calories_kcal} kcal`);

const chapati = resolveMealFromText('2 chapatis, 200g dal and 150g vegetable curry');
assert('thali 3 items', chapati.items.length >= 3);
assert('thali has dal', chapati.items.some((i) => /dal/i.test(i.name)));

const tikka = resolveMealFromText('chicken tikka masala with basmati rice');
assert('tikka+r 2 items', tikka.items.length >= 2);

const eggs = parseQuantityFromText('2 large boiled eggs');
const eggItem = resolvePhraseToItem('2 large boiled eggs', { phrase: '2 large boiled eggs', ...eggs });
assert('egg quantity preserved', eggs.quantity === 2 && eggs.size === 'large');
assert('egg item has kcal', eggItem.calories_kcal > 50);

const scored = scoreMealConfidence(fish);
assert('confidence band assigned', ['high', 'medium', 'low'].includes(scored.band), scored.band);

assert('sodium to salt conversion', sodiumMgToSaltMg(400) === 1000);
assert('atwater with fibre', estimatedKcalFromMacros({ protein_g: 10, carbs_g: 10, fat_g: 5, fibre_g: 5 }) === 135);

const unmatched = resolveMealFromText('xyzzy unknown food 999');
assert('unknown food unmatched not zero-complete', unmatched.items.some((i) => i._unmatched));

console.log('\nDone.');
