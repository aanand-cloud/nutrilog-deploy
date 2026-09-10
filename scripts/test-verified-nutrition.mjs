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

console.log('\nDone.');
