/**
 * Build recipe catalog alias index for Layer C decomposition.
 * Run: node scripts/build-recipe-catalog-index.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFoodAlias } from '../shared/food-ref-v4-normalize.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = resolve(root, 'data/recipes/recipe-catalog.json');
const outPath = resolve(root, 'shared/recipe-catalog-index.generated.js');

if (!existsSync(srcPath)) {
  if (existsSync(outPath)) {
    console.log('recipe-catalog source missing; keeping committed generated index');
    process.exit(0);
  }
  throw new Error(`Missing ${srcPath}`);
}

const catalog = JSON.parse(readFileSync(srcPath, 'utf8'));
const recipes = catalog.recipes || [];

/** @type {Record<string, string>} */
const aliasToId = {};
/** @type {Record<string, string>} */
const refToId = {};
/** @type {Record<string, object>} */
const byId = {};

for (const recipe of recipes) {
  byId[recipe.id] = recipe;
  if (recipe.dishRefId) refToId[recipe.dishRefId] = recipe.id;
  for (const alias of recipe.aliases || []) {
    const key = normalizeFoodAlias(alias);
    if (key) aliasToId[key] = recipe.id;
  }
  const idKey = normalizeFoodAlias(recipe.id.replace(/_/g, ' '));
  if (idKey) aliasToId[idKey] = recipe.id;
}

const header = `/** AUTO-GENERATED — do not edit. Run: node scripts/build-recipe-catalog-index.mjs */\n`;

const body = `${header}export const RECIPE_CATALOG_STATS = ${JSON.stringify({
  count: recipes.length,
  aliases: Object.keys(aliasToId).length,
  version: catalog.version || '1.0',
})};\n\nexport const RECIPE_ALIAS_TO_ID = ${JSON.stringify(aliasToId, null, 2)};\n\nexport const RECIPE_BY_REF_ID = ${JSON.stringify(refToId, null, 2)};\n\nexport const RECIPE_BY_ID = ${JSON.stringify(byId, null, 2)};\n`;

writeFileSync(outPath, body, 'utf8');
console.log(`Wrote ${recipes.length} recipes (${Object.keys(aliasToId).length} aliases) → shared/recipe-catalog-index.generated.js`);
