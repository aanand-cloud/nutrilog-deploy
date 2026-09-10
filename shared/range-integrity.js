/**
 * Range integrity — central kcal estimate must always fall inside displayed min/max.
 */

import { scoreMealConfidence } from './nutrition-confidence.js';

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * Ensure min ≤ point ≤ max. Expands boundaries when recalculation unavailable.
 * @param {object} range
 * @param {number} point
 * @returns {{ range: object, adjusted: boolean, reason: string|null }}
 */
export function normalizeKcalRange(range = null, point = 0) {
  if (!range || point <= 0) return { range, adjusted: false, reason: null };

  let min = Math.round(num(range.min));
  let max = Math.round(num(range.max));
  const central = Math.round(point);
  let adjusted = false;
  let reason = null;

  if (min > max) {
    [min, max] = [max, min];
    adjusted = true;
    reason = 'range_bounds_inverted';
  }

  if (central < min) {
    min = central;
    adjusted = true;
    reason = reason || 'range_below_point';
  }
  if (central > max) {
    max = central;
    adjusted = true;
    reason = reason || 'range_above_point';
  }

  return {
    range: {
      ...range,
      min,
      max,
      point: central,
      integrityAdjusted: adjusted || range.integrityAdjusted,
      integrityReason: reason || range.integrityReason || null,
    },
    adjusted,
    reason,
  };
}

/**
 * Validate and repair meal kcal range against the central estimate.
 * @param {object} analysis
 * @param {object} [scored]
 */
export function enforceRangeIntegrity(analysis = {}, scored = null) {
  const confidence = scored || analysis._confidence || scoreMealConfidence(analysis);
  const point = Math.round(num(analysis.total_calories_kcal));
  let kcalRange = confidence.kcalRange ? { ...confidence.kcalRange, point } : null;
  let adjusted = false;
  let integrityReason = null;

  if (kcalRange) {
    const normalized = normalizeKcalRange(kcalRange, point);
    kcalRange = normalized.range;
    adjusted = normalized.adjusted;
    integrityReason = normalized.reason;
  }

  if (analysis._recipeKcalRange && point > 0) {
    const recipeRange = { ...analysis._recipeKcalRange };
    let recipeAdjusted = false;
    if (point < recipeRange.min) {
      recipeRange.min = point;
      recipeAdjusted = true;
    }
    if (point > recipeRange.max) {
      recipeRange.max = point;
      recipeAdjusted = true;
    }
    if (recipeAdjusted) {
      analysis._recipeKcalRange = recipeRange;
      adjusted = true;
      integrityReason = integrityReason || 'recipe_range_expanded';
    }
  }

  if (adjusted && typeof globalThis !== 'undefined') {
    analysis._rangeIntegrityFailure = {
      reason: integrityReason,
      point,
      range: kcalRange,
      at: new Date().toISOString(),
    };
  }

  const nextConfidence = {
    ...confidence,
    kcalRange,
  };

  return {
    analysis: {
      ...analysis,
      _confidence: nextConfidence,
      _rangeIntegrity: {
        pass: !kcalRange || (kcalRange.min <= point && point <= kcalRange.max),
        adjusted,
        reason: integrityReason,
      },
    },
    scored: nextConfidence,
    adjusted,
  };
}

/**
 * Scale kcal range proportionally with portion factor (immutable baseline scaling).
 * @param {object|null} range
 * @param {number} factor
 */
export function scaleKcalRange(range = null, factor = 1) {
  if (!range || !Number.isFinite(factor) || factor <= 0) return range;
  const point = Math.round(num(range.point) * factor);
  const scaled = {
    ...range,
    min: Math.round(num(range.min) * factor),
    max: Math.round(num(range.max) * factor),
    point,
  };
  return normalizeKcalRange(scaled, point).range;
}
