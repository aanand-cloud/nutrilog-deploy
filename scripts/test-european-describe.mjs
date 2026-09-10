import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';

const CASES = [
  { phrase: 'spaghetti carbonara', expect: 'carbonara', minKcal: 400 },
  { phrase: 'margherita pizza', expect: 'margherita', minKcal: 400 },
  { phrase: 'beef bourguignon', expect: 'bourguignon', minKcal: 400 },
  { phrase: 'seafood paella', expect: 'paella', minKcal: 400 },
  { phrase: 'wiener schnitzel', expect: 'schnitzel', minKcal: 400 },
  { phrase: 'greek salad and souvlaki', expect: 'greek salad', minKcal: 600 },
  { phrase: 'tapas platter', expect: 'tapas', minKcal: 400 },
  { phrase: 'croque monsieur', expect: 'croque', minKcal: 350 },
  { phrase: 'lasagne', expect: 'lasagne', minKcal: 400 },
  { phrase: 'goulash', expect: 'goulash', minKcal: 350 },
  { phrase: 'tiramisu', expect: 'tiramisu', minKcal: 250 },
  { phrase: 'spaghetti bolognese', expect: 'bolognese', minKcal: 400 },
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
