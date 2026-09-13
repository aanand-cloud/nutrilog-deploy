import {
  getVerifiedRecord,
  isVerifiedFoodId,
  enrichReferenceWithVerified,
  VERIFIED_NUTRITION_STATS,
} from '../shared/verified-nutrition.js';
import { matchFoodReferenceDetailed } from '../shared/food-match-engine.js';
import { canonicalFromReference } from '../shared/canonical-food-model.js';
import { getMealNovaFlags, resetMealNovaFlagsCache } from '../shared/feature-flags.js';
import { V4_ACTIVE_PHASES } from '../shared/food-ref-v4-rollout.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

resetMealNovaFlagsCache();
assert('verified registry loaded', VERIFIED_NUTRITION_STATS.count >= 35, `${VERIFIED_NUTRITION_STATS.count} records`);
assert('v4 priority flag on (Phase 2)', getMealNovaFlags().v4CanonicalPriority === true);
assert('uk_europe rollout active', V4_ACTIVE_PHASES.includes('uk_europe'));
assert('global_rest rollout active', V4_ACTIVE_PHASES.includes('global_rest'));

const baked = getVerifiedRecord('baked_beans');
assert('baked_beans CoFID source', baked?.dataSource === 'cofid' && baked?.sourceRecordId === '13-149');
assert('baked_beans kcal', baked?.kcal100 === 105);

const idli = getVerifiedRecord('idli');
assert('idli IFCT source', idli?.dataSource === 'ifct' && idli?.sourceRecordId === 'A031');

const enriched = enrichReferenceWithVerified({ id: 'butter', kcal100: 700, protein100: 0, carbs100: 0, fat100: 80 });
assert('enrich overlays kcal', enriched.kcal100 === 717 && enriched._verified === true);

const match = matchFoodReferenceDetailed('200g baked beans');
assert('match baked beans', match.ref?.id === 'baked_beans', match.ref?.id);
const canonical = canonicalFromReference(match.ref, match.meta);
assert('canonical verified status', canonical.verificationStatus === 'verified');
assert('canonical dataSource', canonical.dataSource === 'cofid');

const riceMatch = matchFoodReferenceDetailed('100g cooked rice');
assert('rice match has ref', Boolean(riceMatch.ref?.id));
const riceCanonical = canonicalFromReference(
  enrichReferenceWithVerified(riceMatch.ref),
  riceMatch.meta,
);
assert('rice verified or existing', ['verified', 'estimated'].includes(riceCanonical.verificationStatus));

assert('isVerifiedFoodId roti', isVerifiedFoodId('roti'));
assert('isVerifiedFoodId unknown', !isVerifiedFoodId('xyzzy_food'));

const okra = getVerifiedRecord('okra');
assert('okra IFCT source', okra?.dataSource === 'ifct' && okra?.sourceRecordId === 'D056');
assert('okra kcal', okra?.kcal100 === 28);

const ladiesFinger = matchFoodReferenceDetailed('ladies finger');
assert('match ladies finger → okra', ladiesFinger.ref?.id === 'okra', ladiesFinger.ref?.id);
assert('okra overlay', enrichReferenceWithVerified(ladiesFinger.ref)._verified === true);

const beans = matchFoodReferenceDetailed('french beans');
assert('match french beans', beans.ref?.id === 'french_beans', beans.ref?.id);

const plainBeans = matchFoodReferenceDetailed('beans');
assert('plain beans are french beans not baked', plainBeans.ref?.id === 'french_beans', plainBeans.ref?.id);

const bakedStill = matchFoodReferenceDetailed('200g baked beans');
assert('baked beans still baked', bakedStill.ref?.id === 'baked_beans', bakedStill.ref?.id);

const ivy = matchFoodReferenceDetailed('ivy gourd');
assert('match ivy gourd', ivy.ref?.id === 'ivy_gourd', ivy.ref?.id);

const karela = matchFoodReferenceDetailed('karela');
assert('match karela', karela.ref?.id === 'karela', karela.ref?.id);

const gobi = matchFoodReferenceDetailed('cauliflower');
assert('cauliflower not broccoli', gobi.ref?.id === 'cauliflower', gobi.ref?.id);

const mango = getVerifiedRecord('mango');
assert('mango IFCT source', mango?.dataSource === 'ifct' && mango?.sourceRecordId === 'E036');
assert('mango fibre', mango?.fibre100 === 1.88);
assert('match mango', matchFoodReferenceDetailed('ripe mango').ref?.id === 'mango', matchFoodReferenceDetailed('ripe mango').ref?.id);
assert('match guava fibre overlay', enrichReferenceWithVerified(matchFoodReferenceDetailed('guava').ref).fibre100 === 8.59);
assert('match raisins not grapes', matchFoodReferenceDetailed('raisins').ref?.id === 'raisins', matchFoodReferenceDetailed('raisins').ref?.id);
assert('match kiwi', matchFoodReferenceDetailed('kiwi').ref?.id === 'kiwi', matchFoodReferenceDetailed('kiwi').ref?.id);
assert('banana still banana', matchFoodReferenceDetailed('banana').ref?.id === 'banana', matchFoodReferenceDetailed('banana').ref?.id);

console.log('\nDone.');
