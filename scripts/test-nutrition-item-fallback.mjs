import {
  applyItemDishRename,
  countEstimateItemsAfterFallback,
  isPhotoScanAnalysis,
  listEstimateItemEntries,
  needsP1FallbackUi,
  suggestDishNamesForItem,
} from '../shared/nutrition-item-fallback.js';
import { getItemNutritionTrust } from '../shared/nutrition-item-trust.js';
import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const weakPlate = composeAnalysisFromVision({
  meal_summary: 'Mixed plate',
  confidence_score: 0.62,
  items: [
    { name: 'Chicken curry', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.82 },
    { name: 'Mystery stew', unit: 'g', estimated_amount: 200, cooking_method: 'unknown', visible_oil: false, confidence: 0.55 },
    { name: 'Side veg', unit: 'g', estimated_amount: 80, cooking_method: 'steamed', visible_oil: false, confidence: 0.58 },
  ],
  clarification_questions: [],
});

const barcodePlate = {
  source: 'barcode',
  items: [{ name: 'Cereal', calories_kcal: 200, nutrition: { protein_g: 5, carbs_g: 30, fat_g: 4 } }],
};

assert('photo scan detected', isPhotoScanAnalysis(weakPlate));
assert('barcode skips fallback ui', !needsP1FallbackUi(barcodePlate));
assert('weak plate shows fallback ui', needsP1FallbackUi(weakPlate));

const entries = listEstimateItemEntries(weakPlate);
assert('lists estimate items', entries.length >= 1, `${entries.length} entries`);
assert('includes mystery stew', entries.some(({ item }) => /mystery stew/i.test(item.name)));

const suggestions = suggestDishNamesForItem('Mystery stew');
assert('suggests dishes for vague name', suggestions.length >= 1, suggestions.map((s) => s.label).join(', '));
assert('suggestions have ref ids', suggestions.every((s) => s.refId && s.label));

const mysteryEntry = entries.find(({ item }) => /mystery stew/i.test(item.name));
const renamed = applyItemDishRename(weakPlate, mysteryEntry.index, suggestions[0]);
assert(
  'rename improves trust',
  getItemNutritionTrust(renamed.items[mysteryEntry.index], renamed) === 'matched',
);
assert(
  'estimate count drops',
  countEstimateItemsAfterFallback(renamed) < countEstimateItemsAfterFallback(weakPlate),
  `${countEstimateItemsAfterFallback(weakPlate)} → ${countEstimateItemsAfterFallback(renamed)}`,
);

const typed = applyItemDishRename(weakPlate, mysteryEntry.index, 'Dal tadka');
assert('typed rename matches database', getItemNutritionTrust(typed.items[mysteryEntry.index], typed) === 'matched');

console.log('\nDone.');
