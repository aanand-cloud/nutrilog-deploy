/**
 * Range integrity — central estimate must always fall inside min/max.
 */

import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { enforceRangeIntegrity, normalizeKcalRange } from '../shared/range-integrity.js';
import { scoreMealConfidence } from '../shared/nutrition-confidence.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('normalize expands min when point below range',
  normalizeKcalRange({ min: 750, max: 1100, point: 500 }, 500).range.min === 500);

assert('normalize expands max when point above range',
  normalizeKcalRange({ min: 750, max: 1100, point: 1263 }, 1263).range.max === 1263);

const mismatched = enforceRangeIntegrity({
  total_calories_kcal: 1263,
  items: [{ name: 'Test', calories_kcal: 1263, _refId: 'biryani', portion_estimate: '300g' }],
  _recipeKcalRange: { min: 750, max: 1100, reason: 'Test' },
});
const range = mismatched.scored.kcalRange;
assert('enforceRangeIntegrity contains point',
  range && range.min <= 1263 && 1263 <= range.max,
  `${range?.min}–${range?.max}`);

const meals = [
  '300 g restaurant chicken biryani',
  '180 g battered cod with 250 g chip-shop chips and 80 g mushy peas',
  '200 g chicken tikka masala with 180 g cooked basmati rice',
];

for (const input of meals) {
  const result = resolveMealFromText(input);
  const scored = result._confidence || scoreMealConfidence(result);
  const point = Math.round(result.total_calories_kcal);
  if (scored.kcalRange) {
    assert(`${input.slice(0, 32)} range integrity`,
      scored.kcalRange.min <= point && point <= scored.kcalRange.max,
      `${point} vs ${scored.kcalRange.min}–${scored.kcalRange.max}`);
  }
  assert(`${input.slice(0, 32)} _rangeIntegrity pass`, result._rangeIntegrity?.pass !== false);
}

console.log('\nDone.');
