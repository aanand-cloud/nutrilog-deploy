import {
  validateMealAnalysis,
  applyMealValidation,
  sanitizeAnalysisTotals,
} from '../shared/nutrition-sanitize.js';
import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const incomplete = validateMealAnalysis(
  {
    items: [{ name: 'Rice', calories_kcal: 180, nutrition: { protein_g: 4, carbs_g: 40, fat_g: 1 } }],
  },
  {
    sourceText: '200g dal, 150g vegetable curry, 2 chapatis',
  },
);
assert('detects missing phrase items', !incomplete.complete, incomplete.issues.map((i) => i.code).join(', '));
assert('incomplete status', incomplete.status === 'incomplete');

const unmatched = validateMealAnalysis(
  {
    items: [
      { name: 'Mystery chutney', calories_kcal: 0, _unmatched: true },
      { name: 'Rice', calories_kcal: 180, nutrition: { protein_g: 4, carbs_g: 40, fat_g: 1 } },
    ],
  },
  { sourceText: 'mystery chutney, rice' },
);
assert('flags unmatched items', unmatched.issues.some((i) => i.code === 'unmatched_items'));

const drift = validateMealAnalysis({
  total_calories_kcal: 500,
  total_nutrition: { protein_g: 25, carbs_g: 10, fat_g: 20 },
  items: [{
    name: 'Protein bowl',
    calories_kcal: 500,
    nutrition: { protein_g: 25, carbs_g: 10, fat_g: 20 },
  }],
});
assert('warns on meal macro drift', drift.warnings.some((w) => w.code === 'meal_macro_drift'));

const applied = applyMealValidation(
  { items: [{ name: 'Rice', calories_kcal: 180, nutrition: { protein_g: 4, carbs_g: 40, fat_g: 1 } }] },
  { sourceText: '200g rice, 150g curry' },
);
assert('applyMealValidation attaches metadata', applied._mealIncomplete === true && applied._mealStatus === 'incomplete');

const voice = estimateMealFromDescription('180g battered cod, 250g chips, 80g mushy peas');
assert('voice describe passes validation metadata', voice._mealValidation?.complete === true, voice._mealStatus);
assert('voice describe keeps 3 items', voice.items.length >= 3);

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
assert('sanitize still reconciles kcal', sanitized.total_calories_kcal === 320, `${sanitized.total_calories_kcal} kcal`);
assert('sanitize attaches validation', sanitized._mealValidation != null);

console.log('\nDone.');
