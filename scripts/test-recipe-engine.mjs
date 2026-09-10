import {
  lookupRecipeByText,
  resolveRecipeToItems,
  RECIPE_CATALOG_STATS,
} from '../shared/recipe-engine.js';
import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { getMealNovaFlags, resetMealNovaFlagsCache } from '../shared/feature-flags.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

resetMealNovaFlagsCache();
assert('recipe catalog loaded', RECIPE_CATALOG_STATS.count >= 20, `${RECIPE_CATALOG_STATS.count} recipes`);
assert('recipeEngine flag on', getMealNovaFlags().recipeEngine === true);

const fishChips = resolveMealFromText('fish and chips');
assert('fish and chips decomposes', fishChips.items.length >= 2, `${fishChips.items.length} items`);
assert('fish and chips has cod', fishChips.items.some((i) => /cod|fish/i.test(i.name)));
assert('fish and chips has chips', fishChips.items.some((i) => /chip/i.test(i.name)));
assert('fish and chips recipe derived', fishChips.items.every((i) => i._recipeDerived));
assert('fish and chips kcal band', fishChips.total_calories_kcal >= 900 && fishChips.total_calories_kcal <= 1400,
  `${fishChips.total_calories_kcal} kcal`);

const chole = resolveMealFromText('chole bhature');
assert('chole bhature 2 items', chole.items.length >= 2, `${chole.items.length} items`);
assert('chole bhature has chole', chole.items.some((i) => /chole|chana/i.test(i.name)));

const beans = resolveMealFromText('beans on toast');
assert('beans on toast 2 items', beans.items.length >= 2);
assert('beans on toast kcal', beans.total_calories_kcal >= 250 && beans.total_calories_kcal <= 450,
  `${beans.total_calories_kcal} kcal`);

const roast = resolveMealFromText('sunday roast');
assert('sunday roast 4+ items', roast.items.length >= 4, `${roast.items.length} items`);

const recipe = lookupRecipeByText('pav bhaji');
assert('lookup pav bhaji', recipe?.id === 'pav_bhaji');
const pavItems = resolveRecipeToItems(recipe);
assert('pav bhaji components', pavItems.length === 2);

const explicit = resolveMealFromText('180g battered cod, 250g chips');
assert('explicit grams skips recipe lump', explicit.items.length >= 2);
assert('explicit grams not all recipe derived', explicit.items.some((i) => !i._recipeDerived));

console.log('\nDone.');
