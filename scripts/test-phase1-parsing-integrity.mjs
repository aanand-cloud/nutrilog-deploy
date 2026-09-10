/**
 * Phase 1 — Parsing integrity regression suite and acceptance gates.
 */

import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { splitMealPhrases, parseQuantityFromText, phraseHasExplicitQuantity } from '../shared/quantity-parser.js';
import {
  reconcileMealInputOutput,
  PHASE1_TARGETS,
} from '../shared/parsing-integrity.js';
import { getMealNovaFlags, resetMealNovaFlagsCache } from '../shared/feature-flags.js';
import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';

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
  return items.find((item) => {
    const blob = `${item.name || ''} ${item._refId || ''}`.toLowerCase();
    return blob.includes(n);
  });
}

resetMealNovaFlagsCache();
assert('parsingIntegrity flag on', getMealNovaFlags().parsingIntegrity === true);

/** Exact acceptance gate cases from QA retest (Describe path). */
const ACCEPTANCE_CASES = [
  {
    id: 'accept-eggs-banana',
    input: '2 large boiled eggs and 1 medium banana',
    minItems: 2,
    checks: (items) => {
      const eggs = findItem(items, 'egg');
      const banana = findItem(items, 'banana');
      return eggs && banana && (eggs.name.includes('2') || eggs.portion_estimate?.includes('2'));
    },
    maxBand: 'high',
  },
  {
    id: 'accept-dry-oats-milk',
    input: '50 g dry oats with 250 ml milk',
    minItems: 2,
    checks: (items) => {
      const oats = findItem(items, 'oat');
      const milk = findItem(items, 'milk');
      return oats?._refId === 'oats'
        && oats?._hiddenGrams === 50
        && oats.calories_kcal >= 150
        && (milk?._refId === 'milk' || milk?._refId === 'semi_skimmed_milk')
        && milk?._hiddenGrams === 250;
    },
    minKcal: 280,
    maxBand: 'high',
  },
  {
    id: 'accept-toast-beans-butter',
    input: '2 slices wholemeal toast, 200 g baked beans, 10 g butter',
    minItems: 3,
    checks: (items) => {
      const toast = items.some((i) => /toast|bread/i.test(i.name) || i._refId === 'bread');
      const beans = findItem(items, 'bean');
      const butter = findItem(items, 'butter');
      return toast && beans && butter;
    },
    maxBand: 'high',
  },
  {
    id: 'accept-biryani-raita-weights',
    input: '300 g chicken biryani, 100 g cucumber raita',
    minItems: 2,
    checks: (items) => {
      const biryani = findItem(items, 'biryani');
      const raita = findItem(items, 'raita');
      return biryani?._hiddenGrams === 300 && raita?._hiddenGrams === 100;
    },
    maxBand: 'medium',
  },
  {
    id: 'accept-poha-peanuts-weights',
    input: '250 g poha, 20 g peanuts',
    minItems: 2,
    checks: (items) => {
      const poha = findItem(items, 'poha');
      const peanuts = items.filter((i) => /peanut|nuts/i.test(`${i.name} ${i._refId}`));
      return poha?._hiddenGrams === 250 && peanuts.length === 1 && peanuts[0]._hiddenGrams === 20;
    },
    maxBand: 'medium',
  },
  {
    id: 'accept-bhature-chole',
    input: '2 bhature, 200 g chole',
    minItems: 2,
    checks: (items) => {
      const bhature = findItem(items, 'bhatur') || findItem(items, 'roti');
      const chole = findItem(items, 'chole') || findItem(items, 'chana');
      return Boolean(bhature && chole);
    },
    maxBand: 'medium',
  },
];

for (const tc of ACCEPTANCE_CASES) {
  const result = estimateMealFromDescription(tc.input);
  const items = result?.items || [];
  assert(`${tc.id} resolves`, Boolean(result), tc.input);
  assert(`${tc.id} item count`, items.length >= tc.minItems, `${items.length} items`);
  assert(`${tc.id} components`, tc.checks(items), items.map((i) => `${i.name} ${i._hiddenGrams}g`).join(' + '));
  assert(`${tc.id} reconciliation`, result?._inputOutputReconciliation?.pass !== false,
    result?._inputOutputReconciliation?.missingPhrases?.join(', ') || 'ok');
  if (tc.minKcal) {
    assert(`${tc.id} min kcal`, result.total_calories_kcal >= tc.minKcal, `${result.total_calories_kcal}`);
  }
  if (tc.maxBand === 'high') {
    assert(`${tc.id} not high when incomplete`, result._mealStatus === 'complete' || result._confidence?.band !== 'high',
      `band=${result._confidence?.band} status=${result._mealStatus}`);
    if (result._mealStatus === 'complete') {
      assert(`${tc.id} confidence high when complete`, result._confidence?.band === 'high', result._confidence?.band);
    }
  }
  if (tc.maxBand === 'medium') {
    assert(`${tc.id} capped at medium for variable dish`, result._confidence?.band !== 'high',
      result._confidence?.band);
  }
}

const REGRESSION_CASES = [
  {
    id: 'two-eggs-banana',
    input: 'two eggs and banana',
    minItems: 2,
    checks: (items) => {
      const eggs = findItem(items, 'egg');
      const banana = findItem(items, 'banana');
      return eggs && banana
        && (eggs.name.includes('2') || eggs.portion_estimate?.includes('2'))
        && !items.some((i) => i._refId === 'boiled_egg' && items.filter((x) => x._refId === 'boiled_egg').length > 1);
    },
  },
  {
    id: 'dry-oats-milk',
    input: 'dry oats with milk',
    minItems: 2,
    checks: (items) => {
      const oats = findItem(items, 'oat');
      const milk = findItem(items, 'milk');
      return oats?._refId === 'oats' && (milk?._refId === 'milk' || milk?._refId === 'semi_skimmed_milk');
    },
  },
  {
    id: 'toast-beans-butter',
    input: 'toast, beans and butter',
    minItems: 3,
    checks: (items) => {
      const toast = items.some((i) => /toast|bread/i.test(i.name) || i._refId === 'bread');
      const beans = findItem(items, 'bean');
      const butter = findItem(items, 'butter');
      return toast && beans && butter;
    },
  },
  {
    id: 'biryani-raita',
    input: '300g biryani with raita',
    minItems: 2,
    checks: (items) => {
      const biryani = findItem(items, 'biryani');
      const raita = findItem(items, 'raita');
      return biryani?._hiddenGrams === 300 && raita && raita._refId === 'raita';
    },
  },
  {
    id: 'poha-peanuts',
    input: 'poha with peanuts',
    minItems: 2,
    checks: (items) => {
      const poha = findItem(items, 'poha');
      const peanuts = items.filter((i) => /peanut|nuts/i.test(`${i.name} ${i._refId}`));
      return poha && peanuts.length === 1;
    },
  },
];

for (const tc of REGRESSION_CASES) {
  const result = resolveMealFromText(tc.input);
  const items = result?.items || [];
  assert(`${tc.id} resolves`, Boolean(result), tc.input);
  assert(`${tc.id} item count`, items.length >= tc.minItems, `${items.length} items`);
  assert(`${tc.id} components`, tc.checks(items), items.map((i) => i.name).join(' + '));
  assert(`${tc.id} reconciliation`, result?._inputOutputReconciliation?.pass !== false,
    result?._inputOutputReconciliation?.missingPhrases?.join(', ') || 'ok');
}

assert('toast beans butter splits', splitMealPhrases('toast beans butter').length === 3,
  splitMealPhrases('toast beans butter').join(' | '));
assert('2 toast beans butter splits', splitMealPhrases('2 toast beans butter').length === 3,
  splitMealPhrases('2 toast beans butter').join(' | '));

const spaceCase = resolveMealFromText('toast beans butter');
assert('toast beans butter 3 items', spaceCase?.items?.length === 3, `${spaceCase?.items?.length} items`);

const beansToast = resolveMealFromText('beans on toast with butter');
assert('beans on toast with butter keeps butter', beansToast?.items?.length === 3,
  beansToast?.items?.map((i) => i.name).join(' + '));

const oatsMeasured = resolveMealFromText('40g dry oats with 200ml milk');
const oatsItem = findItem(oatsMeasured?.items || [], 'oat');
const milkItem = findItem(oatsMeasured?.items || [], 'milk');
assert('40g dry oats uses oats ref', oatsItem?._refId === 'oats' && oatsItem?._hiddenGrams === 40);
assert('200ml milk preserved', milkItem?._hiddenGrams === 200);

assert('porridge oats uses dry oats ref', findItem(resolveMealFromText('50g porridge oats with 250ml milk')?.items || [], 'oat')?._refId === 'oats');

const dryOatsOnly = resolveMealFromText('50 g dry oats');
const dryOatsItem = findItem(dryOatsOnly?.items || [], 'oat');
assert('50g dry oats ref', dryOatsItem?._refId === 'oats' && dryOatsItem?._hiddenGrams === 50);
assert('50g dry oats kcal', dryOatsItem?.calories_kcal >= 180 && dryOatsItem?.calories_kcal <= 195,
  `${dryOatsItem?.calories_kcal}`);

const porridgeWater = resolveMealFromText('250g porridge made with water');
const pwItem = findItem(porridgeWater?.items || [], 'porridge') || porridgeWater?.items?.[0];
assert('porridge with water ref', pwItem?._refId === 'porridge_water', pwItem?._refId);

let explicitTotal = 0;
let explicitRetained = 0;
let phraseTotal = 0;
let phraseReflected = 0;

for (const tc of [...REGRESSION_CASES, ...ACCEPTANCE_CASES]) {
  const result = estimateMealFromDescription(tc.input) || resolveMealFromText(tc.input);
  const reconciliation = reconcileMealInputOutput(tc.input, result);
  phraseTotal += reconciliation.phrases.length;
  phraseReflected += reconciliation.phrases.length - reconciliation.missingPhrases.length;

  for (const phrase of splitMealPhrases(tc.input)) {
    const q = parseQuantityFromText(phrase);
    if (!phraseHasExplicitQuantity(q)) continue;
    explicitTotal += 1;
    const bound = (result?.items || []).filter((item) => item._sourcePhrase === phrase);
    const pool = bound.length ? bound : (result?.items || []);
    const ok = pool.some((item) => item._boundQuantity?.amount === q.amount && item._boundQuantity?.unit === q.unit);
    if (ok) explicitRetained += 1;
  }
}

const bindingRate = phraseTotal ? phraseReflected / phraseTotal : 1;
const retentionRate = explicitTotal ? explicitRetained / explicitTotal : 1;

assert(`quantity-to-food binding ≥${PHASE1_TARGETS.quantityFoodBinding * 100}%`,
  bindingRate >= PHASE1_TARGETS.quantityFoodBinding, `${(bindingRate * 100).toFixed(1)}%`);
assert(`quantity retention ≥${PHASE1_TARGETS.quantityRetention * 100}%`,
  retentionRate >= PHASE1_TARGETS.quantityRetention, `${(retentionRate * 100).toFixed(1)}%`);

console.log('\nDone.');
