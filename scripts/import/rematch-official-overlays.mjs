/**
 * Rematch verified overlays to CoFID 2021 / IFCT 2017 official rows.
 * Run: node scripts/import/rematch-official-overlays.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const verifiedPath = resolve(root, 'data/verified/verified-nutrition.json');
const cofidXml = resolve(root, '.tmp/cofid-2021-xml/xl');
const ifctTable1Path = resolve(root, '.tmp/ifct-table1.json');

const COFID_CODES = {
  apple: '14-319',
  avocado: '14-386',
  bacon: '19-500',
  baked_beans: '13-532',
  baked_potato: '13-491',
  banana: '14-318',
  basmati_rice: '11-858',
  beef: '18-468',
  beef_burger: '19-546',
  beef_doner: '19-539',
  beef_steak: '18-051',
  biryani: '19-454',
  boiled_egg: '12-940',
  boiled_potato: '13-490',
  bolognese: '19-628',
  bread: '11-981',
  broccoli: '13-503',
  brown_bread: '11-971',
  burger: '19-544',
  butter: '17-685',
  carrots: '13-497',
  cauliflower: '13-513',
  cheddar: '12-346',
  cheese: '12-346',
  cheeseburger: '19-545',
  chicken: '18-323',
  chicken_breast: '18-323',
  chicken_burger: '19-315',
  chicken_curry: '19-322',
  chicken_tikka_masala: '19-296',
  chickpeas: '13-662',
  chocolate: '17-648',
  chow_mein: '19-321',
  cod: '16-373',
  coleslaw: '15-635',
  coffee_black: '17-833',
  cooked_rice: '11-862',
  cornflakes: '11-742',
  couscous: '11-902',
  crisps: '17-671',
  cucumber: '13-523',
  dal: '15-758',
  doner_kebab: '19-526',
  edamame: '13-667',
  egg: '12-937',
  falafel: '15-795',
  fish_curry: '16-364',
  fries: '13-486',
  fried_rice: '11-444',
  grapes: '14-350',
  gravy: '17-725',
  greek_yogurt: '12-555',
  honey: '17-050',
  hummus: '13-556',
  ice_cream: '12-508',
  jam: '17-073',
  ketchup: '17-709',
  kofta_kebab: '19-642',
  lamb: '18-131',
  lasagne: '19-481',
  lasagna_spinach: '15-186',
  lentils: '13-658',
  lettuce: '13-520',
  macaroni_bechamel: '11-954',
  marmite: '17-517',
  mashed_potato: '13-553',
  mayonnaise: '17-654',
  minced_beef: '18-470',
  mozzarella: '12-360',
  mushy_peas: '13-563',
  naan: '11-973',
  nuts: '14-880',
  oats: '11-788',
  olive_oil: '17-038',
  onion: '13-499',
  orange: '14-327',
  orange_juice: '14-329',
  omelette: '12-946',
  pancakes: '11-1143',
  paratha: '11-1104',
  pasta: '11-1129',
  peanut_butter: '14-892',
  peas: '13-536',
  pepperoni_pizza: '11-1015',
  pizza: '11-936',
  pizza_funghi: '11-1014',
  pizza_napoli: '11-1011',
  plain_rice: '11-862',
  pork: '18-534',
  porridge: '11-1108',
  porridge_water: '11-1107',
  potatoes: '13-490',
  prawns: '16-384',
  raita: '17-832',
  roast_beef: '18-089',
  roast_chicken: '18-331',
  roti: '11-987',
  salmon: '16-357',
  sambar: '12-467',
  sausage: '19-509',
  sausage_roll: '19-468',
  scrambled_eggs: '12-945',
  semi_skimmed_milk: '12-313',
  shish_kebab: '19-525',
  skimmed_milk: '12-307',
  soy_sauce: '17-721',
  spaghetti: '11-722',
  spinach: '13-550',
  strawberry: '14-324',
  sugar: '17-063',
  sunflower_oil: '17-045',
  sweet_potato: '13-672',
  tea: '17-165',
  toast: '11-1001',
  tomato: '13-517',
  tomato_soup: '17-652',
  tuna: '16-416',
  water: '17-377',
  white_bread: '11-1145',
  white_fish: '16-466',
  white_rice: '11-862',
  whole_milk: '12-596',
  yogurt: '12-379',
};

const DROP_IDS = new Set([
  'chole_bhature',
  'coconut_chutney',
  'dosa',
  'idli',
  'pani_puri',
  'pav_bhaji',
  'poha',
  'uttapam',
  'vegetable_curry',
]);

function round1(v) {
  return Math.round(Number(v) * 10) / 10;
}

function num(v) {
  if (v == null || v === '' || v === 'Tr' || v === 'N') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseSheet(path, strings) {
  const xml = readFileSync(path, 'utf8');
  const rows = [];
  for (const rm of xml.matchAll(/<row r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
    const cells = {};
    for (const cm of rm[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)) {
      const col = cm[1];
      const attrs = cm[3] || '';
      const v = cm[4];
      if (v == null) continue;
      cells[col] = attrs.includes('t="s"') ? strings[Number(v)] : v;
    }
    if (cells.A && cells.A !== 'Food Code' && cells.A !== ' ') rows.push(cells);
  }
  return rows;
}

function loadCofid() {
  const sstXml = readFileSync(resolve(cofidXml, 'sharedStrings.xml'), 'utf8');
  const strings = [];
  for (const m of sstXml.matchAll(/<si>(.*?)<\/si>/gs)) {
    const texts = [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((x) => x[1]);
    strings.push(texts.join(''));
  }
  const prox = parseSheet(resolve(cofidXml, 'worksheets/sheet4.xml'), strings);
  const inorg = parseSheet(resolve(cofidXml, 'worksheets/sheet5.xml'), strings);
  const naByCode = new Map(inorg.map((r) => [String(r.A).trim(), num(r.H)]));
  const byCode = new Map();
  for (const r of prox) {
    const code = String(r.A).trim();
    const na = naByCode.get(code);
    const fibre = num(r.Z);
    const nsp = num(r.Y);
    byCode.set(code, {
      code,
      name: r.B,
      kcal: num(r.M) ?? 0,
      protein: num(r.J) ?? 0,
      fat: num(r.K) ?? 0,
      carbs: num(r.L) ?? 0,
      sugar: num(r.Q),
      fibre: fibre != null ? fibre : nsp,
      salt: na == null ? 0 : Math.round(na * 2.5),
    });
  }
  return byCode;
}

function applyCofid(row, official) {
  const next = {
    ...row,
    canonicalName: official.name,
    dataSource: 'cofid',
    sourceRecordId: official.code,
    verificationStatus: 'verified',
    nutrition_basis: 'verified_cofid',
    lastReviewedAt: '2026-09-14',
    kcal100: Math.round(official.kcal),
    protein100: round1(official.protein),
    carbs100: round1(official.carbs),
    fat100: round1(official.fat),
    fibre100: official.fibre == null ? null : round1(official.fibre),
    salt100: official.salt,
  };
  if (official.sugar != null) next.sugar100 = round1(official.sugar);
  else delete next.sugar100;
  return next;
}

function applyIfct(row, official) {
  return {
    ...row,
    canonicalName: official.name.replace(/\s*\([^)]*\)\s*$/, '').trim() || row.canonicalName,
    lastReviewedAt: '2026-09-14',
    kcal100: official.kcal,
    protein100: official.protein,
    carbs100: official.carb,
    fat100: official.fat,
    fibre100: official.fibre,
  };
}

const catalog = JSON.parse(readFileSync(verifiedPath, 'utf8'));
const cofid = loadCofid();
const ifctTable1 = existsSync(ifctTable1Path)
  ? JSON.parse(readFileSync(ifctTable1Path, 'utf8'))
  : {};

const missing = [];
const dropped = [];
const nextRecords = [];

for (const row of catalog.records || []) {
  if (DROP_IDS.has(row.id)) {
    dropped.push(row.id);
    continue;
  }

  const cofidCode = COFID_CODES[row.id];
  if (cofidCode) {
    const official = cofid.get(cofidCode);
    if (!official) {
      missing.push(`${row.id} missing CoFID ${cofidCode}`);
      continue;
    }
    nextRecords.push(applyCofid(row, official));
    continue;
  }

  if (row.dataSource === 'ifct') {
    const official = ifctTable1[row.sourceRecordId];
    if (row.id === 'paneer' && row.sourceRecordId === 'L003') {
      nextRecords.push({ ...row, lastReviewedAt: '2026-09-14' });
      continue;
    }
    if (!official) {
      missing.push(`${row.id} missing IFCT ${row.sourceRecordId}`);
      dropped.push(row.id);
      continue;
    }
    nextRecords.push(applyIfct(row, official));
    continue;
  }

  nextRecords.push({ ...row, lastReviewedAt: row.lastReviewedAt || '2026-09-14' });
}

nextRecords.sort((a, b) => a.id.localeCompare(b.id));

const next = {
  ...catalog,
  records: nextRecords,
  updated: '2026-09-14',
};
writeFileSync(verifiedPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Wrote ${nextRecords.length} records (dropped ${dropped.join(', ') || 'none'})`);
if (missing.length) {
  console.error('MISSING', missing);
  process.exitCode = 1;
}
