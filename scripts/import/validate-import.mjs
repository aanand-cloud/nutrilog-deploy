/**
 * Validate verified nutrition import — macro/kcal consistency and required fields.
 * Run: node scripts/import/validate-import.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkEnergyMacroConsistency,
  estimatedKcalFromMacros,
} from '../../shared/canonical-food-model.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const srcPath = resolve(root, 'data/verified/verified-nutrition.json');

const catalog = JSON.parse(readFileSync(srcPath, 'utf8'));
const records = catalog.records || [];

let errors = 0;
const ids = new Set();

for (const row of records) {
  const label = row.id || '(missing id)';

  if (!row.id) {
    console.error(`FAIL | ${label} — missing id`);
    errors += 1;
    continue;
  }
  if (ids.has(row.id)) {
    console.error(`FAIL | ${label} — duplicate id`);
    errors += 1;
  }
  ids.add(row.id);

  for (const field of ['dataSource', 'sourceRecordId', 'verificationStatus', 'kcal100']) {
    if (row[field] == null || row[field] === '') {
      console.error(`FAIL | ${label} — missing ${field}`);
      errors += 1;
    }
  }

  if (!['cofid', 'ifct', 'usda'].includes(row.dataSource)) {
    console.error(`FAIL | ${label} — unknown dataSource ${row.dataSource}`);
    errors += 1;
  }

  const drift = checkEnergyMacroConsistency(
    {
      protein_g: row.protein100,
      carbs_g: row.carbs100,
      fat_g: row.fat100,
      fibre_g: row.fibre100 || 0,
    },
    row.kcal100,
    { tolerance: 0.2 },
  );
  if (drift && row.kcal100 > 30) {
    console.warn(`WARN | ${label} — ${drift.message} (may be label-stated kcal)`);
  }

  const macroKcal = estimatedKcalFromMacros({
    protein_g: row.protein100,
    carbs_g: row.carbs100,
    fat_g: row.fat100,
    fibre_g: row.fibre100 || 0,
  });
  if (row.kcal100 <= 0 && row.id !== 'water') {
    console.error(`FAIL | ${label} — zero kcal`);
    errors += 1;
  }
}

console.log(`\nValidated ${records.length} records — ${errors} error(s), ${ids.size} unique ids`);
if (errors > 0) process.exit(1);
