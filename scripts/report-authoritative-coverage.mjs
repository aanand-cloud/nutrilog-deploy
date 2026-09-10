/**
 * Phase 2 — authoritative nutrition coverage report.
 * Usage: node scripts/report-authoritative-coverage.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVerifiedRecord, VERIFIED_NUTRITION_STATS } from '../shared/verified-nutrition.js';
import { PHASE2_TARGETS } from '../shared/authoritative-nutrition.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commonPath = resolve(root, 'data/verified/common-foods.json');
const common = JSON.parse(readFileSync(commonPath, 'utf8'));

const foods = common.foods || [];
let covered = 0;
const missing = [];

for (const food of foods) {
  if (getVerifiedRecord(food.id)) {
    covered += 1;
  } else {
    missing.push(food.id);
  }
}

const coverage = foods.length ? covered / foods.length : 0;
const pass = coverage >= PHASE2_TARGETS.commonFoodCoverage;

console.log('MealNova Phase 2 — authoritative coverage');
console.log(`Verified registry: ${VERIFIED_NUTRITION_STATS.count} records`);
console.log(`Common foods tracked: ${foods.length}`);
console.log(`Authoritative coverage: ${(coverage * 100).toFixed(1)}% (${covered}/${foods.length})`);
console.log(`Target: ≥${PHASE2_TARGETS.commonFoodCoverage * 100}% — ${pass ? 'PASS' : 'BELOW TARGET (progress report)'}`);
if (missing.length) {
  console.log(`Missing authoritative records (${missing.length}): ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}`);
}
