import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';
import {
  countToNutritionGrams,
  nutritionGramsFromParsed,
  parsePortionEstimate,
} from '../src/services/portion-units.js';
import { nutritionForAmount, resolvePer100ForItem } from '../shared/nutrition-density.js';

function assert(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
}

function reviewKcal(item) {
  const parsed = parsePortionEstimate(item.portion_estimate, item.name);
  const grams = item._hiddenGrams ?? nutritionGramsFromParsed(parsed, item.name);
  const per100 = resolvePer100ForItem(item);
  return nutritionForAmount(per100, grams).calories_kcal;
}

function itemHasGrams(item, grams) {
  const text = `${item.portion_estimate || ''} ${item.name || ''}`;
  return new RegExp(`\\b${grams}\\s*g\\b`, 'i').test(text) || item._hiddenGrams === grams;
}

function itemCount(item, n) {
  return /\bpieces?\b/i.test(item.portion_estimate || '') && parsePortionEstimate(item.portion_estimate, item.name).amount === n;
}

assert('2 eggs → ~116g piece weight', countToNutritionGrams(2, '2 boiled eggs') >= 110);
assert('1 banana → ~118g', countToNutritionGrams(1, 'medium banana') >= 110);

const eggsBanana = estimateMealFromDescription('2 large boiled eggs and 1 medium banana');
assert('eggs+banana produces 2 items', eggsBanana.items.length >= 2);
assert('eggs+banana total kcal plausible', eggsBanana.total_calories_kcal >= 230 && eggsBanana.total_calories_kcal <= 300);
const eggItem = eggsBanana.items.find((i) => /\begg/i.test(i.name || '')) || eggsBanana.items[0];
assert('eggs+banana review kcal plausible', reviewKcal(eggItem) >= 120);

const rice100 = estimateMealFromDescription('100g cooked rice');
assert('100g rice kcal', rice100.total_calories_kcal >= 110 && rice100.total_calories_kcal <= 170);
assert('100g rice portion preserved', itemHasGrams(rice100.items[0], 100));

const rice250 = estimateMealFromDescription('250g cooked rice');
assert('250g rice kcal', rice250.total_calories_kcal >= 280 && rice250.total_calories_kcal <= 420);

const fishChips = estimateMealFromDescription('180g battered cod, 250g chips, 80g mushy peas');
assert('fish+chips has 3 items', fishChips.items.length >= 3);
assert('cod keeps 180g', fishChips.items.some((i) => itemHasGrams(i, 180)));
assert('chips keeps 250g', fishChips.items.some((i) => itemHasGrams(i, 250)));
assert('fish+chips total kcal plausible', fishChips.total_calories_kcal >= 550);

const dosaPlate = estimateMealFromDescription('masala dosa + 150g potato masala + 100ml sambar + 30g chutney');
assert('dosa plate has 4 lines', dosaPlate.items.length >= 4);
assert('dosa plate total kcal plausible', dosaPlate.total_calories_kcal >= 350);
assert('sambar keeps 100ml', dosaPlate.items.some((i) => /100\s*ml/i.test(i.portion_estimate || '')));

const sushi = estimateMealFromDescription('8-piece salmon-avocado roll + 100g edamame + 15ml soy sauce');
assert('sushi plate has 3 items', sushi.items.length >= 3);
assert('sushi 8 pieces preserved', sushi.items.some((i) => itemCount(i, 8) || /8\s+pieces?/i.test(i.portion_estimate || '')));
assert('soy sauce present', sushi.items.some((i) => /soy/i.test(i.name)));
assert('sushi total kcal plausible', sushi.total_calories_kcal >= 350);

console.log('PASS | describe quantity regression tests');
console.log(`INFO | eggs+banana ${eggsBanana.total_calories_kcal} kcal`);
console.log(`INFO | fish+chips ${fishChips.total_calories_kcal} kcal`);
console.log(`INFO | dosa plate ${dosaPlate.total_calories_kcal} kcal`);
console.log(`INFO | sushi plate ${sushi.total_calories_kcal} kcal`);
console.log('Done.');
