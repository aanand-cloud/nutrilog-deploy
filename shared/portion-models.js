/**
 * Category and food-specific portion defaults — single source of truth for gram weights.
 * Per-100g nutrition lives in food references; this module only converts counts/units → grams.
 */

import { canonicalPieceGrams, resolveBreadReference } from './bread-piece-grams.js';
import { matchFoodReference } from './nutrition-density.js';
import { UK_MEDIUM_EGG_G } from './nutrition-reference.js';

/** Egg weights (g) — small/medium/large; default aligns with UK medium reference. */
export const EGG_GRAMS = {
  small: 38,
  medium: 44,
  large: 50,
  default: UK_MEDIUM_EGG_G,
};

/** Category defaults when no explicit grams and no food-specific override. */
export const CATEGORY_PORTIONS = [
  { id: 'cooked_rice', grams: 180, re: /\b(rice|biryani|pulao|pilaf|fried\s+rice)\b/i },
  { id: 'curry', grams: 200, re: /\b(curry|masala|korma|saag|bhaji|chole|chana|dal(?!\s+tadka\b))\b/i },
  { id: 'dal', grams: 200, re: /\b(dal|daal|lentil\s+soup|sambar)\b/i },
  { id: 'chutney', grams: 30, re: /\b(chutney|pickle|achar|pachadi|thuvaiyal)\b/i },
  { id: 'sauce_gravy', grams: 60, re: /\b(gravy|sauce|salna|salna|rasam)\b/i },
  { id: 'flatbread', grams: 45, re: /\b(chapati|chapathi|rotis?|phulka|naan|paratha|dosas?|idlis?|puris?|bhaturas?|pav)\b/i },
  { id: 'bread_slice', grams: 35, re: /\b(bread|toast|slice)\b/i },
  { id: 'fried_snack', grams: 60, re: /\b(samosa|pakora|vada|bhaji|fritter)\b/i },
  { id: 'cooked_veg', grams: 120, re: /\b(vegetable|veggie|salad|greens|broccoli|peas)\b/i },
  { id: 'meat_fish', grams: 150, re: /\b(chicken|lamb|mutton|beef|pork|fish|cod|salmon|prawn|shrimp|tofu|paneer)\b/i },
  { id: 'soup_drink', ml: 250, re: /\b(soup|coffee|tea|latte|smoothie|shake|juice|drink|water)\b/i },
  { id: 'default_solid', grams: 120, re: /.*/ },
];

const COUNTABLE_PIECES = {
  banana: 118,
  apple: 182,
  avocado: 160,
  sushi: 35,
  maki: 35,
  nigiri: 35,
  roll: 35,
  cookie: 30,
  biscuit: 15,
};

/**
 * @param {string} text
 * @returns {'small'|'medium'|'large'|null}
 */
export function parseSizeModifier(text = '') {
  const t = String(text).toLowerCase();
  if (/\bsmall\b/.test(t)) return 'small';
  if (/\blarge\b/.test(t)) return 'large';
  if (/\bmedium\b/.test(t)) return 'medium';
  return null;
}

/**
 * @param {string} name
 * @returns {string|null}
 */
export function detectPortionCategory(name = '') {
  const t = String(name).toLowerCase();
  for (const cat of CATEGORY_PORTIONS) {
    if (cat.id === 'default_solid') continue;
    if (cat.re.test(t)) return cat.id;
  }
  return 'default_solid';
}

/**
 * Grams (or ml≈g) for one piece/serving of a named food.
 * @param {string} name
 * @param {{ size?: string|null, refId?: string }} [opts]
 */
export function gramsPerPiece(name = '', { size = null, refId = '' } = {}) {
  const t = String(name).toLowerCase();
  const resolvedSize = size || parseSizeModifier(name) || 'default';

  if (/\begg/.test(t)) {
    return EGG_GRAMS[resolvedSize] || EGG_GRAMS.default;
  }

  for (const [key, grams] of Object.entries(COUNTABLE_PIECES)) {
    if (new RegExp(`\\b${key}s?\\b`, 'i').test(t)) return grams;
  }

  const breadRef = resolveBreadReference(name);
  if (breadRef) return canonicalPieceGrams(breadRef.id, name);

  const ref = refId ? matchFoodReference(refId) : matchFoodReference(name);
  if (ref && /\bdosas?\b|\bidlis?\b|\brotis?\b|\bnaan\b|\bparatha\b|\bpuris?\b|\bbhatur/.test(t)) {
    return canonicalPieceGrams(ref.id, name);
  }

  const cat = detectPortionCategory(name);
  const catDef = CATEGORY_PORTIONS.find((c) => c.id === cat) || CATEGORY_PORTIONS[CATEGORY_PORTIONS.length - 1];
  if (catDef.grams) return catDef.grams;
  return 60;
}

/**
 * Total nutrition grams for a count or explicit amount.
 * @param {number} count
 * @param {string} name
 * @param {{ size?: string|null, refId?: string }} [opts]
 */
export function countToNutritionGrams(count, name = '', opts = {}) {
  const parsed = Number(count);
  const n = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  return Math.round(n * gramsPerPiece(name, opts));
}

/**
 * Default serving weight when user gives no quantity.
 * @param {string} name
 * @param {string} [refId]
 */
export function defaultServingGrams(name = '', refId = '') {
  const t = `${name} ${refId}`.toLowerCase();
  if (/\b(ml|soup|drink|coffee|tea|sambar|rasam|sauce|gravy)\b/.test(t)) {
    const cat = CATEGORY_PORTIONS.find((c) => c.id === 'soup_drink');
    return cat?.ml || 250;
  }
  const cat = detectPortionCategory(name);
  const catDef = CATEGORY_PORTIONS.find((c) => c.id === cat) || CATEGORY_PORTIONS[CATEGORY_PORTIONS.length - 1];
  return catDef.grams || 120;
}
