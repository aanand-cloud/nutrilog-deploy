/**
 * Promote validated India Level 2.1 repairs into the verified overlay.
 *
 * Never writes current_nutrition snapshots.
 * Never strips estimated_reference placeholders unless the promotion gate passes.
 *
 * Run: node scripts/promote-india-nutrition-repair.mjs [--dry-run]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canRemovePlaceholderNutrition,
  evaluateIndiaRepairPromotion,
} from '../shared/india-nutrition-repair.js';
import { evaluateIndiaValidationPromotion } from '../shared/india-nutrition-validation.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const queuePath = resolve(root, 'data/level2/india-nutrition-repair-queue.json');
const validationPath = resolve(root, 'data/level2/india-nutrition-validation.json');
const repairsPath = resolve(root, 'data/level2/india-nutrition-repairs.json');
const verifiedPath = resolve(root, 'data/verified/verified-nutrition.json');
const dryRun = process.argv.includes('--dry-run');

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

const queue = loadJson(queuePath, { records: [] });
const validation = loadJson(validationPath, { records: [] });
const repairs = loadJson(repairsPath, { records: [] });
const verified = loadJson(verifiedPath, { version: '1.0', records: [] });
const queueById = new Map((queue.records || []).map((row) => [row.source_v4_id, row]));
const validationById = new Map((validation.records || []).map((row) => [row.source_v4_id, row]));
const verifiedById = new Map((verified.records || []).map((row) => [row.id, row]));

const candidates = [...(repairs.records || [])].sort((a, b) => {
  const rankA = queueById.get(a.source_v4_id || a.id)?.rank ?? 9999;
  const rankB = queueById.get(b.source_v4_id || b.id)?.rank ?? 9999;
  return rankA - rankB;
});

let promoted = 0;
let blocked = 0;

for (const repair of candidates) {
  const id = repair.source_v4_id || repair.id;
  const queueItem = queueById.get(id);
  const gate = evaluateIndiaRepairPromotion(queueItem, repair);
  const v22 = evaluateIndiaValidationPromotion(validationById.get(id) || { source_v4_id: id }, repair);
  if (!gate.ok || !canRemovePlaceholderNutrition(queueItem, repair) || !v22.ok) {
    blocked += 1;
    console.warn(`BLOCK | ${id || '(missing id)'} — ${[...gate.errors, ...v22.errors].join('; ')}`);
    continue;
  }

  const overlay = {
    id,
    canonicalName: repair.canonicalName || queueItem.display_name || id.replace(/_/g, ' '),
    aliases: repair.aliases || [queueItem.display_name].filter(Boolean),
    dataSource: repair.dataSource,
    sourceRecordId: repair.sourceRecordId || `india-repair:${id}`,
    verificationStatus: repair.verificationStatus || 'recipe_derived',
    nutrition_basis: repair.nutrition_basis || 'recipe_derived',
    preparationState: repair.preparationState || 'cooked',
    lastReviewedAt: String(repair.validated_at).slice(0, 10),
    kcal100: Number(repair.kcal100_central),
    protein100: Number(repair.protein100_central),
    carbs100: Number(repair.carbs100_central),
    fat100: Number(repair.fat100_central),
    fibre100: Number(repair.fibre100_central),
    sugar100: repair.sugar100 ?? null,
    salt100: repair.salt100 ?? null,
    standardPortionGrams: Number(repair.typical_portion_g),
    kcal100Low: Number(repair.kcal100_low),
    kcal100High: Number(repair.kcal100_high),
    confidence: repair.confidence,
    source_notes: repair.source_notes,
    evidence_paths: repair.evidence_paths,
  };

  if (verifiedById.has(id)) {
    Object.assign(verifiedById.get(id), overlay);
  } else {
    verified.records.push(overlay);
    verifiedById.set(id, overlay);
  }
  promoted += 1;
  console.log(`PROMOTE | rank ${queueItem.rank} ${id}`);
}

console.log(`India repair promotion: ${promoted} promoted, ${blocked} blocked, ${candidates.length} candidates`);

if (!dryRun && promoted > 0) {
  writeFileSync(verifiedPath, `${JSON.stringify(verified, null, 2)}\n`);
  console.log('Wrote data/verified/verified-nutrition.json');
} else if (dryRun) {
  console.log('Dry run — no files written');
}
