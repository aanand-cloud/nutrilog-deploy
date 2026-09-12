/**
 * Extract the Level 2.1 India nutrition-repair QA queue.
 * Compact repeated contract fields; keep rank, source_v4_id, and current snapshot.
 * Does not write nutrition into V4 or verified overlays.
 *
 * Run: node scripts/build-india-nutrition-repair-queue.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V4_BY_ID } from '../shared/food-ref-v4-index.generated.js';
import { INDIA_REPAIR_PRIORITY_MAX } from '../shared/india-nutrition-repair.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extractedPath = resolve(root, 'data/level2/india-nutrition-repair-queue.json');
const repairsPath = resolve(root, 'data/level2/india-nutrition-repairs.json');
const libraryCandidates = [
  process.argv[2],
  resolve(root, 'data/level2/mealnova-level2-1-india-nutrition-repair-plan-v1.json'),
  'c:/Users/user/Downloads/mealnova-level2-1-india-nutrition-repair-plan-v1.json',
].filter(Boolean);

function loadPlan() {
  if (existsSync(extractedPath)) {
    return JSON.parse(readFileSync(extractedPath, 'utf8'));
  }
  const libraryPath = libraryCandidates.find((path) => existsSync(path));
  if (!libraryPath) {
    throw new Error('Missing Level 2.1 plan. Expected data/level2/india-nutrition-repair-queue.json or the attached JSON.');
  }
  return JSON.parse(readFileSync(libraryPath, 'utf8'));
}

const plan = loadPlan();
const records = (plan.records || [])
  .filter((row) => Number(row.rank) >= 1 && Number(row.rank) <= INDIA_REPAIR_PRIORITY_MAX)
  .sort((a, b) => a.rank - b.rank)
  .map((row) => ({
    rank: row.rank,
    source_v4_id: row.source_v4_id,
    display_name: row.display_name,
    category: row.category,
    variability: row.variability,
    current_nutrition: row.current_nutrition || null,
    repair_flags: row.repair_flags || [],
    repair_action: row.repair_action,
  }));

const missingV4 = records.filter((row) => !V4_BY_ID[row.source_v4_id]).map((row) => row.source_v4_id);
if (missingV4.length) {
  throw new Error(`Level 2.1 source_v4_id not in V4: ${missingV4.slice(0, 8).join(', ')}`);
}

const queue = {
  version: plan.version || '2.1.0',
  purpose: plan.purpose || 'MealNova India nutrition repair queue for high-priority foods',
  important_note: plan.important_note || 'This queue does not invent replacement nutrition values.',
  accuracy_definition: plan.accuracy_definition || {},
  authoritative_sources: plan.authoritative_sources || [],
  repair_pipeline: plan.repair_pipeline || [],
  promotion_gate: plan.promotion_gate || {},
  priority_window: { min: 1, max: INDIA_REPAIR_PRIORITY_MAX },
  updated: new Date().toISOString().slice(0, 10),
  records,
};

mkdirSync(dirname(extractedPath), { recursive: true });
writeFileSync(extractedPath, `${JSON.stringify(queue, null, 2)}\n`);

if (!existsSync(repairsPath)) {
  writeFileSync(repairsPath, `${JSON.stringify({
    version: queue.version,
    notes: [
      'Validated India repairs only. Do not copy current_nutrition snapshots here.',
      'Promotion requires provenance, ranges, and confidence (see shared/india-nutrition-repair.js).',
    ],
    records: [],
  }, null, 2)}\n`);
}

console.log('India nutrition-repair QA queue built');
console.log(JSON.stringify({
  version: queue.version,
  priorityRecords: records.length,
  missingV4: missingV4.length,
  first: records[0]?.source_v4_id,
  last: records.at(-1)?.source_v4_id,
}, null, 2));
