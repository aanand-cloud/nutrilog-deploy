import { nutritionForAmount } from '../shared/nutrition-density.js';
import {
  PORTION_OPTIONS,
  getPortionOption,
  scaleEditableItemByFactor,
} from '../src/services/portion-scale.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('five portion presets', PORTION_OPTIONS.length === 5);
assert('half preset factor', getPortionOption('half').factor === 0.5);
assert('three quarter preset', getPortionOption('three_quarter').factor === 0.75);

const base = {
  id: 'item-1',
  name: 'Chicken curry',
  grams: 250,
  displayUnit: 'g',
  unitKind: 'weight',
  per100: { kcal: 140, protein_g: 14, carbs_g: 5, fat_g: 7 },
  _hiddenGrams: 250,
};

const half = scaleEditableItemByFactor(base, 0.5, nutritionForAmount);
assert('half plate halves grams', half.grams === 125, `${half.grams}g`);
assert('half plate halves kcal', half.calories_kcal === 175, `${half.calories_kcal} kcal`);

const pieces = scaleEditableItemByFactor({
  ...base,
  name: 'Idli',
  grams: 3,
  displayUnit: 'piece',
  unitKind: 'count',
  _hiddenGrams: 180,
  per100: { kcal: 106, protein_g: 3.5, carbs_g: 22, fat_g: 0.5 },
}, 0.5, nutritionForAmount);
assert('half plate rounds pieces', pieces.grams >= 1, `${pieces.grams} pieces`);

const baseline1008 = {
  id: 'plate-1008',
  name: 'Test meal',
  grams: 252,
  displayUnit: 'g',
  unitKind: 'weight',
  per100: { kcal: 400, protein_g: 20, carbs_g: 40, fat_g: 10 },
  _hiddenGrams: 252,
  _baselineWeightGrams: 252,
};

const scaleExpectations = [
  { factor: 1, kcal: 1008 },
  { factor: 0.75, kcal: 756 },
  { factor: 0.5, kcal: 504 },
  { factor: 0.25, kcal: 252 },
  { factor: 0.1, kcal: 101 },
];

for (const { factor, kcal } of scaleExpectations) {
  const scaled = scaleEditableItemByFactor(baseline1008, factor, nutritionForAmount);
  assert(`${Math.round(factor * 100)}% scales kcal`, scaled.calories_kcal === kcal, `${scaled.calories_kcal}`);
}

const restored = scaleEditableItemByFactor(
  scaleEditableItemByFactor(baseline1008, 0.5, nutritionForAmount),
  2,
  nutritionForAmount,
);
assert('return to 100% from 50%', restored.calories_kcal === 1008, `${restored.calories_kcal}`);

console.log('\nDone.');
