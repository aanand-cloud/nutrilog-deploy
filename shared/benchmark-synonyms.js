/**
 * Token synonyms for benchmark mustInclude checks — reusable, not meal-specific hardcoding.
 * Extend this map when adding new cuisine tokens; do not add one-off meal fixes in runners.
 */
export const BENCHMARK_SYNONYMS = {
  chip: ['chip', 'fries', 'chips'],
  pea: ['pea', 'peas'],
  peanut: ['peanut', 'peanuts', 'nuts'],
  oat: ['oat', 'oats', 'porridge'],
  toast: ['toast', 'bread', 'slice'],
  sabzi: ['sabzi', 'vegetable', 'curry'],
  bhatur: ['bhatur', 'bhature', 'chole bhature'],
  chana: ['chana', 'chole', 'chana_masala'],
  chole: ['chole', 'chana'],
  cod: ['cod', 'fish', 'battered', 'white_fish'],
  kurma: ['kurma', 'korma', 'veg_kurma'],
  roti: ['roti', 'chapati', 'chapatis'],
  chapati: ['chapati', 'roti'],
  mash: ['mash', 'potato', 'potatoes', 'mushy'],
  sausage: ['sausage', 'bangers', 'sausages'],
  pav: ['pav', 'bread'],
  bhaji: ['bhaji', 'vegetable'],
  tikka: ['tikka', 'masala', 'chicken'],
  egg: ['egg', 'eggs'],
  bean: ['bean', 'beans', 'black', 'baked'],
  chicken: ['chicken', 'breast', 'biryani', 'roast', 'thigh'],
  potato: ['potato', 'potatoes', 'jacket'],
  curry: ['curry', 'madras', 'butter', 'tikka', 'masala'],
  rice: ['rice', 'basmati', 'cooked', 'steamed'],
  lamb: ['lamb', 'minced'],
  dal: ['dal', 'makhani', 'tadka'],
  naan: ['naan', 'bread'],
  paneer: ['paneer', 'palak'],
  biryani: ['biryani'],
  raita: ['raita', 'cucumber'],
  poha: ['poha'],
  dosa: ['dosa'],
  sambar: ['sambar'],
  chutney: ['chutney', 'coconut'],
  uttapam: ['uttapam'],
  idli: ['idli', 'idlis', 'idly'],
  milk: ['milk'],
  butter: ['butter'],
  yogurt: ['yogurt', 'curd', 'greek'],
  banana: ['banana'],
  fries: ['fries', 'chips'],
  fish: ['fish', 'cod', 'battered'],
  baked: ['baked', 'beans'],
  edamame: ['edamame'],
  salmon: ['salmon'],
  tuna: ['tuna'],
  bread: ['bread', 'slice', 'pieces'],
  pasta: ['pasta'],
  pizza: ['pizza'],
  burger: ['burger'],
  bacon: ['bacon'],
  cheese: ['cheese'],
  apple: ['apple'],
  grape: ['grape', 'grapes'],
  hummus: ['hummus'],
  tofu: ['tofu'],
  almond: ['almond', 'almonds'],
  cashew: ['cashew', 'cashews', 'nuts'],
  english: ['english', 'breakfast', 'egg', 'sausage', 'bean', 'bacon'],
  porridge: ['porridge', 'oat', 'oats'],
};

export function mustIncludeMatch(text, token, synonyms = BENCHMARK_SYNONYMS) {
  const alts = synonyms[token.toLowerCase()] || [token];
  return alts.some((t) => text.includes(String(t).toLowerCase()));
}

export function itemBlob(items = []) {
  return items.map((i) => `${i.name || ''} ${i._refId || ''} ${i.portion_estimate || ''}`).join(' ').toLowerCase();
}

export function findItemByRef(items = [], refId = '') {
  return items.find((i) => i._refId === refId || i._per100?.refId === refId);
}

export function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

export function withinTolerance(actual, expected, tolerancePct = 20) {
  if (!Number.isFinite(expected) || expected <= 0) return true;
  const delta = Math.abs(actual - expected) / expected;
  return delta <= tolerancePct / 100;
}

export function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
