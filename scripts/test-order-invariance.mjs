/**
 * Order-invariance property tests — reversing component order must not change results.
 */

import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { splitMealPhrases } from '../shared/quantity-parser.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

function itemSignature(items = []) {
  return items
    .map((item) => ({
      ref: item._refId || item.name,
      grams: Math.round(item._hiddenGrams || 0),
      kcal: Math.round(item.calories_kcal || 0),
      unmatched: Boolean(item._unmatched),
    }))
    .sort((a, b) => `${a.ref}:${a.grams}`.localeCompare(`${b.ref}:${b.grams}`));
}

function assertOrderInvariant(a, b, label) {
  const ra = resolveMealFromText(a);
  const rb = resolveMealFromText(b);
  assert(`${label} resolves`, Boolean(ra) && Boolean(rb));
  const sa = JSON.stringify(itemSignature(ra.items));
  const sb = JSON.stringify(itemSignature(rb.items));
  assert(`${label} same components`, sa === sb, `${sa} vs ${sb}`);
  assert(`${label} same kcal`, ra.total_calories_kcal === rb.total_calories_kcal,
    `${ra.total_calories_kcal} vs ${rb.total_calories_kcal}`);
}

const pairs = [
  ['200 g vegetable korma with 2 chapatis', '2 chapatis with 200 g vegetable korma', 'korma-chapati'],
  ['30 g coconut chutney with 3 idlis', '3 idlis with 30 g coconut chutney', 'chutney-idli'],
  ['200 g chicken tikka masala with 180 g cooked basmati rice', '180 g cooked basmati rice with 200 g chicken tikka masala', 'tikka-rice'],
  ['2 bhature with 200 g chole', '200 g chole with 2 bhature', 'chole-bhature'],
];

for (const [a, b, label] of pairs) {
  assertOrderInvariant(a, b, label);
}

assert('korma-chapati splits both orders',
  splitMealPhrases('200 g vegetable korma with 2 chapatis').length === 2
  && splitMealPhrases('2 chapatis with 200 g vegetable korma').length === 2);

assert('chutney-idli splits both orders',
  splitMealPhrases('30 g coconut chutney with 3 idlis').length === 2
  && splitMealPhrases('3 idlis with 30 g coconut chutney').length === 2);

console.log('\nDone.');
