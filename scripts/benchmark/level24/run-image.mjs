/**
 * Run the existing MealNova photo pipeline on one real benchmark image.
 * Isolated CLI — does not change matcher, UI, or production nutrition.
 *
 * Usage:
 *   node scripts/benchmark/level24/run-image.mjs --case IN24A-0001 --image path.jpg
 *   node scripts/benchmark/level24/run-image.mjs --case IN24A-0001 --vision-json vision.json
 *   node scripts/benchmark/level24/run-image.mjs --case IN24A-0001 --vision-json vision.json --portion-g 412
 *
 * Holdout cases are refused unless LEVEL24_ALLOW_HOLDOUT=1.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { composeAnalysisFromVision, normalizePhotoAnalysis } from '../../../shared/vision-analysis-compose.js';
import { parseAnalysisPayload } from '../../../shared/analysis-result.js';
import {
  assertDevelopmentSplit,
  extractPredictionSnapshot,
  level24Paths,
  loadLevel24Spec,
  scoreLevel24Case,
} from './lib.mjs';

function argValue(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function loadEnv(root) {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.replace(/\r$/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const paths = level24Paths();
const spec = loadLevel24Spec(paths.root);
const caseId = argValue('--case');
const imagePath = argValue('--image');
const visionPath = argValue('--vision-json');
const portionArg = argValue('--portion-g');
const allowHoldout = process.env.LEVEL24_ALLOW_HOLDOUT === '1' || process.argv.includes('--allow-holdout');

if (!caseId) {
  throw new Error('Missing --case IN24A-0001');
}

const row = spec.cases.find((item) => item.case_id === caseId);
if (!row) throw new Error(`Unknown case_id ${caseId}`);
assertDevelopmentSplit(row, { allowHoldout });

const measured = Number(portionArg);
const measuredPortionG = Number.isFinite(measured) && measured > 0 ? measured : null;

let rawVision = null;
if (visionPath) {
  rawVision = JSON.parse(readFileSync(resolve(visionPath), 'utf8'));
} else if (imagePath) {
  const env = { ...loadEnv(paths.root), ...process.env };
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for --image. Or pass --vision-json from an existing pipeline output.');
  }
  const { analyzeFoodWithGemini, defaultVisionModel } = await import('../../../netlify/lib/gemini.mjs');
  const { ANALYSIS_PROMPT } = await import('../../../netlify/lib/prompts.mjs');
  const image = readFileSync(resolve(imagePath));
  const mimeType = extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  const result = await analyzeFoodWithGemini(env.GEMINI_API_KEY, {
    image: image.toString('base64'),
    mimeType,
    prompt: ANALYSIS_PROMPT,
  }, defaultVisionModel());
  rawVision = parseAnalysisPayload(result?.result) || result?.result;
} else {
  throw new Error('Provide --image or --vision-json. The existing MealNova pipeline is then run unchanged.');
}

const analysis = normalizePhotoAnalysis(rawVision) || composeAnalysisFromVision(rawVision);
const snapshot = extractPredictionSnapshot(analysis);
const scored = scoreLevel24Case(row, snapshot, { measuredPortionG });

const destDir = resolve(paths.predictions, row.split);
mkdirSync(destDir, { recursive: true });
const dest = resolve(destDir, `${row.case_id}.json`);
const payload = {
  case_id: row.case_id,
  split: row.split,
  created_at: new Date().toISOString(),
  image_name: imagePath ? basename(imagePath) : null,
  measured_portion_g: measuredPortionG,
  raw_vision: rawVision,
  prediction: snapshot,
  score: scored,
};
writeFileSync(dest, `${JSON.stringify(payload, null, 2)}\n`);

if (measuredPortionG) {
  const measuredPath = paths.measured;
  const current = existsSync(measuredPath) ? JSON.parse(readFileSync(measuredPath, 'utf8')) : { portions: {} };
  current.portions = current.portions || {};
  current.portions[row.case_id] = measuredPortionG;
  writeFileSync(measuredPath, `${JSON.stringify(current, null, 2)}\n`);
}

console.log(JSON.stringify({
  saved: dest,
  case_id: row.case_id,
  split: row.split,
  food_ok: scored.food_ok,
  variant_ok: scored.variant_ok,
  calorie_error_pct: scored.calorie_error_pct,
  errors: scored.errors,
}, null, 2));
