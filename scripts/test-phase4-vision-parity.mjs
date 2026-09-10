/**
 * Phase 4 — Photo/vision pipeline parity with Describe Phase 1–3 guarantees.
 */

import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';
import {
  applyDeterministicAccompanimentFill,
  detectMissingAccompaniments,
} from '../shared/vision-accompaniment-pass.js';
import { scoreMealConfidence } from '../shared/nutrition-confidence.js';
import { getVerifiedRecord } from '../shared/verified-nutrition.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

function idliKcal(count, gramsEach = 60) {
  const verified = getVerifiedRecord('idli');
  const pieceG = verified?.standardPortionGrams || gramsEach;
  const kcal100 = verified?.kcal100 || 106;
  return Math.round(kcal100 * count * pieceG / 100);
}

const fishVision = {
  meal_summary: 'Fish and chips with mushy peas',
  confidence_score: 0.84,
  items: [{
    name: 'Fish and chips',
    unit: 'g',
    estimated_amount: 430,
    cooking_method: 'deep_fried',
    visible_oil: true,
    confidence: 0.82,
  }],
  clarification_questions: [],
};

const fish = composeAnalysisFromVision(fishVision);
assert('fish-chips decomposes 3+ items', fish.items.length >= 3, `${fish.items.length}`);
assert('fish-chips not high confidence', scoreMealConfidence(fish).band !== 'high', scoreMealConfidence(fish).band);
assert('fish-chips has kcal range', Boolean(fish._confidence?.kcalRange));

const tikkaVision = {
  meal_summary: 'Chicken tikka masala',
  confidence_score: 0.8,
  items: [{
    name: 'Chicken tikka masala',
    unit: 'g',
    estimated_amount: 200,
    cooking_method: 'pan_fried',
    visible_oil: false,
    confidence: 0.85,
  }],
  clarification_questions: [],
};

const tikka = composeAnalysisFromVision(tikkaVision);
const tikkaItem = tikka.items.find((i) => /tikka|masala|chicken/i.test(i.name));
assert('tikka masala ref not chicken_tikka only', tikkaItem?._refId === 'chicken_tikka_masala', tikkaItem?._refId);
assert('tikka medium confidence', scoreMealConfidence(tikka).band === 'medium', scoreMealConfidence(tikka).band);

const biryaniVision = {
  meal_summary: 'Chicken biryani with cucumber raita',
  confidence_score: 0.82,
  items: [{
    name: 'Chicken biryani',
    unit: 'g',
    estimated_amount: 300,
    cooking_method: 'unknown',
    visible_oil: false,
    confidence: 0.8,
  }],
  clarification_questions: [],
};

const biryaniPartial = composeAnalysisFromVision(biryaniVision);
const biryaniFilled = applyDeterministicAccompanimentFill(biryaniPartial, biryaniVision);
assert('biryani+raita fill adds raita', biryaniFilled.items.some((i) => /raita/i.test(i.name)),
  biryaniFilled.items.map((i) => i.name).join(', '));
assert('biryani salt not fake zero', biryaniFilled.total_nutrition?.salt_mg == null
  || biryaniFilled.total_nutrition?.salt_mg > 10, `${biryaniFilled.total_nutrition?.salt_mg}`);

const idliVision = {
  meal_summary: '3 idlies with sambar',
  confidence_score: 0.85,
  items: [{
    name: '3 idlies',
    unit: 'g',
    estimated_amount: 180,
    cooking_method: 'steamed',
    visible_oil: false,
    confidence: 0.88,
  }],
  clarification_questions: [],
};

const idliPlate = composeAnalysisFromVision(idliVision);
const idliFilled = applyDeterministicAccompanimentFill(idliPlate, idliVision);
assert('idli plate keeps idli', idliFilled.items.some((i) => i._refId === 'idli' || /idli/i.test(i.name)));
assert('idli plate fills sambar', idliFilled.items.some((i) => /sambar/i.test(i.name)),
  idliFilled.items.map((i) => i.name).join(', '));

const splitCurry = composeAnalysisFromVision({
  meal_summary: 'Chicken tikka masala with basmati rice',
  confidence_score: 0.86,
  items: [
    { name: 'Chicken tikka masala', unit: 'g', estimated_amount: 200, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.9 },
    { name: 'Basmati rice', unit: 'g', estimated_amount: 180, cooking_method: 'steamed', visible_oil: false, confidence: 0.88 },
  ],
  clarification_questions: [],
});
assert('tikka+rice 2 items preserved', splitCurry.items.length >= 2, `${splitCurry.items.length}`);
assert('tikka+rice has rice component', splitCurry.items.some((i) => /rice/i.test(i.name) || i._refId === 'cooked_rice'));

const unknownPlate = composeAnalysisFromVision({
  meal_summary: 'Mystery regional stew',
  confidence_score: 0.5,
  items: [{
    name: 'Unusual stew xyz123',
    unit: 'g',
    estimated_amount: 200,
    cooking_method: 'unknown',
    visible_oil: false,
    confidence: 0.4,
  }],
  clarification_questions: [],
});
const unknownItem = unknownPlate.items[0];
assert('unknown food uses fallback', unknownItem?._nutritionFallback === true);
assert('fallback micros null not zero', unknownItem?.nutrition?.salt_mg == null);

for (const meal of [fish, tikka, biryaniFilled, splitCurry]) {
  assert(`${meal.meal_summary?.slice(0, 20) || 'meal'} has confidence`, Boolean(meal._confidence?.band));
  assert(`${meal.meal_summary?.slice(0, 20) || 'meal'} has validation`, meal._mealValidation != null);
}

console.log('\nDone.');
