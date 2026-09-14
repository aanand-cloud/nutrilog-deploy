import {
  matchFoodReference,
  matchFoodReferenceDetailed,
  clearFoodMatchCache,
} from '../shared/nutrition-density.js';
import { V4_ALIAS_TO_ID, V4_BY_ID, V4_COLLISION_ALIASES } from '../shared/food-ref-v4-index.generated.js';
import { LEVEL1_ALIAS_TO_ID, LEVEL1_INDEX_STATS } from '../shared/level1-recognition-index.generated.js';
import { FOOD_REFERENCES } from '../shared/food-references.js';
import { getVerifiedRecord } from '../shared/verified-nutrition.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

clearFoodMatchCache();

const aliases = Object.keys(LEVEL1_ALIAS_TO_ID);
assert('level1 index has unique aliases', aliases.length >= 1000, String(aliases.length));
assert('level1 stats match generated map', LEVEL1_INDEX_STATS.uniqueAliases === aliases.length);

const overlapV4 = aliases.filter((alias) => V4_ALIAS_TO_ID[alias] || V4_COLLISION_ALIASES[alias]);
assert('level1 never overrides V4 unique or collision aliases', overlapV4.length === 0, overlapV4.slice(0, 5).join(', '));

const uniqueKeys = new Set(aliases);
assert('normalized terms are deduplicated', uniqueKeys.size === aliases.length);

const knownIds = new Set([
  ...Object.keys(V4_BY_ID),
  ...FOOD_REFERENCES.map((row) => row.id),
]);
const unknownTargets = [...new Set(Object.values(LEVEL1_ALIAS_TO_ID))]
  .filter((id) => !knownIds.has(id) && !getVerifiedRecord(id));
assert('every level1 target is an existing food id', unknownTargets.length === 0, unknownTargets.slice(0, 8).join(', '));

const idli = matchFoodReferenceDetailed('idli', { useCache: false, logV4: false });
const iddly = matchFoodReferenceDetailed('iddly', { useCache: false, logV4: false });
assert('iddly resolves to idli', iddly.ref?.id === 'idli', iddly.ref?.id || 'none');
assert(
  'iddly uses existing idli nutrition',
  iddly.ref?.kcal100 === idli.ref?.kcal100
    && iddly.ref?.protein100 === idli.ref?.protein100
    && iddly.ref?.carbs100 === idli.ref?.carbs100
    && iddly.ref?.fat100 === idli.ref?.fat100,
  `${iddly.ref?.kcal100} vs ${idli.ref?.kcal100}`,
);

const masala = matchFoodReferenceDetailed('masala dosa', { useCache: false, logV4: false });
const thosai = matchFoodReferenceDetailed('masala thosai', { useCache: false, logV4: false });
assert('masala thosai resolves to masala dosa', thosai.ref?.id === 'masala_dosa', thosai.ref?.id || 'none');
assert('masala thosai nutrition matches masala dosa', thosai.ref?.kcal100 === masala.ref?.kcal100);

const curry = matchFoodReferenceDetailed('chicken curry', { useCache: false, logV4: false });
assert('existing chicken curry still resolves', curry.ref?.id === 'chicken_curry', curry.ref?.id || 'none');
assert(
  'existing chicken curry still uses a V4/tier1 fast path',
  ['alias_exact', 'canonical_id', 'regex'].includes(curry.meta?.match_method),
  curry.meta?.match_method,
);

assert('unknown dish still returns null', matchFoodReference('some totally unknown xyz dish 12345') == null);
assert('golden delicious apple still matches apple', matchFoodReference('golden delicious apple')?.id === 'apple', matchFoodReference('golden delicious apple')?.id || 'none');
assert('hog plum is not European plum', matchFoodReference('hog plum')?.id === 'hog_plum', matchFoodReference('hog plum')?.id || 'none');
assert('june plum maps to hog plum', matchFoodReference('june plum')?.id === 'hog_plum', matchFoodReference('june plum')?.id || 'none');
assert('plain plum still matches plum', matchFoodReference('plum')?.id === 'plum', matchFoodReference('plum')?.id || 'none');

console.log('\nLevel 1 recognition stats:', LEVEL1_INDEX_STATS);
console.log('\nDone.');
