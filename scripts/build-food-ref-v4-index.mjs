/**
 * Build Tier 2 alias index from food-ref-v4.json.
 * Colliding aliases are excluded — never silently pick one winner.
 *
 * Run: node scripts/build-food-ref-v4-index.mjs
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { aliasKeysForItem } from '../shared/food-ref-v4-normalize.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDefault = 'c:/Users/user/Downloads/food-ref-v4.json';
const srcPath = process.argv[2] || resolve(root, 'shared/food-ref-v4.json');
const jsonDest = resolve(root, 'shared/food-ref-v4.json');
const outPath = resolve(root, 'shared/food-ref-v4-index.generated.js');

if (!existsSync(srcPath)) {
  console.error(`Missing V4 source: ${srcPath}`);
  process.exit(1);
}

if (srcPath !== jsonDest && !existsSync(jsonDest)) {
  copyFileSync(srcPath, jsonDest);
  console.log('Copied V4 JSON to shared/food-ref-v4.json');
}

const catalog = JSON.parse(readFileSync(existsSync(jsonDest) ? jsonDest : srcPath, 'utf8'));
const items = catalog.items || [];

/** @type {Map<string, Set<string>>} */
const aliasToIds = new Map();
/** @type {Map<string, object>} */
const byId = new Map();

for (const item of items) {
  byId.set(item.id, item);
  const keys = aliasKeysForItem(item.aliases || item.id.replace(/_/g, ' '), item.id);
  for (const key of keys) {
    if (!aliasToIds.has(key)) aliasToIds.set(key, new Set());
    aliasToIds.get(key).add(item.id);
  }
}

/** @type {Record<string, string>} */
const uniqueAliasToId = {};
/** @type {Record<string, string[]>} */
const collisionAliases = {};

for (const [alias, ids] of aliasToIds) {
  if (ids.size === 1) {
    uniqueAliasToId[alias] = [...ids][0];
  } else {
    collisionAliases[alias] = [...ids].sort();
  }
}

/** Compact nutrition + metadata for runtime lookup by id. */
const compactById = {};
/** @type {Record<string, [string, string][]>} prefix → [alias, id][] for fuzzy fallback */
const fuzzyBuckets = {};

for (const item of items) {
  compactById[item.id] = [
    item.kcal100,
    item.protein100,
    item.carbs100,
    item.fat100,
    item.fibre100 ?? 0,
    item.region || '',
    item.cuisine || '',
    item.food_type || 'dish',
    item.nutrition_basis || 'estimated_reference',
    item.country || '',
  ];
}

for (const [alias, id] of Object.entries(uniqueAliasToId)) {
  if (alias.length < 4) continue;
  const prefix = alias.slice(0, 4);
  if (!fuzzyBuckets[prefix]) fuzzyBuckets[prefix] = [];
  if (fuzzyBuckets[prefix].length < 80) fuzzyBuckets[prefix].push([alias, id]);
}

const stats = {
  version: catalog.version || '4.0',
  totalItems: items.length,
  uniqueAliases: Object.keys(uniqueAliasToId).length,
  collisionAliases: Object.keys(collisionAliases).length,
  builtAt: new Date().toISOString(),
};

const output = `/** AUTO-GENERATED — run node scripts/build-food-ref-v4-index.mjs */
export const V4_INDEX_STATS = ${JSON.stringify(stats, null, 2)};

/** @type {Record<string, string>} normalized alias → canonical id (unique only) */
export const V4_ALIAS_TO_ID = ${JSON.stringify(uniqueAliasToId)};

/** @type {Record<string, string[]>} aliases that map to multiple ids — never auto-match */
export const V4_COLLISION_ALIASES = ${JSON.stringify(collisionAliases)};

/**
 * id → [kcal100, protein100, carbs100, fat100, fibre100, region, cuisine, food_type, nutrition_basis]
 * @type {Record<string, [number, number, number, number, number, string, string, string, string]>}
 */
export const V4_BY_ID = ${JSON.stringify(compactById)};

/** Prefix buckets for controlled fuzzy fallback (first 4 chars → [alias, id]) */
export const V4_FUZZY_BUCKETS = ${JSON.stringify(fuzzyBuckets)};
`;

writeFileSync(outPath, output);

console.log('V4 index built');
console.log(JSON.stringify(stats, null, 2));
console.log('Sample collisions:', Object.entries(collisionAliases).slice(0, 5));
