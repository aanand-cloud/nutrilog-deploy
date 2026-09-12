/**
 * India Level 2.2 nutrition validation layer.
 *
 * Keyed by source_v4_id. Provisional values are QA-only.
 * Production nutrition changes only when production_approved === true.
 * Recognition, portion, and nutrition confidence stay separate signals.
 */

import {
  INDIA_APPROVED_BY_V4_ID,
  INDIA_VALIDATION_STATS,
} from './india-nutrition-validation-approved.generated.js';

export const INDIA_VALIDATION_PROMOTION_FIELDS = [
  'source_ids_or_urls',
  'ingredient_grams',
  'ingredient_nutrition_sources',
  'final_cooked_yield_g',
  'kcal100_central',
  'kcal100_low',
  'kcal100_high',
  'protein100_central',
  'carbs100_central',
  'fat100_central',
  'fibre100_central',
  'typical_portion_g',
  'portion_low_g',
  'portion_high_g',
  'reviewer',
  'validated_at',
  'calculation_version',
];

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function isApprovedFlag(value) {
  return value === true || value === 'true';
}

/**
 * Tiny approved overlay map — empty until a reviewer sets production_approved.
 * @param {string} id
 * @returns {object|null}
 */
export function getApprovedIndiaNutrition(id = '') {
  if (!id || !INDIA_VALIDATION_STATS.approvedCount) return null;
  return INDIA_APPROVED_BY_V4_ID[id] || null;
}

export function isIndiaProductionApproved(id = '') {
  return Boolean(getApprovedIndiaNutrition(id));
}

/**
 * Keep the three confidence channels independent.
 * @param {object} [record]
 * @param {object} [matchMeta]
 * @returns {{ recognition: string|null, portion: string|null, nutrition: string|null }}
 */
export function indiaConfidenceSignals(record = {}, matchMeta = {}) {
  return {
    recognition: matchMeta.confidence || matchMeta.recognition_confidence || null,
    portion: record.portion_confidence || matchMeta.portion_confidence || null,
    nutrition: record.nutrition_confidence
      || record.confidence_before_source_validation
      || matchMeta.nutrition_confidence
      || null,
  };
}

/**
 * @param {object|null} v22Record
 * @param {object|null} validated
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function evaluateIndiaValidationPromotion(v22Record, validated) {
  const errors = [];
  if (!v22Record?.source_v4_id) {
    errors.push('missing source_v4_id mapping');
    return { ok: false, errors };
  }
  if (!validated || typeof validated !== 'object') {
    errors.push('missing validated payload');
    return { ok: false, errors };
  }

  const id = String(validated.source_v4_id || validated.id || '').trim();
  if (!id) errors.push('validated payload missing source_v4_id');
  else if (id !== v22Record.source_v4_id) {
    errors.push(`source_v4_id mismatch (${id} vs ${v22Record.source_v4_id})`);
  }

  if (!isApprovedFlag(validated.production_approved) && !isApprovedFlag(v22Record.production_approved)) {
    errors.push('production_approved must be true');
  }

  if (validated.validation_status === 'PROVISIONAL_NOT_SOURCE_VALIDATED') {
    errors.push('provisional validation_status cannot replace production nutrition');
  }

  for (const field of INDIA_VALIDATION_PROMOTION_FIELDS) {
    if (validated[field] == null || validated[field] === '') {
      errors.push(`missing ${field}`);
    }
  }

  if (!hasText(validated.reviewer)) errors.push('independent reviewer required');
  if (!Array.isArray(validated.source_ids_or_urls) || validated.source_ids_or_urls.length < 1) {
    if (!hasText(validated.source_ids_or_urls)) errors.push('source provenance required');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Provisional pack values must never be treated as a production overlay.
 * @param {object} [record]
 * @returns {boolean}
 */
export function isProvisionalIndiaReference(record = {}) {
  return record.production_approved !== true
    && (record.validation_status === 'PROVISIONAL_NOT_SOURCE_VALIDATED'
      || Boolean(record.provisional || record.level_2_2_provisional_reference));
}

export { INDIA_VALIDATION_STATS, INDIA_APPROVED_BY_V4_ID };
