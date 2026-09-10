/**
 * Resolve ambiguous alias collisions using meal/cuisine context — never pick first id.
 */

import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import { v4RecordById } from './food-ref-v4-match.js';

const CUISINE_HINTS = {
  indian: ['indian', 'south asian', 'tamil', 'telugu', 'kerala', 'punjabi', 'bengali', 'hyderabadi', 'dosa', 'idli', 'biryani', 'dal', 'roti', 'naan'],
  chinese: ['chinese', 'szechuan', 'sichuan', 'cantonese', 'dim sum', 'wok', 'chow mein'],
  thai: ['thai', 'pad thai', 'tom yum', 'green curry'],
  british: ['british', 'uk', 'english', 'scottish', 'welsh', 'irish', 'pub'],
  african: ['african', 'nigerian', 'ghanaian', 'ethiopian', 'jollof', 'suya', 'injera'],
  mexican: ['mexican', 'taco', 'burrito', 'salsa', 'tex-mex'],
};

/**
 * @param {string[]} ids
 * @param {{ mealSummary?: string, cuisineHint?: string, itemName?: string, otherItems?: string[] }} [context]
 * @returns {string | null} resolved food id
 */
export function disambiguateCollisionIds(ids = [], context = {}) {
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0];

  const haystack = normalizeFoodAlias([
    context.itemName,
    context.mealSummary,
    context.cuisineHint,
    ...(context.otherItems || []),
  ].filter(Boolean).join(' '));

  if (!haystack) return null;

  /** @type {{ id: string, score: number }[]} */
  const scored = [];

  for (const id of ids) {
    const record = v4RecordById(id);
    if (!record) continue;
    let score = 0;

    const cuisine = normalizeFoodAlias(record.cuisine || '');
    const region = normalizeFoodAlias(record.region || '');
    const country = normalizeFoodAlias(record.country || '');

    if (cuisine && haystack.includes(cuisine)) score += 4;
    if (country && haystack.includes(country)) score += 3;
    if (region) {
      for (const part of region.split('&')) {
        const p = normalizeFoodAlias(part);
        if (p && haystack.includes(p)) score += 2;
      }
    }

    for (const [family, hints] of Object.entries(CUISINE_HINTS)) {
      if (haystack.includes(family) && (cuisine.includes(family) || id.includes(family.replace(/\s+/g, '_')))) {
        score += 3;
      }
      for (const hint of hints) {
        if (haystack.includes(hint) && (id.includes(hint.replace(/\s+/g, '_')) || cuisine.includes(hint))) {
          score += 1;
        }
      }
    }

    for (const token of id.split('_')) {
      if (token.length >= 4 && haystack.includes(token)) score += 1;
    }

    scored.push({ id, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];
  if (!top || top.score < 2) return null;
  if (second && second.score === top.score) return null;
  return top.id;
}
