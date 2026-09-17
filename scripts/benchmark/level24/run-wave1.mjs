/**
 * Run the unchanged MealNova photo pipeline on all 187 Wave 1 development images.
 * Never loads holdout cases. Never sends case labels to vision.
 *
 * Run: node scripts/benchmark/level24/run-wave1.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { composeAnalysisFromVision, normalizePhotoAnalysis } from '../../../shared/vision-analysis-compose.js';
import { parseAnalysisPayload } from '../../../shared/analysis-result.js';
import {
  aggregateLevel24Scores,
  assertDevelopmentSplit,
  extractPredictionSnapshot,
  level24Paths,
  loadLevel24Spec,
  scoreLevel24Case,
  selectWave1Cases,
} from './lib.mjs';

function loadEnv(root) {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.replace('\r', '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

const paths = level24Paths();
const spec = loadLevel24Spec(paths.root);
const wave1 = selectWave1Cases(spec.cases, 200);
const manifestPath = resolve(paths.root, 'data/benchmark/level24/image-manifest-wave1.json');
if (!existsSync(manifestPath)) {
  throw new Error('Missing Wave 1 image manifest. Run collect-wave1-images.mjs first.');
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const byId = Object.fromEntries((manifest.cases || []).map((row) => [row.case_id, row]));

if (wave1.length !== 187) throw new Error(`Expected 187 wave-1 cases, got ${wave1.length}`);
if (manifest.holdout_included) throw new Error('Manifest must not include holdout.');
if (wave1.some((row) => row.split !== 'development' || !byId[row.case_id])) {
  throw new Error('Wave 1 map is incomplete or includes holdout.');
}

const env = { ...loadEnv(paths.root), ...process.env };
if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required to run the existing photo pipeline.');

const { analyzeFoodWithGemini, defaultVisionModel } = await import('../../../netlify/lib/gemini.mjs');
const { ANALYSIS_PROMPT } = await import('../../../netlify/lib/prompts.mjs');

const predDir = resolve(paths.predictions, 'development');
mkdirSync(predDir, { recursive: true });

let ran = 0;
let skipped = 0;
const failures = [];

for (const row of wave1) {
  assertDevelopmentSplit(row);
  const mapped = byId[row.case_id];
  const dest = resolve(predDir, `${row.case_id}.json`);
  if (existsSync(dest) && !process.argv.includes('--force')) {
    skipped += 1;
    continue;
  }
  const imagePath = resolve(paths.root, mapped.image_path);
  if (!existsSync(imagePath)) {
    failures.push({ case_id: row.case_id, error: `missing image ${mapped.image_path}` });
    continue;
  }

  try {
    const image = readFileSync(imagePath);
    const mimeType = extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    const result = await analyzeFoodWithGemini(env.GEMINI_API_KEY, {
      image: image.toString('base64'),
      mimeType,
      prompt: ANALYSIS_PROMPT,
    }, defaultVisionModel());
    const rawVision = parseAnalysisPayload(result?.result) || result?.result;
    const analysis = normalizePhotoAnalysis(rawVision) || composeAnalysisFromVision(rawVision);
    const snapshot = extractPredictionSnapshot(analysis);
    const scored = scoreLevel24Case(row, snapshot, {
      measuredPortionG: mapped.actual_portion_g,
    });
    writeFileSync(dest, `${JSON.stringify({
      case_id: row.case_id,
      split: 'development',
      created_at: new Date().toISOString(),
      image_name: basename(imagePath),
      source_title: mapped.source_title,
      mapping_confidence: mapped.mapping_confidence,
      measured_portion_g: mapped.actual_portion_g,
      labels_sent_to_vision: false,
      raw_vision: rawVision,
      prediction: snapshot,
      score: scored,
    }, null, 2)}\n`);
    ran += 1;
    console.log(JSON.stringify({
      case_id: row.case_id,
      food_ok: scored.food_ok,
      variant_ok: scored.variant_ok,
      errors: scored.errors,
    }));
    await sleep(800);
  } catch (error) {
    failures.push({ case_id: row.case_id, error: error.message });
    console.warn(`FAIL ${row.case_id}: ${error.message}`);
    await sleep(1500);
  }
}

const scored = [];
for (const row of wave1) {
  const dest = resolve(predDir, `${row.case_id}.json`);
  if (!existsSync(dest)) continue;
  const payload = JSON.parse(readFileSync(dest, 'utf8'));
  scored.push(scoreLevel24Case(row, payload.prediction || {}, {
    measuredPortionG: payload.measured_portion_g ?? byId[row.case_id]?.actual_portion_g ?? null,
  }));
}

const report = {
  version: '2.4B.0',
  split: 'development',
  wave: 1,
  generated_at: new Date().toISOString(),
  holdout_used_for_tuning: false,
  labels_sent_to_vision: false,
  production_logic_changed: false,
  cases_requested: 187,
  cases_scored: scored.length,
  pipeline_runs: ran,
  skipped_existing: skipped,
  pipeline_failures: failures,
  mapping_confidence_counts: manifest.mapping_confidence_counts,
  actual_weights_recorded: manifest.actual_weights_recorded || 0,
  ...aggregateLevel24Scores(scored),
};

mkdirSync(paths.reports, { recursive: true });
const dest = resolve(paths.reports, 'scorecard-wave1-development.json');
writeFileSync(dest, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  saved: dest,
  cases_scored: report.cases_scored,
  food_recognition: report.overall.food_recognition,
  variant_recognition: report.overall.variant_recognition,
  calories_within_20pct: report.overall.calories_within_20pct,
  calories_within_15pct: report.overall.calories_within_15pct,
  portion_within_20pct: report.overall.portion_within_20pct,
  macros_within_20pct: report.overall.macros_within_20pct,
  high_confidence_wrong_food: report.overall.high_confidence_wrong_food,
  error_counts: report.error_counts,
  next_fix: report.next_fix,
  pipeline_failures: failures.length,
}, null, 2));
