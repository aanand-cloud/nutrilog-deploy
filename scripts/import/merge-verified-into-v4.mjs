/**
 * Patch food-ref-v4.json with verified CoFID/IFCT overlays for linked ids.
 * Run: node scripts/import/merge-verified-into-v4.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const v4Path = resolve(root, 'shared/food-ref-v4.json');
const verifiedPath = resolve(root, 'data/verified/verified-nutrition.json');
const dryRun = process.argv.includes('--dry-run');

const catalog = JSON.parse(readFileSync(v4Path, 'utf8'));
const verified = JSON.parse(readFileSync(verifiedPath, 'utf8'));
const byId = new Map((verified.records || []).map((r) => [r.id, r]));

let patched = 0;
let missing = 0;

for (const item of catalog.items || []) {
  const overlay = byId.get(item.id);
  if (!overlay) continue;

  if (!item.id) continue;

  item.kcal100 = overlay.kcal100;
  item.protein100 = overlay.protein100;
  item.carbs100 = overlay.carbs100;
  item.fat100 = overlay.fat100;
  item.fibre100 = overlay.fibre100 ?? item.fibre100;
  item.sugar100 = overlay.sugar100 ?? item.sugar100;
  item.salt100 = overlay.salt100 ?? item.salt100;
  item.dataSource = overlay.dataSource;
  item.sourceRecordId = overlay.sourceRecordId;
  item.verificationStatus = overlay.verificationStatus;
  item.nutrition_basis = overlay.nutrition_basis;
  item.preparationState = overlay.preparationState;
  item.lastReviewedAt = overlay.lastReviewedAt;
  patched += 1;
  byId.delete(item.id);
}

for (const id of byId.keys()) {
  console.warn(`WARN | verified id "${id}" not found in V4 catalog`);
  missing += 1;
}

console.log(`Merge verified → V4: ${patched} patched, ${missing} verified-only ids`);

if (!dryRun && patched > 0) {
  writeFileSync(v4Path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log('Wrote shared/food-ref-v4.json');
} else if (dryRun) {
  console.log('Dry run — no files written');
}
