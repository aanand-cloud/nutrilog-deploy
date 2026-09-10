/**
 * Phase 2 — Authoritative nutrition foundation acceptance gates.
 */

import { readFileSync } from 'node:fs';
import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import {
  authoritativeArithmeticOk,
  PHASE2_TARGETS,
  hasAuthoritativeNutrition,
} from '../shared/authoritative-nutrition.js';
import { getMealNovaFlags, resetMealNovaFlagsCache } from '../shared/feature-flags.js';
import { isAllowedZeroKcal } from '../shared/canonical-food-model.js';
import { getVerifiedRecord } from '../shared/verified-nutrition.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

function findItemByRef(items = [], refId = '') {
  const verifiedTarget = getVerifiedRecord(refId)?.id || refId;
  return items.find((i) => i._refId === refId
    || i._refId === verifiedTarget
    || i._per100?.refId === refId
    || i._per100?.refId === verifiedTarget);
}

resetMealNovaFlagsCache();
assert('authoritative nutrition flag on', getMealNovaFlags().authoritativeNutrition === true);

const trustedCases = JSON.parse(readFileSync('./scripts/benchmark/cases-trusted.json', 'utf8')).cases;
const fixtures = JSON.parse(readFileSync('./scripts/benchmark/fixtures/trusted-per100.json', 'utf8')).fixtures;

let weighedTotal = 0;
let weighedPass = 0;
let authoritativeChecked = 0;
let arithmeticPass = 0;
let falseZero = 0;

for (const tc of trustedCases) {
  const result = resolveMealFromText(tc.input);
  const items = result?.items || [];

  if (tc.itemFixtures?.length) {
    for (const spec of tc.itemFixtures) {
      const item = findItemByRef(items, spec.refId);
      assert(`${tc.id} has ${spec.refId}`, Boolean(item), items.map((i) => i._refId).join(', '));
      if (!item) continue;
      weighedTotal += 1;
      const fixture = fixtures[spec.fixtureId];
      if (fixture && spec.grams) {
        const per100 = item._per100?.kcal ?? (item.calories_kcal / spec.grams) * 100;
        const delta = Math.abs(per100 - fixture.kcal100) / fixture.kcal100;
        if (delta <= (fixture.tolerancePct || 10) / 100) weighedPass += 1;
      }
      if (item._authoritative || hasAuthoritativeNutrition(item._refId)) {
        authoritativeChecked += 1;
        if (authoritativeArithmeticOk(item)) arithmeticPass += 1;
      }
      if (!isAllowedZeroKcal(item._refId, item.calories_kcal) && item.calories_kcal <= 0) falseZero += 1;
    }
    continue;
  }

  const item = findItemByRef(items, tc.refId) || items[0];
  assert(`${tc.id} resolves item`, Boolean(item), tc.input);
  if (tc.grams && tc.fixtureId) {
    weighedTotal += 1;
    const fixture = fixtures[tc.fixtureId];
    const per100 = item._per100?.kcal ?? (item.calories_kcal / tc.grams) * 100;
    const delta = Math.abs(per100 - fixture.kcal100) / fixture.kcal100;
    if (delta <= (fixture.tolerancePct || 10) / 100) weighedPass += 1;
  }
  if (item?._authoritative || hasAuthoritativeNutrition(item?._refId)) {
    authoritativeChecked += 1;
    if (authoritativeArithmeticOk(item)) arithmeticPass += 1;
  }
  if (item && !isAllowedZeroKcal(item._refId, item.calories_kcal) && item.calories_kcal <= 0) falseZero += 1;

  if (tc.expectVerified) {
    assert(`${tc.id} authoritative`, item?._authoritative === true || hasAuthoritativeNutrition(item?._refId),
      item?._nutritionSource || 'none');
  }
}

const fishChips = resolveMealFromText('180g battered cod, 250g chips, 80g mushy peas');
const cod = findItemByRef(fishChips?.items || [], 'white_fish');
assert('battered cod maps to white_fish ref', cod?._refId === 'white_fish', cod?._refId);
assert('battered cod authoritative', cod?._authoritative === true, cod?._provenanceLabel);

const weighedRate = weighedTotal ? weighedPass / weighedTotal : 1;
const arithmeticRate = authoritativeChecked ? arithmeticPass / authoritativeChecked : 1;

assert(`weighed simple foods ±10% ≥${PHASE2_TARGETS.weighedSimpleFoodsWithin10Pct * 100}%`,
  weighedRate >= PHASE2_TARGETS.weighedSimpleFoodsWithin10Pct, `${weighedPass}/${weighedTotal}`);
assert(`nutrition arithmetic ≥${PHASE2_TARGETS.nutritionArithmetic * 100}%`,
  arithmeticRate >= PHASE2_TARGETS.nutritionArithmetic, `${Math.round(arithmeticRate * 100)}%`);
assert('false zero-kcal matches', falseZero === PHASE2_TARGETS.falseZeroKcal, `${falseZero}`);

console.log('\nDone.');
