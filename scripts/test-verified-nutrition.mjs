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
assert('baked_beans CoFID source', baked?.dataSource === 'cofid' && baked?.sourceRecordId === '13-532');
assert('baked_beans kcal', baked?.kcal100 === 81);

const enriched = enrichReferenceWithVerified({ id: 'butter', kcal100: 700, protein100: 0, carbs100: 0, fat100: 80 });
assert('enrich overlays kcal', enriched.kcal100 === 744 && enriched._verified === true);

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
const banana = getVerifiedRecord('banana');
assert('banana CoFID source', banana?.dataSource === 'cofid' && banana?.sourceRecordId === '14-318');
assert('banana kcal', banana?.kcal100 === 81);
assert('banana protein', banana?.protein100 === 1.2);
assert('banana fibre', banana?.fibre100 === 1.4);
assert('banana sugars', banana?.sugar100 === 18.1);
assert('banana still banana', matchFoodReferenceDetailed('banana').ref?.id === 'banana', matchFoodReferenceDetailed('banana').ref?.id);
assert('banana overlay', enrichReferenceWithVerified(matchFoodReferenceDetailed('70g banana').ref).kcal100 === 81);

const almonds = getVerifiedRecord('almonds');
assert('almonds IFCT source', almonds?.dataSource === 'ifct' && almonds?.sourceRecordId === 'H001');
assert('almonds fibre', almonds?.fibre100 === 13.06);
assert('match almonds not generic nuts', matchFoodReferenceDetailed('roasted almonds').ref?.id === 'almonds', matchFoodReferenceDetailed('roasted almonds').ref?.id);
assert('match peanuts not generic nuts', matchFoodReferenceDetailed('peanuts').ref?.id === 'peanuts', matchFoodReferenceDetailed('peanuts').ref?.id);
assert('peanut butter still peanut butter', matchFoodReferenceDetailed('peanut butter').ref?.id === 'peanut_butter', matchFoodReferenceDetailed('peanut butter').ref?.id);
assert('chia fibre overlay', enrichReferenceWithVerified(matchFoodReferenceDetailed('chia seeds').ref).fibre100 === 34.4);
assert('match sesame seeds', matchFoodReferenceDetailed('sesame seeds').ref?.id === 'sesame_seeds', matchFoodReferenceDetailed('sesame seeds').ref?.id);
assert('match walnuts', matchFoodReferenceDetailed('walnuts').ref?.id === 'walnuts', matchFoodReferenceDetailed('walnuts').ref?.id);

const paneer = getVerifiedRecord('paneer');
assert('paneer IFCT source', paneer?.dataSource === 'ifct' && paneer?.sourceRecordId === 'L003');
assert('paneer protein', paneer?.protein100 === 18.86);
assert('match paneer cubes', matchFoodReferenceDetailed('paneer').ref?.id === 'paneer', matchFoodReferenceDetailed('paneer').ref?.id);
assert('palak paneer stays dish', matchFoodReferenceDetailed('palak paneer').ref?.id === 'palak_paneer', matchFoodReferenceDetailed('palak paneer').ref?.id);
const chanaHit = matchFoodReferenceDetailed('chana');
const chanaEnriched = enrichReferenceWithVerified(chanaHit.ref);
assert('chana uses chickpea nutrition', chanaEnriched?.kcal100 === 129 && chanaEnriched?.fibre100 === 10.6 && chanaEnriched?._verified === true, `${chanaHit.ref?.id} ${chanaEnriched?.kcal100}`);
assert('chana is not chana masala', chanaHit.ref?.id !== 'chana_masala', chanaHit.ref?.id);
assert('match chick peas', matchFoodReferenceDetailed('chick peas').ref?.id === 'chickpeas', matchFoodReferenceDetailed('chick peas').ref?.id);
assert('chana masala stays curry', matchFoodReferenceDetailed('chana masala').ref?.id === 'chana_masala', matchFoodReferenceDetailed('chana masala').ref?.id);
assert('match tofu fibre', enrichReferenceWithVerified(matchFoodReferenceDetailed('firm tofu').ref).fibre100 === 2.3);
assert('mapo tofu stays mapo', matchFoodReferenceDetailed('mapo tofu').ref?.id === 'mapo_tofu', matchFoodReferenceDetailed('mapo tofu').ref?.id);
assert('match rajma', matchFoodReferenceDetailed('rajma').ref?.id === 'rajma', matchFoodReferenceDetailed('rajma').ref?.id);
assert('chickpeas CoFID kept', getVerifiedRecord('chickpeas')?.dataSource === 'cofid' && getVerifiedRecord('chickpeas')?.sourceRecordId === '13-662');

const sambar = getVerifiedRecord('sambar');
assert('sambar CoFID 12-467', sambar?.dataSource === 'cofid' && sambar?.sourceRecordId === '12-467');
assert('sambar kcal/macros', sambar?.kcal100 === 49 && sambar?.protein100 === 3.1 && sambar?.fibre100 === 2.4, JSON.stringify(sambar));
const raita = getVerifiedRecord('raita');
assert('raita CoFID 17-832', raita?.dataSource === 'cofid' && raita?.sourceRecordId === '17-832');
assert('raita kcal/macros', raita?.kcal100 === 57 && raita?.protein100 === 4.4 && raita?.fat100 === 2.4, JSON.stringify(raita));
const milkHit = enrichReferenceWithVerified(matchFoodReferenceDetailed('milk').ref);
assert('milk aliases to verified CoFID semi-skimmed', milkHit?._verified === true && milkHit?.kcal100 === 46 && milkHit?.sourceRecordId === '12-313', `${milkHit?.kcal100} ${milkHit?.sourceRecordId}`);
assert('idli not invented as verified', !getVerifiedRecord('idli'));
assert('dosa not invented as verified', !getVerifiedRecord('dosa'));

console.log('\nDone.');
