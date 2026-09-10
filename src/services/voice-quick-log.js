/**
 * Describe / voice meal estimates — unified per-100g pipeline only (no fixed-kcal pattern lumps).
 */

import { resolveMealFromText } from '../../shared/meal-resolution-pipeline.js';

/**
 * @param {string} text
 * @returns {object|null} analysis-shaped object for meal review modal
 */
export function estimateMealFromDescription(text) {
  const raw = String(text || '').trim();
  if (raw.length < 3) return null;
  return resolveMealFromText(raw, { source: 'voice' });
}
