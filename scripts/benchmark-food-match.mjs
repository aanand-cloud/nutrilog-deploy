/**
 * Benchmark alias-first vs regex-first matching orders.
 * Run: node scripts/benchmark-food-match.mjs
 */

import { performance } from 'node:perf_hooks';
import { matchFoodReferenceTier1 } from '../shared/food-reference-tier1.js';
import { normalizeFoodAlias } from '../shared/food-ref-v4-normalize.js';
import { V4_ALIAS_TO_ID, V4_BY_ID } from '../shared/food-ref-v4-index.generated.js';
import { clearFoodMatchCache, matchFoodReferenceDetailed } from '../shared/food-match-engine.js';

const SAMPLES = [
  'chicken biryani',
  'idli',
  'pad thai',
  'fish and chips',
  'butter chicken',
  'adai',
  'homemade chicken curry with rice',
  'masala dosa',
  'unknown mystery stew xyz',
];

function bench(label, fn, iterations = 5000) {
  fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const sample of SAMPLES) fn(sample);
  }
  const ms = performance.now() - start;
  console.log(`${label}: ${ms.toFixed(1)}ms (${iterations * SAMPLES.length} lookups)`);
}

function aliasFirst(sample) {
  const n = normalizeFoodAlias(sample);
  const id = V4_ALIAS_TO_ID[n] || (V4_BY_ID[n.replace(/\s+/g, '_')] ? n.replace(/\s+/g, '_') : null);
  if (id) return id;
  return matchFoodReferenceTier1(sample)?.id || null;
}

function regexFirst(sample) {
  const t1 = matchFoodReferenceTier1(sample)?.id;
  if (t1) return t1;
  const n = normalizeFoodAlias(sample);
  return V4_ALIAS_TO_ID[n] || null;
}

console.log('Benchmark sample set:', SAMPLES.join(', '));
bench('alias → regex', aliasFirst, 3000);
bench('regex → alias', regexFirst, 3000);

clearFoodMatchCache();
bench('engine + LRU cache', (sample) => matchFoodReferenceDetailed(sample, { useCache: true, logV4: false }).ref?.id, 3000);
bench('engine no cache', (sample) => matchFoodReferenceDetailed(sample, { useCache: false, logV4: false }).ref?.id, 1500);

console.log('\nDone.');
