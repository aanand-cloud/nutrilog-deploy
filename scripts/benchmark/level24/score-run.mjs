/**
 * Score saved Level 2.4B predictions against immutable benchmark truth.
 * Default split is development. Holdout requires LEVEL24_ALLOW_HOLDOUT=1.
 *
 * Run: node scripts/benchmark/level24/score-run.mjs [--split development]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  aggregateLevel24Scores,
  assertDevelopmentSplit,
  level24Paths,
  loadLevel24Spec,
  scoreLevel24Case,
} from './lib.mjs';

const split = process.argv.includes('--split')
  ? process.argv[process.argv.indexOf('--split') + 1]
  : 'development';
const allowHoldout = process.env.LEVEL24_ALLOW_HOLDOUT === '1' || process.argv.includes('--allow-holdout');
if (split === 'holdout' && !allowHoldout) {
  throw new Error('Holdout scoring is locked. Set LEVEL24_ALLOW_HOLDOUT=1 only for a frozen final evaluation.');
}

const paths = level24Paths();
const spec = loadLevel24Spec(paths.root);
const byId = Object.fromEntries(spec.cases.map((row) => [row.case_id, row]));
const measured = existsSync(paths.measured)
  ? JSON.parse(readFileSync(paths.measured, 'utf8')).portions || {}
  : {};
const predDir = join(paths.predictions, split);
if (!existsSync(predDir)) {
  throw new Error(`No predictions in ${predDir}. Run run-image.mjs first.`);
}

const scored = [];
for (const file of readdirSync(predDir).filter((name) => name.endsWith('.json'))) {
  const payload = JSON.parse(readFileSync(join(predDir, file), 'utf8'));
  const row = byId[payload.case_id];
  if (!row) continue;
  assertDevelopmentSplit(row, { allowHoldout: allowHoldout && row.split === 'holdout' });
  const prediction = payload.prediction || {};
  const mergedItems = (prediction.items || []).map((item, index) => ({
    ...item,
    portion_estimate: item.portion_estimate || payload.raw_vision?.items?.[index]?.portion_estimate || null,
  }));
  scored.push(scoreLevel24Case(row, { ...prediction, items: mergedItems }, {
    measuredPortionG: payload.measured_portion_g ?? measured[row.case_id] ?? null,
  }));
}

const report = {
  version: '2.4B.0',
  split,
  generated_at: new Date().toISOString(),
  holdout_used_for_tuning: false,
  ...aggregateLevel24Scores(scored),
};

mkdirSync(paths.reports, { recursive: true });
const dest = join(paths.reports, `scorecard-${split}.json`);
writeFileSync(dest, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Level 2.4B ${split} scorecard`);
console.log(JSON.stringify({
  cases: report.overall.cases,
  food_recognition: report.overall.food_recognition,
  variant_recognition: report.overall.variant_recognition,
  calories_within_20pct: report.overall.calories_within_20pct,
  calories_within_15pct: report.overall.calories_within_15pct,
  portion_within_20pct: report.overall.portion_within_20pct,
  macros_within_20pct: report.overall.macros_within_20pct,
  high_confidence_wrong_food: report.overall.high_confidence_wrong_food,
  error_counts: report.error_counts,
  next_fix: report.next_fix,
  saved: dest,
}, null, 2));
