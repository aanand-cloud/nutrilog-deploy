/**
 * Phase 1–3 mandatory regression suite — system-level accuracy and trust.
 * Does not save meals; exercises resolve + validation paths only.
 */

import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';
import { scoreMealConfidence } from '../shared/nutrition-confidence.js';
import { getVerifiedRecord } from '../shared/verified-nutrition.js';
import { resolveVerifiedIdFromText } from '../shared/verified-nutrition.js';
import { servingGramsForReference } from '../shared/description-anchor.js';
import { matchFoodReferenceDetailed } from '../shared/nutrition-density.js';

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

function resolve(input) {
  return estimateMealFromDescription(input) || resolveMealFromText(input);
}

function idliKcal(count) {
  const verified = getVerifiedRecord('idli');
  const pieceG = verified?.standardPortionGrams || 60;
  const kcal100 = verified?.kcal100 || 106;
  return Math.round(kcal100 * count * pieceG / 100);
}

const IDLI_COUNTS = [
  { id: '3-idlis', input: '3 idlis', count: 3 },
  { id: '4-idlis', input: '4 idlis', count: 4 },
  { id: '5-idlis', input: '5 idlis', count: 5 },
  { id: '6-idlis', input: '6 idlis', count: 6 },
  { id: '3-idlies', input: '3 idlies', count: 3 },
  { id: '3-idlys', input: '3 idlys', count: 3 },
];

for (const tc of IDLI_COUNTS) {
  const result = resolve(tc.input);
  const item = findItem(result?.items || [], 'idli') || result?.items?.[0];
  const expectedKcal = idliKcal(tc.count);
  const expectedGrams = tc.count * (getVerifiedRecord('idli')?.standardPortionGrams || 60);
  assert(`${tc.id} resolves`, Boolean(result), tc.input);
  assert(`${tc.id} ref idli`, item?._refId === 'idli', item?._refId);
  assert(`${tc.id} grams ${expectedGrams}`, item?._hiddenGrams === expectedGrams, `${item?._hiddenGrams}`);
  assert(`${tc.id} linear kcal ~${expectedKcal}`, Math.abs((item?.calories_kcal || 0) - expectedKcal) <= 2,
    `${item?.calories_kcal}`);
  assert(`${tc.id} alias canonical`, resolveVerifiedIdFromText(tc.input) === 'idli');
}

for (let count = 1; count <= 10; count += 1) {
  const result = resolve(`${count} idlis`);
  const item = findItem(result?.items || [], 'idli') || result?.items?.[0];
  const expectedKcal = idliKcal(count);
  const expectedGrams = count * (getVerifiedRecord('idli')?.standardPortionGrams || 60);
  assert(`idli-scale-${count} grams`, item?._hiddenGrams === expectedGrams, `${item?._hiddenGrams}`);
  assert(`idli-scale-${count} kcal`, Math.abs((item?.calories_kcal || 0) - expectedKcal) <= 2,
    `${item?.calories_kcal}`);
}

const idliPlate = resolve('3 idlies with 100 ml sambar and 30 g coconut chutney');
const idliItems = idliPlate?.items || [];
assert('idli-sambar-chutney 3 components', idliItems.length >= 3,
  idliItems.map((i) => i.name).join(' + '));
assert('idli-sambar-chutney keeps idli', Boolean(findItem(idliItems, 'idli')));
assert('idli-sambar-chutney keeps sambar', Boolean(findItem(idliItems, 'sambar')));
assert('idli-sambar-chutney keeps chutney', Boolean(findItem(idliItems, 'chutney')));

const oatsMilk = resolve('50 g dry porridge oats made with 250 ml semi-skimmed milk');
const oats = findItem(oatsMilk?.items || [], 'oat');
const milk = findItem(oatsMilk?.items || [], 'milk');
assert('dry-oats-milk 2 items', (oatsMilk?.items?.length || 0) >= 2);
assert('dry-oats ref oats', oats?._refId === 'oats' && oats?._hiddenGrams === 50, `${oats?._refId} ${oats?._hiddenGrams}g`);
assert('dry-oats kcal plausible', oats?.calories_kcal >= 180 && oats?.calories_kcal <= 200, `${oats?.calories_kcal}`);
assert('milk 250ml', milk?._hiddenGrams === 250, `${milk?._hiddenGrams}`);
assert('oats+milk total plausible', oatsMilk.total_calories_kcal >= 300, `${oatsMilk.total_calories_kcal}`);

const tikkaRice = resolve('200 g chicken tikka masala with 180 g cooked basmati rice');
const masala = findItem(tikkaRice?.items || [], 'tikka');
const rice = findItem(tikkaRice?.items || [], 'rice');
assert('tikka-rice 2 items', (tikkaRice?.items?.length || 0) >= 2);
assert('tikka masala not chicken tikka only', masala?._refId === 'chicken_tikka_masala', masala?._refId);
assert('tikka 200g', masala?._hiddenGrams === 200, `${masala?._hiddenGrams}`);
assert('rice 180g', rice?._hiddenGrams === 180, `${rice?._hiddenGrams}`);
assert('tikka-rice medium confidence', scoreMealConfidence(tikkaRice).band !== 'high',
  scoreMealConfidence(tikkaRice).band);

const biryaniRaita = resolve('300 g chicken biryani with 100 g cucumber raita');
assert('biryani-raita 2 items', (biryaniRaita?.items?.length || 0) >= 2);
const biryani = findItem(biryaniRaita?.items || [], 'biryani');
const raita = findItem(biryaniRaita?.items || [], 'raita');
assert('biryani 300g', biryani?._hiddenGrams === 300);
assert('raita 100g', raita?._hiddenGrams === 100);
const biryaniSalt = biryaniRaita?.total_nutrition?.salt_mg;
assert('biryani salt not fake zero', biryaniSalt == null || biryaniSalt > 10, `${biryaniSalt}`);

const toastBeans = resolve('2 slices wholemeal toast with 200 g baked beans and 10 g butter');
assert('toast-beans-butter 3 items', (toastBeans?.items?.length || 0) >= 3);

const dosaCurry = resolve('2 dosa and meat curry');
assert('dosa-curry 2 items', (dosaCurry?.items?.length || 0) === 2, dosaCurry?.items?.map((i) => i.name).join(' | '));
assert('dosa-curry no sambar', !(dosaCurry?.items || []).some((i) => /sambar/i.test(i.name)));
assert('dosa-curry no chutney', !(dosaCurry?.items || []).some((i) => /chutney/i.test(i.name)));

const dosaCurryWith = resolve('2 dosa with meat curry');
assert('dosa-with-curry 2 items', (dosaCurryWith?.items?.length || 0) === 2, dosaCurryWith?.items?.map((i) => i.name).join(' | '));
assert('dosa-with-curry keeps dosa', Boolean(findItem(dosaCurryWith?.items || [], 'dosa')));
assert('dosa-with-curry keeps curry', Boolean(findItem(dosaCurryWith?.items || [], 'curry')));

const fishChips = resolve('180 g battered cod, 250 g chips and 80 g mushy peas');
assert('fish-chips-peas 3 items', (fishChips?.items?.length || 0) >= 3);
assert('fish-chips medium/low', scoreMealConfidence(fishChips).band !== 'high',
  scoreMealConfidence(fishChips).band);
assert('fish-chips range', Boolean(scoreMealConfidence(fishChips).kcalRange));

for (const tc of [
  { r: oatsMilk, label: 'oats-milk' },
  { r: tikkaRice, label: 'tikka-rice' },
  { r: biryaniRaita, label: 'biryani-raita' },
  { r: fishChips, label: 'fish-chips' },
]) {
  const items = tc.r?.items || [];
  assert(`${tc.label} no dropped items on first submit`, items.length > 0);
  assert(`${tc.label} has source metadata`, items.some((i) => i._refId || i._provenanceLabel || i._authoritative));
}

const idliRef = matchFoodReferenceDetailed('idli')?.ref;
assert('idli default serving 60g', servingGramsForReference(idliRef, 'idli') === 60);
assert('3 idlis default serving 180g', servingGramsForReference(idliRef, '3 idlis') === 180);

const unmatchedMeal = resolveMealFromText('150 g zzunknownfooditem');
const unmatched = (unmatchedMeal?.items || []).find((i) => i._unmatched);
assert('unmatched item kept visible', Boolean(unmatched));
assert('unmatched salt not fake zero', unmatched?.nutrition?.salt_mg == null);
assert('unmatched review hint', (unmatched?._reviewHint || '').includes('We could not confidently match'));

const oliveOil = resolve('15 ml olive oil');
const oliveItem = oliveOil?.items?.[0];
assert('olive-oil matched', oliveItem?._refId === 'olive_oil', oliveItem?._refId);
assert('olive-oil 15ml', oliveItem?._hiddenGrams === 15, `${oliveItem?._hiddenGrams}`);
assert('olive-oil kcal', (oliveItem?.calories_kcal || 0) >= 110 && (oliveItem?.calories_kcal || 0) <= 140,
  `${oliveItem?.calories_kcal}`);
assert('olive-oil complete', !oliveOil?._mealIncomplete);

const honey = resolve('1 tbsp honey');
const honeyItem = honey?.items?.[0];
assert('honey matched', honeyItem?._refId === 'honey', honeyItem?._refId);
assert('honey ~15g', honeyItem?._hiddenGrams === 15, `${honeyItem?._hiddenGrams}`);
assert('honey kcal', (honeyItem?.calories_kcal || 0) >= 40 && (honeyItem?.calories_kcal || 0) <= 50,
  `${honeyItem?.calories_kcal}`);

const strawberries = resolve('100g strawberries');
const berryItem = strawberries?.items?.[0];
assert('strawberries matched', berryItem?._refId === 'strawberry', berryItem?._refId);
assert('strawberries 100g', berryItem?._hiddenGrams === 100, `${berryItem?._hiddenGrams}`);
assert('strawberries kcal', (berryItem?.calories_kcal || 0) >= 25 && (berryItem?.calories_kcal || 0) <= 30,
  `${berryItem?.calories_kcal}`);

const halfAvo = resolve('half avocado');
const avoItem = halfAvo?.items?.[0];
assert('half-avocado matched', avoItem?._refId === 'avocado', avoItem?._refId);
assert('half-avocado ~80g', avoItem?._hiddenGrams === 80, `${avoItem?._hiddenGrams}`);
assert('half-avocado kcal', (avoItem?.calories_kcal || 0) >= 130 && (avoItem?.calories_kcal || 0) <= 150,
  `${avoItem?.calories_kcal}`);

const bratwurstMeal = resolve('bratwurst with sauerkraut');
assert('bratwurst-sauerkraut 2 items', (bratwurstMeal?.items?.length || 0) >= 2,
  bratwurstMeal?.items?.map((i) => i.name).join(' | '));
assert('bratwurst-sauerkraut keeps bratwurst', Boolean(findItem(bratwurstMeal?.items || [], 'bratwurst')));
assert('bratwurst-sauerkraut keeps sauerkraut', Boolean(findItem(bratwurstMeal?.items || [], 'sauerkraut')));

for (const tc of [
  { input: 'tostadas', refId: 'tostada' },
  { input: 'flan', refId: 'flan' },
  { input: 'horchata', refId: 'horchata' },
]) {
  const result = resolve(tc.input);
  const item = result?.items?.[0];
  assert(`${tc.input} matched`, item?._refId === tc.refId, item?._refId);
  assert(`${tc.input} not unmatched`, !item?._unmatched);
  assert(`${tc.input} has kcal`, (item?.calories_kcal || 0) > 0, `${item?.calories_kcal}`);
}

const continental = resolve('continental breakfast');
assert('continental breakfast decomposed', (continental?.items?.length || 0) >= 3,
  continental?.items?.map((i) => i.name).join(' | '));
assert('continental breakfast kcal', (continental?.total_calories_kcal || 0) >= 250,
  `${continental?.total_calories_kcal}`);
assert('continental breakfast complete', !continental?._mealIncomplete);

console.log('\nDone.');
