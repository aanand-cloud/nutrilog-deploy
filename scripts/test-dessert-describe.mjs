import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';

const CASES = [
  { phrase: 'gulab jamun', expect: 'Gulab jamun', minKcal: 200 },
  { phrase: 'jalebi', expect: 'Jalebi', minKcal: 280 },
  { phrase: 'rasmalai', expect: 'Rasmalai', minKcal: 180 },
  { phrase: 'kulfi', expect: 'Kulfi', minKcal: 140 },
  { phrase: 'kheer', expect: 'Kheer', minKcal: 180 },
  { phrase: 'gajar halwa', expect: 'Carrot halwa', minKcal: 250 },
  { phrase: 'falooda', expect: 'Falooda', minKcal: 320 },
  { phrase: 'sticky toffee pudding', expect: 'Sticky toffee pudding', minKcal: 350 },
  { phrase: 'banoffee pie', expect: 'Banoffee pie', minKcal: 320 },
  { phrase: 'eton mess', expect: 'Eton mess', minKcal: 220 },
  { phrase: 'cheesecake slice', expect: 'Cheesecake', minKcal: 350 },
  { phrase: 'ice cream sundae', expect: 'Ice cream sundae', minKcal: 350 },
  { phrase: 'lava cake', expect: 'Lava cake', minKcal: 350 },
  { phrase: 'mooncake', expect: 'Mooncake', minKcal: 250 },
  { phrase: 'egg tart', expect: 'Egg tart', minKcal: 140 },
  { phrase: 'baklava', expect: 'Baklava', minKcal: 250 },
  { phrase: 'kunefe', expect: 'Kunefe', minKcal: 350 },
  { phrase: 'turkish delight', expect: 'Turkish delight', minKcal: 90 },
  { phrase: 'crème brûlée', expect: 'Creme Brulee', minKcal: 280 },
  { phrase: 'chocolate cake slice', expect: 'Chocolate cake', minKcal: 300 },
  { phrase: 'mochi', expect: 'Mochi', minKcal: 130 },
  { phrase: 'tiramisu', expect: 'Tiramisu', minKcal: 250 },
];

let pass = 0;
let fail = 0;

for (const { phrase, expect, minKcal } of CASES) {
  const out = estimateMealFromDescription(phrase);
  const summary = out?.meal_summary || '';
  const kcal = out?.total_calories_kcal || 0;
  const okSummary = summary.toLowerCase().includes(expect.toLowerCase());
  const okKcal = kcal >= minKcal;
  const ok = okSummary && okKcal;
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | "${phrase}" → ${summary} (${kcal} kcal)${ok ? '' : ` [want "${expect}", min ${minKcal}]`}`);
}

console.log(`\n${pass}/${CASES.length} passed`);
process.exit(fail ? 1 : 0);
