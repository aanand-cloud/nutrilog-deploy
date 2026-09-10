/**
 * Mandatory regression descriptions — first-submission success and full verification.
 */

import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { scoreMealConfidence } from '../shared/nutrition-confidence.js';
import { splitMealPhrases } from '../shared/quantity-parser.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

function findItem(items = [], needle = '') {
  const n = needle.toLowerCase();
  return items.find((item) => `${item.name || ''} ${item._refId || ''}`.toLowerCase().includes(n));
}

function itemSignature(items = []) {
  return items
    .map((item) => ({
      ref: item._refId || item.name,
      grams: Math.round(item._hiddenGrams || 0),
      kcal: Math.round(item.calories_kcal || 0),
    }))
    .sort((a, b) => `${a.ref}:${a.grams}`.localeCompare(`${b.ref}:${b.grams}`));
}

function assertMeal(input, opts = {}) {
  const result = resolveMealFromText(input);
  assert(`${opts.id || input} resolves`, Boolean(result), input);
  assert(`${opts.id || input} not incomplete on first submit`, !result?._mealIncomplete,
    result?._mealValidation?.issues?.map((i) => i.code).join(', '));
  assert(`${opts.id || input} min items ${opts.minItems || 1}`,
    (result?.items?.length || 0) >= (opts.minItems || 1),
    `${result?.items?.length}`);

  if (opts.mustInclude?.length) {
    for (const token of opts.mustInclude) {
      assert(`${opts.id || input} includes ${token}`, Boolean(findItem(result.items, token)), token);
    }
  }

  if (opts.grams) {
    for (const [needle, grams] of Object.entries(opts.grams)) {
      const item = findItem(result.items, needle);
      assert(`${opts.id || input} ${needle} grams`, item?._hiddenGrams === grams, `${item?._hiddenGrams}`);
    }
  }

  const point = Math.round(result.total_calories_kcal);
  const range = result._confidence?.kcalRange;
  if (range) {
    assert(`${opts.id || input} range integrity`, range.min <= point && point <= range.max,
      `${point} vs ${range.min}–${range.max}`);
  }

  if (opts.weightProvenance !== false) {
    assert(`${opts.id || input} weight provenance`, result._weightProvenanceComplete !== false);
    assert(`${opts.id || input} total meal weight`, (result._totalMealWeightGrams || 0) > 0,
      `${result._totalMealWeightGrams}`);
  }

  const summed = (result.items || []).reduce((s, i) => s + Math.round(i.calories_kcal || 0), 0);
  assert(`${opts.id || input} totals match components`, Math.abs(summed - point) <= 2, `${summed} vs ${point}`);

  if (opts.confidenceBand) {
    const band = (result._confidence || scoreMealConfidence(result)).band;
    assert(`${opts.id || input} confidence ${opts.confidenceBand}`, band === opts.confidenceBand, band);
  }

  return result;
}

function assertOrderPair(a, b, label) {
  const ra = resolveMealFromText(a);
  const rb = resolveMealFromText(b);
  assert(`${label} order-invariant components`,
    JSON.stringify(itemSignature(ra.items)) === JSON.stringify(itemSignature(rb.items)));
  assert(`${label} order-invariant kcal`, ra.total_calories_kcal === rb.total_calories_kcal);
}

assertMeal('3 idlis', { id: '3-idlis', mustInclude: ['idli'], grams: { idli: 180 } });
assertMeal('4 idlis', { id: '4-idlis', mustInclude: ['idli'], grams: { idli: 240 } });
assertMeal('5 idlis', { id: '5-idlis', mustInclude: ['idli'], grams: { idli: 300 } });
assertMeal('6 idlis', { id: '6-idlis', mustInclude: ['idli'], grams: { idli: 360 } });
assertMeal('3 idlys', { id: '3-idlys', mustInclude: ['idli'], grams: { idli: 180 } });

assertMeal('3 idlies with 100 ml sambar and 30 g coconut chutney', {
  id: 'idli-plate',
  minItems: 3,
  mustInclude: ['idli', 'sambar', 'chutney'],
  grams: { idli: 180, sambar: 100, chutney: 30 },
});

assertOrderPair('30 g coconut chutney with 3 idlis', '3 idlis with 30 g coconut chutney', 'chutney-idli');
assertOrderPair('200 g vegetable korma with 2 chapatis', '2 chapatis with 200 g vegetable korma', 'korma-chapati');

assertMeal('200 g vegetable korma with 2 chapatis', {
  id: 'korma-chapati-a',
  minItems: 2,
  mustInclude: ['kurma', 'roti'],
  grams: { kurma: 200, roti: 120 },
});

assertMeal('50 g dry porridge oats made with 250 ml semi-skimmed milk', {
  id: 'oats-milk',
  minItems: 2,
  mustInclude: ['oat', 'milk'],
  grams: { oat: 50, milk: 250 },
});

assertMeal('200 g chicken tikka masala with 180 g cooked basmati rice', {
  id: 'tikka-rice',
  minItems: 2,
  mustInclude: ['tikka', 'rice'],
  grams: { tikka: 200, rice: 180 },
  confidenceBand: 'medium',
});

assertMeal('300 g restaurant chicken biryani', {
  id: 'biryani-300g',
  minItems: 1,
  mustInclude: ['biryani'],
  grams: { biryani: 300 },
  confidenceBand: 'medium',
});

assertMeal('300 g chicken biryani with 100 g cucumber raita', {
  id: 'biryani-raita',
  minItems: 2,
  mustInclude: ['biryani', 'raita'],
});

assertMeal('2 bhature with 200 g chole', {
  id: 'chole-bhature',
  minItems: 2,
  mustInclude: ['bhatur', 'chana'],
  grams: { bhatur: 240, chana: 200 },
});

assertMeal('180 g battered cod with 250 g chip-shop chips and 80 g mushy peas', {
  id: 'fish-chips-peas',
  minItems: 3,
  mustInclude: ['cod', 'chip', 'pea'],
  grams: { cod: 180, fries: 250, pea: 80 },
});

assertMeal('2 slices wholemeal toast with 200 g baked beans and 10 g butter', {
  id: 'toast-beans-butter',
  minItems: 3,
});

assertMeal('250 g vegetable poha with 20 g peanuts', {
  id: 'poha-peanuts',
  minItems: 2,
  mustInclude: ['poha', 'peanut'],
});

assert('korma-chapati split phrases',
  splitMealPhrases('200 g vegetable korma with 2 chapatis').length === 2);

console.log('\nDone.');
