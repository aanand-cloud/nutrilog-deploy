/**
 * MealNova nutrition benchmark runner.
 * Reports metrics separately by category — does NOT produce a single flattering accuracy %.
 *
 * Usage:
 *   node scripts/run-nutrition-benchmark.mjs [--cases=core|trusted|recipes|all]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  loadBenchmarkFixtures,
  runBenchmarkCase,
  splitMealPhrases,
  parseQuantityFromText,
  phraseHasExplicitQuantity,
  itemBlob,
  mustIncludeMatch,
} from '../shared/benchmark-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadCases(name = 'core') {
  const path = join(__dirname, 'benchmark', `cases-${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function findItemByRef(items = [], refId = '') {
  return items.find((i) => i._refId === refId || i._per100?.refId === refId);
}

function splittingAccuracy(cases, results) {
  let ok = 0;
  for (let i = 0; i < cases.length; i += 1) {
    const phrases = splitMealPhrases(cases[i].input);
    const items = results[i]?.result?.items || [];
    if (phrases.length <= 1 || items.length >= phrases.length) ok += 1;
  }
  return cases.length ? ok / cases.length : 0;
}

function quantityRetentionAccuracy(cases, results) {
  let explicit = 0;
  let retained = 0;
  for (let i = 0; i < cases.length; i += 1) {
    const phrases = splitMealPhrases(cases[i].input);
    for (const phrase of phrases) {
      const q = parseQuantityFromText(phrase);
      if (!phraseHasExplicitQuantity(q)) continue;
      explicit += 1;
      const text = itemBlob(results[i]?.result?.items || []);
      const food = String(q.foodText || phrase).toLowerCase();
      if ((q.unit === 'g' && text.includes(`${Math.round(q.quantity)}g`))
        || (q.unit === 'ml' && text.includes(`${Math.round(q.quantity)}ml`))
        || (q.unit === 'piece' && new RegExp(`${Math.round(q.quantity)}\\s*piece`, 'i').test(text))
        || text.includes(food.slice(0, 8))) {
        retained += 1;
      }
    }
  }
  return explicit ? retained / explicit : 1;
}

function trustedNutrientAccuracy(cases, results, fixtures) {
  let checked = 0;
  let withinTol = 0;
  for (let i = 0; i < cases.length; i += 1) {
    const testCase = cases[i];
    const items = results[i]?.result?.items || [];
    const specs = testCase.itemFixtures
      || (testCase.fixtureId && testCase.grams
        ? [{ refId: testCase.refId, grams: testCase.grams, fixtureId: testCase.fixtureId }]
        : []);

    for (const spec of specs) {
      const fixture = fixtures[spec.fixtureId];
      const item = findItemByRef(items, spec.refId);
      if (!fixture || !item || !spec.grams) continue;
      checked += 1;
      const per100 = item._per100?.kcal ?? (item.calories_kcal / spec.grams) * 100;
      const tol = fixture.tolerancePct || 10;
      if (Math.abs(per100 - fixture.kcal100) / fixture.kcal100 <= tol / 100) {
        withinTol += 1;
      }
    }
  }
  return checked ? withinTol / checked : null;
}

function runSuite(suiteName, fixtures = {}) {
  const suite = loadCases(suiteName);
  const cases = suite.cases || [];
  const byCategory = {};
  let passed = 0;
  const results = [];

  console.log(`\n── Suite: ${suiteName} (${cases.length} cases) ──`);
  console.log(`${suite.description}\n`);

  for (const testCase of cases) {
    const outcome = runBenchmarkCase(testCase, fixtures);
    results.push(outcome);
    const cat = testCase.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = { pass: 0, total: 0 };
    byCategory[cat].total += 1;
    if (outcome.pass) {
      passed += 1;
      byCategory[cat].pass += 1;
      console.log(`PASS | ${testCase.id}`);
    } else {
      console.log(`FAIL | ${testCase.id} — ${outcome.failures.join('; ')}`);
      if (outcome.result) {
        console.log(`       items: ${itemBlob(outcome.result.items)}`);
        console.log(`       kcal: ${outcome.result.total_calories_kcal}`);
      }
    }
  }

  const splitRate = splittingAccuracy(cases, results);
  const qtyRate = quantityRetentionAccuracy(cases, results);
  const passRate = cases.length ? passed / cases.length : 0;
  const trustedRate = trustedNutrientAccuracy(cases, results, fixtures);

  console.log('\n── Metrics (reported separately) ──');
  console.log(`Case pass rate (${suiteName}): ${(passRate * 100).toFixed(1)}% (${passed}/${cases.length})`);
  if (suiteName === 'core') {
    console.log(`Component splitting recall: ${(splitRate * 100).toFixed(1)}% (target ≥98%)`);
    console.log(`Explicit quantity retention: ${(qtyRate * 100).toFixed(1)}% (target ≥99%)`);
  }
  if (trustedRate != null) {
    console.log(`Trusted per-100g kcal accuracy: ${(trustedRate * 100).toFixed(1)}% (CoFID/IFCT fixtures)`);
  }
  console.log('\nBy category:');
  for (const [cat, stats] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${stats.pass}/${stats.total} (${((stats.pass / stats.total) * 100).toFixed(0)}%)`);
  }

  return { passRate, passed, total: cases.length, trustedRate };
}

function main() {
  const arg = process.argv.find((a) => a.startsWith('--cases='));
  const mode = arg ? arg.split('=')[1] : 'all';
  const fixtures = loadBenchmarkFixtures(join(__dirname, '..'));

  console.log('MealNova nutrition benchmark');

  const suites = mode === 'all'
    ? [
      'core',
      'trusted',
      'recipes',
      'vision-recipes',
      'uk-expanded',
      'indian-expanded',
      'african-expanded',
      'american-expanded',
      'dessert-expanded',
      'east-asian-expanded',
      'mediterranean-expanded',
      'weighed-staples-expanded',
      'latin-american-expanded',
      'european-expanded',
      'weighed-portions-expanded',
    ]
    : [mode];
  const summary = [];

  for (const name of suites) {
    try {
      summary.push({ name, ...runSuite(name, fixtures) });
    } catch (err) {
      console.error(`Suite "${name}" failed to load: ${err.message}`);
      process.exitCode = 1;
    }
  }

  console.log('\n── Benchmark note ──');
  console.log('Trusted suite: CoFID/IFCT fixtures. Recipes suite: Layer C decomposition.');
  console.log('Vision-recipes suite: Phase 4 photo compose + recipe engine.');
  console.log('UK/Indian expanded suites: Phase 6 benchmark batch 1 (~45 new cases).');
  console.log('African/American/dessert suites: Phase 6 benchmark batch 2 (~43 new cases).');
  console.log('East Asian/Mediterranean/weighed staples: Phase 6 benchmark batch 3 (~51 new cases).');
  console.log('Latin American/European/weighed portions: Phase 6 benchmark batch 4 (~76 new cases).');
  console.log('P5 locked suite (200+ cases): run test-benchmark-locked.mjs for CI gates.\n');

  const core = summary.find((s) => s.name === 'core');
  if (core && core.passRate < 0.7) {
    console.log(`WARN | Core benchmark pass rate ${(core.passRate * 100).toFixed(1)}% is below 70%.`);
  }
}

main();
