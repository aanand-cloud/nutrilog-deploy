/**
 * Phase 3 — Mixed dishes and cooking logic acceptance gates.
 */

import { readFileSync } from 'node:fs';
import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import {
  PHASE3_TARGETS,
  withinPhase3Tolerance,
  parseCookingSourceFromAnswer,
  parseOilLevelFromAnswer,
} from '../shared/mixed-dish-cooking.js';
import { applyClarificationsLocally } from '../shared/clarification-apply.js';
import { RECIPE_CATALOG_STATS } from '../shared/recipe-engine.js';
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
assert('recipeEngine flag on', getMealNovaFlags().recipeEngine === true);
assert('mixedDishCooking flag on', getMealNovaFlags().mixedDishCooking === true);
assert('recipe catalog >= 20', RECIPE_CATALOG_STATS.count >= 20, `${RECIPE_CATALOG_STATS.count} recipes`);

const cases = JSON.parse(readFileSync('./scripts/benchmark/cases-phase3-mixed.json', 'utf8'));
const tolerancePct = cases.tolerancePct || 20;
let confirmedTotal = 0;
let confirmedPass = 0;

for (const tc of cases.cases) {
  const result = resolveMealFromText(tc.input);
  assert(`${tc.id} resolves`, Boolean(result?.items?.length), tc.input);

  if (tc.expectRecipeDerived) {
    const derived = result.items.filter((i) => i._recipeDerived).length;
    assert(`${tc.id} recipe derived`, derived >= (tc.minItems || 2), `${derived}/${result.items.length}`);
  }

  if (tc.minItems) {
    assert(`${tc.id} min items`, result.items.length >= tc.minItems, `${result.items.length}`);
  }

  if (Number.isFinite(tc.expectedKcal)) {
    confirmedTotal += 1;
    const ok = withinPhase3Tolerance(result.total_calories_kcal, tc.expectedKcal, tolerancePct);
    if (ok) confirmedPass += 1;
    assert(
      `${tc.id} kcal ±${tolerancePct}%`,
      ok,
      `${result.total_calories_kcal} vs ${tc.expectedKcal}`,
    );
  }
}

const passRate = confirmedTotal ? confirmedPass / confirmedTotal : 0;
assert(
  `Phase 3 gate ≥${Math.round(PHASE3_TARGETS.confirmedMixedDishesWithin20Pct * 100)}% within ±${tolerancePct}%`,
  passRate >= PHASE3_TARGETS.confirmedMixedDishesWithin20Pct,
  `${confirmedPass}/${confirmedTotal} (${Math.round(passRate * 100)}%)`,
);

// Accompaniment split phrases must decompose as one recipe plate
const splitCases = [
  { input: 'biryani with raita', minDerived: 2 },
  { input: 'idli with sambar', minDerived: 2 },
  { input: 'poha with peanuts', minDerived: 2 },
  { input: 'chicken tikka masala with rice', minDerived: 2 },
];
for (const sc of splitCases) {
  const r = resolveMealFromText(sc.input);
  const derived = r.items.filter((i) => i._recipeDerived).length;
  assert(`${sc.input} full-plate recipe`, derived >= sc.minDerived, `${derived} derived`);
  assert(`${sc.input} single phrase`, r._sourcePhrases?.length === 1, String(r._sourcePhrases?.length));
}

// Cooking source + oil clarify re-resolves recipe templates
const base = resolveMealFromText('chole bhature');
const clarified = applyClarificationsLocally(base, [
  { topic: 'meal_source', answer: 'Takeaway' },
  { topic: 'oil_fat', answer: 'Oily / restaurant-style' },
]);
assert(
  'clarify takeaway chole bhature increases kcal',
  clarified.total_calories_kcal > base.total_calories_kcal,
  `${base.total_calories_kcal} → ${clarified.total_calories_kcal}`,
);
assert('clarify re-resolves recipe', clarified.items.every((i) => i._recipeDerived));
assert('parse cooking source', parseCookingSourceFromAnswer('Takeaway') === 'takeaway');
assert('parse oil level', parseOilLevelFromAnswer('Oily / restaurant-style') === 'generous');

console.log('\nDone.');
