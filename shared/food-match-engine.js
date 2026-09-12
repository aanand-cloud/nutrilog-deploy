/**
 * Production food-match hot path:
 * normalize → canonical id → V4 alias hash → collision disambiguation →
 * regex → verified → Level 1 recognition hash → fuzzy
 *
 * Level 1 aliases are recognition-only and never override V4, collision, regex, or verified hits.
 * Nutrition still comes from V4 / Tier-1 / verified records, then the
 * Level 2.3 override map. Matcher steps and recognition aliases are unchanged.
 */

import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import { matchFoodReferenceTier1 } from './food-reference-tier1.js';
import { MatchLruCache } from './food-match-lru.js';
import { disambiguateCollisionIds } from './food-match-disambiguate.js';
import { fuzzyAliasLookup } from './food-match-fuzzy.js';
import {
  V4_ALIAS_TO_ID,
  V4_BY_ID,
  V4_COLLISION_ALIASES,
} from './food-ref-v4-index.generated.js';
import { LEVEL1_ALIAS_TO_ID } from './level1-recognition-index.generated.js';
import {
  v4RefById,
  v4RecordById,
  buildFoodMatchMeta,
  lookupV4ReferenceById,
} from './food-ref-v4-match.js';
import { isV4ItemRolloutEnabled, logV4Match } from './food-ref-v4-rollout.js';
import { FOOD_REFERENCES } from './food-references.js';
import { isFlagEnabled } from './feature-flags.js';
import {
  enrichReferenceWithVerified,
  isVerifiedFoodId,
  resolveVerifiedIdFromText,
  getVerifiedRecord,
} from './verified-nutrition.js';

const matchCache = new MatchLruCache(512);

/**
 * @typedef {object} MatchContext
 * @property {string} [mealSummary]
 * @property {string} [cuisineHint]
 * @property {string} [itemName]
 * @property {string[]} [otherItems]
 */

/**
 * @typedef {object} MatchOptions
 * @property {MatchContext} [context]
 * @property {boolean} [logV4]
 * @property {boolean} [skipV4Rollout]
 * @property {boolean} [fuzzy]
 * @property {boolean} [useCache]
 */

function cacheKey(text, context = {}) {
  return [
    normalizeFoodAlias(text),
    normalizeFoodAlias(context.mealSummary || ''),
    normalizeFoodAlias(context.cuisineHint || ''),
  ].join('|');
}

function tier1Meta(ref, text = '') {
  const enriched = enrichReferenceWithVerified(ref, { exactName: text });
  return buildFoodMatchMeta({
    id: enriched.id,
    food_type: 'dish',
    cuisine: '',
    country: '',
    region: '',
    nutrition_basis: enriched.nutrition_basis || 'existing_reference',
    dataSource: enriched.dataSource,
    verificationStatus: enriched.verificationStatus,
  }, {
    matched_alias: normalizeFoodAlias(text) || enriched.id,
    match_method: 'regex',
    confidence: 'high',
    tier: 1,
  });
}

/**
 * @param {string} id
 * @param {string} matchedAlias
 * @param {'canonical_id'|'alias_exact'|'disambiguated'|'fuzzy'} matchMethod
 * @param {'high'|'medium'|'low'} confidence
 * @param {MatchOptions} opts
 * @param {string[]} [collisionIds]
 */
function packV4(id, matchedAlias, matchMethod, confidence, opts, collisionIds) {
  const record = v4RecordById(id);
  if (!record) return { ref: null, meta: null };

  const verifiedBypass = isFlagEnabled('v4CanonicalPriority') && isVerifiedFoodId(id);
  if (!opts.skipV4Rollout && !isV4ItemRolloutEnabled(record) && !verifiedBypass) {
    const meta = buildFoodMatchMeta(record, {
      matched_alias: matchedAlias,
      match_method: matchMethod,
      confidence: 'none',
      tier: 2,
      collision_ids: collisionIds,
      disabled: true,
    });
    if (opts.logV4 !== false) logV4Match({ ...meta, input: matchedAlias, status: 'disabled' });
    return { ref: null, meta };
  }

  const ref = enrichReferenceWithVerified(v4RefById(id), { exactName: matchedAlias });
  const meta = buildFoodMatchMeta({ ...record, ...ref }, {
    matched_alias: matchedAlias,
    match_method: matchMethod,
    confidence,
    tier: 2,
    collision_ids: collisionIds,
    verified_bypass: verifiedBypass && !isV4ItemRolloutEnabled(record),
  });
  if (opts.logV4 !== false) logV4Match({ ...meta, input: matchedAlias, status: 'hit' });
  return { ref, meta };
}

/**
 * @param {string} text
 * @param {MatchOptions} [opts]
 * @returns {{ ref: object | null, meta: object | null }}
 */
export function matchFoodReferenceDetailed(text = '', opts = {}) {
  const key = cacheKey(text, opts.context || {});
  if (opts.useCache !== false) {
    const cached = matchCache.get(key);
    if (cached) return cached;
  }

  const normalized = normalizeFoodAlias(text);
  if (!normalized) {
    return { ref: null, meta: null };
  }

  let result = { ref: null, meta: null };

  function finish(candidate) {
    if (opts.useCache !== false) matchCache.set(key, candidate);
    return candidate;
  }

  function v4Hit(id, matchedAlias, matchMethod, confidence, collisionIds) {
    const packed = packV4(id, matchedAlias, matchMethod, confidence, opts, collisionIds);
    if (packed.ref) return packed;
    // Rollout-disabled V4 hits fall through to Tier 1 regex — do not stop the hot path.
    return null;
  }

  // 1. Exact canonical food id (underscore form)
  const canonicalId = normalized.replace(/\s+/g, '_');
  if (V4_BY_ID[canonicalId]) {
    result = v4Hit(canonicalId, normalized, 'canonical_id', 'high');
    if (result) return finish(result);
  }

  // 2. Exact alias hash lookup — O(1)
  const aliasId = V4_ALIAS_TO_ID[normalized];
  if (aliasId) {
    result = v4Hit(aliasId, normalized, 'alias_exact', 'high');
    if (result) return finish(result);
  }

  // 3. Ambiguous alias — disambiguate with meal/cuisine context before regex
  const collisionIds = V4_COLLISION_ALIASES[normalized];
  if (collisionIds?.length) {
    const resolvedId = disambiguateCollisionIds(collisionIds, {
      itemName: text,
      ...opts.context,
    });
    if (resolvedId) {
      result = v4Hit(resolvedId, normalized, 'disambiguated', 'medium', collisionIds);
      if (result) return finish(result);
    }
  }

  // 4. Precompiled regex tier (partial phrase matching)
  const tier1 = matchFoodReferenceTier1(text);
  if (tier1) {
    if (isFlagEnabled('v4CanonicalPriority')) {
      const v4ForTier1 = packV4(tier1.id, normalized, 'canonical_id', 'high', opts);
      if (v4ForTier1.ref) return finish(v4ForTier1);
    }
    const enriched = enrichReferenceWithVerified(tier1, { exactName: text });
    return finish({ ref: enriched, meta: tier1Meta(enriched, text) });
  }

  // 4b. Verified CoFID/IFCT staples not yet in V4 rollout (honey, olive oil, etc.)
  const verifiedId = resolveVerifiedIdFromText(normalized) || resolveVerifiedIdFromText(text);
  const verified = verifiedId ? getVerifiedRecord(verifiedId) : null;
  if (verified) {
    const ref = enrichReferenceWithVerified({
      id: verified.id,
      kcal100: verified.kcal100,
      protein100: verified.protein100,
      carbs100: verified.carbs100,
      fat100: verified.fat100,
      fibre100: verified.fibre100,
      sugar100: verified.sugar100,
      salt100: verified.salt100,
      canonicalName: verified.canonicalName,
      preparationState: verified.preparationState,
    }, { exactName: normalized || text });
    return finish({ ref, meta: tier1Meta(ref, normalized || text) });
  }

  // 4c. Level 1 recognition aliases — O(1), only if V4 / collision / regex / verified missed
  const level1Id = LEVEL1_ALIAS_TO_ID[normalized];
  if (level1Id) {
    result = v4Hit(level1Id, normalized, 'alias_exact', 'high');
    if (result) return finish(result);
    const tier1ById = FOOD_REFERENCES.find((row) => row.id === level1Id);
    if (tier1ById) {
      if (isFlagEnabled('v4CanonicalPriority')) {
        const v4ForTier1 = packV4(tier1ById.id, normalized, 'canonical_id', 'high', opts);
        if (v4ForTier1.ref) return finish(v4ForTier1);
      }
      const enriched = enrichReferenceWithVerified(tier1ById, { exactName: text });
      return finish({ ref: enriched, meta: tier1Meta(enriched, text) });
    }
    const level1Verified = getVerifiedRecord(level1Id);
    if (level1Verified) {
      const ref = enrichReferenceWithVerified({
        id: level1Verified.id,
        kcal100: level1Verified.kcal100,
        protein100: level1Verified.protein100,
        carbs100: level1Verified.carbs100,
        fat100: level1Verified.fat100,
        fibre100: level1Verified.fibre100,
        sugar100: level1Verified.sugar100,
        salt100: level1Verified.salt100,
        canonicalName: level1Verified.canonicalName,
        preparationState: level1Verified.preparationState,
      }, { exactName: text });
      return finish({ ref, meta: tier1Meta(ref, normalized || text) });
    }
  }

  // 5. Optional fuzzy fallback — prefix bucket, threshold, unique best
  if (opts.fuzzy !== false) {
    const fuzzy = fuzzyAliasLookup(normalized);
    if (fuzzy) {
      result = v4Hit(fuzzy.id, fuzzy.alias, 'fuzzy', 'low');
      if (result) return finish(result);
    }
  }

  if (collisionIds?.length) {
    return finish({
      ref: null,
      meta: buildFoodMatchMeta({
        id: '',
        food_type: 'dish',
        cuisine: '',
        country: '',
        region: '',
        nutrition_basis: '',
      }, {
        matched_alias: normalized,
        match_method: 'alias_exact',
        confidence: 'none',
        tier: 2,
        collision_ids: collisionIds,
        ambiguous: true,
      }),
    });
  }

  return finish({ ref: null, meta: null });
}

/** @param {string} id @param {MatchOptions} [opts] */
export function resolveFoodReferenceById(id = '', opts = {}) {
  if (!id) return { ref: null, meta: null };
  const v4 = lookupV4ReferenceById(id, {
    skipRollout: opts.skipV4Rollout || isVerifiedFoodId(id),
  });
  if (v4.ref) {
    return { ref: enrichReferenceWithVerified(v4.ref), meta: v4.meta };
  }
  const tier1 = FOOD_REFERENCES.find((row) => row.id === id);
  if (tier1) {
    const enriched = enrichReferenceWithVerified(tier1);
    return { ref: enriched, meta: tier1Meta(enriched, id.replace(/_/g, ' ')) };
  }
  const verified = getVerifiedRecord(id);
  if (verified) {
    const ref = enrichReferenceWithVerified({
      id: verified.id,
      kcal100: verified.kcal100,
      protein100: verified.protein100,
      carbs100: verified.carbs100,
      fat100: verified.fat100,
      fibre100: verified.fibre100,
      sugar100: verified.sugar100,
      salt100: verified.salt100,
      canonicalName: verified.canonicalName,
      preparationState: verified.preparationState,
    });
    return { ref, meta: tier1Meta(ref, id.replace(/_/g, ' ')) };
  }
  return { ref: null, meta: null };
}

export function matchFoodReference(text = '', opts = {}) {
  return matchFoodReferenceDetailed(text, opts).ref;
}

export function clearFoodMatchCache() {
  matchCache.clear();
}

export function getFoodMatchCacheSize() {
  return matchCache.size;
}

export { matchFoodReferenceTier1 };
