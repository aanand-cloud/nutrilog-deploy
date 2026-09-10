#!/usr/bin/env node
/**
 * P5 locked benchmark CI gate — fails when accuracy metrics breach manifest thresholds.
 *
 * Usage:
 *   node scripts/test-benchmark-locked.mjs [--verbose]
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadBenchmarkFixtures,
  loadBenchmarkSuite,
  runBenchmarkCase,
  computeP5Metrics,
} from '../shared/benchmark-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lockedDir = join(__dirname, 'benchmark', 'locked');
const verbose = process.argv.includes('--verbose');

function pct(n) {
  return n == null ? 'n/a' : `${(n * 100).toFixed(1)}%`;
}

function fmtRate(n) {
  return n == null ? 'n/a' : `${(n * 100).toFixed(1)}%`;
}

function checkGate(label, actual, min, max = null) {
  if (actual == null) return { ok: true, label, actual, threshold: min };
  const ok = max == null ? actual >= min : actual <= max;
  return { ok, label, actual, threshold: min, max };
}

function main() {
  const manifest = JSON.parse(readFileSync(join(lockedDir, 'manifest.json'), 'utf8'));
  const suite = loadBenchmarkSuite('scripts/benchmark/locked/cases-p5-locked.json');
  const cases = suite.cases || [];
  const fixtures = loadBenchmarkFixtures(join(__dirname, '..'));

  if (cases.length < Object.values(manifest.quotas).reduce((a, b) => a + b, 0)) {
    console.error(`P5 locked suite has ${cases.length} cases — regenerate with generate-p5-locked-benchmark.mjs`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n── P5 locked benchmark (${cases.length} cases) ──`);
  console.log(`Build lock: ${manifest.buildLock}`);
  console.log(`Region counts: ${JSON.stringify(suite.regionCounts || manifest.regionCounts)}\n`);

  const outcomes = cases.map((testCase) => runBenchmarkCase(testCase, fixtures));
  const metrics = computeP5Metrics(cases, outcomes);

  const mandatoryIds = new Set(
    (loadBenchmarkSuite('scripts/benchmark/locked/cases-mandatory-p5.json').cases || []).map((c) => c.id),
  );
  const mandatoryOutcomes = outcomes.filter((_, i) => mandatoryIds.has(cases[i].id));
  const mandatoryCases = cases.filter((c) => mandatoryIds.has(c.id));
  const mandatoryPassRate = mandatoryCases.length
    ? mandatoryOutcomes.filter((o) => o.pass).length / mandatoryCases.length
    : 1;

  const gates = manifest.gates || {};
  const checks = [
    checkGate('Case pass rate', metrics.casePassRate, gates.casePassRateMin ?? 0.95),
    checkGate('Component recognition', metrics.componentRecognition, gates.componentRecognitionMin ?? 0.95),
    checkGate('Ingredient retention', metrics.ingredientRetention, gates.ingredientRetentionMin ?? 0.98),
    checkGate('Quantity binding', metrics.quantityBinding, gates.quantityBindingMin ?? 0.98),
    checkGate('Median calorie error', metrics.medianCalorieError, null, gates.medianCalorieErrorPctMax ?? 0.10),
    checkGate('Within ±20% kcal', metrics.within20Pct, gates.within20PctMin ?? 0.90),
    checkGate('Range integrity', metrics.rangeIntegrity, gates.rangeIntegrityMin ?? 1.0),
    checkGate('First submission success', metrics.firstSubmissionSuccess, gates.firstSubmissionSuccessMin ?? 1.0),
    checkGate('Weight provenance', metrics.weightProvenance, gates.weightProvenanceMin ?? 1.0),
    checkGate('Mandatory pass rate', mandatoryPassRate, gates.mandatoryPassRateMin ?? 1.0),
  ];

  console.log('── P5 metrics ──');
  console.log(`Case pass rate:          ${pct(metrics.casePassRate)} (${metrics.passed}/${metrics.total})`);
  console.log(`Component recognition:   ${pct(metrics.componentRecognition)}`);
  console.log(`Ingredient retention:    ${pct(metrics.ingredientRetention)}`);
  console.log(`Quantity binding:        ${pct(metrics.quantityBinding)}`);
  console.log(`Median calorie error:    ${metrics.medianCalorieError == null ? 'n/a' : pct(metrics.medianCalorieError)} (${metrics.calorieMeasured} measured)`);
  console.log(`Within ±10% kcal:        ${fmtRate(metrics.within10Pct)}`);
  console.log(`Within ±20% kcal:        ${fmtRate(metrics.within20Pct)}`);
  console.log(`Range integrity:         ${pct(metrics.rangeIntegrity)}`);
  console.log(`First submission:        ${pct(metrics.firstSubmissionSuccess)}`);
  console.log(`Weight provenance:       ${pct(metrics.weightProvenance)}`);
  console.log(`Splitting recall:        ${pct(metrics.splittingRecall)}`);
  console.log(`Mandatory pass rate:     ${pct(mandatoryPassRate)} (${mandatoryCases.length} cases)\n`);

  console.log('── CI gates ──');
  let failed = false;
  for (const check of checks) {
    const threshold = check.max != null
      ? `≤ ${pct(check.threshold)}`
      : `≥ ${pct(check.threshold)}`;
    const status = check.ok ? 'PASS' : 'FAIL';
    console.log(`${status} | ${check.label}: ${pct(check.actual)} (gate ${threshold})`);
    if (!check.ok) failed = true;
  }

  if (verbose || failed) {
    console.log('\n── Failed cases ──');
    outcomes.forEach((outcome, i) => {
      if (outcome.pass) return;
      const c = cases[i];
      console.log(`FAIL | ${c.id} [${c.p5Region}] — ${outcome.failures.join('; ')}`);
      if (verbose && outcome.result) {
        console.log(`       input: ${c.input}`);
        console.log(`       kcal: ${outcome.result.total_calories_kcal}`);
      }
    });
  }

  if (failed) {
    console.error('\nP5 locked benchmark gate breach — fix parsing/nutrition before release.');
    process.exitCode = 1;
  } else {
    console.log('\nP5 locked benchmark: all gates passed.');
  }
}

main();
