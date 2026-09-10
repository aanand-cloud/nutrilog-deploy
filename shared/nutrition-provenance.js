/**
 * Phase 2 — source-backed nutrition provenance and calculation display.
 */

import { getVerifiedRecord } from './verified-nutrition.js';
import { VERIFICATION_META } from './canonical-food-model.js';

const SOURCE_LABELS = {
  cofid: 'CoFID',
  ifct: 'IFCT',
  usda: 'USDA',
  manufacturer: 'Manufacturer label',
  restaurant: 'Restaurant nutrition',
  recipe: 'MealNova recipe',
  internal_estimated: 'Estimated reference',
};

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * @param {number|null|undefined} value
 * @param {'known'|'estimated'|'not_available'} availability
 */
export function formatNutrientDisplay(value, availability = 'known') {
  if (availability === 'not_available' || value == null) return 'Not available';
  if (availability === 'estimated') return `~${value}`;
  return String(value);
}

/**
 * Derive per-nutrient availability from verified record and scaled values.
 * @param {object} ref
 * @param {object} nutrition
 */
export function nutrientAvailability(ref = {}, nutrition = {}) {
  const microKeys = ['fibre_g', 'sugar_g', 'salt_mg'];
  const refMap = { fibre_g: 'fibre100', sugar_g: 'sugar100', salt_mg: 'salt100' };
  const out = {};
  for (const key of microKeys) {
    const refKey = refMap[key];
    if (ref?.[refKey] == null && nutrition[key] == null) {
      out[key] = 'not_available';
    } else if (ref?.[refKey] == null && nutrition[key] != null) {
      out[key] = 'estimated';
    } else {
      out[key] = 'known';
    }
  }
  return out;
}

/**
 * Build provenance lines for one item — used in "Why this estimate?"
 * @param {object} item
 */
export function itemProvenanceSummary(item = {}) {
  const verified = getVerifiedRecord(item._refId);
  const per100 = item._per100 || {};
  const grams = num(item._hiddenGrams) || num(item._boundQuantity?.amount);
  const canonicalName = verified?.canonicalName || per100.canonicalName || item._canonical?.canonicalName || item.name;
  const source = SOURCE_LABELS[verified?.dataSource || item._nutritionSource || per100.dataSource]
    || item._provenanceLabel
    || 'Estimated reference';
  const sourceRecordId = verified?.sourceRecordId || per100.sourceRecordId || item._canonical?.sourceRecordId || '';
  const kcal100 = num(verified?.kcal100 ?? per100.kcal);
  const prepState = verified?.preparationState || item._preparationState || item._canonical?.preparationState || '';
  const dataVersion = verified?.dataVersion || per100.dataVersion || '';
  const pieceG = verified?.standardPortionGrams;
  const status = VERIFICATION_META[verified?.verificationStatus || item._canonical?.verificationStatus]?.label
    || (item._authoritative ? 'Verified' : 'Estimated');

  const lines = [`Detected: ${item.name}`, `Canonical match: ${canonicalName}`];
  if (item._refId) lines.push(`Food ID: ${item._refId}`);
  if (prepState) lines.push(`State: ${prepState}`);
  if (source) lines.push(`Source: ${source}${sourceRecordId ? ` (${sourceRecordId})` : ''}`);
  if (dataVersion) lines.push(`Data version: ${dataVersion}`);
  if (kcal100 > 0) lines.push(`Nutrition basis: ${kcal100} kcal per 100 g`);
  if (pieceG > 0 && item._boundQuantity?.unit === 'piece') {
    lines.push(`Portion: ${item._boundQuantity.amount} × ${pieceG} g = ${Math.round(item._boundQuantity.amount * pieceG)} g`);
  } else if (grams > 0) {
    lines.push(`Converted weight: ${Math.round(grams)} g`);
  }
  if (kcal100 > 0 && grams > 0) {
    const kcal = Math.round(kcal100 * grams / 100);
    lines.push(`Calculation: ${kcal100} × ${Math.round(grams)} ÷ 100 = ${kcal} kcal`);
  }
  lines.push(`Confidence basis: ${status}`);
  return lines.join('\n');
}

/**
 * Full "Why this estimate?" text with per-component provenance.
 * @param {object} analysis
 */
export function whyThisEstimateDetailed(analysis = {}) {
  const items = (analysis.items || []).filter((i) => !i._unmatched);
  if (!items.length) return 'Review each line before saving.';

  return items.map((item) => itemProvenanceSummary(item)).join('\n\n');
}

/**
 * HTML block for item-level provenance in review modal.
 * @param {object} item
 */
export function itemProvenanceHtml(item = {}) {
  const summary = itemProvenanceSummary(item);
  if (!summary) return '';
  return `
    <details class="item-provenance">
      <summary>Why this estimate?</summary>
      <pre class="item-provenance__text fine-print">${escapeHtml(summary)}</pre>
    </details>
  `;
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
