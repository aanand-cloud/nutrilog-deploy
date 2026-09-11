/**
 * Build compact verified-nutrition index for runtime overlay.
 * Run: node scripts/build-verified-nutrition-index.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = resolve(root, 'data/verified/verified-nutrition.json');
const outPath = resolve(root, 'shared/verified-nutrition.generated.js');

if (!existsSync(srcPath)) {
  if (existsSync(outPath)) {
    console.log('verified-nutrition source missing; keeping committed generated index');
    process.exit(0);
  }
  throw new Error(`Missing ${srcPath}`);
}

const catalog = JSON.parse(readFileSync(srcPath, 'utf8'));
const records = catalog.records || [];

/** @type {Record<string, object>} */
const byId = {};
/** @type {Record<string, string>} */
const aliasToId = {};

for (const row of records) {
  if (!row?.id) continue;
  byId[row.id] = {
    id: row.id,
    canonicalName: row.canonicalName || row.id.replace(/_/g, ' '),
    aliases: row.aliases || [],
    dataSource: row.dataSource || 'internal_estimated',
    sourceRecordId: row.sourceRecordId || '',
    verificationStatus: row.verificationStatus || 'verified',
    nutrition_basis: row.nutrition_basis || 'verified_cofid',
    preparationState: row.preparationState || '',
    standardPortionGrams: row.standardPortionGrams ?? null,
    standardPortions: row.standardPortions || [],
    dataVersion: row.dataVersion || catalog.version || '1.0',
    lastReviewedAt: row.lastReviewedAt || '',
    kcal100: row.kcal100,
    protein100: row.protein100,
    carbs100: row.carbs100,
    fat100: row.fat100,
    fibre100: row.fibre100 ?? null,
    sugar100: row.sugar100 ?? null,
    salt100: row.salt100 ?? null,
    dataQualityScore: row.dataQualityScore ?? 95,
  };
  aliasToId[row.id] = row.id;
  aliasToId[row.id.replace(/_/g, ' ')] = row.id;
  for (const alias of row.aliases || []) {
    aliasToId[String(alias).toLowerCase().trim()] = row.id;
  }
}

const header = `/** AUTO-GENERATED — do not edit. Run: node scripts/build-verified-nutrition-index.mjs */\n`;

const body = `${header}export const VERIFIED_NUTRITION_STATS = ${JSON.stringify({
  count: Object.keys(byId).length,
  version: catalog.version || '1.0',
  updated: catalog.updated || new Date().toISOString().slice(0, 10),
})};\n\nexport const VERIFIED_BY_ID = ${JSON.stringify(byId, null, 2)};\n\nexport const VERIFIED_ALIAS_TO_ID = ${JSON.stringify(aliasToId, null, 2)};\n`;

writeFileSync(outPath, body, 'utf8');
console.log(`Wrote ${Object.keys(byId).length} verified records → shared/verified-nutrition.generated.js`);
