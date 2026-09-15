/**
 * Canadian Nutrient File (CNF / FCÉN) utilities.
 * Official open data: https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109
 */

/** CNF nutrient codes → MealNova fields (per 100 g edible). */
export const CNF_NUTRIENT_CODES = {
  203: 'protein',
  204: 'fat',
  205: 'carbs',
  208: 'kcal',
  269: 'sugar',
  291: 'fibre',
  307: 'sodiumMg',
};

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function round1(v) {
  return Math.round(Number(v) * 10) / 10;
}

function parseCsvLine(line = '') {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Parse CNF Food_Name.csv → Map<code, { code, name, usdaNdb }>.
 * @param {string} text
 */
export function parseCnfFoodNames(text = '') {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map();
  const headers = parseCsvLine(lines[0]);
  const iCode = headers.indexOf('Food_Code');
  const iName = headers.indexOf('Food_Description_EN');
  const iUsda = headers.indexOf('USDA_NDB_Code');
  const byCode = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const code = String(cols[iCode] || '').trim();
    if (!code) continue;
    byCode.set(code, {
      code,
      name: cols[iName] || '',
      usdaNdb: cols[iUsda] || '',
    });
  }
  return byCode;
}

/**
 * Stream-parse Nutrient_Amount.csv into Map<code, proximates>.
 * Only keeps energy/macros/fibre/sodium.
 * @param {string} text
 * @param {Map<string, object>} foodNames
 */
export function buildCnfProximates(text = '', foodNames = new Map()) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  const iFood = headers.indexOf('Food_Code');
  const iNut = headers.indexOf('Nutrient_Code');
  const iAmt = headers.indexOf('Nutrient_Amount');

  /** @type {Map<string, object>} */
  const byCode = new Map();
  for (const [code, food] of foodNames) {
    byCode.set(code, {
      code,
      name: food.name,
      usdaNdb: food.usdaNdb || '',
      kcal: null,
      protein: null,
      fat: null,
      carbs: null,
      sugar: null,
      fibre: null,
      sodiumMg: null,
    });
  }

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const code = String(cols[iFood] || '').trim();
    const nut = Number(cols[iNut]);
    const field = CNF_NUTRIENT_CODES[nut];
    if (!field || !code) continue;
    const row = byCode.get(code);
    if (!row) continue;
    const amount = num(cols[iAmt]);
    if (amount == null) continue;
    row[field] = amount;
  }

  return [...byCode.values()].filter((r) => r.kcal != null || r.protein != null);
}

/**
 * @param {object[]} rows
 * @param {string} query
 */
export function searchCnfProximates(rows = [], query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return rows.filter((r) => String(r.name || '').toLowerCase().includes(q));
}

/**
 * Normalize a CNF row (+ MealNova id) into verified-nutrition shape.
 * @param {object} row
 */
export function normalizeCnfRecord(row = {}) {
  const id = row.id;
  if (!id) return null;
  const sodiumMg = row.sodiumMg100 ?? row.sodiumMg;
  const salt100 = row.salt100 != null
    ? Math.round(num(row.salt100) || 0)
    : (sodiumMg != null ? Math.round(Number(sodiumMg) * 2.5) : 0);

  return {
    id,
    canonicalName: row.canonicalName || row.name || id.replace(/_/g, ' '),
    aliases: row.aliases || [],
    dataSource: 'cnf',
    sourceRecordId: String(row.sourceRecordId || row.code || '').trim(),
    verificationStatus: 'verified',
    nutrition_basis: 'verified_cnf',
    preparationState: row.preparationState || 'cooked',
    lastReviewedAt: row.lastReviewedAt || new Date().toISOString().slice(0, 10),
    kcal100: Math.round(num(row.kcal100 ?? row.kcal) || 0),
    protein100: round1(num(row.protein100 ?? row.protein) || 0),
    carbs100: round1(num(row.carbs100 ?? row.carbs) || 0),
    fat100: round1(num(row.fat100 ?? row.fat) || 0),
    fibre100: row.fibre100 != null || row.fibre != null
      ? round1(num(row.fibre100 ?? row.fibre) || 0)
      : null,
    sugar100: row.sugar100 != null || row.sugar != null
      ? round1(num(row.sugar100 ?? row.sugar) || 0)
      : undefined,
    salt100,
  };
}
