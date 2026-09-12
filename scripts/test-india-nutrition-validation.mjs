import { readFileSync } from 'node:fs';
import { V4_BY_ID } from '../shared/food-ref-v4-index.generated.js';
import { getVerifiedRecord, enrichReferenceWithVerified } from '../shared/verified-nutrition.js';
import { matchFoodReferenceDetailed } from '../shared/nutrition-density.js';
import {
  INDIA_APPROVED_BY_V4_ID,
  INDIA_VALIDATION_STATS,
  evaluateIndiaValidationPromotion,
  getApprovedIndiaNutrition,
  indiaConfidenceSignals,
  isIndiaProductionApproved,
  isProvisionalIndiaReference,
} from '../shared/india-nutrition-validation.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const pack = JSON.parse(readFileSync(new URL('../data/level2/india-nutrition-validation.json', import.meta.url), 'utf8'));
const records = pack.records || [];
const byId = Object.fromEntries(records.map((row) => [row.source_v4_id, row]));

assert('pack version is 2.2', String(pack.version).startsWith('2.2'));
assert('250 records keyed by source_v4_id', records.length === 250 && pack.record_count === 250);
assert('source_v4_id values are unique', new Set(records.map((row) => row.source_v4_id)).size === 250);
assert('every source_v4_id exists in V4', records.every((row) => V4_BY_ID[row.source_v4_id]));
assert('no production_approved records yet', records.every((row) => row.production_approved === false));
assert('approved overlay map is empty', INDIA_VALIDATION_STATS.approvedCount === 0);
assert('approved lookup is a no-op', getApprovedIndiaNutrition('dindigul_mutton_biryani') == null);
assert('dindigul is not production approved', isIndiaProductionApproved('dindigul_mutton_biryani') === false);

const first = byId.dindigul_mutton_biryani;
assert('rank 1 is dindigul_mutton_biryani', first?.rank === 1);
assert('provisional snapshot is marked provisional', isProvisionalIndiaReference(first));
assert(
  'provisional kcal matches current V4 snapshot, not a new invented value',
  first.provisional.kcal100_central === first.current_v4_nutrition.kcal100,
);

const signals = indiaConfidenceSignals(first, { confidence: 'high', portion_confidence: 'medium' });
assert('recognition confidence stays on the match signal', signals.recognition === 'high');
assert('portion confidence stays separate', signals.portion === 'medium');
assert('nutrition confidence stays separate', signals.nutrition === 'low');

const blocked = evaluateIndiaValidationPromotion(first, {
  source_v4_id: first.source_v4_id,
  ...first.provisional,
  production_approved: false,
  validation_status: first.validation_status,
});
assert('provisional pack cannot promote', blocked.ok === false, blocked.errors.join('; '));

const live = matchFoodReferenceDetailed('dindigul mutton biryani', { useCache: false, logV4: false });
assert('core matcher still uses V4 dindigul nutrition', live.ref?.kcal100 === 210, String(live.ref?.kcal100));
assert('enrich does not apply provisional overlay', enrichReferenceWithVerified(live.ref)?.kcal100 === 210);
assert('verified overlay unchanged', !getVerifiedRecord('dindigul_mutton_biryani'));
assert('approved map has no provisional keys', Object.keys(INDIA_APPROVED_BY_V4_ID).length === 0);

console.log('\nIndia 2.2 validation:', INDIA_VALIDATION_STATS);
console.log('Done.');
