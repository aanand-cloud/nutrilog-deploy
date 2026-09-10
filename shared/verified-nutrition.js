/**
 * Verified nutrition overlay — CoFID / IFCT authoritative values on matched refs.
 */

import { VERIFIED_BY_ID, VERIFIED_NUTRITION_STATS, VERIFIED_ALIAS_TO_ID } from './verified-nutrition.generated.js';
import { VERIFICATION_META } from './canonical-food-model.js';
import { normalizeCanonicalFoodText } from './canonical-food-identity.js';

export { VERIFIED_NUTRITION_STATS, VERIFIED_BY_ID, VERIFIED_ALIAS_TO_ID };

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isVerifiedFoodId(id = '') {
  return Boolean(id && getVerifiedRecord(id));
}

/**
 * @param {string} id
 * @returns {object|null}
 */
/** Tier-1 id → verified overlay id when catalog uses a shorter alias. */
const VERIFIED_ID_ALIASES = {
  rice: 'cooked_rice',
  plain_rice: 'cooked_rice',
  chicken: 'chicken_breast',
  cheese: 'cheddar',
  dal_tadka: 'dal',
  dal_fry: 'dal',
  battered_fish: 'white_fish',
  toast: 'toast',
  bread: 'bread',
  semi_skimmed_milk: 'semi_skimmed_milk',
  milk: 'semi_skimmed_milk',
  vegetable_curry: 'vegetable_curry',
  gravy: 'gravy',
  carrots: 'carrots',
  potatoes: 'potatoes',
  poha: 'poha',
  nuts: 'nuts',
  idly: 'idli',
  idlis: 'idli',
  idlies: 'idli',
  idlys: 'idli',
};

/**
 * Resolve verified id from alias text or id.
 * @param {string} textOrId
 * @returns {string|null}
 */
const VERIFIED_EXTRA_ALIASES = {
  strawberries: 'strawberry',
};

export function resolveVerifiedIdFromText(textOrId = '') {
  const raw = String(textOrId || '').trim().toLowerCase();
  if (!raw) return null;
  if (VERIFIED_BY_ID[raw]) return raw;
  if (VERIFIED_ID_ALIASES[raw]) return VERIFIED_ID_ALIASES[raw];
  if (VERIFIED_EXTRA_ALIASES[raw]) return VERIFIED_EXTRA_ALIASES[raw];
  if (VERIFIED_ALIAS_TO_ID[raw]) return VERIFIED_ALIAS_TO_ID[raw];
  const normalized = normalizeCanonicalFoodText(raw);
  if (VERIFIED_EXTRA_ALIASES[normalized]) return VERIFIED_EXTRA_ALIASES[normalized];
  if (VERIFIED_ALIAS_TO_ID[normalized]) return VERIFIED_ALIAS_TO_ID[normalized];
  for (const tok of normalized.split(/\s+/)) {
    if (VERIFIED_EXTRA_ALIASES[tok]) return VERIFIED_EXTRA_ALIASES[tok];
    if (VERIFIED_ALIAS_TO_ID[tok]) return VERIFIED_ALIAS_TO_ID[tok];
  }
  return null;
}

export function getVerifiedRecord(id = '') {
  if (!id) return null;
  const key = VERIFIED_ID_ALIASES[id] || id;
  return VERIFIED_BY_ID[key] || null;
}

/**
 * Resolve the canonical verified record id for a matched ref.
 * @param {string} refId
 */
export function canonicalVerifiedId(refId = '') {
  const verified = getVerifiedRecord(refId);
  return verified?.id || refId;
}

/**
 * Overlay verified CoFID/IFCT nutrition onto a Tier-1 or V4 ref row.
 * @param {object|null} ref
 * @returns {object|null}
 */
export function enrichReferenceWithVerified(ref) {
  if (!ref?.id) return ref;
  const verified = getVerifiedRecord(ref.id);
  if (!verified) return ref;

  return {
    ...ref,
    kcal100: verified.kcal100,
    protein100: verified.protein100,
    carbs100: verified.carbs100,
    fat100: verified.fat100,
    fibre100: verified.fibre100,
    sugar100: verified.sugar100,
    salt100: verified.salt100,
    dataSource: verified.dataSource,
    sourceRecordId: verified.sourceRecordId,
    verificationStatus: verified.verificationStatus,
    nutrition_basis: verified.nutrition_basis,
    preparationState: verified.preparationState,
    lastReviewedAt: verified.lastReviewedAt,
    dataQualityScore: verified.dataQualityScore
      ?? VERIFICATION_META[verified.verificationStatus]?.score
      ?? 95,
    _verified: true,
  };
}

/**
 * Provenance summary for UI / confidence.
 * @param {object} ref
 */
export function verifiedProvenanceLabel(ref = {}) {
  if (!ref?.dataSource || ref.dataSource === 'internal_estimated') return '';
  const src = String(ref.dataSource).toUpperCase();
  const id = ref.sourceRecordId ? ` #${ref.sourceRecordId}` : '';
  return `${src}${id}`;
}
