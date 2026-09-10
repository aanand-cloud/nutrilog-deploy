import {
  matchFoodReference,
  matchFoodReferenceDetailed,
  matchFoodReferenceTier1,
  clearFoodMatchCache,
  getFoodMatchCacheSize,
} from '../shared/nutrition-density.js';
import { normalizeFoodAlias } from '../shared/food-ref-v4-normalize.js';
import { V4_COLLISION_ALIASES } from '../shared/food-ref-v4-index.generated.js';
import { V4_ACTIVE_PHASES, clearV4MatchLog } from '../shared/food-ref-v4-rollout.js';
import { disambiguateCollisionIds } from '../shared/food-match-disambiguate.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('normalize trims and lowercases', normalizeFoodAlias('  Chicken Biryani! ') === 'chicken biryani');
assert('normalize spelling channa→chana', normalizeFoodAlias('Channa Masala') === 'chana masala');

assert('tier1 regex still works', matchFoodReferenceTier1('chicken curry')?.id === 'chicken_curry');

clearFoodMatchCache();
clearV4MatchLog();

const curry = matchFoodReferenceDetailed('chicken curry', { useCache: true });
assert('chicken curry resolves', curry.ref?.id === 'chicken_curry', curry.meta?.match_method);
assert('fast path used for chicken curry', ['alias_exact', 'canonical_id', 'regex'].includes(curry.meta?.match_method));
assert('match metadata present', Boolean(curry.meta?.food_id && curry.meta?.match_method && curry.meta?.confidence));

const indianOnly = matchFoodReferenceDetailed('adai', { logV4: false });
assert('indian v4 dish matches', indianOnly.ref?.id === 'adai', indianOnly.meta?.match_method);
assert('alias path is fast lookup', ['alias_exact', 'canonical_id'].includes(indianOnly.meta?.match_method));

const africanRollout = matchFoodReferenceDetailed('achu poulet dg', { logV4: false });
assert('african v4 dish matches with global rollout', africanRollout.ref?.id === 'achu_poulet_dg', africanRollout.meta?.match_method);
assert('global rollout phase active', V4_ACTIVE_PHASES.includes('global_rest'));
assert('china_thailand rollout phase active', V4_ACTIVE_PHASES.includes('china_thailand'));
assert('indian dish still resolves via v4', matchFoodReferenceDetailed('adai', { logV4: false }).ref?.id === 'adai');
assert('tier1 catches dish outside v4 rollout', matchFoodReferenceDetailed('crème brûlée', { logV4: false }).ref?.id === 'creme_brulee');

assert('cache stores repeat lookup', (() => {
  clearFoodMatchCache();
  matchFoodReferenceDetailed('adai', { useCache: true });
  const size1 = getFoodMatchCacheSize();
  matchFoodReferenceDetailed('adai', { useCache: true });
  return size1 === 1 && getFoodMatchCacheSize() === 1;
})());

// Regex still catches partial names not in alias map
const partial = matchFoodReferenceDetailed('homemade chicken curry with basmati');
assert('regex catches partial dish names', partial.ref?.id === 'chicken_curry', partial.meta?.match_method);

if (V4_COLLISION_ALIASES['butter tart']) {
  const ambiguous = matchFoodReferenceDetailed('butter tart', { fuzzy: false });
  assert(
    'collision alias resolves with global v4 rollout',
    ambiguous.ref?.id === 'butter_tart' || ambiguous.ref?.id === 'butter_tarts',
    ambiguous.ref?.id || 'none',
  );
  const resolved = disambiguateCollisionIds(V4_COLLISION_ALIASES['butter tart'], {
    itemName: 'butter tart',
    mealSummary: 'Canadian bakery pastry',
    cuisineHint: 'Canadian',
  });
  assert('collision disambiguation returns an id with context', Boolean(resolved), resolved || 'none');
}

matchFoodReferenceDetailed('some totally unknown xyz dish 12345');
assert('unknown dish returns null ref', matchFoodReference('some totally unknown xyz dish 12345') == null);

console.log('\nActive rollout phases:', V4_ACTIVE_PHASES.join(', '));
console.log('\nDone.');
