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

const pizza = getVerifiedRecord('pizza');
assert('pizza CoFID 11-936', pizza?.dataSource === 'cofid' && pizza?.sourceRecordId === '11-936');
assert('pizza kcal', pizza?.kcal100 === 272 && pizza?.protein100 === 12.2, JSON.stringify(pizza));
assert('margherita aliases to pizza', enrichReferenceWithVerified(matchFoodReferenceDetailed('pizza margherita').ref)?._verified === true
  && enrichReferenceWithVerified(matchFoodReferenceDetailed('pizza margherita').ref)?.kcal100 === 272);
assert('pepperoni pizza CoFID meat topped', getVerifiedRecord('pepperoni_pizza')?.sourceRecordId === '11-1015'
  && getVerifiedRecord('pepperoni_pizza')?.kcal100 === 255);
assert('diavola aliases to meat pizza', enrichReferenceWithVerified({ id: 'pizza_diavola' })?.kcal100 === 255);
assert('funghi uses vegetarian CoFID', getVerifiedRecord('pizza_funghi')?.sourceRecordId === '11-1014');
assert('napoli uses fish-topped CoFID', getVerifiedRecord('pizza_napoli')?.sourceRecordId === '11-1011');
assert('quattro formaggi not invented', !getVerifiedRecord('pizza_quattro_formaggi'));
assert('argentine pizza not invented', !getVerifiedRecord('pizza_argentine'));

const doner = getVerifiedRecord('doner_kebab');
assert('doner CoFID 19-526', doner?.dataSource === 'cofid' && doner?.sourceRecordId === '19-526');
assert('doner kcal', doner?.kcal100 === 248 && doner?.protein100 === 14.1, JSON.stringify(doner));
assert('kebab aliases to doner', enrichReferenceWithVerified({ id: 'kebab' })?.kcal100 === 248);
assert('beef doner meat-only CoFID', getVerifiedRecord('beef_doner')?.sourceRecordId === '19-539' && getVerifiedRecord('beef_doner')?.kcal100 === 377);
assert('shish kebab CoFID pitta', getVerifiedRecord('shish_kebab')?.sourceRecordId === '19-525' && getVerifiedRecord('shish_kebab')?.kcal100 === 149);
assert('kofta kebab CoFID', getVerifiedRecord('kofta_kebab')?.sourceRecordId === '19-642' && getVerifiedRecord('kofta_kebab')?.kcal100 === 290);
assert('chicken doner not invented', !getVerifiedRecord('chicken_doner'));
assert('shawarma not invented', !getVerifiedRecord('shawarma'));
assert('seekh kebab not invented', !getVerifiedRecord('seekh_kebab'));

assert('burger CoFID hamburger', getVerifiedRecord('burger')?.sourceRecordId === '19-544' && getVerifiedRecord('burger')?.kcal100 === 246);
assert('hamburger aliases to burger', enrichReferenceWithVerified({ id: 'hamburger' })?.kcal100 === 246);
assert('cheeseburger CoFID', getVerifiedRecord('cheeseburger')?.sourceRecordId === '19-545' && getVerifiedRecord('cheeseburger')?.kcal100 === 254);
assert('beef burger CoFID grilled', getVerifiedRecord('beef_burger')?.sourceRecordId === '19-546');
assert('lasagne CoFID homemade', getVerifiedRecord('lasagne')?.sourceRecordId === '19-481' && getVerifiedRecord('lasagne')?.kcal100 === 180);
assert('lasagna bolognese aliases to lasagne', enrichReferenceWithVerified({ id: 'lasagna_bolognese' })?.kcal100 === 180);
assert('spinach lasagne CoFID', getVerifiedRecord('lasagna_spinach')?.sourceRecordId === '15-186');
assert('bolognese CoFID spaghetti', getVerifiedRecord('bolognese')?.sourceRecordId === '19-628' && getVerifiedRecord('bolognese')?.kcal100 === 151);
assert('macaroni cheese CoFID', getVerifiedRecord('macaroni_bechamel')?.sourceRecordId === '11-954' && getVerifiedRecord('macaroni_bechamel')?.kcal100 === 183);
assert('naan CoFID retail', getVerifiedRecord('naan')?.sourceRecordId === '11-973' && getVerifiedRecord('naan')?.kcal100 === 285);
assert('garlic naan aliases to naan', enrichReferenceWithVerified({ id: 'garlic_naan' })?.kcal100 === 285);
assert('paratha CoFID', getVerifiedRecord('paratha')?.sourceRecordId === '11-1104');
assert('chapati aliases to roti', enrichReferenceWithVerified({ id: 'chapati' })?.sourceRecordId === '11-987');
assert('carbonara not invented as sauce-only', !getVerifiedRecord('carbonara'));

assert('sausage roll CoFID', getVerifiedRecord('sausage_roll')?.sourceRecordId === '19-468' && getVerifiedRecord('sausage_roll')?.kcal100 === 352);
assert('omelette CoFID plain', getVerifiedRecord('omelette')?.sourceRecordId === '12-946' && getVerifiedRecord('omelette')?.kcal100 === 191);
assert('falafel CoFID', getVerifiedRecord('falafel')?.sourceRecordId === '15-795' && getVerifiedRecord('falafel')?.kcal100 === 183);
assert('chow mein CoFID chicken takeaway', getVerifiedRecord('chow_mein')?.sourceRecordId === '19-321' && getVerifiedRecord('chow_mein')?.kcal100 === 147);
assert('fried rice CoFID egg takeaway', getVerifiedRecord('fried_rice')?.sourceRecordId === '11-444' && getVerifiedRecord('fried_rice')?.kcal100 === 186);
assert('egg fried rice aliases', enrichReferenceWithVerified({ id: 'egg_fried_rice' })?.kcal100 === 186);
assert('chicken burger CoFID', getVerifiedRecord('chicken_burger')?.sourceRecordId === '19-315' && getVerifiedRecord('chicken_burger')?.kcal100 === 235);

assert('pancakes CoFID sweet', getVerifiedRecord('pancakes')?.sourceRecordId === '11-1143' && getVerifiedRecord('pancakes')?.kcal100 === 234);
assert('pancake aliases to pancakes', enrichReferenceWithVerified({ id: 'pancake' })?.kcal100 === 234);
assert('tomato soup CoFID cream canned', getVerifiedRecord('tomato_soup')?.sourceRecordId === '17-652' && getVerifiedRecord('tomato_soup')?.kcal100 === 51);
assert('coleslaw CoFID retail', getVerifiedRecord('coleslaw')?.sourceRecordId === '15-635' && getVerifiedRecord('coleslaw')?.kcal100 === 173);
assert('chicken curry CoFID takeaway', getVerifiedRecord('chicken_curry')?.sourceRecordId === '19-322' && getVerifiedRecord('chicken_curry')?.kcal100 === 145);
assert('butter chicken aliases to tikka masala', enrichReferenceWithVerified({ id: 'butter_chicken' })?.sourceRecordId === '19-296');
assert('fish curry CoFID', getVerifiedRecord('fish_curry')?.sourceRecordId === '16-364' && getVerifiedRecord('fish_curry')?.kcal100 === 139);
assert('roast beef CoFID topside', getVerifiedRecord('roast_beef')?.sourceRecordId === '18-089' && getVerifiedRecord('roast_beef')?.kcal100 === 222);
assert('beef steak CoFID steakhouse', getVerifiedRecord('beef_steak')?.sourceRecordId === '18-051' && getVerifiedRecord('beef_steak')?.kcal100 === 213);
assert('caesar salad not invented', !getVerifiedRecord('caesar_salad'));

console.log('\nDone.');
