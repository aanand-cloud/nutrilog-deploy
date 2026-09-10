import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';

const CASES = [
  { phrase: 'tonkotsu ramen', expect: 'Tonkotsu ramen', minKcal: 450 },
  { phrase: 'chicken katsu curry', expect: 'Katsu curry', minKcal: 450 },
  { phrase: 'sushi platter', expect: 'Sushi platter', minKcal: 400 },
  { phrase: 'salmon nigiri and miso soup', expect: 'Salmon nigiri', minKcal: 300 },
  { phrase: 'gyudon', expect: 'Gyudon', minKcal: 400 },
  { phrase: 'teriyaki chicken', expect: 'Teriyaki', minKcal: 350 },
  { phrase: 'chicken katsu', expect: 'Tonkatsu', minKcal: 400 },
  { phrase: 'california roll', expect: 'California roll', minKcal: 250 },
  { phrase: 'karaage', expect: 'Karaage', minKcal: 350 },
  { phrase: 'bento box', expect: 'Bento box', minKcal: 500 },
  { phrase: 'gyoza and edamame', expect: 'Gyoza', minKcal: 400 },
  { phrase: 'japanese curry rice', expect: 'Japanese curry', minKcal: 400 },
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
