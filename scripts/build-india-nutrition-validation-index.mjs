/**
 * Extract Level 2.2 India nutrition validation pack.
 * Compact records keyed by source_v4_id. Provisional values stay QA-only.
 *
 * Run: node scripts/build-india-nutrition-validation-index.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V4_BY_ID } from '../shared/food-ref-v4-index.generated.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extractedPath = resolve(root, 'data/level2/india-nutrition-validation.json');
const approvedOut = resolve(root, 'shared/india-nutrition-validation-approved.generated.js');
const libraryCandidates = [
  process.argv[2],
  resolve(root, 'data/level2/mealnova-level2-2-india-nutrition-validation-pack-v1.json'),
  'c:/Users/user/Downloads/mealnova-level2-2-india-nutrition-validation-pack-v1.json',
].filter(Boolean);

function loadPack() {
  if (existsSync(extractedPath)) {
    return JSON.parse(readFileSync(extractedPath, 'utf8'));
  }
  const libraryPath = libraryCandidates.find((path) => existsSync(path));
  if (!libraryPath) {
    throw new Error('Missing Level 2.2 pack. Expected data/level2/india-nutrition-validation.json or the attached JSON.');
  }
  return JSON.parse(readFileSync(libraryPath, 'utf8'));
}

const pack = loadPack();
const byId = {};
const approved = {};

for (const row of pack.records || []) {
  const id = row.source_v4_id;
  if (!id) continue;
  if (!V4_BY_ID[id]) {
    throw new Error(`Level 2.2 source_v4_id not in V4: ${id}`);
  }
  const provisional = row.level_2_2_provisional_reference || row.provisional || null;
  byId[id] = {
    rank: row.rank,
    source_v4_id: id,
    display_name: row.display_name,
    category: row.category,
    variability: row.variability,
    repair_flags: row.repair_flags || [],
    current_v4_nutrition: row.current_v4_nutrition || null,
    provisional,
    nutrition_confidence: row.confidence_before_source_validation || row.nutrition_confidence || null,
    portion_confidence: row.portion_confidence || null,
    recognition_confidence: row.recognition_confidence || null,
    validation_status: row.validation_status,
    production_approved: row.production_approved === true,
    source_recipe_validation_required: row.source_recipe_validation_required !== false,
  };

  if (row.production_approved === true && row.validated_nutrition) {
    approved[id] = {
      id,
      kcal100: row.validated_nutrition.kcal100_central,
      protein100: row.validated_nutrition.protein100_central,
      carbs100: row.validated_nutrition.carbs100_central,
      fat100: row.validated_nutrition.fat100_central,
      fibre100: row.validated_nutrition.fibre100_central,
      nutrition_basis: 'recipe_derived',
      dataSource: row.validated_nutrition.dataSource || 'recipe',
      verificationStatus: 'recipe_derived',
      lastReviewedAt: row.validated_nutrition.validated_at || '',
    };
  }
}

const extracted = {
  version: pack.version || '2.2.0',
  name: pack.name || 'MealNova India Nutrition Validation Pack',
  purpose: pack.purpose,
  critical_rule: pack.critical_rule,
  accuracy_goal: pack.accuracy_goal || {},
  authoritative_source_policy: pack.authoritative_source_policy || [],
  calculation_spec: pack.calculation_spec || {},
  validation_fields_required_for_promotion: pack.validation_fields_required_for_promotion || [],
  integration_rules: pack.integration_rules || [],
  record_count: Object.keys(byId).length,
  updated: new Date().toISOString().slice(0, 10),
  records: Object.values(byId).sort((a, b) => a.rank - b.rank),
};

mkdirSync(dirname(extractedPath), { recursive: true });
writeFileSync(extractedPath, `${JSON.stringify(extracted, null, 2)}\n`);

const stats = {
  version: extracted.version,
  total: extracted.record_count,
  approvedCount: Object.keys(approved).length,
  provisionalCount: extracted.record_count - Object.keys(approved).length,
};

writeFileSync(approvedOut, `/** AUTO-GENERATED — run node scripts/build-india-nutrition-validation-index.mjs */
export const INDIA_VALIDATION_STATS = ${JSON.stringify(stats, null, 2)};

/** Only production_approved=true records. Provisional values never appear here. */
export const INDIA_APPROVED_BY_V4_ID = ${JSON.stringify(approved)};
`);

console.log('India nutrition validation index built');
console.log(JSON.stringify(stats, null, 2));
