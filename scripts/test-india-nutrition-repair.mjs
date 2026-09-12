import { readFileSync } from 'node:fs';
import { V4_BY_ID } from '../shared/food-ref-v4-index.generated.js';
import { getVerifiedRecord } from '../shared/verified-nutrition.js';
import {
  INDIA_REPAIR_PRIORITY_MAX,
  canRemovePlaceholderNutrition,
  evaluateIndiaRepairPromotion,
  isPlaceholderNutrition,
  isPriorityIndiaRepair,
} from '../shared/india-nutrition-repair.js';
import { matchFoodReferenceDetailed } from '../shared/nutrition-density.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const queue = JSON.parse(readFileSync(new URL('../data/level2/india-nutrition-repair-queue.json', import.meta.url), 'utf8'));
const repairs = JSON.parse(readFileSync(new URL('../data/level2/india-nutrition-repairs.json', import.meta.url), 'utf8'));
const records = queue.records || [];
const ids = records.map((row) => row.source_v4_id);

assert('queue version is 2.1', String(queue.version).startsWith('2.1'));
assert('priority window is rank 1–250', records.length === INDIA_REPAIR_PRIORITY_MAX, String(records.length));
assert('ranks are 1–250 in order', records[0]?.rank === 1 && records.at(-1)?.rank === 250);
assert('source_v4_id values are unique', new Set(ids).size === records.length);
assert('every source_v4_id exists in V4', records.every((row) => V4_BY_ID[row.source_v4_id]));
assert('queue is rank-prioritised', records.every((row, i) => row.rank === i + 1 && isPriorityIndiaRepair(row)));
assert('promotion gate requires provenance', queue.promotion_gate?.provenance_required === true);
assert('promotion gate forbids placeholder values', queue.promotion_gate?.no_placeholder_values === true);
assert('no validated repairs are auto-loaded', (repairs.records || []).length === 0);

const first = records[0];
assert('rank 1 maps to dindigul_mutton_biryani', first.source_v4_id === 'dindigul_mutton_biryani');
assert('current snapshot is placeholder', isPlaceholderNutrition(first.current_nutrition));

const snapshotGate = evaluateIndiaRepairPromotion(first, {
  source_v4_id: first.source_v4_id,
  ...first.current_nutrition,
  kcal100_central: first.current_nutrition.kcal100,
});
assert('current snapshot cannot be promoted', snapshotGate.ok === false, snapshotGate.errors.join('; '));
assert('placeholder stays until gated replacement exists', canRemovePlaceholderNutrition(first, first.current_nutrition) === false);

const incomplete = evaluateIndiaRepairPromotion(first, {
  source_v4_id: first.source_v4_id,
  kcal100_central: 180,
  protein100_central: 8,
  carbs100_central: 22,
  fat100_central: 6,
  fibre100_central: 1.2,
  nutrition_basis: 'recipe_derived',
});
assert('missing ranges/provenance/confidence block promotion', incomplete.ok === false);

const valid = evaluateIndiaRepairPromotion(first, {
  source_v4_id: first.source_v4_id,
  dataSource: 'ifct',
  nutrition_basis: 'recipe_derived',
  kcal100_central: 186,
  kcal100_low: 160,
  kcal100_high: 220,
  protein100_central: 9,
  carbs100_central: 22,
  fat100_central: 6,
  fibre100_central: 1.4,
  typical_portion_g: 300,
  portion_low_g: 220,
  portion_high_g: 380,
  confidence: 'medium',
  source_notes: 'IFCT ingredients + standardized Dindigul mutton biryani recipe',
  validated_at: '2026-09-12',
  evidence_paths: ['ICMR-NIN IFCT 2017 ingredients', 'standardized recipe calculation'],
});
assert('complete provenance/range/confidence can promote', valid.ok === true, valid.errors.join('; '));
assert('wrong source_v4_id is rejected', evaluateIndiaRepairPromotion(first, {
  source_v4_id: 'idli',
  dataSource: 'ifct',
  nutrition_basis: 'recipe_derived',
  kcal100_central: 186,
  kcal100_low: 160,
  kcal100_high: 220,
  protein100_central: 9,
  carbs100_central: 22,
  fat100_central: 6,
  fibre100_central: 1.4,
  typical_portion_g: 300,
  portion_low_g: 220,
  portion_high_g: 380,
  confidence: 'medium',
  source_notes: 'notes',
  validated_at: '2026-09-12',
  evidence_paths: ['IFCT', 'recipe'],
}).ok === false);

for (const row of records.slice(0, 8)) {
  const live = V4_BY_ID[row.source_v4_id];
  assert(
    `${row.source_v4_id} still uses live V4 nutrition`,
    Array.isArray(live) && live[0] === row.current_nutrition.kcal100,
    `${live?.[0]} vs ${row.current_nutrition.kcal100}`,
  );
  assert(`${row.source_v4_id} not auto-verified`, !getVerifiedRecord(row.source_v4_id));
}

const biryani = matchFoodReferenceDetailed('dindigul mutton biryani', { useCache: false, logV4: false });
assert('core matcher still resolves dindigul mutton biryani', biryani.ref?.id === 'dindigul_mutton_biryani');
assert(
  'V4 catalog still holds the estimated snapshot',
  Array.isArray(V4_BY_ID.dindigul_mutton_biryani)
    && V4_BY_ID.dindigul_mutton_biryani[0] === first.current_nutrition.kcal100,
  String(V4_BY_ID.dindigul_mutton_biryani?.[0]),
);

console.log('\nIndia repair queue:', records.length, 'priority records');
console.log('Done.');
