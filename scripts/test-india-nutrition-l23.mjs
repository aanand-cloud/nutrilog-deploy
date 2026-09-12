import { readFileSync } from 'node:fs';
import { V4_BY_ID } from '../shared/food-ref-v4-index.generated.js';
import { getVerifiedRecord, enrichReferenceWithVerified } from '../shared/verified-nutrition.js';
import { matchFoodReferenceDetailed } from '../shared/nutrition-density.js';
import { servingGramsForReference, servingGramsMeta } from '../shared/description-anchor.js';
import { resolvePhraseToItem } from '../shared/meal-resolution-pipeline.js';
import {
  INDIA_L23_STATS,
  applyLevel23Overlay,
  getLevel23ExactBrand,
  getLevel23Generic,
  level23ConfidenceSignals,
  resolveLevel23Nutrition,
} from '../shared/india-nutrition-l23.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const pack = JSON.parse(readFileSync(new URL('../data/level2/india-nutrition-l23.json', import.meta.url), 'utf8'));
const records = pack.records || [];
const branded = pack.exact_branded_anchors || [];
const byResolved = Object.fromEntries(
  records.filter((row) => row.resolved_v4_id).map((row) => [row.resolved_v4_id, row]),
);

assert('pack version is 2.3', String(pack.version).startsWith('2.3'));
assert('50 generic research records', records.length === 50 && pack.record_count === 50);
assert('8 exact branded anchors', branded.length === 8);
assert('every mapped generic id exists in V4', records.filter((row) => row.resolved_v4_id).every((row) => V4_BY_ID[row.resolved_v4_id]));
assert('food-ref-v4 dindigul snapshot unchanged', V4_BY_ID.dindigul_mutton_biryani[0] === 210);

const generic = getLevel23Generic('dindigul_mutton_biryani');
assert('dindigul has researched generic overlay', generic?.kcal100 === 190, String(generic?.kcal100));
assert('dindigul keeps a realistic kcal range', generic?.kcal100Low === 160 && generic?.kcal100High === 240);
assert('generic overlay is not branded', generic?.nutrition_source === 'level2_3_generic');

const live = matchFoodReferenceDetailed('dindigul mutton biryani', { useCache: false, logV4: false });
assert('matcher still resolves dindigul_mutton_biryani', live.ref?.id === 'dindigul_mutton_biryani');
assert('matcher still uses the same recognition path', live.meta?.match_method === 'alias_exact' || live.meta?.match_method === 'canonical_id', live.meta?.match_method);
assert('production overlay uses researched generic central', live.ref?.kcal100 === 190, String(live.ref?.kcal100));
assert('internal source is level2_3_generic', live.ref?.nutrition_source === 'level2_3_generic');
assert('portion default is unchanged', servingGramsForReference(live.ref, 'dindigul mutton biryani') === 350, String(servingGramsForReference(live.ref, 'dindigul mutton biryani')));
const fallbackPortion = servingGramsMeta(live.ref, 'dindigul mutton biryani');
assert('350g is a default fallback, not a photo estimate', fallbackPortion.portionSource === 'default_fallback' && fallbackPortion.portionSourceDetail === 'biryani_default_350g');
assert('explicit grams are not replaced by the 350g fallback', servingGramsMeta(live.ref, 'dindigul mutton biryani 420g').grams === 420 && servingGramsMeta(live.ref, 'dindigul mutton biryani 420g').portionSource === 'user_declared');
const described = resolvePhraseToItem('dindigul mutton biryani');
assert('describe logs fallback portion source', described._portionSource === 'default_fallback', described._portionSource);
assert('weighed describe does not use the 350g fallback', resolvePhraseToItem('300 g dindigul mutton biryani')._hiddenGrams === 300);

const brandedOntoGeneric = getLevel23ExactBrand('dindigul_mutton_biryani');
assert('branded map has no generic V4 ids', brandedOntoGeneric == null);
assert(
  'exact Thalappakatti name does not replace generic dindigul lookup by id',
  resolveLevel23Nutrition('dindigul_mutton_biryani')?.nutrition_source === 'level2_3_generic',
);
const exactBrand = resolveLevel23Nutrition('dindigul_mutton_biryani', {
  exactName: 'thalappakatti naidu mutton biryani',
});
assert('exact branded name uses Grade-A menu nutrition', exactBrand?.nutrition_source === 'exact_brand' && exactBrand.kcal100 === 163);
const exactEnriched = enrichReferenceWithVerified(live.ref, {
  exactName: 'thalappakatti naidu mutton biryani',
});
assert('exact brand overlay is 163 kcal/100g', exactEnriched.kcal100 === 163, String(exactEnriched.kcal100));
assert(
  'generic dindigul query is not 163',
  matchFoodReferenceDetailed('dindigul mutton biryani', { useCache: false, logV4: false }).ref?.kcal100 === 190,
);

const tastyGeneric = matchFoodReferenceDetailed('palak paneer', { useCache: false, logV4: false });
assert('palak paneer stays a generic dish', tastyGeneric.ref?.id === 'palak_paneer');
assert('tasty bite nutrition is not applied to generic palak paneer', tastyGeneric.ref?.kcal100 !== 92.9, String(tastyGeneric.ref?.kcal100));

const signals = level23ConfidenceSignals(generic, {
  confidence: 'high',
  portion_confidence: 'medium',
  preparation_confidence: 'low',
});
assert('recognition confidence stays separate', signals.recognition === 'high');
assert('portion confidence stays separate', signals.portion === 'medium');
assert('preparation confidence stays separate', signals.preparation === 'low');
assert('nutrition confidence stays separate', signals.nutrition === generic.nutrition_confidence);

const pohaVerified = getVerifiedRecord('poha');
if (pohaVerified) {
  const poha = enrichReferenceWithVerified({ id: 'poha', kcal100: 999, protein100: 1, carbs100: 1, fat100: 1 });
  assert('authoritative verified poha is not replaced by L2.3', poha.kcal100 === pohaVerified.kcal100, String(poha.kcal100));
  assert('poha is not tagged level2_3_generic', poha.nutrition_source !== 'level2_3_generic');
}

const unmatchedNames = records.filter((row) => !row.resolved_v4_id).map((row) => row.canonical_name);
assert('all 50 generic records are mapped', unmatchedNames.length === 0 && records.every((row) => row.resolved_v4_id), unmatchedNames.join(', '));
assert('vegetable biryani maps onto existing vegetable-biryani family ids', Boolean(byResolved[records.find((row) => row.canonical_name === 'vegetable biryani')?.resolved_v4_id]));
assert('paneer biryani maps onto existing paneer-biryani family ids', Boolean(byResolved[records.find((row) => row.canonical_name === 'paneer biryani')?.resolved_v4_id]));
assert('poori maps to existing puri id', byResolved.puri?.canonical_name === 'poori');

const vegLive = matchFoodReferenceDetailed('vegetable biryani', { useCache: false, logV4: false });
assert('vegetable biryani keeps the existing matcher id', vegLive.ref?.id === 'biryani', vegLive.ref?.id);
assert('verified IFCT biryani outranks generic vegetable L2.3', vegLive.ref?._verified === true && vegLive.ref?.kcal100 !== 165, String(vegLive.ref?.kcal100));
const paneerLive = matchFoodReferenceDetailed('paneer biryani', { useCache: false, logV4: false });
assert('paneer biryani keeps the existing matcher id', paneerLive.ref?.id === 'biryani', paneerLive.ref?.id);
assert('verified IFCT biryani outranks generic paneer L2.3', paneerLive.ref?._verified === true && paneerLive.ref?.kcal100 !== 205, String(paneerLive.ref?.kcal100));
const namedVeg = enrichReferenceWithVerified({ id: 'unverified_veg', kcal100: 999, protein100: 1, carbs100: 1, fat100: 1 }, { exactName: 'vegetable biryani' });
assert('exact vegetable biryani name overlays when the match is not verified', namedVeg.kcal100 === 165 && namedVeg.nutrition_source === 'level2_3_generic', String(namedVeg.kcal100));
const namedPaneer = enrichReferenceWithVerified({ id: 'unverified_paneer', kcal100: 999, protein100: 1, carbs100: 1, fat100: 1 }, { exactName: 'paneer biryani' });
assert('exact paneer biryani name overlays when the match is not verified', namedPaneer.kcal100 === 205 && namedPaneer.nutrition_source === 'level2_3_generic', String(namedPaneer.kcal100));
assert(
  'regional vegetable biryani uses the same generic overlay',
  matchFoodReferenceDetailed('dindigul vegetable biryani', { useCache: false, logV4: false }).ref?.kcal100 === 165,
);
assert(
  'generic dindigul mutton biryani still is not branded 163',
  matchFoodReferenceDetailed('dindigul mutton biryani', { useCache: false, logV4: false }).ref?.kcal100 === 190,
);
assert(
  'plain biryani does not inherit vegetable or paneer overlay',
  matchFoodReferenceDetailed('biryani', { useCache: false, logV4: false }).ref?.kcal100 === 175,
);

const fallback = enrichReferenceWithVerified({ id: 'toast', kcal100: 265, protein100: 9, carbs100: 49, fat100: 3 });
assert('unmapped foods keep v4_fallback source', fallback.nutrition_source === 'v4_fallback' || Boolean(getVerifiedRecord('toast')));

const started = Date.now();
for (let i = 0; i < 2000; i += 1) {
  matchFoodReferenceDetailed(i % 2 ? 'dindigul mutton biryani' : 'chicken curry', { useCache: true, logV4: false });
}
const elapsed = Date.now() - started;
assert('2000 hot-path lookups stay fast', elapsed < 250, `${elapsed}ms`);

assert('exact-brand V4 override count', INDIA_L23_STATS.exactBrandOverrideCount === 0, String(INDIA_L23_STATS.exactBrandOverrideCount));
assert('exact-brand indexed count', INDIA_L23_STATS.exactBrandIndexed === 8, String(INDIA_L23_STATS.exactBrandIndexed));
assert('generic mapped count is 50/50', INDIA_L23_STATS.genericMappedCount === 50, String(INDIA_L23_STATS.genericMappedCount));
assert('no unmatched generic records', INDIA_L23_STATS.unmatchedCount === 0, String(INDIA_L23_STATS.unmatchedCount));
assert('generic override map is populated', INDIA_L23_STATS.genericOverrideCount >= 50, String(INDIA_L23_STATS.genericOverrideCount));
assert('no duplicate generic ids', INDIA_L23_STATS.duplicateCount === 0, String(INDIA_L23_STATS.duplicateCount));
assert('no conflicts', INDIA_L23_STATS.conflictCount === 0, String(INDIA_L23_STATS.conflictCount));
assert(
  'verified records retained',
  (INDIA_L23_STATS.verifiedAuthoritativeWins?.length || INDIA_L23_STATS.verifiedAuthoritativeWins) === 5,
  String(INDIA_L23_STATS.verifiedAuthoritativeWins?.length || INDIA_L23_STATS.verifiedAuthoritativeWins),
);
assert('apply helper does not invent branded values on generic overlay', applyLevel23Overlay({ id: 'x', kcal100: 1 }, generic).nutrition_source === 'level2_3_generic');

console.log('\nLevel 2.3 report');
console.log(JSON.stringify({
  genericMappedCount: INDIA_L23_STATS.genericMappedCount,
  exactBrandIndexed: INDIA_L23_STATS.exactBrandIndexed,
  exactBrandOverrideCount: INDIA_L23_STATS.exactBrandOverrideCount,
  exactBrandNameOnlyCount: INDIA_L23_STATS.exactBrandNameOnlyCount,
  verifiedRecordsRetained: INDIA_L23_STATS.verifiedAuthoritativeWins,
  unmatchedCount: INDIA_L23_STATS.unmatchedCount,
  duplicates: INDIA_L23_STATS.duplicates,
  conflicts: INDIA_L23_STATS.conflicts,
  lookupMsFor2000: elapsed,
}, null, 2));
console.log('Done.');
