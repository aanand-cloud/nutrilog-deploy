import {
  macroKcalFromNutrition,
  reconcileItemKcalWithMacros,
  sanitizeAnalysisTotals,
} from '../shared/nutrition-sanitize.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('macroKcalFromNutrition', macroKcalFromNutrition({ protein_g: 25, carbs_g: 10, fat_g: 20 }) === 320, '320 kcal');

const drifted = reconcileItemKcalWithMacros({
  name: 'Mystery protein bowl',
  calories_kcal: 500,
  nutrition: { protein_g: 25, carbs_g: 10, fat_g: 20 },
});
assert('reconcileItemKcalWithMacros corrects drift', drifted.calories_kcal === 320, `${drifted.calories_kcal} kcal`);
assert('reconcileItemKcalWithMacros flags correction', drifted._kcalCorrected === true);

const ok = reconcileItemKcalWithMacros({
  name: 'Rice',
  calories_kcal: 130,
  nutrition: { protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
});
assert('reconcileItemKcalWithMacros keeps close kcal', ok.calories_kcal === 130);

const sanitized = sanitizeAnalysisTotals({
  meal_summary: 'Test plate',
  total_calories_kcal: 900,
  total_nutrition: { protein_g: 25, carbs_g: 10, fat_g: 20 },
  items: [{
    name: 'Mystery protein bowl',
    calories_kcal: 900,
    nutrition: { protein_g: 25, carbs_g: 10, fat_g: 20 },
  }],
});
assert('sanitizeAnalysisTotals aligns meal kcal', sanitized.total_calories_kcal === 320, `${sanitized.total_calories_kcal} kcal`);

console.log('\nDone.');
