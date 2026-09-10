/**
 * Bulk import CoFID records into verified-nutrition.json.
 *
 * Usage:
 *   node scripts/import/import-cofid.mjs [--dry-run]
 *   node scripts/import/import-cofid.mjs --csv=data/import/cofid/proximates.csv
 *
 * Sources (merged in order):
 *   1. data/import/cofid/staples-pack.json — curated UK staples
 *   2. data/import/cofid/proximates.csv — optional official CoFID export
 *   3. data/import/cofid/id-map.json — maps MealNova id → CoFID food code for CSV rows
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { normalizeCofidRecord, parseCofidProximatesCsv } from './cofid-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const verifiedPath = resolve(root, 'data/verified/verified-nutrition.json');
const staplesPath = resolve(root, 'data/import/cofid/staples-pack.json');
const csvDefault = resolve(root, 'data/import/cofid/proximates.csv');
const idMapPath = resolve(root, 'data/import/cofid/id-map.json');

const dryRun = process.argv.includes('--dry-run');
const csvArg = process.argv.find((a) => a.startsWith('--csv='));
const csvPath = csvArg ? resolve(root, csvArg.slice(6)) : csvDefault;

function loadJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

const catalog = loadJson(verifiedPath, { version: '1.0', records: [] });
const byId = new Map((catalog.records || []).map((r) => [r.id, r]));

let added = 0;
let updated = 0;
let skipped = 0;

function upsert(record) {
  const normalized = normalizeCofidRecord(record);
  if (!normalized.id || !normalized.sourceRecordId) {
    skipped += 1;
    return;
  }
  if (normalized.kcal100 <= 0 && normalized.id !== 'water') {
    skipped += 1;
    return;
  }

  const existing = byId.get(normalized.id);
  if (existing) {
    byId.set(normalized.id, { ...existing, ...normalized });
    updated += 1;
  } else {
    byId.set(normalized.id, normalized);
    added += 1;
  }
}

const staples = loadJson(staplesPath, { records: [] });
for (const row of staples.records || []) {
  upsert(row);
}
console.log(`Staples pack: ${(staples.records || []).length} rows`);

if (existsSync(csvPath)) {
  const idMap = loadJson(idMapPath, {}) || {};
  const csvText = readFileSync(csvPath, 'utf8');
  const parsed = parseCofidProximatesCsv(csvText, idMap);
  for (const row of parsed) upsert(row);
  console.log(`CSV import: ${parsed.length} rows from ${csvPath}`);
} else {
  console.log(`CSV not found (optional): ${csvPath}`);
}

const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
const nextCatalog = {
  ...catalog,
  version: catalog.version || '1.0',
  updated: new Date().toISOString().slice(0, 10),
  importNote: 'CoFID bulk import via scripts/import/import-cofid.mjs',
  records: merged,
};

console.log(`\nCoFID merge summary: +${added} new, ~${updated} updated, ${skipped} skipped`);
console.log(`Total verified records: ${merged.length}`);

if (dryRun) {
  console.log('Dry run — verified-nutrition.json not written');
  process.exit(0);
}

writeFileSync(verifiedPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
console.log(`Wrote ${verifiedPath}`);

execSync('node scripts/import/validate-import.mjs', { cwd: root, stdio: 'inherit' });
execSync('node scripts/build-verified-nutrition-index.mjs', { cwd: root, stdio: 'inherit' });

console.log('\nCoFID import complete.');
