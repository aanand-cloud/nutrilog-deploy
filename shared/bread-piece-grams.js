/**
 * Canonical gram weights for countable breads (dosa, idli, roti, etc.).
 * Used after bread_count clarify answers and for photo calibration defaults.
 */

import { matchFoodReference, nutritionForAmount, per100FromReference, parseGramsFromText } from './nutrition-density.js';

/** @typedef {import('./nutrition-density.js').FoodRef} FoodRef */

export const BREAD_PIECE_GRAMS = {
  dosa: 170,
  egg_dosa: 200,
  ghee_roast: 185,
  idli: 60,
  rava_idli: 65,
  parotta: 75,
  kerala_parotta: 75,
  kulcha: 80,
  rumali_roti: 45,
  tandoori_roti: 55,
  roti: 60,
  naan: 90,
  paratha: 85,
  puri: 45,
  bhatura: 120,
  pav: 50,
  bread: 35,
  wrap: 120,
  toast: 35,
  slice: 35,
  crumpet: 55,
  scone: 60,
  samosa: 80,
  dumpling: 40,
};

const BREAD_NAME_RE = /\b(bread|roti|naan|chapati|chapathi|paratha|parotta|porotta|dosas?|dosai|idli(?:es|s)?|idly(?:s)?|puri|pav|bhaturas?|wrap|toast|slice|pita|pitta|bagel|roll|bun|kulcha|rumali)\b/i;

const COUNT_NOUN_RE = String.raw`pieces?|slices?|roti|rotis|naan|naans|chapati|chapatis|chapathi|dosa|dosas|dosai|idli(?:es|s)?|idly(?:s)?|puri|puris|pav|bhatur[ae]|paratha|parotta|wraps?|toast`;

const ANSWER_BREAD_HINTS = [
  { re: /\bdosas?\b|\bdosai\b|\bmasala\s+dosa\b|\buttapam\b/i, refId: 'dosa' },
  { re: /\bidli(?:es|s)?\b|\bidly(?:s)?\b|\brava\s+idli\b/i, refId: 'idli' },
  { re: /\begg\s+dosa\b|\bmutta\s+dosa\b/i, refId: 'egg_dosa' },
  { re: /\bghee\s+roast\b/i, refId: 'ghee_roast' },
  { re: /\bnaan\b/i, refId: 'naan' },
  { re: /\bparotta\b|\bporotta\b|\bmalabar\s+parotta\b/i, refId: 'kerala_parotta' },
  { re: /\bparatha\b/i, refId: 'paratha' },
  { re: /\bkulcha\b/i, refId: 'kulcha' },
  { re: /\brumali\s+roti\b|\broomali\s+roti\b/i, refId: 'rumali_roti' },
  { re: /\btandoori\s+roti\b/i, refId: 'tandoori_roti' },
  { re: /\bbhatur[ae]\b/i, refId: 'bhatura' },
  { re: /\bpav\b/i, refId: 'pav' },
  { re: /\bpuri\b/i, refId: 'puri' },
  { re: /\b(roti|chapati|chapathi|phulka)\b/i, refId: 'roti' },
  { re: /\bwrap\b/i, refId: 'wrap' },
  { re: /\btoast\b|\bslice\b/i, refId: 'bread' },
];

export function isCountableBreadRef(refId = '') {
  return Boolean(BREAD_PIECE_GRAMS[refId]);
}

export function isBreadItemText(text = '') {
  return BREAD_NAME_RE.test(String(text));
}

export function canonicalPieceGrams(refId = '', text = '') {
  const t = String(text).toLowerCase();
  if (refId === 'dosa' && /\bmasala\b/.test(t)) return 220;
  if (refId === 'dosa' && /\b(rava|semolina)\b/.test(t)) return 150;
  if (refId === 'idli' && /\brava\b/.test(t)) return BREAD_PIECE_GRAMS.rava_idli;
  return BREAD_PIECE_GRAMS[refId] || 60;
}

export function parseBreadCountFromAnswer(answer = '') {
  const t = String(answer).toLowerCase();
  if (/5\s+or\s+more|5\+/.test(t)) return 5;
  if (/4\s+or\s+more|4\+/.test(t)) return 4;
  const named = t.match(new RegExp(`(\\d+)\\s*(?:${COUNT_NOUN_RE})`));
  if (named) return Number(named[1]);
  const words = t.match(new RegExp(`\\b(two|three|four|five|six)\\s+(?:${COUNT_NOUN_RE})`));
  if (words) {
    const map = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    return map[words[1]] || 0;
  }
  const lead = t.match(/^(\d+)/);
  if (lead) return Number(lead[1]);
  if (/\b1\b|one\b|single/.test(t)) return 1;
  if (/\b2\b|two\b/.test(t)) return 2;
  if (/\b3\b|three\b/.test(t)) return 3;
  return 0;
}

/** Count only when the text actually names a number of pieces — never default to 1. */
export function parseExplicitPieceCount(text = '') {
  const t = String(text || '').toLowerCase();
  if (!t) return 0;
  const named = t.match(new RegExp(`(\\d+)\\s*(?:${COUNT_NOUN_RE})`));
  if (named) return Number(named[1]);
  const words = t.match(new RegExp(`\\b(two|three|four|five|six)\\s+(?:${COUNT_NOUN_RE})`));
  if (!words) return 0;
  const map = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  return map[words[1]] || 0;
}

export function countableSingularFromText(text = '') {
  const t = String(text || '').toLowerCase();
  if (/\bidli(?:es|s)?\b|\bidly(?:s)?\b/.test(t)) return 'idli';
  if (/\bdosas?\b|\bdosai\b/.test(t)) return 'dosa';
  if (/\bnaan\b/.test(t)) return 'naan';
  if (/\bparatha\b/.test(t)) return 'paratha';
  if (/\bparotta\b|\bporotta\b/.test(t)) return 'parotta';
  if (/\bpuri\b/.test(t)) return 'puri';
  if (/\bbhatur[ae]\b/.test(t)) return 'bhatura';
  if (/\bpav\b/.test(t)) return 'pav';
  if (/\b(roti|chapati|chapathi|phulka)\b/.test(t)) return 'roti';
  if (/\bwrap\b/.test(t)) return 'wrap';
  if (/\btoast\b|\bslice\b|\bbread\b/.test(t)) return 'slice';
  return 'piece';
}

export function countablePlural(singular = 'piece') {
  switch (singular) {
    case 'idli':
      return 'idlis';
    case 'dosa':
      return 'dosas';
    case 'naan':
      return 'naan';
    case 'puri':
      return 'puris';
    case 'pav':
      return 'pav';
    case 'slice':
      return 'slices';
    case 'piece':
      return 'pieces';
    default:
      return `${singular}s`;
  }
}

export function breadCountOptions(singular = 'piece') {
  const one = countableSingularFromText(singular) || singular;
  const many = countablePlural(one);
  return [
    `1 ${one}`,
    `2 ${many}`,
    `3 ${many}`,
    `4 ${many}`,
    '5 or more',
  ];
}

export function countableLabelFromAnalysis(analysis = {}) {
  const texts = [
    analysis.meal_summary,
    ...(analysis.items || []).map((item) => `${item.name || ''} ${item.portion_estimate || ''}`),
  ].filter(Boolean);
  for (const text of texts) {
    if (isBreadItemText(text)) return countableSingularFromText(text);
  }
  return 'piece';
}

export function analysisHasExplicitPieceCount(analysis = {}) {
  return (analysis.items || []).some((item) => {
    const text = `${item.name || ''} ${item.portion_estimate || ''}`;
    if (!isBreadItemText(text)) return false;
    if (item._boundQuantity?.unit === 'piece' && Number(item._boundQuantity.amount) > 0) return true;
    return parseExplicitPieceCount(text) > 0;
  });
}

/**
 * Parse explicit gram hints from answer text or preset labels.
 * @returns {{ total?: number, perPiece?: number }}
 */
export function parseBreadGramsFromAnswer(answer = '', count = 1) {
  const t = String(answer);
  const each = t.match(/(\d+(?:\.\d+)?)\s*g\s*(?:each|per\s+(?:piece|dosa|idli|roti|naan))/i);
  if (each) {
    return { perPiece: Number(each[1]) };
  }

  const labelledTotal = t.match(/\(~\s*(\d+(?:\.\d+)?)\s*g\)/i);
  if (labelledTotal) {
    return { total: Number(labelledTotal[1]) };
  }

  const totalHint = t.match(/(?:total|about|around|~)\s*(\d+(?:\.\d+)?)\s*g\b/i);
  if (totalHint) {
    return { total: Number(totalHint[1]) };
  }

  const grams = parseGramsFromText(t);
  if (grams > 0) {
    if (/\beach\b|\/\s*(?:piece|dosa|idli|roti)/i.test(t)) {
      return { perPiece: grams };
    }
    if (count > 1 && grams >= 100) {
      return { total: grams };
    }
    if (count <= 1) {
      return { perPiece: grams };
    }
    const expected = canonicalPieceGrams(resolveBreadReference(t)?.id || 'dosa', t) * count;
    if (grams >= expected * 0.65) {
      return { total: grams };
    }
    return { perPiece: grams };
  }

  return {};
}

export function resolveBreadReference(text = '') {
  const t = String(text).toLowerCase();
  for (const hint of ANSWER_BREAD_HINTS) {
    if (hint.re.test(t)) {
      return matchFoodReference(hint.refId) || matchFoodReference(t);
    }
  }
  const ref = matchFoodReference(t);
  if (ref && (isCountableBreadRef(ref.id) || isBreadItemText(t))) return ref;
  return null;
}

export function breadDisplayName(refId = 'bread') {
  switch (refId) {
    case 'dosa':
      return 'Dosa';
    case 'egg_dosa':
      return 'Egg dosa';
    case 'idli':
      return 'Idli';
    case 'roti':
      return 'Roti';
    case 'naan':
      return 'Naan';
    case 'paratha':
      return 'Paratha';
    case 'kerala_parotta':
      return 'Parotta';
    case 'puri':
      return 'Puri';
    case 'bhatura':
      return 'Bhatura';
    case 'pav':
      return 'Pav';
    default:
      return refId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function buildBreadItemFromReference(ref, count = 1, answer = '') {
  const gramsInfo = parseBreadGramsFromAnswer(answer, count);
  const perPiece = gramsInfo.perPiece || canonicalPieceGrams(ref.id, answer);
  const totalGrams = gramsInfo.total || perPiece * count;
  const scaled = nutritionForAmount(per100FromReference(ref), totalGrams);
  return {
    name: breadDisplayName(ref.id),
    portion_estimate: `${count} piece${count > 1 ? 's' : ''} (~${Math.round(totalGrams)}g)`,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    _refId: ref.id,
    _localClarify: true,
  };
}

export function computeBreadTotalGrams({ ref, count, answer = '', itemText = '' } = {}) {
  const gramsInfo = parseBreadGramsFromAnswer(answer, count);
  const perPiece = gramsInfo.perPiece || canonicalPieceGrams(ref?.id, `${answer} ${itemText}`);
  const total = gramsInfo.total || perPiece * Math.max(1, count);
  return { totalGrams: total, perPiece };
}

/**
 * Apply bread_count answer using reference weights (not tiny AI guesses).
 */
export function applyBreadCountToItems(items = [], answer = '', analysis = {}) {
  const count = parseBreadCountFromAnswer(answer);
  if (count <= 0) return items;

  const ctxText = [
    analysis?.meal_summary,
    ...(analysis?.items || []).map((i) => `${i.name || ''} ${i.portion_estimate || ''}`),
    answer,
  ]
    .filter(Boolean)
    .join(' ');

  const ref = resolveBreadReference(answer) || resolveBreadReference(ctxText);

  function itemMatchesBreadTarget(item) {
    const text = `${item.name || ''} ${item.portion_estimate || ''}`;
    if (!isBreadItemText(text)) return false;
    if (!ref) return true;
    const itemRef = matchFoodReference(text);
    if (itemRef?.id === ref.id) return true;
    if (ref.id === 'dosa' && /\bdosa\b|\bdosai\b/.test(text)) return true;
    if (ref.id === 'idli' && /\bidli\b/.test(text)) return true;
    if (ref.id === 'roti' && /\b(roti|chapati|chapathi|phulka)\b/.test(text)) return true;
    if (ref.id === 'kerala_parotta' && /\b(parotta|porotta)\b/.test(text)) return true;
    if (ref.id === 'naan' && /\bnaan\b/.test(text)) return true;
    if (ref.id === 'pav' && /\bpav\b/.test(text)) return true;
    if (ref.id === 'bhatura' && /\bbhatur[ae]\b/.test(text)) return true;
    return false;
  }

  let working = [...items];
  let breadIndexes = working
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => itemMatchesBreadTarget(item));

  if (!breadIndexes.length && ref) {
    working.push(buildBreadItemFromReference(ref, count, answer));
    breadIndexes = [{ item: working[working.length - 1], index: working.length - 1 }];
  }

  if (!breadIndexes.length) {
    return working;
  }

  return working.map((item, index) => {
    const hit = breadIndexes.find((entry) => entry.index === index);
    if (!hit) return item;

    const itemRef = matchFoodReference(`${item.name || ''} ${item.portion_estimate || ''}`) || ref;
    if (!itemRef) return item;

    const { totalGrams } = computeBreadTotalGrams({
      ref: itemRef,
      count,
      answer,
      itemText: `${item.name || ''} ${item.portion_estimate || ''}`,
    });
    const scaled = nutritionForAmount(per100FromReference(itemRef), totalGrams);

    return {
      ...item,
      name: item.name || breadDisplayName(itemRef.id),
      portion_estimate: `${count} piece${count > 1 ? 's' : ''} (~${Math.round(totalGrams)}g)`,
      calories_kcal: scaled.calories_kcal,
      nutrition: scaled.nutrition,
      _refId: itemRef.id,
      _localClarify: true,
    };
  });
}
