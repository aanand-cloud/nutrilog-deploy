/**
 * MealNova benchmark engine — shared case runner and P5 metric calculators.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveMealFromText } from './meal-resolution-pipeline.js';
import { composeAnalysisFromVision } from './vision-analysis-compose.js';
import { splitMealPhrases, parseQuantityFromText, phraseHasExplicitQuantity } from './quantity-parser.js';
import { getVerifiedRecord } from './verified-nutrition.js';
import { scoreMealConfidence } from './nutrition-confidence.js';
import {
  BENCHMARK_SYNONYMS,
  mustIncludeMatch,
  itemBlob,
  findItemByRef,
  num,
  withinTolerance,
  median,
} from './benchmark-synonyms.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadBenchmarkFixtures(rootDir = join(__dirname, '..')) {
  const path = join(rootDir, 'scripts', 'benchmark', 'fixtures', 'trusted-per100.json');
  return JSON.parse(readFileSync(path, 'utf8')).fixtures || {};
}

export function loadBenchmarkSuite(relativePath, rootDir = join(__dirname, '..')) {
  const path = join(rootDir, relativePath);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function runTrustedChecks(testCase, result, fixtures) {
  const failures = [];
  const items = result?.items || [];

  if (testCase.fixtureId && testCase.grams) {
    const item = findItemByRef(items, testCase.refId) || items[0];
    const fixture = fixtures[testCase.fixtureId];
    if (item && fixture) {
      const per100 = item._per100?.kcal ?? (item.calories_kcal / testCase.grams) * 100;
      const tol = fixture.tolerancePct || testCase.tolerancePct || 10;
      const delta = Math.abs(per100 - fixture.kcal100) / fixture.kcal100;
      if (delta > tol / 100) {
        failures.push(`per100 kcal ${Math.round(per100)} vs trusted ${fixture.kcal100} (>${tol}%)`);
      }
    }
  }

  if (testCase.itemFixtures?.length) {
    for (const spec of testCase.itemFixtures) {
      const item = findItemByRef(items, spec.refId);
      const fixture = fixtures[spec.fixtureId];
      if (!item) {
        failures.push(`missing ref ${spec.refId}`);
        continue;
      }
      if (fixture && spec.grams) {
        const per100 = item._per100?.kcal ?? (item.calories_kcal / spec.grams) * 100;
        const tol = fixture.tolerancePct || testCase.tolerancePct || 12;
        const delta = Math.abs(per100 - fixture.kcal100) / fixture.kcal100;
        if (delta > tol / 100) {
          failures.push(`${spec.refId} per100 ${Math.round(per100)} vs ${fixture.kcal100}`);
        }
      }
    }
  }

  if (testCase.expectVerified) {
    const item = findItemByRef(items, testCase.refId) || items[0];
    const verified = getVerifiedRecord(testCase.refId);
    const status = item?._per100?.verificationStatus || item?._canonical?.verificationStatus;
    if (verified && status !== 'verified') {
      failures.push(`expected verified provenance for ${testCase.refId}, got ${status || 'none'}`);
    }
  }

  if (testCase.expectRecipeDerived) {
    const derived = items.filter((i) => i._recipeDerived);
    if (testCase.expectRecipeDerived === false) {
      if (derived.length >= 2) failures.push(`expected no recipe lump (got ${derived.length} derived items)`);
    } else if (derived.length < 2) {
      failures.push(`expected recipe decomposition (≥2 derived items, got ${derived.length})`);
    }
  }

  if (testCase.maxItems && items.length > testCase.maxItems) {
    failures.push(`items ${items.length} > max ${testCase.maxItems}`);
  }

  return failures;
}

function findItemByToken(items = [], token = '') {
  const n = token.toLowerCase();
  return items.find((item) => `${item.name || ''} ${item._refId || ''}`.toLowerCase().includes(n)
    || mustIncludeMatch(`${item.name || ''} ${item._refId || ''}`, token));
}

export function runBenchmarkCase(testCase, fixtures = {}, { synonyms = BENCHMARK_SYNONYMS } = {}) {
  let result;
  const failures = [];

  if (testCase.vision) {
    result = composeAnalysisFromVision(testCase.vision || {});
  } else {
    result = resolveMealFromText(testCase.input, { source: 'benchmark' });
  }

  if (!result) {
    return { pass: false, failures: ['no result'], result: null, testCase };
  }

  const items = result.items || [];
  const text = itemBlob(items);

  if (testCase.minItems && items.length < testCase.minItems) {
    failures.push(`items ${items.length} < min ${testCase.minItems}`);
  }

  for (const token of testCase.mustInclude || []) {
    if (!mustIncludeMatch(text, token, synonyms)) {
      failures.push(`missing component "${token}"`);
    }
  }

  for (const comp of testCase.expectedComponents || []) {
    const item = findItemByToken(items, comp.token || comp.refId || comp.name);
    if (!item) {
      failures.push(`expected component ${comp.token || comp.refId}`);
      continue;
    }
    if (Number.isFinite(comp.grams) && Math.round(item._hiddenGrams || 0) !== Math.round(comp.grams)) {
      failures.push(`${comp.token || comp.refId} grams ${Math.round(item._hiddenGrams || 0)} vs ${comp.grams}`);
    }
  }

  if (testCase.grams) {
    for (const [token, grams] of Object.entries(testCase.grams)) {
      const item = findItemByToken(items, token);
      if (!item || Math.round(item._hiddenGrams || 0) !== Math.round(grams)) {
        failures.push(`${token} grams ${item?._hiddenGrams ?? 'missing'} vs ${grams}`);
      }
    }
  }

  const tol = testCase.tolerancePct ?? 20;
  const refKcal = testCase.referenceKcal ?? testCase.expectedKcal;
  if (refKcal != null && !withinTolerance(result.total_calories_kcal, refKcal, tol)) {
    failures.push(`kcal ${Math.round(result.total_calories_kcal)} vs ref ${refKcal} (±${tol}%)`);
  }

  if (testCase.kcalMin != null && result.total_calories_kcal < testCase.kcalMin) {
    failures.push(`kcal ${result.total_calories_kcal} < min ${testCase.kcalMin}`);
  }
  if (testCase.kcalMax != null && result.total_calories_kcal > testCase.kcalMax) {
    failures.push(`kcal ${result.total_calories_kcal} > max ${testCase.kcalMax}`);
  }

  for (const check of testCase.quantityChecks || []) {
    const hay = `${result._sourceText || testCase.input || ''} ${text}`;
    if (check.contains && !hay.includes(String(check.contains))) {
      failures.push(`quantity "${check.contains}" not retained`);
    }
  }

  if (testCase.expectFirstSubmitPass !== false && result._mealIncomplete) {
    failures.push(`incomplete: ${(result._mealValidation?.issues || []).map((i) => i.code).join(', ')}`);
  }

  if (testCase.expectRangeIntegrity !== false) {
    const scored = result._confidence || scoreMealConfidence(result);
    const point = Math.round(result.total_calories_kcal);
    const range = scored.kcalRange;
    if (range && (point < range.min || point > range.max)) {
      failures.push(`range integrity ${point} vs ${range.min}–${range.max}`);
    }
  }

  if (testCase.expectWeightProvenance !== false && result._weightProvenanceComplete === false) {
    failures.push('weight provenance incomplete');
  }

  if (testCase.confidenceBand) {
    const band = (result._confidence || scoreMealConfidence(result)).band;
    if (band !== testCase.confidenceBand) {
      failures.push(`confidence ${band} vs expected ${testCase.confidenceBand}`);
    }
  }

  if (testCase.expectNoZeroMissingNutrients) {
    const bad = items.some((i) => i._nutrientAvailability && Object.values(i._nutrientAvailability).includes('zero'));
    if (bad) failures.push('missing nutrient shown as zero');
  }

  const zeroFalse = items.filter((i) => i._unmatched && num(i.calories_kcal) === 0);
  if (zeroFalse.length && !items.some((i) => !i._unmatched)) {
    failures.push('all items unmatched with zero kcal');
  }

  failures.push(...runTrustedChecks(testCase, result, fixtures));

  return { pass: failures.length === 0, failures, result, testCase };
}

export function componentRecognitionRate(cases, outcomes) {
  let checked = 0;
  let ok = 0;
  cases.forEach((testCase, i) => {
    const tokens = [
      ...(testCase.mustInclude || []),
      ...(testCase.expectedComponents || []).map((c) => c.token || c.refId).filter(Boolean),
    ];
    if (!tokens.length) return;
    const text = itemBlob(outcomes[i]?.result?.items || []);
    for (const token of tokens) {
      checked += 1;
      if (mustIncludeMatch(text, token)) ok += 1;
    }
  });
  return checked ? ok / checked : 1;
}

export function ingredientRetentionRate(cases, outcomes) {
  let checked = 0;
  let ok = 0;
  cases.forEach((testCase, i) => {
    if (!testCase.minItems) return;
    checked += 1;
    const items = outcomes[i]?.result?.items || [];
    if (items.length >= testCase.minItems && !outcomes[i]?.result?._mealIncomplete) ok += 1;
  });
  return checked ? ok / checked : 1;
}

export function quantityBindingRate(cases, outcomes) {
  let checked = 0;
  let ok = 0;
  cases.forEach((testCase, i) => {
    const items = outcomes[i]?.result?.items || [];
    if (testCase.grams) {
      for (const [token, grams] of Object.entries(testCase.grams)) {
        checked += 1;
        const item = findItemByToken(items, token);
        if (item && Math.round(item._hiddenGrams || 0) === Math.round(grams)) ok += 1;
      }
    }
    for (const comp of testCase.expectedComponents || []) {
      if (!Number.isFinite(comp.grams)) continue;
      checked += 1;
      const item = findItemByToken(items, comp.token || comp.refId);
      if (item && Math.round(item._hiddenGrams || 0) === Math.round(comp.grams)) ok += 1;
    }
  });
  return checked ? ok / checked : 1;
}

export function calorieErrorMetrics(cases, outcomes) {
  const errors = [];
  let within10 = 0;
  let within20 = 0;
  let measured = 0;
  cases.forEach((testCase, i) => {
    const ref = testCase.referenceKcal ?? testCase.expectedKcal;
    const actual = outcomes[i]?.result?.total_calories_kcal;
    if (ref == null || !Number.isFinite(actual)) return;
    measured += 1;
    const err = Math.abs(actual - ref) / ref;
    errors.push(err);
    if (err <= 0.1) within10 += 1;
    if (err <= 0.2) within20 += 1;
  });
  return {
    measured,
    medianError: median(errors),
    within10Pct: measured ? within10 / measured : null,
    within20Pct: measured ? within20 / measured : null,
  };
}

export function rangeIntegrityRate(cases, outcomes) {
  let checked = 0;
  let ok = 0;
  cases.forEach((testCase, i) => {
    const result = outcomes[i]?.result;
    if (!result) return;
    const scored = result._confidence || scoreMealConfidence(result);
    const range = scored.kcalRange;
    if (!range) return;
    checked += 1;
    const point = Math.round(result.total_calories_kcal);
    if (point >= range.min && point <= range.max) ok += 1;
  });
  return checked ? ok / checked : 1;
}

export function firstSubmissionSuccessRate(cases, outcomes) {
  let checked = 0;
  let ok = 0;
  cases.forEach((testCase, i) => {
    if (testCase.expectFirstSubmitPass === false) return;
    checked += 1;
    if (!outcomes[i]?.result?._mealIncomplete) ok += 1;
  });
  return checked ? ok / checked : 1;
}

export function weightProvenanceRate(cases, outcomes) {
  let checked = 0;
  let ok = 0;
  cases.forEach((testCase, i) => {
    if (testCase.expectWeightProvenance === false) return;
    checked += 1;
    if (outcomes[i]?.result?._weightProvenanceComplete !== false) ok += 1;
  });
  return checked ? ok / checked : 1;
}

export function splittingRecall(cases, outcomes) {
  let ok = 0;
  let total = 0;
  cases.forEach((testCase, i) => {
    const input = testCase.input || '';
    const phrases = splitMealPhrases(input);
    if (phrases.length <= 1) return;
    total += 1;
    const items = outcomes[i]?.result?.items || [];
    if (items.length >= phrases.length) ok += 1;
  });
  return total ? ok / total : 1;
}

export function computeP5Metrics(cases, outcomes) {
  const passed = outcomes.filter((o) => o.pass).length;
  const cal = calorieErrorMetrics(cases, outcomes);
  return {
    casePassRate: cases.length ? passed / cases.length : 0,
    passed,
    total: cases.length,
    componentRecognition: componentRecognitionRate(cases, outcomes),
    ingredientRetention: ingredientRetentionRate(cases, outcomes),
    quantityBinding: quantityBindingRate(cases, outcomes),
    medianCalorieError: cal.medianError,
    within10Pct: cal.within10Pct,
    within20Pct: cal.within20Pct,
    calorieMeasured: cal.measured,
    rangeIntegrity: rangeIntegrityRate(cases, outcomes),
    firstSubmissionSuccess: firstSubmissionSuccessRate(cases, outcomes),
    weightProvenance: weightProvenanceRate(cases, outcomes),
    splittingRecall: splittingRecall(cases, outcomes),
  };
}

export {
  BENCHMARK_SYNONYMS,
  mustIncludeMatch,
  itemBlob,
  splitMealPhrases,
  parseQuantityFromText,
  phraseHasExplicitQuantity,
};
