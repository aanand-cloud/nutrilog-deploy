/**
 * CoFID import utilities — normalize records and parse proximates CSV exports.
 */

const PREP_FROM_NAME = [
  { re: /\b(raw|uncooked|dry)\b/i, state: 'raw' },
  { re: /\b(boiled|steamed)\b/i, state: 'boiled' },
  { re: /\b(roast|roasted)\b/i, state: 'roasted' },
  { re: /\b(fried|batter|deep[\s-]?fat)\b/i, state: 'fried' },
  { re: /\b(baked|toasted)\b/i, state: 'baked' },
  { re: /\b(cooked|prepared|made with)\b/i, state: 'cooked' },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function slugId(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

/**
 * @param {object} row
 * @returns {object}
 */
export function normalizeCofidRecord(row = {}) {
  const id = row.id || slugId(row.canonicalName || row.name || row.foodName);
  const canonicalName = row.canonicalName || row.name || row.foodName || id.replace(/_/g, ' ');
  let preparationState = row.preparationState || '';
  if (!preparationState) {
    for (const rule of PREP_FROM_NAME) {
      if (rule.re.test(canonicalName)) {
        preparationState = rule.state;
        break;
      }
    }
  }

  const salt100 = row.salt100 != null
    ? row.salt100
    : (row.sodiumMg100 != null ? Math.round(row.sodiumMg100 * 2.5) : 0);

  return {
    id,
    canonicalName,
    dataSource: 'cofid',
    sourceRecordId: String(row.sourceRecordId || row.foodCode || row.code || '').trim(),
    verificationStatus: 'verified',
    nutrition_basis: 'verified_cofid',
    preparationState: preparationState || 'raw',
    lastReviewedAt: row.lastReviewedAt || new Date().toISOString().slice(0, 10),
    kcal100: Math.round(num(row.kcal100 ?? row.kcals ?? row.energyKcal)),
    protein100: round1(num(row.protein100 ?? row.protein ?? row.protcaa)),
    carbs100: round1(num(row.carbs100 ?? row.carbs ?? row.choavl)),
    fat100: round1(num(row.fat100 ?? row.fat)),
    fibre100: round1(num(row.fibre100 ?? row.fibre ?? row.fibtg)),
    sugar100: round1(num(row.sugar100 ?? row.sugars ?? row.sugar)),
    salt100: Math.round(num(salt100)),
  };
}

function round1(v) {
  return Math.round(v * 10) / 10;
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

function headerIndex(headers = [], names = []) {
  const lower = headers.map((h) => String(h || '').toLowerCase().trim());
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse CoFID proximates CSV (official export or cofid2csv output).
 * @param {string} csvText
 * @param {Record<string, string>} [idMap] mealnovaId -> CoFID food code
 */
export function parseCofidProximatesCsv(csvText = '', idMap = {}) {
  const lines = String(csvText).split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headerRow = lines.findIndex((l) => /food code|food_code|code/i.test(l));
  const headers = parseCsvLine(lines[headerRow >= 0 ? headerRow : 0]);
  const dataStart = headerRow >= 0 ? headerRow + 1 : 1;

  const idx = {
    code: headerIndex(headers, ['food code', 'food_code', 'code']),
    name: headerIndex(headers, ['food name', 'food_name', 'name', 'description']),
    kcal: headerIndex(headers, ['kcal', 'kcal100', 'kcal per 100g', 'energy kcal', 'kcal per 100g']),
    protein: headerIndex(headers, ['protein (g)', 'protein', 'protcaa']),
    fat: headerIndex(headers, ['fat (g)', 'fat']),
    carbs: headerIndex(headers, ['carbohydrate (g)', 'carbohydrate', 'choavl', 'carbs']),
    fibre: headerIndex(headers, ['fibre (g)', 'fibre', 'fibtg']),
    sugar: headerIndex(headers, ['sugars (g)', 'sugars', 'sugar']),
    sodium: headerIndex(headers, ['sodium (mg)', 'sodium']),
  };

  const reverseMap = new Map(Object.entries(idMap).map(([mealId, code]) => [String(code).trim(), mealId]));
  const records = [];

  for (let i = dataStart; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const code = idx.code >= 0 ? cols[idx.code] : cols[0];
    if (!code || !/\d/.test(code)) continue;

    const mappedId = reverseMap.get(String(code).trim());
    const name = idx.name >= 0 ? cols[idx.name] : '';
    const row = normalizeCofidRecord({
      id: mappedId || slugId(name),
      canonicalName: name,
      sourceRecordId: code,
      kcal100: idx.kcal >= 0 ? cols[idx.kcal] : 0,
      protein100: idx.protein >= 0 ? cols[idx.protein] : 0,
      fat100: idx.fat >= 0 ? cols[idx.fat] : 0,
      carbs100: idx.carbs >= 0 ? cols[idx.carbs] : 0,
      fibre100: idx.fibre >= 0 ? cols[idx.fibre] : 0,
      sugar100: idx.sugar >= 0 ? cols[idx.sugar] : 0,
      sodiumMg100: idx.sodium >= 0 ? cols[idx.sodium] : 0,
    });
    if (row.kcal100 > 0 || row.protein100 > 0) records.push(row);
  }

  return records;
}
