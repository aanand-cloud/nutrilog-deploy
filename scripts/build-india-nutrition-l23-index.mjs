/**
 * Build Level 2.3 India nutrition override maps.
 *
 * Keyed by source_v4_id / existing canonical V4 id.
 * Does not write food-ref-v4. Branded Grade-A values never land on generic ids.
 *
 * Run: node scripts/build-india-nutrition-l23-index.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V4_ALIAS_TO_ID, V4_BY_ID } from '../shared/food-ref-v4-index.generated.js';
import { VERIFIED_BY_ID } from '../shared/verified-nutrition.generated.js';
import { normalizeFoodAlias } from '../shared/food-ref-v4-normalize.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extractedPath = resolve(root, 'data/level2/india-nutrition-l23.json');
const generatedOut = resolve(root, 'shared/india-nutrition-l23-index.generated.js');
const libraryCandidates = [
  process.argv[2],
  resolve(root, 'data/level2/mealnova-level2-3-india-top50-research-calibration-v1.json'),
  'c:/Users/user/Downloads/mealnova-level2-3-india-top50-research-calibration-v1.json',
].filter(Boolean);

const MANUAL_GENERIC_ALIASES = {
  poori: 'puri',
};

const FAMILY_CANONICALS = {
  vegetable_biryani: {
    names: ['vegetable biryani', 'veg biryani'],
    idSuffix: '_vegetable_biryani',
  },
  paneer_biryani: {
    names: ['paneer biryani'],
    idSuffix: '_paneer_biryani',
  },
};

function familyIdsFor(suffix = '') {
  return Object.keys(V4_BY_ID)
    .filter((id) => id === suffix.replace(/^_/, '') || id.endsWith(suffix))
    .sort();
}

function familyCanonicalFor(row) {
  const slug = slugName(row.canonical_name);
  if (FAMILY_CANONICALS[slug]) return { key: slug, ...FAMILY_CANONICALS[slug] };
  const name = String(row.canonical_name || '').trim().toLowerCase();
  for (const [key, spec] of Object.entries(FAMILY_CANONICALS)) {
    if (spec.names.includes(name)) return { key, ...spec };
  }
  return null;
}

function loadPack() {
  if (existsSync(extractedPath)) {
    return JSON.parse(readFileSync(extractedPath, 'utf8'));
  }
  const libraryPath = libraryCandidates.find((path) => existsSync(path));
  if (!libraryPath) {
    throw new Error('Missing Level 2.3 pack. Expected data/level2/india-nutrition-l23.json or the attached JSON.');
  }
  return JSON.parse(readFileSync(libraryPath, 'utf8'));
}

function slugName(name = '') {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function brandLookupKeys(name = '') {
  const keys = new Set([
    normalizeFoodAlias(name),
    normalizeFoodAlias(String(name).replace(/&/g, ' and ')),
    String(name || '').trim().toLowerCase(),
  ]);
  return [...keys].filter(Boolean);
}

function resolveGenericId(row) {
  const family = familyCanonicalFor(row);
  const familyIds = family ? familyIdsFor(family.idSuffix) : [];
  const familyMeta = family && familyIds.length
    ? { familyIds, nameKeys: family.names, canonical_key: family.key }
    : {};

  const listed = String(row.source_v4_id || '').trim();
  if (listed && V4_BY_ID[listed]) {
    return { id: listed, how: 'source_v4_id', ...familyMeta };
  }

  const slug = slugName(row.canonical_name);
  if (slug && V4_BY_ID[slug]) return { id: slug, how: 'canonical_slug', ...familyMeta };

  const alias = V4_ALIAS_TO_ID[normalizeFoodAlias(row.canonical_name)];
  if (alias && V4_BY_ID[alias]) return { id: alias, how: 'v4_alias', ...familyMeta };

  const manual = MANUAL_GENERIC_ALIASES[slug];
  if (manual && V4_BY_ID[manual]) return { id: manual, how: 'existing_alias', ...familyMeta };

  if (familyIds.length) {
    return { id: familyIds[0], how: 'family_canonical', ...familyMeta };
  }

  return { id: null, how: listed ? 'missing_v4' : 'unmatched' };
}

const pack = loadPack();
const brandedRows = pack.exact_branded_anchors || pack.branded || [];
const genericRows = pack.top_50_generic_foods || pack.records || [];

const exactBrandById = {};
const exactBrandByName = {};
const genericById = {};
const genericByName = {};
const compactBranded = [];
const compactGeneric = [];
const unmatched = [];
const exactBrandNameOnly = [];
const duplicates = [];
const conflicts = [];
const verifiedAuthoritativeWins = [];

for (const row of brandedRows) {
  const name = row.canonical_name;
  const per = row.per_100g || {};
  const slug = slugName(name);
  const uniqueV4 = V4_BY_ID[slug] ? slug : (V4_ALIAS_TO_ID[normalizeFoodAlias(name)] || null);
  const overlay = {
    id: uniqueV4 || slug,
    canonical_name: name,
    kcal100: num(per.kcal ?? row.kcal100),
    protein100: num(per.protein_g ?? row.protein100),
    carbs100: num(per.carbs_g ?? row.carbs100),
    fat100: num(per.fat_g ?? row.fat100),
    evidence_grade: row.evidence_grade || 'A',
    production_approved: row.production_approved === true,
    nutrition_source: 'exact_brand',
    nutrition_basis: 'approved_exact',
    dataSource: 'exact_brand',
    scope: row.scope || 'exact branded/menu item only',
  };

  if (overlay.kcal100 == null) {
    conflicts.push({ type: 'brand_missing_kcal', name });
    continue;
  }

  compactBranded.push(overlay);

  for (const key of brandLookupKeys(name)) {
    if (exactBrandByName[key] && exactBrandByName[key].id !== overlay.id) {
      duplicates.push({ type: 'brand_name', key, ids: [exactBrandByName[key].id, overlay.id] });
    }
    exactBrandByName[key] = overlay;
  }

  // Only a unique existing V4 id may receive Grade-A branded nutrition.
  if (uniqueV4 && !genericById[uniqueV4]) {
    if (exactBrandById[uniqueV4] && exactBrandById[uniqueV4].kcal100 !== overlay.kcal100) {
      conflicts.push({
        type: 'brand_id_conflict',
        id: uniqueV4,
        kcal: [exactBrandById[uniqueV4].kcal100, overlay.kcal100],
      });
    } else {
      exactBrandById[uniqueV4] = overlay;
    }
  } else if (!uniqueV4) {
    exactBrandNameOnly.push({
      name,
      reason: 'indexed for exact branded/menu name only; no unique V4 id',
    });
  }
}

for (const row of genericRows) {
  const resolved = resolveGenericId(row);
  const per = row.reference_per_100g || {};
  const compact = {
    rank: row.priority_rank || row.rank,
    canonical_name: row.canonical_name,
    source_v4_id: row.source_v4_id || null,
    resolved_v4_id: resolved.id,
    resolve_how: resolved.how,
    category: row.category,
    kcal100: num(per.kcal_central ?? row.kcal100),
    kcal100Low: num(per.kcal_low ?? row.kcal100Low),
    kcal100High: num(per.kcal_high ?? row.kcal100High),
    protein100: num(per.protein_g_central ?? row.protein100),
    carbs100: num(per.carbs_g_central ?? row.carbs100),
    fat100: num(per.fat_g_central ?? row.fat100),
    typical_portion_g: num(row.typical_portion_g),
    nutrition_confidence: row.confidence || row.nutrition_confidence || null,
    evidence_grade: row.evidence_grade || null,
    production_approved: row.production_approved === true,
    validation_status: row.validation_status || null,
    integration_action: row.integration_action || null,
    research_note: row.research_note || '',
    family_ids: resolved.familyIds || [],
    name_keys: resolved.nameKeys || [],
  };
  compactGeneric.push(compact);

  if (!resolved.id) {
    unmatched.push({
      kind: 'generic',
      name: row.canonical_name,
      source_v4_id: row.source_v4_id || null,
      reason: resolved.how,
    });
    continue;
  }

  if (exactBrandById[resolved.id]) {
    conflicts.push({
      type: 'branded_on_generic_blocked',
      id: resolved.id,
      name: row.canonical_name,
    });
    continue;
  }

  if (genericById[resolved.id]) {
    duplicates.push({
      type: 'generic_id',
      id: resolved.id,
      names: [genericById[resolved.id].canonical_name, row.canonical_name],
    });
    continue;
  }

  if (
    compact.kcal100 == null
    || compact.kcal100Low == null
    || compact.kcal100High == null
    || compact.kcal100Low > compact.kcal100
    || compact.kcal100 > compact.kcal100High
  ) {
    conflicts.push({ type: 'invalid_generic_range', id: resolved.id, name: row.canonical_name });
    continue;
  }

  if (VERIFIED_BY_ID[resolved.id]) {
    verifiedAuthoritativeWins.push({
      id: resolved.id,
      name: row.canonical_name,
      source: VERIFIED_BY_ID[resolved.id].dataSource,
    });
  }

  const overlay = {
    id: resolved.canonical_key || resolved.id,
    canonical_name: row.canonical_name,
    kcal100: compact.kcal100,
    kcal100Low: compact.kcal100Low,
    kcal100High: compact.kcal100High,
    protein100: compact.protein100,
    carbs100: compact.carbs100,
    fat100: compact.fat100,
    nutrition_confidence: compact.nutrition_confidence,
    evidence_grade: compact.evidence_grade,
    nutrition_source: 'level2_3_generic',
    nutrition_basis: 'researched_generic',
    dataSource: 'level2_3_generic',
  };

  const targetIds = new Set([resolved.id, ...(resolved.familyIds || [])]);
  if (resolved.canonical_key) targetIds.add(resolved.canonical_key);
  for (const id of targetIds) {
    if (exactBrandById[id]) {
      conflicts.push({ type: 'branded_on_generic_blocked', id, name: row.canonical_name });
      continue;
    }
    if (genericById[id] && genericById[id].canonical_name !== row.canonical_name) {
      duplicates.push({
        type: 'generic_id',
        id,
        names: [genericById[id].canonical_name, row.canonical_name],
      });
      continue;
    }
    genericById[id] = { ...overlay, id };
  }

  for (const name of resolved.nameKeys || []) {
    for (const key of brandLookupKeys(name)) {
      genericByName[key] = overlay;
    }
  }
}

const extracted = {
  version: pack.version || '2.3.0',
  name: pack.name || 'MealNova India Top-50 Research & Calibration Pack',
  objective: pack.objective || {},
  important_interpretation: pack.important_interpretation || {},
  evidence_grades: pack.evidence_grades || {},
  promotion_rules: pack.promotion_rules || [],
  record_count: compactGeneric.length,
  branded_count: compactBranded.length,
  updated: new Date().toISOString().slice(0, 10),
  exact_branded_anchors: compactBranded,
  records: compactGeneric,
};

const genericMappedCount = compactGeneric.filter((row) => row.resolved_v4_id).length;
const stats = {
  version: extracted.version,
  exactBrandIndexed: compactBranded.length,
  exactBrandOverrideCount: Object.keys(exactBrandById).length,
  exactBrandNameOnlyCount: exactBrandNameOnly.length,
  genericMappedCount,
  genericOverrideCount: Object.keys(genericById).length,
  unmatchedCount: unmatched.length,
  duplicateCount: duplicates.length,
  conflictCount: conflicts.length,
  verifiedAuthoritativeWins: verifiedAuthoritativeWins.length,
};

mkdirSync(dirname(extractedPath), { recursive: true });
writeFileSync(extractedPath, `${JSON.stringify(extracted, null, 2)}\n`);

writeFileSync(generatedOut, `/** AUTO-GENERATED — run node scripts/build-india-nutrition-l23-index.mjs */
export const INDIA_L23_STATS = ${JSON.stringify({ ...stats, unmatched, exactBrandNameOnly, duplicates, conflicts, verifiedAuthoritativeWins }, null, 2)};

/** Grade-A branded nutrition. Only exact branded V4 ids. */
export const INDIA_L23_EXACT_BRAND_BY_ID = ${JSON.stringify(exactBrandById)};

/** Grade-A branded nutrition keyed by normalized exact product/menu name. */
export const INDIA_L23_EXACT_BRAND_BY_NAME = ${JSON.stringify(exactBrandByName)};

/** Researched generic overlay keyed by exact normalized generic dish name. */
export const INDIA_L23_GENERIC_BY_NAME = ${JSON.stringify(genericByName)};

/** Researched generic overlay keyed by source_v4_id / canonical V4 id. */
export const INDIA_L23_GENERIC_BY_V4_ID = ${JSON.stringify(genericById)};
`);

console.log('India Level 2.3 nutrition index built');
console.log(JSON.stringify(stats, null, 2));
if (unmatched.length) console.log('unmatched', unmatched);
if (exactBrandNameOnly.length) console.log('exact-brand name-only', exactBrandNameOnly.map((row) => row.name));
if (duplicates.length) console.log('duplicates', duplicates);
if (conflicts.length) console.log('conflicts', conflicts);
if (verifiedAuthoritativeWins.length) console.log('verified wins', verifiedAuthoritativeWins);
