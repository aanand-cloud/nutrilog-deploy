import { productToAnalysis } from '../src/services/barcode.js';
import { sanitizeAnalysisTotals } from '../shared/nutrition-sanitize.js';

const results = [];

function assert(label, pass, detail = '') {
  results.push({ label, pass, detail });
}

const ukYogurt = productToAnalysis({
  product_name: 'Greek style yogurt',
  brands: 'Test Brand',
  serving_size: '1 pot (150g)',
  serving_quantity: 150,
  nutriments: {
    'energy-kcal_serving': 146,
    'energy-kcal_100g': 97,
    proteins_serving: 9.5,
    proteins_100g: 6.3,
    carbohydrates_serving: 12.4,
    carbohydrates_100g: 8.3,
    fat_serving: 6.0,
    fat_100g: 4.0,
    sugars_serving: 11.2,
    sugars_100g: 7.5,
    salt_serving: 0.15,
    salt_100g: 0.1,
    fiber_serving: 0,
    fiber_100g: 0,
  },
}, '5000159407236');

assert(
  'Uses per-serving kcal from label',
  ukYogurt.total_calories_kcal === 146,
  `${ukYogurt.total_calories_kcal} kcal`,
);
assert(
  'Uses per-serving protein from label',
  ukYogurt.total_nutrition.protein_g === 9.5,
  `${ukYogurt.total_nutrition.protein_g}g protein`,
);
assert(
  'Uses per-serving sugar from label',
  ukYogurt.total_nutrition.sugar_g === 11.2,
  `${ukYogurt.total_nutrition.sugar_g}g sugar`,
);
assert(
  'Converts per-serving salt (g) to mg',
  ukYogurt.total_nutrition.salt_mg === 150,
  `${ukYogurt.total_nutrition.salt_mg}mg salt`,
);
assert(
  'Not recalibrated to generic food ref',
  !ukYogurt.items[0]._refId,
  ukYogurt.items[0]._refId || 'no ref',
);

const beans = productToAnalysis({
  product_name: 'Baked beans',
  brands: 'Heinz',
  serving_size: '1/2 can (200g)',
  serving_quantity: 200,
  nutriments: {
    'energy-kcal_serving': 164,
    proteins_serving: 9.7,
    carbohydrates_serving: 27.6,
    fat_serving: 0.8,
    sugars_serving: 18.3,
    salt_serving: 1.2,
  },
}, '5010000000000');

assert(
  'Beans kcal matches serving label',
  beans.total_calories_kcal === 164,
  `${beans.total_calories_kcal} kcal`,
);
assert(
  'Beans salt matches label (1.2g → 1200mg)',
  beans.total_nutrition.salt_mg === 1200,
  `${beans.total_nutrition.salt_mg}mg`,
);

const per100Only = productToAnalysis({
  product_name: 'Plain rice cakes',
  brands: 'Snacks Co',
  serving_size: '1 cake (7g)',
  serving_quantity: 7,
  nutriments: {
    'energy-kcal_100g': 387,
    proteins_100g: 8.5,
    carbohydrates_100g: 81,
    fat_100g: 2.8,
    sugars_100g: 0.5,
    salt_100g: 0.02,
  },
}, '1234567890123');

assert(
  'Falls back to per-100g × serving when no _serving fields',
  per100Only.total_calories_kcal === 27,
  `${per100Only.total_calories_kcal} kcal (387 × 0.07)`,
);
assert(
  'Per-100g fallback protein scaled to serving',
  per100Only.total_nutrition.protein_g === 0.6,
  `${per100Only.total_nutrition.protein_g}g`,
);

const sanitized = sanitizeAnalysisTotals({
  source: 'barcode',
  barcode: '5010000000000',
  meal_summary: 'Chicken soup',
  total_calories_kcal: 120,
  total_nutrition: { protein_g: 8, carbs_g: 10, fat_g: 4, sugar_g: 2, salt_mg: 800 },
  items: [{
    name: 'Chicken soup — Brand',
    portion_estimate: '1 pot (300g)',
    calories_kcal: 120,
    nutrition: { protein_g: 8, carbs_g: 10, fat_g: 4, sugar_g: 2, salt_mg: 800 },
    _labelBacked: true,
  }],
});

assert(
  'Sanitize keeps label kcal (no generic chicken recalibration)',
  sanitized.total_calories_kcal === 120,
  `${sanitized.total_calories_kcal} kcal`,
);
assert(
  'Sanitize keeps label protein',
  sanitized.total_nutrition.protein_g === 8,
  `${sanitized.total_nutrition.protein_g}g`,
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
