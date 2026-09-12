/**
 * Patch food-ref-v4.json with verified CoFID/IFCT overlays for linked ids.
 * Run: node scripts/import/merge-verified-into-v4.mjs [--dry-run]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canRemovePlaceholderNutrition,
  isPlaceholderNutrition,
} from '../../shared/india-nutrition-repair.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const v4Path = resolve(root, 'shared/food-ref-v4.json');
const verifiedPath = resolve(root, 'data/verified/verified-nutrition.json');
const indiaQueuePath = resolve(root, 'data/level2/india-nutrition-repair-queue.json');
const dryRun = process.argv.includes('--dry-run');

const catalog = JSON.parse(readFileSync(v4Path, 'utf8'));
const verified = JSON.parse(readFileSync(verifiedPath, 'utf8'));
const indiaQueue = existsSync(indiaQueuePath)
  ? JSON.parse(readFileSync(indiaQueuePath, 'utf8'))
  : { records: [] };
const indiaById = new Map((indiaQueue.records || []).map((row) => [row.source_v4_id, row]));
const byId = new Map((verified.records || []).map((r) => [r.id, r]));

let patched = 0;
let missing = 0;
let blockedIndia = 0;

for (const item of catalog.items || []) {
  const overlay = byId.get(item.id);
  if (!overlay) continue;

  if (!item.id) continue;

  const indiaItem = indiaById.get(item.id);
  if (indiaItem && isPlaceholderNutrition(item)) {
    const repair = {
      ...overlay,
      source_v4_id: item.id,
      kcal100_central: overlay.kcal100,
      kcal100_low: overlay.kcal100Low ?? overlay.kcal100_low,
      kcal100_high: overlay.kcal100High ?? overlay.kcal100_high,
      protein100_central: overlay.protein100,
      carbs100_central: overlay.carbs100,
      fat100_central: overlay.fat100,
      fibre100_central: overlay.fibre100,
      typical_portion_g: overlay.standardPortionGrams,
      portion_low_g: overlay.portion_low_g,
      portion_high_g: overlay.portion_high_g,
      confidence: overlay.confidence,
      source_notes: overlay.source_notes,
      validated_at: overlay.lastReviewedAt,
      evidence_paths: overlay.evidence_paths,
    };
    if (!canRemovePlaceholderNutrition(indiaItem, repair)) {
      blockedIndia += 1;
      continue;
    }
  }

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

console.log(`Merge verified → V4: ${patched} patched, ${missing} verified-only ids, ${blockedIndia} India placeholders kept`);

if (!dryRun && patched > 0) {
  writeFileSync(v4Path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log('Wrote shared/food-ref-v4.json');
} else if (dryRun) {
  console.log('Dry run — no files written');
}
