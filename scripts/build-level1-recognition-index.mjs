/**
 * Build a recognition-only alias index from the Level 1 MealNova food library.
 *
 * Nutrition still comes from existing food-ref-v4 / Tier-1 / verified records.
 * recognition_supplement and generated aliases are matcher metadata only.
 *
 * Run: node scripts/build-level1-recognition-index.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOOD_REFERENCES } from '../shared/food-references.js';
import { normalizeFoodAlias } from '../shared/food-ref-v4-normalize.js';
import {
  V4_ALIAS_TO_ID,
  V4_BY_ID,
  V4_COLLISION_ALIASES,
} from '../shared/food-ref-v4-index.generated.js';
import { VERIFIED_ALIAS_TO_ID, VERIFIED_BY_ID } from '../shared/verified-nutrition.generated.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extractedPath = resolve(root, 'data/level1/recognition.json');
const libraryCandidates = [
  process.argv[2],
  resolve(root, 'data/level1/mealnova-level1-global-food-library-v1.json'),
  'c:/Users/user/Downloads/mealnova-level1-global-food-library-v1.json',
].filter(Boolean);
const outPath = resolve(root, 'shared/level1-recognition-index.generated.js');

const TIER1_BY_ID = Object.fromEntries(FOOD_REFERENCES.map((ref) => [ref.id, ref]));

function loadRecognitionSource() {
  if (existsSync(extractedPath)) {
    return JSON.parse(readFileSync(extractedPath, 'utf8'));
  }

  const libraryPath = libraryCandidates.find((path) => existsSync(path));
  if (!libraryPath) {
    throw new Error('Missing Level 1 library. Expected data/level1/recognition.json or the attached JSON.');
  }

  const library = JSON.parse(readFileSync(libraryPath, 'utf8'));
  const extracted = {
    version: library.version || 'level1-v1',
    updated: library.updated || '',
    notes: library.level1_notes || [],
    recognition_supplement: library.recognition_supplement || [],
    level1_generated_aliases: library.level1_generated_aliases || [],
  };
  mkdirSync(dirname(extractedPath), { recursive: true });
  writeFileSync(extractedPath, `${JSON.stringify(extracted, null, 2)}\n`);
  console.log(`Extracted recognition metadata → ${extractedPath}`);
  return extracted;
}

function existingFoodId(name = '') {
  const norm = normalizeFoodAlias(name);
  if (!norm) return null;
  const idForm = norm.replace(/\s+/g, '_');
  if (V4_BY_ID[idForm]) return idForm;
  if (V4_ALIAS_TO_ID[norm]) return V4_ALIAS_TO_ID[norm];
  if (TIER1_BY_ID[idForm]) return idForm;
  if (VERIFIED_BY_ID[idForm]) return idForm;
  if (VERIFIED_BY_ID[norm]) return norm;
  if (VERIFIED_ALIAS_TO_ID[norm]) return VERIFIED_ALIAS_TO_ID[norm];
  return null;
}

function collectTerms(source) {
  /** @type {Map<string, Set<string>>} */
  const termToIds = new Map();

  function add(term, id) {
    const key = normalizeFoodAlias(term);
    if (!key || key.length < 3 || key.length > 64 || !id) return;
    if (V4_ALIAS_TO_ID[key] || V4_COLLISION_ALIASES[key] || V4_BY_ID[key.replace(/\s+/g, '_')]) {
      return;
    }
    if (!termToIds.has(key)) termToIds.set(key, new Set());
    termToIds.get(key).add(id);
  }

  for (const row of source.recognition_supplement || []) {
    const id = existingFoodId(row.canonical_name);
    if (!id) continue;
    add(row.canonical_name, id);
    for (const alias of row.aliases || []) add(alias, id);
  }

  for (const row of source.level1_generated_aliases || []) {
    const id = existingFoodId(row.canonical_hint);
    if (!id) continue;
    add(row.alias, id);
    add(row.canonical_hint, id);
  }

  return termToIds;
}

const source = loadRecognitionSource();
const termToIds = collectTerms(source);

/** @type {Record<string, string>} */
const uniqueAliasToId = {};
let skippedCollisions = 0;
let skippedUnresolved = 0;

for (const row of source.recognition_supplement || []) {
  if (!existingFoodId(row.canonical_name)) skippedUnresolved += 1;
}

for (const [alias, ids] of termToIds) {
  if (ids.size !== 1) {
    skippedCollisions += 1;
    continue;
  }
  uniqueAliasToId[alias] = [...ids][0];
}

const stats = {
  version: source.version || 'level1-v1',
  supplementRows: (source.recognition_supplement || []).length,
  generatedAliasRows: (source.level1_generated_aliases || []).length,
  uniqueAliases: Object.keys(uniqueAliasToId).length,
  skippedCollisions,
  skippedUnresolvedCanonicals: skippedUnresolved,
  builtAt: new Date().toISOString(),
};

const output = `/** AUTO-GENERATED — run node scripts/build-level1-recognition-index.mjs */
export const LEVEL1_INDEX_STATS = ${JSON.stringify(stats, null, 2)};

/** Recognition-only aliases → existing food ids. Nutrition still comes from V4 / Tier-1 / verified. */
export const LEVEL1_ALIAS_TO_ID = ${JSON.stringify(uniqueAliasToId)};
`;

writeFileSync(outPath, output);
console.log('Level 1 recognition index built');
console.log(JSON.stringify(stats, null, 2));
