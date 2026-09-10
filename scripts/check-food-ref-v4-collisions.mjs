import { V4_COLLISION_ALIASES, V4_INDEX_STATS } from '../shared/food-ref-v4-index.generated.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('index built', V4_INDEX_STATS.totalItems >= 7000, String(V4_INDEX_STATS.totalItems));
assert('unique aliases registered', V4_INDEX_STATS.uniqueAliases > 5000, String(V4_INDEX_STATS.uniqueAliases));
assert('collisions tracked not hidden', V4_INDEX_STATS.collisionAliases > 0, String(V4_INDEX_STATS.collisionAliases));

const sample = Object.entries(V4_COLLISION_ALIASES).slice(0, 3);
assert('collision entries are multi-id', sample.every(([, ids]) => ids.length > 1));

console.log('\nCollision sample (first 5):');
Object.entries(V4_COLLISION_ALIASES).slice(0, 5).forEach(([alias, ids]) => {
  console.log(`  ${alias} → ${ids.join(', ')}`);
});

console.log('\nDone.');
