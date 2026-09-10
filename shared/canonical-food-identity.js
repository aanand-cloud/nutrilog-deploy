/**
 * Canonical food identities — spelling/plural variants resolve to one verified id.
 * Used by parsing, matching and portion logic (not one-off test hacks).
 */

/** Whole-word replacements applied to normalized food text before matching. */
const SPELLING_REPLACEMENTS = [
  [/\bidlies\b/gi, 'idli'],
  [/\bidlys\b/gi, 'idli'],
  [/\bidly\b/gi, 'idli'],
  [/\bidlis\b/gi, 'idli'],
  [/\bidlie\b/gi, 'idli'],
  [/\bbiriyani\b/gi, 'biryani'],
  [/\bbiriani\b/gi, 'biryani'],
  [/\bchanna\b/gi, 'chana'],
  [/\bdaal\b/gi, 'dal'],
  [/\bdhal\b/gi, 'dal'],
  [/\byoghurt\b/gi, 'yogurt'],
];

/** Explicit alias token → canonical verified / ref id. */
const TOKEN_TO_CANONICAL_ID = {
  idli: 'idli',
  idlis: 'idli',
  idly: 'idli',
  idlies: 'idli',
  idlie: 'idli',
};

/**
 * Normalize food text for alias lookup (lowercase, spelling variants).
 * @param {string} text
 * @returns {string}
 */
export function normalizeCanonicalFoodText(text = '') {
  let s = String(text ?? '').trim().toLowerCase();
  if (!s) return '';
  s = s.normalize('NFD').replace(/\p{M}/gu, '');
  s = s.replace(/[''`´]/g, "'");
  s = s.replace(/[^a-z0-9\s'-]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  for (const [re, repl] of SPELLING_REPLACEMENTS) {
    s = s.replace(re, repl);
  }
  return s;
}

/**
 * Resolve a canonical food id from free text (e.g. "3 idlies" → "idli").
 * @param {string} text
 * @returns {string|null}
 */
export function resolveCanonicalFoodIdFromText(text = '') {
  const normalized = normalizeCanonicalFoodText(text);
  if (!normalized) return null;
  const tokens = normalized.split(/\s+/);
  for (const tok of tokens) {
    if (TOKEN_TO_CANONICAL_ID[tok]) return TOKEN_TO_CANONICAL_ID[tok];
  }
  if (/\bidli\b/.test(normalized)) return 'idli';
  return null;
}

/**
 * Default edible grams per countable piece — verified record overrides static table.
 * @param {string} canonicalId
 * @param {object} [verifiedRecord]
 * @returns {number}
 */
export function defaultPieceGramsForCanonical(canonicalId = '', verifiedRecord = null) {
  const fromVerified = Number(verifiedRecord?.standardPortionGrams);
  if (fromVerified > 0) return fromVerified;
  const STATIC = { idli: 60, dosa: 170, roti: 60, naan: 90, bread: 35, puri: 45, bhatura: 120 };
  return STATIC[canonicalId] || 0;
}
