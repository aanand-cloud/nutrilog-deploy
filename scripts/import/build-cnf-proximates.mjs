/**
 * Build compact CNF proximates index from official CSV extract.
 *
 * Place unzipped CNF files under .tmp/cnf-2026/raw/ then:
 *   node scripts/import/build-cnf-proximates.mjs
 *
 * Writes data/import/cnf/proximates.json (gitignored if large — see README).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCnfFoodNames, buildCnfProximates, searchCnfProximates } from './cnf-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const rawDir = resolve(root, '.tmp/cnf-2026/raw');
const outDir = resolve(root, 'data/import/cnf');
const outPath = resolve(outDir, 'proximates.json');

const foodPath = resolve(rawDir, 'Food_Name.csv');
const nutPath = resolve(rawDir, 'Nutrient_Amount.csv');

if (!existsSync(foodPath) || !existsSync(nutPath)) {
  console.error(`Missing CNF CSVs under ${rawDir}`);
  console.error('Download: https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109');
  console.error('Unzip cnf_fcen_all-files-data_2026.zip into .tmp/cnf-2026/raw/');
  process.exit(1);
}

console.log('Parsing Food_Name.csv…');
const foods = parseCnfFoodNames(readFileSync(foodPath, 'utf8'));
console.log(`Foods: ${foods.size}`);

console.log('Building proximates from Nutrient_Amount.csv (large)…');
const rows = buildCnfProximates(readFileSync(nutPath, 'utf8'), foods);
console.log(`Rows with macros: ${rows.length}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify({
  version: 'cnf-2026',
  source: 'https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109',
  builtAt: new Date().toISOString(),
  count: rows.length,
  records: rows,
}, null, 0)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);

const pizza = searchCnfProximates(rows, 'pizza');
console.log(`\nPizza hits (${pizza.length}):`);
for (const p of pizza.slice(0, 40)) {
  console.log(`${p.code} | ${p.name} | kcal ${p.kcal} P ${p.protein} C ${p.carbs} F ${p.fat} fibre ${p.fibre}`);
}
