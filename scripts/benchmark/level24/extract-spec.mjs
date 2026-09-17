/**
 * Extract Level 2.4A benchmark spec into a compact isolated catalog.
 * Does not touch matcher, UI, or food-ref-v4.
 *
 * Run: node scripts/benchmark/level24/extract-spec.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectWave1Cases } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = resolve(root, 'data/benchmark/level24');
const specOut = resolve(outDir, 'india-benchmark-cases.json');
const waveOut = resolve(outDir, 'development-wave1.json');
const candidates = [
  process.argv[2],
  resolve(root, 'data/benchmark/level24/mealnova-level2-4A-india-benchmark-spec-v1.json'),
  'c:/Users/user/Downloads/mealnova-level2-4A-india-benchmark-spec-v1.json',
].filter(Boolean);

function loadPack() {
  if (existsSync(specOut) && !process.argv.includes('--from-source')) {
    return JSON.parse(readFileSync(specOut, 'utf8'));
  }
  const source = candidates.find((path) => existsSync(path));
  if (!source) throw new Error('Missing Level 2.4A spec JSON.');
  return JSON.parse(readFileSync(source, 'utf8'));
}

const pack = loadPack();
const cases = (pack.cases || []).map((row) => ({
  case_id: row.case_id,
  canonical_name: row.canonical_name,
  source_v4_id: row.source_v4_id || null,
  scenario: row.scenario,
  capture_context: row.capture_context,
  portion_truth_g: row.portion_truth_g,
  portion_class: row.portion_class,
  preparation_note: row.preparation_note,
  common_side: row.common_side || { name: 'none', portion_g: 0, kcal: 0 },
  lookalike_candidates: row.lookalike_candidates || [],
  ground_truth: row.ground_truth,
  evaluation: row.evaluation,
  split: row.split,
  status: row.status,
}));

const ids = cases.map((row) => row.case_id);
if (new Set(ids).size !== ids.length) {
  throw new Error('Duplicate case_id values in Level 2.4A spec.');
}

const wave1 = selectWave1Cases(cases, 200);
if (wave1.some((row) => row.split !== 'development')) {
  throw new Error('Wave 1 leaked a holdout case.');
}

const extracted = {
  version: pack.version || '2.4A.0',
  name: pack.name,
  purpose: pack.purpose,
  benchmark_scope: pack.benchmark_scope,
  targets: pack.targets,
  rules: pack.rules,
  error_taxonomy: pack.error_taxonomy,
  record_count: cases.length,
  development_count: cases.filter((row) => row.split === 'development').length,
  holdout_count: cases.filter((row) => row.split === 'holdout').length,
  updated: new Date().toISOString().slice(0, 10),
  cases,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(specOut, `${JSON.stringify(extracted, null, 2)}\n`);
writeFileSync(waveOut, `${JSON.stringify({
  version: '2.4B.0',
  purpose: 'First 150–200 real development images across the hardest/highest-priority foods.',
  holdout_policy: 'Never include holdout. Never use holdout results to tune MealNova.',
  case_count: wave1.length,
  foods: [...new Set(wave1.map((row) => row.canonical_name))],
  case_ids: wave1.map((row) => row.case_id),
}, null, 2)}\n`);

console.log('Level 2.4 spec extracted');
console.log(JSON.stringify({
  cases: extracted.record_count,
  development: extracted.development_count,
  holdout: extracted.holdout_count,
  wave1: wave1.length,
  wave1Foods: [...new Set(wave1.map((row) => row.canonical_name))].length,
}, null, 2));
