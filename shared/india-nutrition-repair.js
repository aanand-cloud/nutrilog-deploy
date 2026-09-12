/**
 * India Level 2.1 nutrition-repair QA contract.
 *
 * This is a promotion gate only. It never invents or applies nutrition at runtime.
 * Placeholder estimated_reference values stay until a repair passes this gate.
 */

export const INDIA_REPAIR_REQUIRED_OUTPUT_FIELDS = [
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
  'confidence',
  'source_notes',
  'validated_at',
];

export const INDIA_REPAIR_PRIORITY_MAX = 250;

const PLACEHOLDER_BASES = new Set(['estimated_reference', 'internal_estimated', '']);

/**
 * @param {object} [nutrition]
 * @returns {boolean}
 */
export function isPlaceholderNutrition(nutrition = {}) {
  const basis = String(nutrition.nutrition_basis || nutrition.nutritionBasis || '').trim();
  return PLACEHOLDER_BASES.has(basis);
}

/**
 * @param {object} [repair]
 * @returns {string[]}
 */
export function evidencePathsOf(repair = {}) {
  const raw = repair.evidence_paths || repair.evidencePaths || repair.sources || [];
  return [...new Set((Array.isArray(raw) ? raw : [raw]).map((row) => String(row || '').trim()).filter(Boolean))];
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

/**
 * Rank 1–250 is the active India QA window.
 * @param {object} [queueItem]
 * @returns {boolean}
 */
export function isPriorityIndiaRepair(queueItem = {}) {
  const rank = Number(queueItem.rank);
  return Number.isInteger(rank) && rank >= 1 && rank <= INDIA_REPAIR_PRIORITY_MAX;
}

/**
 * Evaluate a candidate repair against the Level 2.1 promotion gate.
 * Passing this is required before any V4 / verified overlay write.
 *
 * @param {object | null} queueItem
 * @param {object | null} repair
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function evaluateIndiaRepairPromotion(queueItem, repair) {
  const errors = [];
  if (!queueItem?.source_v4_id) {
    errors.push('missing queue source_v4_id mapping');
    return { ok: false, errors };
  }
  if (!repair || typeof repair !== 'object') {
    errors.push('missing validated repair');
    return { ok: false, errors };
  }

  const repairId = String(repair.source_v4_id || repair.id || '').trim();
  if (!repairId) errors.push('repair missing source_v4_id');
  else if (repairId !== queueItem.source_v4_id) {
    errors.push(`source_v4_id mismatch (${repairId} vs ${queueItem.source_v4_id})`);
  }

  if (!isPriorityIndiaRepair(queueItem)) {
    errors.push(`rank ${queueItem.rank} is outside the 1–${INDIA_REPAIR_PRIORITY_MAX} priority window`);
  }

  for (const field of INDIA_REPAIR_REQUIRED_OUTPUT_FIELDS) {
    if (repair[field] == null || repair[field] === '') {
      errors.push(`missing ${field}`);
    }
  }

  if (!hasText(repair.source_notes) && !hasText(repair.provenance)) {
    errors.push('provenance required (source_notes)');
  }
  if (!hasText(repair.dataSource) && !hasText(repair.data_source)) {
    errors.push('provenance required (dataSource)');
  }
  if (isPlaceholderNutrition(repair)) {
    errors.push('placeholder nutrition_basis cannot be promoted');
  }

  const variability = String(queueItem.variability || 'high').toLowerCase();
  const evidence = evidencePathsOf(repair);
  const minEvidence = variability === 'high' ? 2 : 1;
  if (evidence.length < minEvidence) {
    errors.push(`${variability} variability requires ${minEvidence} evidence path(s)`);
  }

  if (variability === 'high') {
    const low = num(repair.kcal100_low);
    const central = num(repair.kcal100_central);
    const high = num(repair.kcal100_high);
    if (low == null || central == null || high == null || low > central || central > high) {
      errors.push('high-variability dishes require kcal100_low ≤ central ≤ high');
    }
    const portionLow = num(repair.portion_low_g);
    const portion = num(repair.typical_portion_g);
    const portionHigh = num(repair.portion_high_g);
    if (portionLow == null || portion == null || portionHigh == null || portionLow > portion || portion > portionHigh) {
      errors.push('high-variability dishes require portion_low_g ≤ typical ≤ portion_high_g');
    }
  }

  const confidence = String(repair.confidence || '').toLowerCase();
  if (!['high', 'medium', 'low'].includes(confidence)) {
    errors.push('confidence must be high, medium, or low');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Placeholder estimated values may be removed only after a gated replacement exists.
 * @param {object | null} queueItem
 * @param {object | null} repair
 * @returns {boolean}
 */
export function canRemovePlaceholderNutrition(queueItem, repair) {
  return evaluateIndiaRepairPromotion(queueItem, repair).ok;
}
