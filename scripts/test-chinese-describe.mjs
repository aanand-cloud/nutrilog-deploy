import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';

const CASES = [
  { phrase: 'chicken chow mein', expect: 'Chicken chow mein', minKcal: 400 },
  { phrase: 'sweet and sour chicken', expect: 'Sweet and sour chicken', minKcal: 400 },
  { phrase: 'dim sum platter', expect: 'Dim sum platter', minKcal: 350 },
  { phrase: 'peking duck with pancakes', expect: 'Peking duck', minKcal: 450 },
  { phrase: 'kung pao chicken', expect: 'Kung pao chicken', minKcal: 350 },
  { phrase: 'egg fried rice', expect: 'Egg fried rice', minKcal: 350 },
  { phrase: 'singapore noodles', expect: 'Singapore noodles', minKcal: 350 },
  { phrase: 'mapo tofu', expect: 'Mapo tofu', minKcal: 250 },
  { phrase: 'hot and sour soup', expect: 'Hot and sour soup', minKcal: 80 },
  { phrase: 'prawn chow mein and spring roll', expect: 'Prawn chow mein', minKcal: 600 },
  { phrase: 'chinese takeaway', expect: 'Chinese takeaway', minKcal: 400 },
  { phrase: 'general tso chicken', expect: 'General Tso chicken', minKcal: 450 },
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
