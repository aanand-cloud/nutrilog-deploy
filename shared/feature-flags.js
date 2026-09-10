/**
 * MealNova feature flags — safe rollout and rollback for nutrition engine phases.
 * Browser: localStorage key `mealnova_flags` JSON merge.
 * Node/tests: set process.env.MEALNOVA_FLAGS JSON before import.
 */

/** @typedef {Record<string, boolean>} MealNovaFlags */

export const DEFAULT_FLAGS = {
  /** Phase 1 — unified describe pipeline (refs over patterns where possible). */
  unifiedMealPipeline: true,
  /** Phase 1 — block save on incomplete validation without confirm. */
  requireValidationConfirm: true,
  /** Phase 1 — parsing integrity: bind quantities, reconcile input vs output. */
  parsingIntegrity: true,
  /** Phase 1 — show multi-factor confidence in meal review. */
  confidenceBands: true,
  /** Phase 2 — prefer V4 canonical records over Tier-1 regex when both match. */
  v4CanonicalPriority: true,
  /** Phase 2 — use CoFID/IFCT verified nutrition over V4 estimates. */
  authoritativeNutrition: true,
  /** Phase 3 — recipe decomposition for mixed dishes. */
  recipeEngine: true,
  /** Phase 3 — venue source + oil/ghee models on recipe templates. */
  mixedDishCooking: true,
  /** Phase 4 — second-pass accompaniment detection in vision. */
  visionSecondPass: true,
  /** Phase 5 — kcal ranges for uncertain meals. */
  uncertaintyRanges: true,
};

let cached = null;

function parseFlagJson(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * @returns {MealNovaFlags}
 */
export function getMealNovaFlags() {
  if (cached) return cached;

  let overrides = {};
  if (typeof process !== 'undefined' && process.env?.MEALNOVA_FLAGS) {
    overrides = parseFlagJson(process.env.MEALNOVA_FLAGS);
  } else if (typeof localStorage !== 'undefined') {
    overrides = parseFlagJson(localStorage.getItem('mealnova_flags'));
  }

  cached = { ...DEFAULT_FLAGS, ...overrides };
  return cached;
}

/** @param {Partial<MealNovaFlags>} patch */
export function setMealNovaFlags(patch = {}) {
  const next = { ...getMealNovaFlags(), ...patch };
  cached = next;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mealnova_flags', JSON.stringify(next));
  }
  return next;
}

/** @param {keyof typeof DEFAULT_FLAGS} name */
export function isFlagEnabled(name) {
  return Boolean(getMealNovaFlags()[name]);
}

export function resetMealNovaFlagsCache() {
  cached = null;
}
