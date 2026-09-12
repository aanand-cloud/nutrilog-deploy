import { matchFoodReference } from '../shared/nutrition-density.js';
import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';
import { lookupRecipeByText, RECIPE_CATALOG_STATS } from '../shared/recipe-engine.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const MATCHES = [
  ['Peri peri chicken', 'peri_peri_chicken'],
  ['Thai green curry', 'thai_green_curry'],
  ['Chicken karahi', 'chicken_karahi'],
  ['Palak paneer', 'palak_paneer'],
  ['Chilli con carne', 'chilli_con_carne'],
  ['Chicken nuggets', 'chicken_nuggets'],
  ['Fish fingers', 'fish_fingers'],
  ['Weetabix', 'weetabix'],
  ['Halloumi wrap', 'halloumi_wrap'],
  ['Tuna mayo sandwich', 'tuna_mayo_sandwich'],
];

for (const [name, expectedId] of MATCHES) {
  const ref = matchFoodReference(name);
  assert(`${name} → ${expectedId}`, ref?.id === expectedId, ref?.id || 'none');
}

assert('recipe catalog grew', RECIPE_CATALOG_STATS.count >= 35, `${RECIPE_CATALOG_STATS.count} recipes`);
assert('kebab and chips recipe', lookupRecipeByText('kebab and chips')?.id === 'kebab_and_chips');
assert('jollof rice and chicken recipe', lookupRecipeByText('jollof rice and chicken')?.id === 'jollof_and_chicken');
assert('thai green curry with rice recipe', lookupRecipeByText('thai green curry with rice')?.id === 'thai_green_curry_rice');

const jollof = estimateMealFromDescription('jollof rice and chicken');
assert('jollof plate decomposes', (jollof?.items?.length || 0) >= 2, `${jollof?.items?.length || 0} items`);
assert('jollof plate kcal', (jollof?.total_calories_kcal || 0) >= 500, `${jollof?.total_calories_kcal || 0} kcal`);

const jacket = estimateMealFromDescription('jacket potato with beans and cheese');
assert('jacket potato decomposes', (jacket?.items?.length || 0) >= 3, `${jacket?.items?.length || 0} items`);

console.log('\nDone.');
