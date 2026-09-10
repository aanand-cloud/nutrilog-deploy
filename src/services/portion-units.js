/** Parse and convert portion amounts for meal review (g, ml, oz, pieces). */

import { countToNutritionGrams as countToGramsFromModels, defaultServingGrams } from '../../shared/portion-models.js';
import { parseQuantityFromText, phraseHasExplicitQuantity } from '../../shared/quantity-parser.js';
import { matchFoodReference } from '../../shared/nutrition-density.js';

export const WEIGHT_UNITS = [
  { id: 'g', label: 'g', suffix: 'g' },
  { id: 'oz', label: 'oz', suffix: 'oz' },
];

export const VOLUME_UNITS = [
  { id: 'ml', label: 'ml', suffix: 'ml' },
  { id: 'g', label: 'g (est.)', suffix: 'g' },
];

export const COUNT_UNITS = [
  { id: 'piece', label: 'pieces', suffix: '' },
];

export function detectUnitKind(name = '', portionEstimate = '') {
  const t = `${name} ${portionEstimate}`.toLowerCase();
  if (/\b\d+\s*ml\b|millilitre|milliliter|\bml\b/.test(t)) return 'volume';
  if (/\b(coffee|tea|latte|cappuccino|juice|water|wine|beer|milk|smoothie|shake|cola|drink|soup|sambar|sauce|soy)\b/.test(t)) {
    return 'volume';
  }
  if (/\b\d+\s*(?:medium\s+)?eggs?\b|\begg\b|\bbananas?\b|\bslices?\b|\bpieces?\b|\bcookies?\b|\bnaan\b|\broti\b|\bchapati\b|\bdosa\b|\bidli\b|\bpuri\b|\bbhatur[ae]\b|\bpav\b|\bwrap\b|\bsushi\b|\bmaki\b|\bnigiri\b|\broll\b/.test(t)) {
    return 'count';
  }
  return 'weight';
}

/** Convert piece/slice count to estimated gram weight for nutrition scaling. */
export function countToNutritionGrams(pieceCount, name = '', opts = {}) {
  const size = typeof opts === 'string' ? opts : opts?.size;
  return countToGramsFromModels(pieceCount, name, { size: size || null });
}

/**
 * Grams (or ml treated as ~1g/ml) used for per-100g nutrition scaling.
 * @param {{ amount: number, unit: string, kind: string }} parsed
 * @param {string} name
 */
export function nutritionGramsFromParsed(parsed, name = '') {
  if (!parsed || !parsed.amount || parsed.amount <= 0) return 0;
  if (parsed.unit === 'ml' || parsed.kind === 'volume') return parsed.amount;
  if (parsed.unit === 'piece' || parsed.kind === 'count') {
    return countToNutritionGrams(parsed.amount, name, { size: parsed.size });
  }
  if (parsed.unit === 'oz') return Math.round(parsed.amount * 28.3495);
  return parsed.amount;
}

export function unitOptionsForKind(kind = 'weight', prefs = { weight: 'g' }) {
  if (kind === 'volume') return VOLUME_UNITS;
  if (kind === 'count') return COUNT_UNITS;
  if (prefs.weight === 'oz') {
    return [
      { id: 'oz', label: 'oz', suffix: 'oz' },
      { id: 'g', label: 'g', suffix: 'g' },
    ];
  }
  return WEIGHT_UNITS;
}

/** @returns {{ amount: number, unit: string, kind: 'weight'|'volume'|'count' }} */
export function parsePortionEstimate(text = '', name = '') {
  const raw = String(text || '').trim();
  const kind = detectUnitKind(name, raw);

  let m = raw.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (m) return { amount: Number(m[1]), unit: 'ml', kind: 'volume' };

  m = raw.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (m) return { amount: Number(m[1]), unit: 'g', kind: kind === 'volume' ? 'volume' : 'weight' };

  m = raw.match(/(\d+(?:\.\d+)?)\s*(?:medium\s+)?eggs?\b/i);
  if (m) return { amount: Number(m[1]), unit: 'piece', kind: 'count' };

  m = raw.match(/(\d+(?:\.\d+)?)\s*(?:medium|large|small)?\s*bananas?\b/i);
  if (m) return { amount: Number(m[1]), unit: 'piece', kind: 'count' };

  m = raw.match(/(\d+(?:\.\d+)?)\s*(?:pieces?|slices?)\b/i);
  if (m) return { amount: Number(m[1]), unit: 'piece', kind: 'count' };

  m = raw.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (m) {
    return {
      amount: Number(m[1]),
      unit: kind === 'count' ? 'piece' : kind === 'volume' ? 'ml' : 'g',
      kind,
    };
  }

  if (kind === 'count') return { amount: 1, unit: 'piece', kind: 'count' };
  if (kind === 'volume') return { amount: 200, unit: 'ml', kind: 'volume' };
  return { amount: defaultServingGrams(name), unit: 'g', kind: 'weight' };
}

export function parseGrams(text) {
  const parsed = parsePortionEstimate(text);
  if (parsed.unit === 'g') return parsed.amount;
  if (parsed.unit === 'oz') return Math.round(parsed.amount * 28.3495);
  if (parsed.unit === 'ml') return parsed.amount;
  if (parsed.unit === 'piece') return countToNutritionGrams(parsed.amount, text);
  return null;
}

export function displayAmount(baseAmount, unit, kind) {
  if (unit === 'oz') return Math.round((baseAmount / 28.3495) * 10) / 10;
  return Math.round(baseAmount * 10) / 10;
}

export function toBaseAmount(displayValue, unit) {
  const n = Number(displayValue);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === 'oz') return Math.round(n * 28.3495);
  return Math.round(n * 10) / 10;
}

export function formatPortionEstimate(amount, unit, kind) {
  const n = Math.round(amount * 10) / 10;
  if (unit === 'piece' || kind === 'count') {
    return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
  }
  if (unit === 'ml' || kind === 'volume') return `${n}ml`;
  if (unit === 'oz') return `${n}oz`;
  return `${n}g`;
}

export function itemQuickAdjustments(kind = 'weight') {
  if (kind === 'count') {
    return [
      { id: 'minus1', label: '−1', delta: -1 },
      { id: 'plus1', label: '+1', delta: 1 },
    ];
  }
  return [
    { id: 'half', label: 'Half', factor: 0.5 },
    { id: 'double', label: 'Double', factor: 2 },
  ];
}
