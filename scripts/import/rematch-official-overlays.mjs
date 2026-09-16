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
  apple_juice: '14-331',
  avocado: '14-386',
  bacon: '19-500',
  bagel: '11-970',
  baked_beans: '13-532',
  baked_potato: '13-491',
  banana: '14-318',
  banana_bread: '11-1029',
  basmati_rice: '11-858',
  beef: '18-468',
  beef_burger: '19-546',
  beef_doner: '19-539',
  beef_steak: '18-051',
  biryani: '19-454',
  blt: '11-955',
  boiled_egg: '12-940',
  boiled_potato: '13-490',
  bolognese: '19-628',
  bombay_mix: '17-764',
  bread: '11-981',
  broccoli: '13-503',
  brown_bread: '11-971',
  brownie: '11-1127',
  brussels_sprouts: '13-630',
  burger: '19-544',
  butter: '17-685',
  carrots: '13-497',
  cauliflower: '13-513',
  cheddar: '12-346',
  cheese: '12-346',
  cheeseburger: '19-545',
  cheesecake: '12-562',
  chevda: '17-782',
  chicken: '18-323',
  chicken_breast: '18-323',
  chicken_burger: '19-315',
  chicken_curry: '19-322',
  chicken_fajita: '19-464',
  chicken_korma: '19-565',
  chicken_risotto: '19-566',
  chicken_soup: '17-695',
  chicken_tikka_masala: '19-296',
  chickpeas: '13-662',
  chilli_con_carne: '19-478',
  chocolate: '17-648',
  chow_mein: '19-321',
  cod: '16-373',
  coleslaw: '15-635',
  coffee_black: '17-833',
  cooked_rice: '11-862',
  cornflakes: '11-742',
  cottage_pie: '19-575',
  couscous: '11-902',
  crisps: '17-671',
  croissant: '11-988',
  cucumber: '13-523',
  custard: '12-543',
  dal: '15-758',
  doner_kebab: '19-526',
  doughnut: '11-850',
  edamame: '13-667',
  egg: '12-937',
  falafel: '15-795',
  fish_curry: '16-364',
  fish_fingers: '16-405',
  fried_egg: '12-944',
  fries: '13-486',
  fried_rice: '11-444',
  flatbread: '11-974',
  garlic_bread: '11-937',
  grapes: '14-350',
  gravy: '17-725',
  greek_yogurt: '12-555',
  gulab_jamun: '11-1083',
  honey: '17-050',
  hummus: '13-556',
  ice_cream: '12-508',
  jam: '17-073',
  ketchup: '17-709',
  kofta_kebab: '19-642',
  lamb: '18-131',
  lamb_chops: '18-477',
  lamb_curry: '19-595',
  lasagne: '19-481',
  lasagna_spinach: '15-186',
  lassi: '12-373',
  lentils: '13-658',
  lettuce: '13-520',
  macaroni_bechamel: '11-954',
  mango_chutney: '17-343',
  marmite: '17-517',
  mashed_potato: '13-553',
  mayonnaise: '17-654',
  meat_samosa: '19-326',
  minced_beef: '18-470',
  mozzarella: '12-360',
  muesli: '11-780',
  muffin: '11-738',
  mushy_peas: '13-563',
  naan: '11-973',
  nuts: '14-880',
  oats: '11-788',
  olive_oil: '17-038',
  onion: '13-499',
  onion_bhaji: '15-828',
  orange: '14-327',
  orange_juice: '14-329',
  omelette: '12-946',
  pakora: '15-620',
  pancakes: '11-1143',
  paratha: '11-1104',
  parmesan: '12-526',
  pasta: '11-1129',
  peanut_butter: '14-892',
  peas: '13-536',
  pepperoni_pizza: '11-1015',
  peshwari_naan: '11-910',
  pizza: '11-936',
  pizza_funghi: '11-1014',
  pizza_napoli: '11-1011',
  plain_rice: '11-862',
  poppadoms: '11-998',
  pork: '18-534',
  pork_chop: '18-535',
  porridge: '11-1108',
  porridge_water: '11-1107',
  potato_pakora: '15-831',
  potatoes: '13-490',
  prawns: '16-384',
  puri: '11-911',
  quiche: '12-936',
  raita: '17-832',
  roast_beef: '18-089',
  roast_chicken: '18-331',
  roti: '11-987',
  salmon: '16-357',
  sambar: '12-467',
  samosa: '15-305',
  sausage: '19-509',
  sausage_roll: '19-468',
  scrambled_eggs: '12-945',
  semi_skimmed_milk: '12-313',
  sev: '17-836',
  shepherds_pie: '19-626',
  shish_kebab: '19-525',
  skimmed_milk: '12-307',
  smoothie: '17-747',
  soy_sauce: '17-721',
  spaghetti: '11-722',
  spinach: '13-550',
  spinach_pakora: '15-832',
  spring_roll: '19-327',
  strawberry: '14-324',
  stuffing: '11-1000',
  sugar: '17-063',
  sunflower_oil: '17-045',
  sushi: '16-361',
  sweet_and_sour_chicken: '19-324',
  sweet_potato: '13-672',
  tea: '17-165',
  thai_green_curry: '19-465',
  toast: '11-1001',
  tomato: '13-517',
  tomato_soup: '17-652',
  tuna: '16-416',
  tuna_mayo_sandwich: '11-967',
  veg_curry: '15-619',
  waffle: '11-1130',
  water: '17-377',
  white_bread: '11-1145',
  white_fish: '16-466',
  white_rice: '11-862',
  whole_milk: '12-596',
  yogurt: '12-379',
  yorkshire_pudding: '11-960',
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
