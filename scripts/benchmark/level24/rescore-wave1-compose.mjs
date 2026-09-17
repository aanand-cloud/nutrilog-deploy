/**
 * Re-score the same 187 Wave 1 development photos through forced compose.
 * Uses saved raw_vision only — no Gemini, no new images, no holdout.
 *
 * Run: node scripts/benchmark/level24/rescore-wave1-compose.mjs
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePhotoAnalysis } from '../../../shared/vision-analysis-compose.js';
import {
  aggregateLevel24Scores,
  assertDevelopmentSplit,
  extractPredictionSnapshot,
  level24Paths,
  loadLevel24Spec,
  scoreLevel24Case,
  selectWave1Cases,
} from './lib.mjs';

const paths = level24Paths();
const spec = loadLevel24Spec(paths.root);
const wave1 = selectWave1Cases(spec.cases, 200);
const manifest = JSON.parse(readFileSync(resolve(paths.root, 'data/benchmark/level24/image-manifest-wave1.json'), 'utf8'));
const byId = Object.fromEntries((manifest.cases || []).map((row) => [row.case_id, row]));

if (wave1.length !== 187) throw new Error(`Expected 187 wave-1 cases, got ${wave1.length}`);
if (manifest.holdout_included) throw new Error('Manifest must not include holdout.');
if (wave1.some((row) => row.split !== 'development')) throw new Error('Wave 1 leaked a holdout case.');

const predDir = resolve(paths.predictions, 'development');
const baselinePath = resolve(paths.reports, 'scorecard-wave1-baseline.json');
const previousPath = resolve(paths.reports, 'scorecard-wave1-development.json');
if (existsSync(previousPath) && !existsSync(baselinePath)) {
  copyFileSync(previousPath, baselinePath);
}

const scored = [];
const failures = [];

for (const row of wave1) {
  assertDevelopmentSplit(row);
  const dest = resolve(predDir, `${row.case_id}.json`);
  if (!existsSync(dest)) {
    failures.push({ case_id: row.case_id, error: 'missing saved prediction' });
    continue;
  }
  const payload = JSON.parse(readFileSync(dest, 'utf8'));
  const rawVision = payload.raw_vision;
  if (!rawVision) {
    failures.push({ case_id: row.case_id, error: 'missing raw_vision' });
    continue;
  }
  const analysis = normalizePhotoAnalysis(rawVision);
  const snapshot = extractPredictionSnapshot(analysis);
  const result = scoreLevel24Case(row, snapshot, {
    measuredPortionG: payload.measured_portion_g ?? byId[row.case_id]?.actual_portion_g ?? null,
  });
  scored.push(result);
  writeFileSync(dest, `${JSON.stringify({
    ...payload,
    composed_at: new Date().toISOString(),
    compose_forced: true,
    labels_sent_to_vision: false,
    prediction: snapshot,
    score: result,
  }, null, 2)}\n`);
}

if (scored.length !== 187) {
  throw new Error(`Compose rescore expected 187 saved cases, got ${scored.length}. Failures: ${JSON.stringify(failures)}`);
}

const report = {
  version: '2.4B.0',
  split: 'development',
  wave: 1,
  mode: 'compose_forced',
  generated_at: new Date().toISOString(),
  holdout_used_for_tuning: false,
  labels_sent_to_vision: false,
  gemini_recalled: false,
  same_187_images: true,
  cases_requested: 187,
  cases_scored: scored.length,
  pipeline_failures: failures,
  mapping_confidence_counts: manifest.mapping_confidence_counts,
  actual_weights_recorded: manifest.actual_weights_recorded || 0,
  ...aggregateLevel24Scores(scored),
};

mkdirSync(paths.reports, { recursive: true });
const composePath = resolve(paths.reports, 'scorecard-wave1-compose.json');
writeFileSync(composePath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(previousPath, `${JSON.stringify(report, null, 2)}\n`);

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null;
function pct(value) {
  return value == null ? null : Number((value * 100).toFixed(1));
}
function delta(now, before) {
  if (now == null || before == null) return null;
  return Number(((now - before) * 100).toFixed(1));
}

console.log(JSON.stringify({
  saved: composePath,
  cases_scored: report.cases_scored,
  holdout_used: false,
  gemini_recalled: false,
  overall: {
    food_recognition: pct(report.overall.food_recognition),
    variant_recognition: pct(report.overall.variant_recognition),
    portion_within_20pct: pct(report.overall.portion_within_20pct),
    calories_within_20pct: pct(report.overall.calories_within_20pct),
    calories_within_15pct: pct(report.overall.calories_within_15pct),
    macros_within_20pct: pct(report.overall.macros_within_20pct),
    nutrition_range_consistency: pct(report.overall.nutrition_range_consistency),
    high_confidence_wrong_food: pct(report.overall.high_confidence_wrong_food),
  },
  vs_baseline: baseline ? {
    food_recognition: delta(report.overall.food_recognition, baseline.overall.food_recognition),
    variant_recognition: delta(report.overall.variant_recognition, baseline.overall.variant_recognition),
    portion_within_20pct: delta(report.overall.portion_within_20pct, baseline.overall.portion_within_20pct),
    calories_within_20pct: delta(report.overall.calories_within_20pct, baseline.overall.calories_within_20pct),
    calories_within_15pct: delta(report.overall.calories_within_15pct, baseline.overall.calories_within_15pct),
    macros_within_20pct: delta(report.overall.macros_within_20pct, baseline.overall.macros_within_20pct),
    high_confidence_wrong_food: delta(report.overall.high_confidence_wrong_food, baseline.overall.high_confidence_wrong_food),
  } : null,
  error_counts: report.error_counts,
  next_fix: report.next_fix,
  per_food: Object.fromEntries(Object.entries(report.per_food).map(([food, row]) => [food, {
    food: pct(row.food_recognition),
    variant: pct(row.variant_recognition),
    kcal20: pct(row.calories_within_20pct),
    portion: pct(row.portion_within_20pct),
  }])),
  worst10: report.worst_20.slice(0, 10).map((row) => ({
    id: row.case_id,
    food: row.canonical_name,
    pred: row.predicted_name,
    pred_id: row.predicted_id,
    kcal_err: row.calorie_error_pct == null ? null : Number(row.calorie_error_pct.toFixed(1)),
    errors: row.errors,
  })),
  high_conf_wrong: report.high_confidence_wrong_answers.length,
}, null, 2));
