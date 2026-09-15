/**
 * Import curated CNF rows into verified-nutrition.json via id-map.
 *
 * Usage:
 *   node scripts/import/import-cnf.mjs [--dry-run]
 *
 * Requires:
 *   data/import/cnf/proximates.json  (from build-cnf-proximates.mjs)
 *   data/import/cnf/id-map.json      (MealNova id → CNF Food_Code)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { normalizeCnfRecord } from './cnf-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const verifiedPath = resolve(root, 'data/verified/verified-nutrition.json');
const proxPath = resolve(root, 'data/import/cnf/proximates.json');
const idMapPath = resolve(root, 'data/import/cnf/id-map.json');
const dryRun = process.argv.includes('--dry-run');

if (!existsSync(proxPath)) {
  console.error('Missing data/import/cnf/proximates.json — run: node scripts/import/build-cnf-proximates.mjs');
  process.exit(1);
}
if (!existsSync(idMapPath)) {
  console.error('Missing data/import/cnf/id-map.json');
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(verifiedPath, 'utf8'));
const prox = JSON.parse(readFileSync(proxPath, 'utf8'));
const idMap = JSON.parse(readFileSync(idMapPath, 'utf8'));
const byCode = new Map((prox.records || []).map((r) => [String(r.code), r]));
const byId = new Map((catalog.records || []).map((r) => [r.id, r]));

let added = 0;
let updated = 0;
let missing = 0;

for (const [id, code] of Object.entries(idMap)) {
  if (id.startsWith('_')) continue;
  const official = byCode.get(String(code));
  if (!official) {
    console.warn(`MISSING CNF ${code} for ${id}`);
    missing += 1;
    continue;
  }
  const next = normalizeCnfRecord({
    id,
    ...official,
    sourceRecordId: official.code,
  });
  if (!next || next.kcal100 <= 0) {
    missing += 1;
    continue;
  }
  // Never overwrite CoFID/IFCT verified rows unless explicitly mapped with force.
  const existing = byId.get(id);
  if (existing && existing.dataSource && existing.dataSource !== 'cnf' && !idMap._allowOverwrite?.includes(id)) {
    console.log(`SKIP ${id} — keep existing ${existing.dataSource} #${existing.sourceRecordId}`);
    continue;
  }
  if (existing) {
    byId.set(id, { ...existing, ...next });
    updated += 1;
  } else {
    byId.set(id, next);
    added += 1;
  }
}

const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
console.log(`CNF import: +${added} new, ~${updated} updated, ${missing} missing`);
console.log(`Total verified: ${merged.length}`);

if (dryRun) {
  console.log('Dry run — not written');
  process.exit(missing ? 1 : 0);
}

writeFileSync(verifiedPath, `${JSON.stringify({
  ...catalog,
  records: merged,
  updated: new Date().toISOString().slice(0, 10),
  importNote: `${catalog.importNote || ''}; CNF via scripts/import/import-cnf.mjs`.replace(/^; /, ''),
}, null, 2)}\n`, 'utf8');

execSync('node scripts/import/validate-import.mjs', { cwd: root, stdio: 'inherit' });
execSync('node scripts/build-verified-nutrition-index.mjs', { cwd: root, stdio: 'inherit' });
console.log('CNF import complete.');
