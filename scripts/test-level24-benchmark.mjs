import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';
import {
  ERROR_TYPES,
  assertDevelopmentSplit,
  foodFamilyKey,
  level24Paths,
  loadLevel24Spec,
  scoreLevel24Case,
  selectWave1Cases,
  aggregateLevel24Scores,
  extractPredictionSnapshot,
} from './benchmark/level24/lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const spec = loadLevel24Spec();
const cases = spec.cases || [];
const holdout = cases.filter((row) => row.split === 'holdout');
const development = cases.filter((row) => row.split === 'development');
const wave1 = selectWave1Cases(cases, 200);

assert('spec has 600 cases', cases.length === 600);
assert('development/holdout stay 550/50', development.length === 550 && holdout.length === 50);
assert('case_id values are unique', new Set(cases.map((row) => row.case_id)).size === 600);
assert('wave 1 is 150–200 development cases', wave1.length >= 150 && wave1.length <= 200, String(wave1.length));
assert('wave 1 never includes holdout', wave1.every((row) => row.split === 'development'));

let holdoutBlocked = false;
try {
  assertDevelopmentSplit(holdout[0]);
} catch {
  holdoutBlocked = true;
}
assert('holdout cases are blocked by default', holdoutBlocked);

const dindigul = cases.find((row) => row.case_id === 'IN24A-0002');
const vision = {
  meal_summary: 'Dindigul mutton biryani',
  confidence_score: 0.86,
  items: [
    { name: 'dindigul mutton biryani', estimated_amount: 400, unit: 'g', confidence: 0.86 },
  ],
};
const analysis = composeAnalysisFromVision(vision);
const snapshot = extractPredictionSnapshot(analysis);
assert('existing vision pipeline still composes a photo analysis', Boolean(snapshot.items[0]?._refId) && snapshot.total_calories_kcal > 0, snapshot.items[0]?._refId);
assert('photo grams come from the vision estimate, not the 350g fallback', snapshot.items[0]?._hiddenGrams === 400 && snapshot.items[0]?._portionSource === 'photo_estimated');

const correctPrediction = {
  items: [{
    name: 'dindigul mutton biryani',
    _refId: 'dindigul_mutton_biryani',
    _hiddenGrams: 400,
    calories_kcal: 760,
    nutrition: { protein_g: 38, carbs_g: 88, fat_g: 28 },
  }],
  total_calories_kcal: 760,
  total_nutrition: { protein_g: 38, carbs_g: 88, fat_g: 28 },
  confidence_band: 'high',
};
const good = scoreLevel24Case(dindigul, correctPrediction);
assert('top-1 food recognition passes on a correct plate', good.food_ok);
assert('variant recognition passes on the exact V4 id', good.variant_ok);
assert('portion / calorie / macro tolerances can pass', good.portion_within_20 && good.calories_within_20 && good.calories_within_15 && good.macros_within_20);
assert('nutrition-range consistency can pass', good.nutrition_range_ok);
assert('family key strips regional prefixes', foodFamilyKey('dindigul_mutton_biryani') === foodFamilyKey('ambur mutton biryani'));
assert('family key groups dosa variants', foodFamilyKey('masala dosa') === 'dosa' && foodFamilyKey('rava_dosa') === 'dosa');
assert('family key groups idli variants', foodFamilyKey('sambar idli') === 'idli' && foodFamilyKey('ghee podi idli') === 'idli');
assert('family key maps chicken pulao to chicken biryani', foodFamilyKey('chicken pulao') === 'chicken biryani');
assert('family key keeps mutton vs chicken biryani distinct', foodFamilyKey('mutton biryani') !== foodFamilyKey('chicken biryani'));

const wrongFood = scoreLevel24Case(dindigul, {
  items: [{ name: 'masala dosa', _refId: 'masala_dosa', _hiddenGrams: 400, calories_kcal: 720 }],
  total_calories_kcal: 720,
  total_nutrition: { protein_g: 20, carbs_g: 80, fat_g: 20 },
  confidence_band: 'high',
});
assert('wrong food is classified', wrongFood.errors.includes('wrong_food'));
assert('high-confidence wrong food is flagged', wrongFood.high_confidence_wrong_food);

const wrongVariant = scoreLevel24Case(dindigul, {
  items: [{ name: 'ambur mutton biryani', _refId: 'ambur_mutton_biryani', _hiddenGrams: 400, calories_kcal: 760 }],
  total_calories_kcal: 760,
  total_nutrition: { protein_g: 38, carbs_g: 88, fat_g: 28 },
  confidence_band: 'medium',
});
assert('regional lookalike is wrong_variant, not wrong_food', wrongVariant.errors.includes('wrong_variant') && !wrongVariant.errors.includes('wrong_food'));

const portion = scoreLevel24Case(dindigul, correctPrediction, { measuredPortionG: 220 });
assert('entered actual weight is used for portion error', portion.portion_within_20 === false && portion.errors.includes('portion_error'));
assert('matching measured weight can pass portion scoring', scoreLevel24Case(dindigul, correctPrediction, { measuredPortionG: 400 }).portion_within_20);

const sideCase = {
  ...dindigul,
  case_id: 'IN24A-SIDE',
  common_side: { name: 'raita', portion_g: 80, kcal: 70 },
};
const missedSide = scoreLevel24Case(sideCase, snapshot);
assert('missing raita is side_component_missed', missedSide.errors.includes('side_component_missed'));

const report = aggregateLevel24Scores([good, wrongFood, wrongVariant, portion, missedSide]);
assert('scorecard includes overall and per-food rows', report.overall.cases === 5 && report.per_food['dindigul mutton biryani']);
assert('error-type counts are populated', report.error_counts.wrong_food >= 1 && report.error_counts.wrong_variant >= 1);
assert('worst failures are ranked', report.worst_20.length >= 1);
assert('high-confidence wrong answers are listed', report.high_confidence_wrong_answers.length >= 1);
assert('next-fix recommendation is based on the biggest error source', String(report.next_fix || '').length > 20);
assert('taxonomy covers all required error types', ERROR_TYPES.length === 8);

const richMiss = scoreLevel24Case({
  ...dindigul,
  preparation_note: 'restaurant-rich / higher oil',
  ground_truth: { ...dindigul.ground_truth, meal_kcal_central: 1100, meal_kcal_low: 900, meal_kcal_high: 1300 },
}, correctPrediction);
assert('underestimated rich plate is preparation_style_error', richMiss.errors.includes('preparation_style_error'));

const hiddenFat = scoreLevel24Case(dindigul, {
  items: [{ name: 'dindigul mutton biryani', _refId: 'dindigul_mutton_biryani', _hiddenGrams: 400, calories_kcal: 760 }],
  total_calories_kcal: 760,
  total_nutrition: { protein_g: 38, carbs_g: 88, fat_g: 8 },
  confidence_band: 'medium',
});
assert('fat miss with close calories is hidden_fat_or_sugar_error', hiddenFat.errors.includes('hidden_fat_or_sugar_error'));

const refMiss = scoreLevel24Case(dindigul, {
  items: [{ name: 'dindigul mutton biryani', _refId: 'dindigul_mutton_biryani', _hiddenGrams: 400, calories_kcal: 400 }],
  total_calories_kcal: 400,
  total_nutrition: { protein_g: 20, carbs_g: 40, fat_g: 12 },
  confidence_band: 'medium',
});
assert('correct food/portion but wrong kcal is nutrition_reference_error', refMiss.errors.includes('nutrition_reference_error'));

function collectSource(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'benchmark'].includes(entry.name)) continue;
      collectSource(path, files);
    } else if (/\.(js|mjs|ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}
const productionFiles = [
  ...collectSource(join(root, 'shared')),
  ...collectSource(join(root, 'src')),
  ...collectSource(join(root, 'api')),
  ...collectSource(join(root, 'netlify')),
];
const leaked = productionFiles.filter((path) => readFileSync(path, 'utf8').includes('benchmark/level24'));
assert('production matcher/UI/core never import Level 2.4B', leaked.length === 0, leaked.join(', '));

const fixture = join(root, 'scripts/benchmark/level24/fixtures/dindigul-home-normal.vision.json');
const paths = level24Paths(root);
const predFile = join(paths.predictions, 'development', 'IN24A-0002.json');
if (existsSync(predFile)) rmSync(predFile);
execFileSync(process.execPath, [
  'scripts/benchmark/level24/run-image.mjs',
  '--case', 'IN24A-0002',
  '--vision-json', fixture,
  '--portion-g', '400',
], { cwd: root, encoding: 'utf8' });
const saved = JSON.parse(readFileSync(predFile, 'utf8'));
assert('prediction is stored separately from truth', saved.case_id === 'IN24A-0002' && saved.prediction && !saved.ground_truth);
assert('actual portion weight can be recorded', saved.measured_portion_g === 400);

let holdoutCliBlocked = false;
try {
  execFileSync(process.execPath, [
    'scripts/benchmark/level24/run-image.mjs',
    '--case', holdout[0].case_id,
    '--vision-json', fixture,
  ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch {
  holdoutCliBlocked = true;
}
assert('run-image refuses holdout without an explicit unlock', holdoutCliBlocked);

console.log('\nLevel 2.4B wave 1:', wave1.length, 'cases /', new Set(wave1.map((row) => row.canonical_name)).size, 'foods');
console.log('Done.');
