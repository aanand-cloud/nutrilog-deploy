/**
 * Phase 3 — mixed dish cooking logic: venue source, oil/ghee tiers, hidden-fat uncertainty.
 */

export const PHASE3_TARGETS = {
  /** Supported confirmed mixed dishes within ±20% of trusted benchmark. */
  confirmedMixedDishesWithin20Pct: 0.9,
};

/** Portion scale by where the meal was prepared. */
export const COOKING_SOURCE_SCALE = {
  homemade: 1.0,
  restaurant: 1.12,
  takeaway: 1.22,
};

/** Hidden cooking fat multiplier when oil clarify is applied post-hoc (non-recipe path). */
export const OIL_LEVEL_MULTIPLIER = {
  light: 0.88,
  normal: 1.0,
  generous: 1.22,
  deep_fried: 1.45,
  unknown: 1.15,
};

const MEAL_SOURCE_ANSWERS = {
  homemade: ['homemade', 'home cooked', 'home-cooked', 'cooked at home', 'home'],
  restaurant: ['restaurant', 'dining out', 'eat out', 'pub', 'cafe', 'café'],
  takeaway: ['takeaway', 'take away', 'take-out', 'takeout', 'delivery', 'delivered'],
};

const OIL_ANSWER_LEVEL = [
  { level: 'light', re: /very little|minimal|light|dry|little oil|little butter|little ghee/i },
  { level: 'normal', re: /normal|regular|home|standard/i },
  { level: 'generous', re: /oily|restaurant|greasy|lots of (oil|ghee|butter)|extra oil/i },
  { level: 'deep_fried', re: /deep.?fried|deep fried/i },
];

/**
 * @param {string} answer
 * @returns {'homemade'|'restaurant'|'takeaway'|null}
 */
export function parseCookingSourceFromAnswer(answer = '') {
  const t = String(answer).toLowerCase().trim();
  if (!t) return null;
  for (const [source, phrases] of Object.entries(MEAL_SOURCE_ANSWERS)) {
    if (phrases.some((p) => t.includes(p))) return source;
  }
  if (/restaurant|dine/.test(t)) return 'restaurant';
  if (/take/.test(t)) return 'takeaway';
  return null;
}

/**
 * @param {string} answer
 * @returns {'light'|'normal'|'generous'|'deep_fried'|null}
 */
export function parseOilLevelFromAnswer(answer = '') {
  const t = String(answer).trim();
  if (!t) return null;
  for (const { level, re } of OIL_ANSWER_LEVEL) {
    if (re.test(t)) return level;
  }
  return null;
}

/**
 * Build recipe resolution opts from clarify answer list.
 * @param {Array<{ topic?: string, answer?: string }>} answers
 */
export function cookingOptsFromClarifyAnswers(answers = []) {
  let cookingSource = null;
  let oilLevel = null;
  for (const { topic, answer } of answers) {
    if (topic === 'meal_source') {
      cookingSource = parseCookingSourceFromAnswer(answer) || cookingSource;
    }
    if (topic === 'oil_fat') {
      oilLevel = parseOilLevelFromAnswer(answer) || oilLevel;
    }
    if (topic === 'portion_solid' || topic === 'portion_takeaway') {
      const src = parseCookingSourceFromAnswer(answer);
      if (src) cookingSource = src;
    }
  }
  return { cookingSource, oilLevel };
}

/**
 * @param {object} recipe
 * @param {{ cookingSource?: string, oilLevel?: string }} opts
 */
export function sourceScaleForRecipe(recipe, opts = {}) {
  const source = opts.cookingSource || 'homemade';
  const fromRecipe = recipe?.sourceScale?.[source];
  if (Number.isFinite(fromRecipe) && fromRecipe > 0) return fromRecipe;
  return COOKING_SOURCE_SCALE[source] ?? 1;
}

/**
 * Grams of hidden cooking fat for a recipe at given oil level.
 * @param {object} recipe
 * @param {{ oilLevel?: string }} opts
 */
export function cookingFatGramsForRecipe(recipe, opts = {}) {
  const fat = recipe?.cookingFat;
  if (!fat?.gramsByOil) return 0;
  const level = opts.oilLevel || 'normal';
  const grams = fat.gramsByOil[level] ?? fat.gramsByOil.normal ?? 0;
  return Math.max(0, num(grams));
}

/**
 * ±pct tolerance check for Phase 3 benchmark gates.
 */
export function withinPhase3Tolerance(actual, expected, pct = 20) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) return false;
  return Math.abs(actual - expected) / expected <= pct / 100;
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * Whether analysis looks like a decomposed mixed dish needing venue/oil clarify.
 * @param {object} analysis
 */
export function isMixedDishNeedingClarify(analysis = {}) {
  if (!analysis._recipeDecomposed) return false;
  const confidence = Number(analysis.confidence_score) || Number(analysis._confidence?.score) || 1;
  return confidence < 0.88;
}
