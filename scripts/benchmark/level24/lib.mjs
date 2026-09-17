/**
 * Level 2.4B real-image evaluation — isolated from matcher/UI/core flow.
 * Production code must never import this file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEVEL24_TARGETS = {
  food_recognition: 0.93,
  variant_recognition: 0.9,
  portion_within_20pct: 0.85,
  calories_within_20pct: 0.9,
  calories_within_15pct: 0.8,
  macros_within_20pct: 0.85,
  high_confidence_wrong_food: 0.02,
};

export const ERROR_TYPES = [
  'wrong_food',
  'wrong_variant',
  'portion_error',
  'preparation_style_error',
  'hidden_fat_or_sugar_error',
  'side_component_missed',
  'nutrition_reference_error',
  'confidence_miscalibration',
];

const REGIONAL_PREFIXES = [
  'dindigul', 'ambur', 'hyderabadi', 'thalassery', 'lucknowi', 'awadhi', 'kolkata',
  'chettinad', 'andhra', 'malabar', 'donne', 'kashmiri', 'sindhi style', 'mughlai',
  'bombay', 'memoni style', 'tamil', 'kerala', 'karnataka', 'telangana', 'arcot',
  'vaniyambadi', 'thalappakatti',
];

const WAVE1_FOOD_LIMIT = 17;

function rootDir() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function level24Paths(root = rootDir()) {
  return {
    root,
    spec: resolve(root, 'data/benchmark/level24/india-benchmark-cases.json'),
    wave1: resolve(root, 'data/benchmark/level24/development-wave1.json'),
    measured: resolve(root, 'data/benchmark/level24/measured-portions.json'),
    predictions: resolve(root, 'data/benchmark/level24/predictions'),
    images: resolve(root, 'data/benchmark/level24/images'),
    reports: resolve(root, 'data/benchmark/level24/reports'),
  };
}

export function loadLevel24Spec(root = rootDir()) {
  const path = level24Paths(root).spec;
  if (!existsSync(path)) {
    throw new Error(`Missing Level 2.4 spec at ${path}. Run: node scripts/benchmark/level24/extract-spec.mjs`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function assertDevelopmentSplit(row, { allowHoldout = false } = {}) {
  if (row?.split === 'holdout' && !allowHoldout) {
    throw new Error(`Holdout case ${row.case_id} is frozen. Do not score or tune on holdout.`);
  }
}

export function normalizeBenchName(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function foodFamilyKey(value = '') {
  let text = normalizeBenchName(value);
  for (const prefix of REGIONAL_PREFIXES) {
    if (text.startsWith(`${prefix} `)) text = text.slice(prefix.length + 1);
  }
  text = text.replace(/\b(style|naidu|plain)\b/g, '').replace(/\s+/g, ' ').trim();

  // South Indian staples: preparation variants share one food family; variant_ok checks the id.
  if (/\bidli(?:es|s)?\b|\bidly(?:s)?\b/.test(text)) return 'idli';
  if (/\bdosas?\b|\bdosai\b/.test(text)) return 'dosa';
  if (/\buttapam\b|\buthappam\b/.test(text)) return 'uttapam';

  // Biryani / pulao / pilaf share a family; keep protein when present.
  if (/\b(biryani|biriyani|pulao|pulav|pilau|pilaf)\b/.test(text)) {
    if (/\b(mutton|lamb|goat)\b/.test(text)) return 'mutton biryani';
    if (/\bchicken\b/.test(text)) return 'chicken biryani';
    if (/\bpaneer\b/.test(text)) return 'paneer biryani';
    if (/\b(vegetable|veg|veggie)\b/.test(text)) return 'vegetable biryani';
    if (/\begg\b/.test(text)) return 'egg biryani';
    return 'biryani';
  }

  return text;
}

export function slugName(value = '') {
  return normalizeBenchName(value).replace(/\s+/g, '_');
}

export function selectWave1Cases(cases = [], limit = 200) {
  const foods = [];
  for (const row of cases) {
    if (!foods.includes(row.canonical_name)) foods.push(row.canonical_name);
  }
  const priorityFoods = new Set(foods.slice(0, WAVE1_FOOD_LIMIT));
  const selected = cases.filter((row) => row.split === 'development' && priorityFoods.has(row.canonical_name));
  return selected.slice(0, limit);
}

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctError(predicted, truth) {
  const pred = num(predicted);
  const ref = num(truth);
  if (pred == null || ref == null || ref === 0) return null;
  return (Math.abs(pred - ref) / Math.abs(ref)) * 100;
}

function withinPct(predicted, truth, tolerance) {
  const err = pctError(predicted, truth);
  return err != null && err <= tolerance;
}

function isHighConfidence(prediction = {}) {
  const band = prediction.confidence_band || prediction._confidence?.band;
  if (band === 'high') return true;
  const score = num(prediction.confidence_score);
  return score != null && score >= 0.8;
}

function primaryItem(items = []) {
  const solids = items.filter((item) => !item._visionOil && !/cooking oil/i.test(item.name || ''));
  const ranked = [...solids].sort((a, b) => (num(b.calories_kcal) || 0) - (num(a.calories_kcal) || 0));
  return ranked[0] || items[0] || null;
}

/** Prefer a family-matching solid over the highest-calorie side (vada/chutney/dosa on idli plates). */
function selectScoreItem(row, items = []) {
  const solids = items.filter((item) => !item._visionOil && !/cooking oil/i.test(item.name || ''));
  const familyHits = solids
    .filter((item) => foodMatch(row, item).foodOk)
    .sort((a, b) => (num(b.calories_kcal) || 0) - (num(a.calories_kcal) || 0));
  return familyHits[0] || primaryItem(items);
}

function gramsFromEstimate(value) {
  if (value == null) return null;
  if (typeof value === 'number') return num(value);
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*g\b/i);
  return match ? num(match[1]) : null;
}

function predictionGrams(prediction = {}, item = null) {
  const target = item || primaryItem(prediction.items || []);
  return num(target?._hiddenGrams)
    ?? num(target?._visionMeta?.amount)
    ?? gramsFromEstimate(target?.portion_estimate)
    ?? num(prediction.predicted_portion_g)
    ?? gramsFromEstimate(prediction.portion_estimate)
    ?? null;
}

function predictionRef(item = null) {
  if (!item) return '';
  return item._refId || item._per100?.refId || '';
}

function foodMatch(row, item) {
  const predictedId = predictionRef(item);
  const predictedName = normalizeBenchName(item?.name || '');
  const truthId = row.source_v4_id || slugName(row.canonical_name);
  const truthName = normalizeBenchName(row.canonical_name);
  const truthFamily = foodFamilyKey(row.source_v4_id || row.canonical_name);
  const predFamily = foodFamilyKey(predictedId || predictedName);
  return {
    predictedId,
    predictedName,
    truthId,
    foodOk: Boolean(predFamily && truthFamily && predFamily === truthFamily),
    variantOk: predictedId
      ? predictedId === truthId || predictedId === slugName(row.canonical_name)
      : Boolean(predictedName && predictedName === truthName),
  };
}

function sideMissed(row, items = []) {
  const side = row.common_side;
  if (!side || side.name === 'none' || !side.portion_g) return false;
  const needle = normalizeBenchName(side.name);
  return !items.some((item) => normalizeBenchName(`${item.name || ''} ${item._refId || ''}`).includes(needle));
}

export function scoreLevel24Case(row, prediction = {}, { measuredPortionG = null } = {}) {
  const evals = row.evaluation || {};
  const truth = row.ground_truth || {};
  const items = prediction.items || [];
  const item = selectScoreItem(row, items);
  const match = foodMatch(row, item);
  const portionTruth = num(measuredPortionG) ?? num(row.actual_portion_g) ?? num(row.portion_truth_g);
  const predGrams = predictionGrams(prediction, item);
  const predKcal = num(prediction.total_calories_kcal) ?? num(item?.calories_kcal);
  const predProtein = num(prediction.total_nutrition?.protein_g) ?? num(item?.nutrition?.protein_g);
  const predCarbs = num(prediction.total_nutrition?.carbs_g) ?? num(item?.nutrition?.carbs_g);
  const predFat = num(prediction.total_nutrition?.fat_g) ?? num(item?.nutrition?.fat_g);
  const mealKcal = num(truth.meal_kcal_central);
  const mealProtein = (num(truth.protein100_central) ?? 0) * (portionTruth || 0) / 100;
  const mealCarbs = (num(truth.carbs100_central) ?? 0) * (portionTruth || 0) / 100;
  const mealFat = (num(truth.fat100_central) ?? 0) * (portionTruth || 0) / 100;

  const portionErr = pctError(predGrams, portionTruth);
  const calorieErr = pctError(predKcal, mealKcal);
  const proteinErr = pctError(predProtein, mealProtein);
  const carbsErr = pctError(predCarbs, mealCarbs);
  const fatErr = pctError(predFat, mealFat);
  const portionTol = evals.portion_tolerance_pct ?? 20;
  const calorieTol = evals.calorie_pass_tolerance_pct ?? 20;
  const stretchTol = evals.calorie_stretch_tolerance_pct ?? 15;
  const macroTol = evals.macro_tolerance_pct ?? 20;

  const rangeOk = predKcal != null
    && num(truth.meal_kcal_low) != null
    && num(truth.meal_kcal_high) != null
    && predKcal >= truth.meal_kcal_low
    && predKcal <= truth.meal_kcal_high;

  const highConf = isHighConfidence(prediction);
  const sideMissing = sideMissed(row, items);
  const prepRich = /rich|higher oil|restaurant-rich/i.test(row.preparation_note || '');
  const prepLean = /lean|lower added/i.test(row.preparation_note || '');
  const portionOk = withinPct(predGrams, portionTruth, portionTol);
  const calorieOk = withinPct(predKcal, mealKcal, calorieTol);
  const calorieStretchOk = withinPct(predKcal, mealKcal, stretchTol);
  const proteinOk = withinPct(predProtein, mealProtein, macroTol);
  const carbsOk = withinPct(predCarbs, mealCarbs, macroTol);
  const fatOk = withinPct(predFat, mealFat, macroTol);
  const macrosOk = proteinOk && carbsOk && fatOk;

  const errors = [];
  if (!match.foodOk) errors.push('wrong_food');
  else if (!match.variantOk) errors.push('wrong_variant');
  if (sideMissing) errors.push('side_component_missed');
  if (portionErr != null && portionErr > portionTol) errors.push('portion_error');
  if (
    match.foodOk
    && portionOk
    && calorieErr != null
    && calorieErr > calorieTol
    && ((prepRich && predKcal < mealKcal) || (prepLean && predKcal > mealKcal))
  ) {
    errors.push('preparation_style_error');
  }
  if (match.foodOk && portionOk && fatErr != null && fatErr > macroTol && (calorieErr == null || calorieErr <= calorieTol + 5)) {
    errors.push('hidden_fat_or_sugar_error');
  }
  if (match.foodOk && portionOk && !calorieOk) errors.push('nutrition_reference_error');
  if (highConf && !match.foodOk && evals.penalize_high_confidence_wrong_answer !== false) {
    errors.push('confidence_miscalibration');
  }

  return {
    case_id: row.case_id,
    split: row.split,
    canonical_name: row.canonical_name,
    source_v4_id: row.source_v4_id,
    scenario: row.scenario,
    predicted_id: match.predictedId || null,
    predicted_name: match.predictedName || null,
    food_ok: match.foodOk,
    variant_ok: match.variantOk,
    portion_error_pct: portionErr,
    calorie_error_pct: calorieErr,
    protein_error_pct: proteinErr,
    carbs_error_pct: carbsErr,
    fat_error_pct: fatErr,
    portion_within_20: portionOk,
    calories_within_20: calorieOk,
    calories_within_15: calorieStretchOk,
    protein_within_20: proteinOk,
    carbs_within_20: carbsOk,
    fat_within_20: fatOk,
    macros_within_20: macrosOk,
    nutrition_range_ok: rangeOk,
    high_confidence: highConf,
    high_confidence_wrong_food: highConf && !match.foodOk,
    errors,
    primary_error: errors[0] || null,
  };
}

function rate(rows, key) {
  const usable = rows.filter((row) => row[key] != null);
  if (!usable.length) return null;
  return usable.filter((row) => row[key] === true).length / usable.length;
}

export function aggregateLevel24Scores(scored = []) {
  const errorCounts = Object.fromEntries(ERROR_TYPES.map((type) => [type, 0]));
  for (const row of scored) {
    for (const type of row.errors || []) {
      if (errorCounts[type] != null) errorCounts[type] += 1;
    }
  }

  const perFood = {};
  for (const row of scored) {
    const key = row.canonical_name;
    if (!perFood[key]) perFood[key] = [];
    perFood[key].push(row);
  }

  const overall = {
    cases: scored.length,
    food_recognition: rate(scored, 'food_ok'),
    variant_recognition: rate(scored, 'variant_ok'),
    portion_within_20pct: rate(scored, 'portion_within_20'),
    calories_within_20pct: rate(scored, 'calories_within_20'),
    calories_within_15pct: rate(scored, 'calories_within_15'),
    macros_within_20pct: rate(scored, 'macros_within_20'),
    nutrition_range_consistency: rate(scored, 'nutrition_range_ok'),
    high_confidence_wrong_food: scored.length
      ? scored.filter((row) => row.high_confidence_wrong_food).length / scored.length
      : null,
  };

  const worst20 = [...scored]
    .sort((a, b) => (b.calorie_error_pct || 0) - (a.calorie_error_pct || 0)
      || (b.errors?.length || 0) - (a.errors?.length || 0))
    .slice(0, 20);

  const highConfidenceWrong = scored.filter((row) => row.high_confidence_wrong_food);
  const biggestError = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    overall,
    targets: LEVEL24_TARGETS,
    per_food: Object.fromEntries(Object.entries(perFood).map(([food, rows]) => [food, {
      cases: rows.length,
      food_recognition: rate(rows, 'food_ok'),
      variant_recognition: rate(rows, 'variant_ok'),
      calories_within_20pct: rate(rows, 'calories_within_20'),
      portion_within_20pct: rate(rows, 'portion_within_20'),
      primary_errors: rows.map((row) => row.primary_error).filter(Boolean),
    }])),
    error_counts: errorCounts,
    worst_20: worst20,
    high_confidence_wrong_answers: highConfidenceWrong,
    next_fix: recommendNextFix(biggestError, errorCounts, perFood),
  };
}

export function recommendNextFix(biggestError, errorCounts = {}, perFood = {}) {
  const [type, count] = biggestError || [];
  if (!type || !count) {
    return 'No scored failures yet. Collect the 150–200 wave-1 development photos and run scoring.';
  }
  const worstFood = Object.entries(perFood)
    .map(([food, rows]) => [food, rows.filter((row) => (row.errors || []).includes(type)).length])
    .sort((a, b) => b[1] - a[1])[0];
  const foodHint = worstFood?.[1] ? ` Worst food: ${worstFood[0]}.` : '';
  const advice = {
    wrong_food: 'Biggest gap is food recognition. Add development photos and review matcher/Level 1 aliases — do not tune on holdout.',
    wrong_variant: 'Biggest gap is variant recognition. Keep generic overlays; add variant-disambiguation tests on development only.',
    portion_error: 'Biggest gap is portion estimation. Measure plate weights and compare against the 350 g fallback log — do not change photo logic from holdout.',
    preparation_style_error: 'Biggest gap is lean/rich preparation. Keep ranges; add development cases with oil/ghee notes.',
    hidden_fat_or_sugar_error: 'Biggest gap is hidden fat/sugar. Ask one clarification or widen ranges; do not invent precision.',
    side_component_missed: 'Biggest gap is missing sides. Check accompaniment pass on mixed plates.',
    nutrition_reference_error: 'Biggest gap is per-100 g references. Queue those foods for source-validated Level 2.3 promotion.',
    confidence_miscalibration: 'Biggest gap is high-confidence wrong answers. Lower confidence when the match is weak.',
  };
  return `${advice[type] || type} (${count} errors).${foodHint}`;
}

export function extractPredictionSnapshot(analysis = {}) {
  return {
    items: (analysis.items || []).map((item) => ({
      name: item.name,
      _refId: item._refId || item._per100?.refId || null,
      calories_kcal: item.calories_kcal,
      portion_estimate: item.portion_estimate || null,
      _hiddenGrams: item._hiddenGrams ?? null,
      _portionSource: item._portionSource || item._weightProvenance?.portionSource || null,
      nutrition: item.nutrition || null,
    })),
    total_calories_kcal: analysis.total_calories_kcal,
    total_nutrition: analysis.total_nutrition || null,
    confidence_score: analysis.confidence_score,
    confidence_band: analysis._confidence?.band || null,
    meal_summary: analysis.meal_summary || '',
    nutrition_sources: (analysis.items || []).map((item) => item.nutrition_source || item._per100?.nutrition_source || item._nutritionSource || null),
  };
}
