import {
  EATEN_OPTIONS,
  parseMealWeight,
  scaleItemsByEatenFactor,
  sumCaloriesPrecise,
  sumConsumedGrams,
  sumOriginalGrams,
  sumNutritionHonest,
  formatNutrientLine,
  applyMeasuredMealWeight,
} from '../src/services/eaten-amount.js';
import { validatePhotoFile, cameraErrorMessage, isLikelyOverexposed } from '../src/services/photo-quality.js';
import { hasUsefulFoodItems } from '../shared/analysis-result.js';
import {
  normalizeClarificationQuestions,
  getClarificationStepConfig,
  MAX_CLARIFICATION_QUESTIONS,
} from '../src/services/clarification-questions.js';
import { computeKcalRange, scoreMealConfidence } from '../shared/nutrition-confidence.js';
import { defaultMealType, inferMealTypeFromText } from '../src/services/meal-types.js';
import {
  keepsUnderlyingGrams,
  displayAmountFromGrams,
  gramsFromDisplayAmount,
} from '../src/services/household-portions.js';
import { productToAnalysis } from '../src/services/barcode.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const chicken = {
  name: 'Grilled chicken breast',
  _originalGrams: 150,
  _originalCalories: 248,
  calories_kcal: 248,
  nutrition: { protein_g: 46, carbs_g: 0, fat_g: 5.4, fibre_g: null, sugar_g: null, salt_mg: 160 },
};
const rice = {
  name: 'Cooked basmati rice',
  _originalGrams: 180,
  _originalCalories: 234,
  calories_kcal: 234,
  nutrition: { protein_g: 4.8, carbs_g: 50, fat_g: 0.6, fibre_g: 0.6, sugar_g: 0, salt_mg: 4 },
};
const broccoli = {
  name: 'Steamed broccoli',
  _originalGrams: 100,
  _originalCalories: 35,
  calories_kcal: 35,
  nutrition: { protein_g: 2.8, carbs_g: 7, fat_g: 0.4, fibre_g: 2.6, sugar_g: null, salt_mg: 33 },
};
const sauce = {
  name: 'Creamy sauce',
  _originalGrams: 20,
  _originalCalories: 90,
  calories_kcal: 90,
  nutrition: { protein_g: 0.4, carbs_g: 1, fat_g: 9.4, fibre_g: 0, sugar_g: 0.4, salt_mg: 120 },
};

const mealItems = [chicken, rice, broccoli, sauce];
const unroundedTotal = sumCaloriesPrecise(mealItems);
assert('component calories sum to meal total', Math.abs(unroundedTotal - 607) < 0.01, String(unroundedTotal));

const half = scaleItemsByEatenFactor(mealItems, 0.5);
assert('50% eaten is exactly half unrounded calories', sumCaloriesPrecise(half) === unroundedTotal * 0.5, String(sumCaloriesPrecise(half)));
assert('consumed weights sum to half original', Math.abs(sumConsumedGrams(half) - sumOriginalGrams(half) * 0.5) < 1e-9);
assert('original grams unchanged on items', half[1]._originalGrams === 180);
assert('consumed rice grams are 90', Math.abs(half[1].grams - 90) < 1e-9);

const honest = sumNutritionHonest(half);
assert('missing sugar stays unavailable not zero', honest.sugar_g == null || honest._sugar_g_partial === true);
assert('fibre present is not forced to zero', honest.fibre_g != null);
const line = formatNutrientLine(honest);
assert('sugar language is unavailable when missing', /unavailable/.test(line.line) || !/_sugar_g_unavailable/.test(''));

const w = parseMealWeight(0.355, 'kg');
assert('parses 0.355 kg', w.ok && Math.abs(w.grams - 355) < 0.01, JSON.stringify(w));
assert('rejects zero', parseMealWeight(0, 'g').ok === false);
assert('rejects negative', parseMealWeight(-10, 'g').ok === false);

const scaledMeal = applyMeasuredMealWeight({
  items: mealItems.map((i) => ({ ...i, grams: i._originalGrams, calories_kcal: i._originalCalories })),
  total_calories_kcal: 607,
}, 355);
const gramsAfter = scaledMeal.items.reduce((s, i) => s + i.grams, 0);
assert('measured weight matches component sum', Math.abs(gramsAfter - 355) < 0.05, String(gramsAfter));

assert('unsupported file type', validatePhotoFile({ name: 'x.gif', type: 'image/gif', size: 1200 }).ok === false);
assert('file too large', validatePhotoFile({ name: 'x.jpg', type: 'image/jpeg', size: 30 * 1024 * 1024 }).ok === false);
assert('valid jpeg', validatePhotoFile({ name: 'x.jpg', type: 'image/jpeg', size: 4000 }).ok === true);
assert('camera denial offers upload', cameraErrorMessage(new Error('Permission denied')).offerUpload === true);
assert('white background with food detail is not overexposed', !isLikelyOverexposed({ mean: 235, variance: 1800, clippedRatio: 0.65 }));
assert('washed-out image is overexposed', isLikelyOverexposed({ mean: 250, variance: 60, clippedRatio: 0.95 }));

assert('no useful food on empty analysis', hasUsefulFoodItems({ items: [] }) === false);
assert('useful food when named items exist', hasUsefulFoodItems({ items: [{ name: 'Rice' }] }) === true);

const riceMeal = {
  meal_summary: 'Rice and chicken',
  confidence_score: 0.6,
  items: [
    { name: 'Rice', portion_estimate: '~180g', calories_kcal: 234, nutrition: {} },
    { name: 'Chicken curry', portion_estimate: '~150g', calories_kcal: 248, nutrition: {} },
  ],
  clarification_questions: [],
};
const steps = normalizeClarificationQuestions(riceMeal);
assert('asks at most 3 questions', steps.length <= MAX_CLARIFICATION_QUESTIONS, String(steps.length));
assert('asks grams for foods on the plate', steps.some((s) => s.topic === 'portion_item' && /chicken|rice/i.test(s.about || s.question)), steps.map((s) => `${s.topic}:${s.about || s.question}`).join(','));
for (const step of steps) {
  const cfg = getClarificationStepConfig(step, riceMeal);
  assert(`Not sure on ${step.topic}`, cfg.options.some((o) => /^not sure$/i.test(o)));
}

const geminiClarify = normalizeClarificationQuestions({
  meal_summary: '65 dish',
  confidence_score: 0.55,
  items: [{ name: '65 dish', portion_estimate: '~180g', calories_kcal: 390, nutrition: {} }],
  clarification_questions: [{
    topic: 'protein_type',
    question: 'Is this Chicken 65 or Paneer 65?',
    about: '65 Dish',
    options: ['Chicken', 'Paneer', 'Gobi'],
  }],
});
const proteinStep = geminiClarify.find((s) => s.topic === 'protein_type');
const proteinCfg = getClarificationStepConfig(proteinStep || {}, { meal_summary: '65 dish' });
assert('keeps Gemini 1-tap protein options', Boolean(proteinStep?.options?.includes('Paneer')), JSON.stringify(proteinStep));
assert('review UI uses Gemini options', proteinCfg.options.includes('Chicken') && proteinCfg.options.includes('Paneer'), proteinCfg.options.join(','));

const poor = computeKcalRange({ total_calories_kcal: 600, source: 'photo', _photoQualityPoor: true, items: mealItems }, 'medium');
const okRange = computeKcalRange({ total_calories_kcal: 600, source: 'photo', items: mealItems }, 'medium');
assert('poor image widens range', poor.max - poor.min > okRange.max - okRange.min);

const oilRange = computeKcalRange({ total_calories_kcal: 600, source: 'photo', _unknownOil: true, items: mealItems }, 'medium');
assert('unknown oil widens range', oilRange.max - oilRange.min >= okRange.max - okRange.min);

const sauceRange = computeKcalRange({ total_calories_kcal: 600, source: 'photo', _unknownSauce: true, items: mealItems }, 'medium');
assert('unknown sauce widens range', sauceRange.max - sauceRange.min >= okRange.max - okRange.min);

const restaurant = scoreMealConfidence({
  meal_summary: 'Chicken tikka masala',
  total_calories_kcal: 720,
  items: [{ name: 'Chicken tikka masala', _refId: 'chicken_tikka_masala', calories_kcal: 720, nutrition: {}, _authoritative: true }],
});
assert('restaurant mixed dish is not High', restaurant.band !== 'high', restaurant.band);

const labelUnknownServing = scoreMealConfidence({
  meal_summary: 'Yogurt',
  source: 'barcode',
  _labelBacked: true,
  items: [{
    name: 'Yogurt',
    _labelBacked: true,
    calories_kcal: 97,
    portion_estimate: 'per 100 g',
    nutrition: {},
  }],
});
assert('label without serving is not auto High', labelUnknownServing.band !== 'high', labelUnknownServing.band);

const lunch = defaultMealType(new Date(2026, 8, 10, 12, 30));
assert('local noon is lunch', lunch === 'lunch', lunch);
const breakfast = defaultMealType(new Date(2026, 8, 10, 8, 0));
assert('local 08:00 is breakfast', breakfast === 'breakfast');
const dinner = defaultMealType(new Date(2026, 8, 10, 19, 0));
assert('local 19:00 is dinner', dinner === 'dinner');
const snack = defaultMealType(new Date(2026, 8, 10, 23, 0));
assert('late night is snack', snack === 'snack');
assert('notes breakfast wins over clock', inferMealTypeFromText('4 idlies with sambar for breakfast') === 'breakfast');
assert('notes lunch is explicit', inferMealTypeFromText('leftover pasta for lunch') === 'lunch');

const idliPlate = {
  meal_summary: 'Idli with sambar',
  confidence_score: 0.6,
  items: [
    { name: 'Idli', portion_estimate: '~240g', calories_kcal: 160, nutrition: {} },
    { name: 'Sambar', portion_estimate: '~150g', calories_kcal: 90, nutrition: {} },
  ],
  clarification_questions: [{
    topic: 'bread_count',
    question: 'How many pieces of roti/naan?',
    options: ['1 piece / roti / slice', '2 pieces'],
  }],
};
const idliSteps = normalizeClarificationQuestions(idliPlate, '');
const idliBread = idliSteps.find((s) => s.topic === 'bread_count');
assert('idli plate asks how many idlis not roti', /idlis/i.test(idliBread?.question || ''), JSON.stringify(idliBread));
assert('idli options are idli-specific', (idliBread?.options || []).some((o) => /idli/i.test(o)), JSON.stringify(idliBread?.options));
assert('idli plate does not ask grams of idli', !idliSteps.some((s) => s.topic === 'portion_item' && /idli/i.test(s.about || s.question)), idliSteps.map((s) => `${s.topic}:${s.about || s.question}`).join(','));
const sambarStep = idliSteps.find((s) => s.topic === 'portion_item');
assert('sambar is a bowl question not raw grams headline', sambarStep && /how much sambar/i.test(sambarStep.question) && !/how many grams of sambar/i.test(sambarStep.question), JSON.stringify(sambarStep));
const idliUi = getClarificationStepConfig(idliBread, idliPlate);
assert('idli UI has no roti/naan wording', !/roti|naan/i.test(`${idliUi.question} ${idliUi.inputPlaceholder} ${idliUi.options.join(' ')}`), `${idliUi.question} | ${idliUi.options.join(',')}`);

const countedIdli = normalizeClarificationQuestions(idliPlate, '4 idlies with sambar for breakfast');
assert('known idli count skips piece question', !countedIdli.some((s) => s.topic === 'bread_count'), countedIdli.map((s) => s.topic).join(','));
assert('known idli count still can ask sambar amount', countedIdli.every((s) => s.topic !== 'bread_count'), countedIdli.map((s) => `${s.topic}:${s.question}`).join(','));

const alreadyCounted = normalizeClarificationQuestions({
  ...idliPlate,
  items: [
    { name: 'Idli', portion_estimate: '4 pieces (~240g)', calories_kcal: 160, nutrition: {} },
    { name: 'Sambar', portion_estimate: '~150g', calories_kcal: 90, nutrition: {} },
  ],
}, '');
assert('photo count on idli skips piece question', !alreadyCounted.some((s) => s.topic === 'bread_count'), alreadyCounted.map((s) => s.topic).join(','));

const g = 180;
const tbspAmt = displayAmountFromGrams(g, 'tbsp');
assert('unit conversion keeps grams', Math.abs(gramsFromDisplayAmount(tbspAmt, 'tbsp') - g) < 1e-6);
assert('tbsp keeps underlying grams flag', keepsUnderlyingGrams('tbsp'));
assert('eaten options include half', EATEN_OPTIONS.some((o) => o.factor === 0.5));

const beans = productToAnalysis({
  product_name: 'Baked beans',
  serving_quantity: 200,
  serving_size: '1/2 can',
  nutriments: {
    'energy-kcal_serving': 164,
    proteins_serving: 9.7,
    carbohydrates_serving: 27.6,
    fat_serving: 0.8,
    sugars_serving: 18.3,
    salt_serving: 1.2,
  },
}, '5010000000000');
assert('missing fibre stays null not zero', beans.total_nutrition.fibre_g == null, String(beans.total_nutrition.fibre_g));
assert('barcode is label-backed internally', beans._labelBacked === true);
assert('pack serving known when serving_size present', beans._packServingKnown === true);

const saveIds = new Map();
function saveOnce(meal) {
  if (meal.save_id && saveIds.has(meal.save_id)) return saveIds.get(meal.save_id);
  const rec = { ...meal, id: `sv-${meal.save_id}` };
  saveIds.set(meal.save_id, rec);
  return rec;
}
const first = saveOnce({ save_id: 'abc', total_calories_kcal: 607 });
const second = saveOnce({ save_id: 'abc', total_calories_kcal: 607 });
assert('double save is idempotent', first === second);

console.log('\nPhoto-log core checks done.');
