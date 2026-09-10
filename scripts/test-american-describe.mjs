import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';

function summaryMatches(summary = '', expect = '') {
  const s = summary.toLowerCase();
  const e = expect.toLowerCase();
  if (s.includes(e)) return true;
  return e.split(/\s+and\s+|\s+with\s+/).every((part) => {
    const p = part.trim();
    if (!p) return true;
    if (s.includes(p)) return true;
    if (p.endsWith('s') && s.includes(p.slice(0, -1))) return true;
    return false;
  });
}

const CASES = [
  { phrase: 'cheeseburger and fries', expect: 'Burger and fries', minKcal: 650 },
  { phrase: 'chicken and waffles', expect: 'Chicken and waffles', minKcal: 550 },
  { phrase: 'mac and cheese', expect: 'Mac and cheese', minKcal: 400 },
  { phrase: 'buffalo wings', expect: 'Buffalo wings', minKcal: 450 },
  { phrase: 'philly cheesesteak', expect: 'Philly cheesesteak', minKcal: 500 },
  { phrase: 'meatloaf and mashed potatoes', expect: 'Meatloaf and mashed potatoes', minKcal: 500 },
  { phrase: 'biscuits and gravy', expect: 'Biscuits and gravy', minKcal: 450 },
  { phrase: 'eggs benedict', expect: 'Eggs Benedict', minKcal: 450 },
  { phrase: 'pancakes and bacon', expect: 'Pancakes and bacon', minKcal: 550 },
  { phrase: 'clam chowder', expect: 'Clam chowder', minKcal: 280 },
  { phrase: 'jambalaya', expect: 'Jambalaya', minKcal: 450 },
  { phrase: 'cobb salad', expect: 'Cobb salad', minKcal: 350 },
  { phrase: 'bbq ribs', expect: 'BBQ ribs', minKcal: 500 },
  { phrase: 'grilled cheese', expect: 'Grilled cheese', minKcal: 380 },
  { phrase: 'chocolate chip cookie', expect: 'Chocolate chip cookie', minKcal: 200 },
];

let pass = 0;
let fail = 0;

for (const { phrase, expect, minKcal } of CASES) {
  const out = estimateMealFromDescription(phrase);
  const summary = out?.meal_summary || '';
  const kcal = out?.total_calories_kcal || 0;
  const okSummary = summaryMatches(summary, expect);
  const okKcal = kcal >= minKcal;
  const ok = okSummary && okKcal;
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | "${phrase}" → ${summary} (${kcal} kcal)${ok ? '' : ` [want "${expect}", min ${minKcal}]`}`);
}

console.log(`\n${pass}/${CASES.length} passed`);
process.exit(fail ? 1 : 0);
