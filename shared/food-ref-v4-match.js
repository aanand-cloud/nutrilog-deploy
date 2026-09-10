/**
 * V4 reference store + metadata helpers.
 * Hot-path matching lives in food-match-engine.js.
 */

import {
  V4_ALIAS_TO_ID,
  V4_BY_ID,
  V4_COLLISION_ALIASES,
  V4_INDEX_STATS,
} from './food-ref-v4-index.generated.js';
import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import { isV4ItemRolloutEnabled } from './food-ref-v4-rollout.js';

export { V4_INDEX_STATS, V4_COLLISION_ALIASES, V4_ALIAS_TO_ID, V4_BY_ID };

/**
 * @param {object} record
 * @param {object} opts
 */
export function buildFoodMatchMeta(record = {}, opts = {}) {
  const confidence = opts.confidence || 'high';
  const matchMethod = opts.match_method || 'alias_exact';

  return {
    food_id: record.id || '',
    id: record.id || '',
    matched_alias: opts.matched_alias || '',
    match_method: matchMethod,
    match_source: matchMethod === 'regex' ? 'regex' : 'v4_alias',
    confidence,
    match_confidence: confidence === 'high' ? 'exact' : confidence === 'medium' ? 'disambiguated' : confidence === 'low' ? 'fuzzy' : opts.ambiguous ? 'collision' : opts.disabled ? 'disabled' : 'miss',
    country: record.country || '',
    cuisine: record.cuisine || '',
    food_type: record.food_type || 'dish',
    region: record.region || '',
    nutrition_basis: record.nutrition_basis || '',
    tier: opts.tier ?? 2,
    collision_ids: opts.collision_ids,
  };
}

export function v4RefById(id) {
  const row = V4_BY_ID[id];
  if (!row) return null;
  const [kcal100, protein100, carbs100, fat100, fibre100] = row;
  return {
    id,
    kcal100,
    protein100,
    carbs100,
    fat100,
    fibre100,
    _v4: true,
  };
}

export function v4RecordById(id) {
  const row = V4_BY_ID[id];
  if (!row) return null;
  const [
    kcal100,
    protein100,
    carbs100,
    fat100,
    fibre100,
    region,
    cuisine,
    food_type,
    nutrition_basis,
    country,
  ] = row;
  return {
    id,
    kcal100,
    protein100,
    carbs100,
    fat100,
    fibre100,
    region,
    cuisine,
    food_type,
    nutrition_basis,
    country: country || '',
  };
}

/** Legacy wrapper — prefer food-match-engine.js */
export function matchFoodReferenceV4(text = '', opts = {}) {
  const normalized = normalizeFoodAlias(text);
  if (!normalized) return { ref: null, meta: null };

  const id = V4_ALIAS_TO_ID[normalized] || (V4_BY_ID[normalized.replace(/\s+/g, '_')] ? normalized.replace(/\s+/g, '_') : null);
  if (!id) {
    if (V4_COLLISION_ALIASES[normalized]) {
      return {
        ref: null,
        meta: buildFoodMatchMeta({}, {
          matched_alias: normalized,
          match_method: 'alias_exact',
          confidence: 'none',
          ambiguous: true,
          collision_ids: V4_COLLISION_ALIASES[normalized],
        }),
      };
    }
    return { ref: null, meta: null };
  }

  const record = v4RecordById(id);
  if (!record) return { ref: null, meta: null };
  if (!opts.skipRollout && !isV4ItemRolloutEnabled(record)) {
    return {
      ref: null,
      meta: buildFoodMatchMeta(record, {
        matched_alias: normalized,
        match_method: 'alias_exact',
        confidence: 'none',
        disabled: true,
      }),
    };
  }

  return {
    ref: v4RefById(id),
    meta: buildFoodMatchMeta(record, {
      matched_alias: normalized,
      match_method: 'alias_exact',
      confidence: 'high',
    }),
  };
}

export function lookupV4ReferenceById(id, opts = {}) {
  const record = v4RecordById(id);
  if (!record) return { ref: null, meta: null };
  const skipRollout = opts.skipRollout || opts.skipV4Rollout;
  if (!skipRollout && !isV4ItemRolloutEnabled(record)) {
    return { ref: null, meta: null };
  }
  return {
    ref: v4RefById(id),
    meta: buildFoodMatchMeta(record, {
      matched_alias: normalizeFoodAlias(id.replace(/_/g, ' ')),
      match_method: 'canonical_id',
      confidence: 'high',
    }),
  };
}
