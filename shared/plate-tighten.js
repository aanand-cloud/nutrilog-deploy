/**
 * Multi-item / mixed-plate accuracy — all cuisines.
 * Dedupes double-counts, restores collapsed photo items, and surfaces missing components.
 */

import { matchFoodReference, parseGramsFromText, calibrateItemWithReference } from './nutrition-density.js';

const COMPOUND_TEXT_RE = /\b(and|with|plus|\+|&)\b/i;

const RICE_MAIN_RE = /\b(biryani|pulao|pilau|fried rice|risotto|paella|jollof|nasi lemak|chow mein|lo mein|spaghetti|carbonara|bolognese)\b/i;
const PLAIN_RICE_RE = /\b(steamed rice|white rice|basmati|jeera rice|plain rice|boiled rice)\b/i;
const GENERIC_RICE_RE = /\brice\b/i;

const COMPONENT_CHECKS = [
  {
    id: 'bread',
    gapKey: 'missingBread',
    textRe: /\b(bread|roti|naan|chapati|paratha|dosa|dosai|idli|puri|pav|bhatura|wrap|tortilla|pita|bagel|toast|bun|roll|flatbread|pitta)\b/i,
    itemRe: /\b(bread|roti|naan|chapati|paratha|dosa|dosai|idli|puri|pav|bhatura|wrap|tortilla|pita|bagel|toast|bun|roll|flatbread|pitta)\b/i,
    clarifyTopic: 'bread_count',
  },
  {
    id: 'rice',
    gapKey: 'missingRiceSide',
    textRe: /\b(steamed rice|white rice|basmati|jeera rice|plain rice|side rice)\b/i,
    itemRe: /\b(steamed rice|white rice|basmati|jeera rice|plain rice|side rice)\b/i,
    clarifyTopic: 'portion_rice',
  },
  {
    id: 'curry',
    gapKey: 'missingCurry',
    textRe: /\b(curry|dal|sambar|rasam|stew|gravy|masala|korma|sauce|chili|chilli|tagine|tikka masala)\b/i,
    itemRe: /\b(curry|dal|sambar|rasam|stew|gravy|masala|korma|sauce|chili|chilli|tagine|tikka)\b/i,
    clarifyTopic: 'portion_solid',
  },
  {
    id: 'egg',
    gapKey: 'missingEgg',
    textRe: /\b(egg|eggs|omelette|omelet|frittata|fried egg|scrambled egg|poached egg)\b/i,
    itemRe: /\b(egg|eggs|omelette|omelet|frittata)\b/i,
    clarifyTopic: 'portion_solid',
  },
  {
    id: 'protein',
    gapKey: 'missingProtein',
    textRe: /\b(chicken|lamb|beef|pork|fish|salmon|prawn|shrimp|tofu|paneer|steak|sausage|bacon|ham|turkey|duck)\b/i,
    itemRe: /\b(chicken|lamb|beef|pork|fish|salmon|prawn|shrimp|tofu|paneer|steak|sausage|bacon|ham|turkey|duck)\b/i,
    clarifyTopic: 'portion_solid',
  },
  {
    id: 'salad',
    gapKey: 'missingSalad',
    textRe: /\b(salad|greens|coleslaw|slaw)\b/i,
    itemRe: /\b(salad|greens|coleslaw|slaw)\b/i,
    clarifyTopic: 'portion_solid',
  },
  {
    id: 'fries',
    gapKey: 'missingFries',
    textRe: /\b(fries|chips|wedges)\b/i,
    itemRe: /\b(fries|chips|wedges)\b/i,
    clarifyTopic: 'portion_snack',
  },
];

const MIXED_PLATE_TEXT_RE = /\b(plate|platter|thali|tiffin|combo|set meal|full meal|mixed|with|and|breakfast|brunch|mezze|tapas|bento|box meal|Sunday roast|full english|fish and chips|burger and fries|curry and rice|rice and curry)\b/i;

const PLATE_MIN_KCAL = {
  mixed: 350,
  curry_rice: 450,
  tiffin: 400,
  takeaway: 500,
  breakfast: 450,
};

function itemText(item = {}) {
  return `${item.name || ''} ${item.portion_estimate || ''}`.trim();
}

function normalizeItemKey(item = {}) {
  return itemText(item).toLowerCase().replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function analysisText(analysis = {}) {
  return [
    analysis.meal_summary,
    analysis._userDescription,
    ...(analysis.items || []).map((i) => itemText(i)),
    ...(analysis._photoItems || []).map((i) => itemText(i)),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isCompoundMealDescription(text = '') {
  const t = String(text).trim();
  if (!t) return false;
  if (!COMPOUND_TEXT_RE.test(t)) return false;
  const parts = t.split(COMPOUND_TEXT_RE).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2;
}

export function itemsCoverComponent(items = [], itemRe) {
  return items.some((item) => itemRe.test(itemText(item)));
}

export function detectPlateGaps(analysis = {}) {
  const items = analysis.items || [];
  const text = analysisText(analysis);
  const gaps = {
    missingBread: false,
    missingRiceSide: false,
    missingCurry: false,
    missingEgg: false,
    missingProtein: false,
    missingSalad: false,
    missingFries: false,
    suggestedTopics: [],
  };

  for (const check of COMPONENT_CHECKS) {
    if (!check.textRe.test(text)) continue;
    if (itemsCoverComponent(items, check.itemRe)) continue;
    gaps[check.gapKey] = true;
    if (!gaps.suggestedTopics.includes(check.clarifyTopic)) {
      gaps.suggestedTopics.push(check.clarifyTopic);
    }
  }

  if (gaps.missingRiceSide && RICE_MAIN_RE.test(text)) {
    gaps.missingRiceSide = false;
    gaps.suggestedTopics = gaps.suggestedTopics.filter((t) => t !== 'portion_rice');
  }

  return gaps;
}

export function isUndercountedMixedPlate(analysis = {}) {
  const items = analysis.items || [];
  const text = analysisText(analysis);
  const kcal = Number(analysis.total_calories_kcal) || items.reduce((s, i) => s + (Number(i.calories_kcal) || 0), 0);
  const gaps = detectPlateGaps(analysis);

  if (items.length >= 3) return false;
  if (gaps.suggestedTopics.length >= 2) return kcal < PLATE_MIN_KCAL.mixed;
  if (MIXED_PLATE_TEXT_RE.test(text) && items.length <= 1) return kcal < PLATE_MIN_KCAL.mixed;
  if (/\b(thali|tiffin|dosa|idli|breakfast|full english|fish and chips)\b/i.test(text) && items.length <= 2) {
    return kcal < PLATE_MIN_KCAL.tiffin;
  }
  if (/\b(curry|rice and|and rice)\b/i.test(text) && items.length <= 1) {
    return kcal < PLATE_MIN_KCAL.curry_rice;
  }
  if (/\b(takeaway|chow mein|noodle box|fried rice box)\b/i.test(text) && items.length <= 1) {
    return kcal < PLATE_MIN_KCAL.takeaway;
  }
  return false;
}

export function dedupePlateItems(items = []) {
  if (!items.length) return items;

  const hasRiceMain = items.some((item) => RICE_MAIN_RE.test(itemText(item)));
  let working = [...items];

  if (hasRiceMain) {
    working = working.filter((item) => {
      const text = itemText(item);
      if (RICE_MAIN_RE.test(text)) return true;
      if (!GENERIC_RICE_RE.test(text)) return true;
      if (PLAIN_RICE_RE.test(text)) return false;
      const grams = parseGramsFromText(text) || 0;
      return grams > 0 && grams <= 120;
    });
  }

  const seen = new Map();
  const out = [];
  for (const item of working) {
    const key = normalizeItemKey(item);
    const ref = matchFoodReference(key)?.id || key.split(' ')[0];
    const prev = seen.get(ref);
    if (!prev) {
      seen.set(ref, item);
      out.push(item);
      continue;
    }
    const prevKcal = Number(prev.calories_kcal) || 0;
    const nextKcal = Number(item.calories_kcal) || 0;
    if (nextKcal > prevKcal) {
      const idx = out.indexOf(prev);
      if (idx >= 0) out[idx] = item;
      seen.set(ref, item);
    }
  }

  return out;
}

function mergeUniqueItems(primary = [], secondary = []) {
  const out = [...primary];
  const coveredRes = primary.map((item) => itemText(item)).join(' ');

  for (const item of secondary) {
    const text = itemText(item);
    if (!text) continue;
    const ref = matchFoodReference(text);
    const token = ref?.id || normalizeItemKey(item).split(' ')[0];
    const duplicate = out.some((existing) => {
      const existingRef = matchFoodReference(itemText(existing));
      if (ref && existingRef && ref.id === existingRef.id) return true;
      return normalizeItemKey(existing).includes(token) || normalizeItemKey(item).includes(normalizeItemKey(existing).split(' ')[0]);
    });
    if (duplicate) continue;
    if (ref && new RegExp(`\\b${ref.id.replace(/_/g, '[\\s_]?')}\\b`, 'i').test(coveredRes)) continue;
    out.push(item);
  }

  return out;
}

export function mergePhotoItemsIfCollapsed(analysis = {}) {
  const items = analysis.items || [];
  const photoItems = analysis._photoItems || [];
  if (!photoItems.length) return analysis;

  const shouldMerge = (
    (analysis._anchored && photoItems.length > items.length)
    || (items.length <= 1 && photoItems.length >= 2)
    || (items.length === 2 && photoItems.length >= 3 && isUndercountedMixedPlate(analysis))
  );

  if (!shouldMerge) return analysis;

  const merged = mergeUniqueItems(items, photoItems).map((item) => calibrateItemWithReference(item));
  return {
    ...analysis,
    items: merged,
    _plateMerged: true,
  };
}

export function injectPlateClarificationQuestions(analysis = {}) {
  const existing = [...(analysis.clarification_questions || [])];
  const existingTopics = new Set(
    existing.map((q) => (typeof q === 'string' ? null : q.topic)).filter(Boolean),
  );
  const gaps = detectPlateGaps(analysis);
  const undercounted = isUndercountedMixedPlate(analysis);

  const toAdd = [];
  if (gaps.missingBread && !existingTopics.has('bread_count')) {
    toAdd.push({ topic: 'bread_count', question: 'How many pieces of bread / dosa / roti?' });
  } else if (gaps.missingRiceSide && !existingTopics.has('portion_rice')) {
    toAdd.push({ topic: 'portion_rice', question: 'About how much rice was on the plate?' });
  } else if (undercounted && gaps.suggestedTopics.length) {
    for (const topic of gaps.suggestedTopics) {
      if (existingTopics.has(topic)) continue;
      if (topic === 'bread_count') {
        toAdd.push({ topic, question: 'How many pieces of bread / dosa / roti?' });
      } else if (topic === 'portion_rice') {
        toAdd.push({ topic, question: 'About how much rice was on the plate?' });
      } else if (topic === 'portion_takeaway') {
        toAdd.push({ topic, question: 'How much was in the takeaway box? (rough grams)' });
      } else {
        toAdd.push({ topic: 'portion_solid', question: 'About how much was on the plate? (rough grams)' });
      }
      break;
    }
  }

  if (!toAdd.length) return analysis;

  return {
    ...analysis,
    clarification_questions: [...existing, ...toAdd].slice(0, 4),
    _plateClarifyInjected: true,
  };
}

/** Main post-process hook for photo analysis (server + client). */
export function tightenPlateAnalysis(analysis = {}) {
  if (!analysis || typeof analysis !== 'object') return analysis;

  let out = mergePhotoItemsIfCollapsed(analysis);
  out = {
    ...out,
    items: dedupePlateItems(out.items || []).map((item) => calibrateItemWithReference(item)),
  };
  out = injectPlateClarificationQuestions(out);

  if (isUndercountedMixedPlate(out)) {
    out._plateUndercounted = true;
  }

  return out;
}

export function shouldSkipDescriptionAnchor(analysis = {}, descriptionText = '') {
  const desc = String(descriptionText || '').trim();
  const photoItems = analysis?.items || [];
  if (!desc) return false;
  if (isCompoundMealDescription(desc)) return true;
  if (photoItems.length >= 2) return true;
  return false;
}
