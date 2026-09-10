import { foodMealsOnly } from '../src/services/reports.js';
import { summarizeDayMeals } from '../src/services/meal-calendar.js';

const foodMeal = {
  date: '2026-08-31',
  meal_type: 'lunch',
  meal_summary: 'Chicken salad',
  total_calories_kcal: 420,
  total_nutrition: { protein_g: 30, carbs_g: 20, fat_g: 18 },
};

const supplementMeal = {
  date: '2026-08-31',
  meal_type: 'supplement',
  source: 'supplement',
  meal_summary: 'Vitamin D',
  total_calories_kcal: 0,
  total_nutrition: { protein_g: 0, carbs_g: 0, fat_g: 0 },
};

const mixed = [foodMeal, supplementMeal];
const filtered = foodMealsOnly(mixed);

const results = [];

function assert(label, pass, detail = '') {
  results.push({ label, pass, detail });
}

assert('foodMealsOnly drops supplements', filtered.length === 1 && filtered[0].meal_summary === 'Chicken salad');
assert('foodMealsOnly keeps food meals', foodMealsOnly([foodMeal]).length === 1);

assert(
  'Calendar summary uses food kcal only',
  summarizeDayMeals(filtered).calories_kcal === 420,
  `${summarizeDayMeals(filtered).calories_kcal} kcal`,
);

assert(
  'Supplement-only day has no food summary',
  !summarizeDayMeals(foodMealsOnly([supplementMeal])),
  summarizeDayMeals(foodMealsOnly([supplementMeal])) ? 'unexpected summary' : 'null as expected',
);

let passed = 0;
let failed = 0;
for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL';
  if (r.pass) passed += 1;
  else failed += 1;
  console.log(`${status} | ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
