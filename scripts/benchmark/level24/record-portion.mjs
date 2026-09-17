/**
 * Record a weighed plate for Level 2.4 development scoring.
 * Web Commons photos cannot be weighed — use this only for plates you actually weighed.
 *
 * Usage:
 *   node scripts/benchmark/level24/record-portion.mjs IN24A-0002 400
 *   node scripts/benchmark/level24/record-portion.mjs IN24A-0002 400 --note "kitchen scale, plated"
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { level24Paths, loadLevel24Spec } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const paths = level24Paths(root);
const caseId = String(process.argv[2] || '').trim().toUpperCase();
const grams = Number(process.argv[3]);
const noteIdx = process.argv.indexOf('--note');
const note = noteIdx >= 0 ? String(process.argv[noteIdx + 1] || '').trim() : '';

if (!/^IN24A-\d{4}$/.test(caseId) || !Number.isFinite(grams) || grams < 20 || grams > 2000) {
  console.error('Usage: node scripts/benchmark/level24/record-portion.mjs <case_id> <grams> [--note "..."]');
  console.error('Example: node scripts/benchmark/level24/record-portion.mjs IN24A-0002 400');
  process.exit(1);
}

const spec = loadLevel24Spec(root);
const row = (spec.cases || []).find((c) => c.case_id === caseId);
if (!row) {
  console.error(`Unknown case ${caseId}`);
  process.exit(1);
}
if (row.split === 'holdout') {
  console.error(`Holdout case ${caseId} is frozen — do not record measured weights for tuning.`);
  process.exit(1);
}

mkdirSync(dirname(paths.measured), { recursive: true });
const current = existsSync(paths.measured)
  ? JSON.parse(readFileSync(paths.measured, 'utf8'))
  : { version: '1.0', portions: {}, notes: {} };

current.portions = current.portions || {};
current.notes = current.notes || {};
current.portions[caseId] = Math.round(grams);
if (note) current.notes[caseId] = note;
current.updated = new Date().toISOString().slice(0, 10);

writeFileSync(paths.measured, `${JSON.stringify(current, null, 2)}\n`);
console.log(`Recorded ${caseId} = ${current.portions[caseId]} g (${row.canonical_name}, ${row.scenario})`);
console.log(`Truth was portion_truth_g=${row.portion_truth_g}. Rescore with: npm run bench:level24:score`);
