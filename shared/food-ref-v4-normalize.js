/**
 * Normalize food names for Tier 2 alias lookup.
 * Direct lookup only — no fuzzy/substring matching here.
 */

/** Conservative spelling normalizations (whole-word only). */
const SPELLING_VARIANTS = [
  ['channa', 'chana'],
  ['daal', 'dal'],
  ['dhal', 'dal'],
  ['yoghurt', 'yogurt'],
  ['biriyani', 'biryani'],
  ['biriani', 'biryani'],
  ['idly', 'idli'],
  ['idlies', 'idli'],
  ['idlys', 'idli'],
];

const PLURAL_SUFFIXES = [
  { re: /ies$/, repl: 'y' },
  { re: /oes$/, repl: 'o' },
  { re: /ses$/, repl: 's' },
  { re: /s$/, repl: '' },
];

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeFoodAlias(text = '') {
  let s = String(text ?? '').trim().toLowerCase();
  if (!s) return '';

  s = s.normalize('NFD').replace(/\p{M}/gu, '');
  s = s.replace(/[''`´]/g, "'");
  s = s.replace(/[^a-z0-9\s'-]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  for (const [from, to] of SPELLING_VARIANTS) {
    s = s.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }

  return s;
}

/**
 * Register alias keys for an item — primary alias, id-as-name, optional plural form.
 * @param {string} primary
 * @param {string} [id]
 * @returns {string[]}
 */
export function aliasKeysForItem(primary = '', id = '') {
  const keys = new Set();
  const main = normalizeFoodAlias(primary);
  if (main) keys.add(main);

  const fromId = normalizeFoodAlias(String(id || '').replace(/_/g, ' '));
  if (fromId) keys.add(fromId);

  if (main) {
    for (const { re, repl } of PLURAL_SUFFIXES) {
      if (re.test(main)) {
        const singular = main.replace(re, repl).trim();
        if (singular.length >= 3) keys.add(singular);
      }
      const plural = `${main}s`;
      keys.add(plural);
    }
  }

  return [...keys].filter(Boolean);
}
