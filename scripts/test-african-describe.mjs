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
  { phrase: 'jollof rice and chicken', expect: 'Jollof rice and chicken', minKcal: 500 },
  { phrase: 'party jollof', expect: 'Party jollof', minKcal: 450 },
  { phrase: 'egusi and pounded yam', expect: 'Egusi', minKcal: 500 },
  { phrase: 'pepper soup', expect: 'Pepper soup', minKcal: 250 },
  { phrase: 'suya and plantain', expect: 'Suya and plantain', minKcal: 450 },
  { phrase: 'moi moi and akara', expect: 'Moi moi and akara', minKcal: 400 },
  { phrase: 'rice and stew', expect: 'Rice and stew', minKcal: 450 },
  { phrase: 'ofada rice', expect: 'Ofada rice', minKcal: 450 },
  { phrase: 'amala and ewedu', expect: 'Amala and ewedu', minKcal: 300 },
  { phrase: 'abacha', expect: 'Abacha', minKcal: 300 },
  { phrase: 'waakye', expect: 'Waakye', minKcal: 450 },
  { phrase: 'banku and tilapia', expect: 'Banku and tilapia', minKcal: 400 },
  { phrase: 'nyama choma and ugali', expect: 'Nyama choma and ugali', minKcal: 400 },
  { phrase: 'doro wat with injera', expect: 'Doro wat', minKcal: 500 },
  { phrase: 'beef suya', expect: 'Suya', minKcal: 300 },
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
