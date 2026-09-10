import { estimateMealFromDescription } from '../src/services/voice-quick-log.js';
import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { splitMealPhrases, parseQuantityFromText, phraseHasExplicitQuantity } from '../shared/quantity-parser.js';
import { readFileSync } from 'node:fs';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

function blob(items = []) {
  return items.map((i) => `${i.name} ${i.portion_estimate}`).join(' ').toLowerCase();
}

const voice = estimateMealFromDescription('180g battered cod, 250g chips');
assert('voice path uses unified pipeline', voice?._pipelineResolved === true);
assert('voice path has per100 anchors', voice?.items?.every((i) => i._per100 || i._unmatched));
assert('no pattern lump flags', !voice?.items?.some((i) => i._voiceKcalLocked));

const cases = JSON.parse(readFileSync('./scripts/benchmark/cases-core.json', 'utf8')).cases;
let explicit = 0;
let retained = 0;
for (const tc of cases) {
  const result = resolveMealFromText(tc.input);
  for (const phrase of splitMealPhrases(tc.input)) {
    const q = parseQuantityFromText(phrase);
    if (!phraseHasExplicitQuantity(q)) continue;
    explicit += 1;
    const text = blob(result?.items || []);
    const food = String(q.foodText || phrase).toLowerCase();
    const ok = (q.unit === 'g' && text.includes(`${Math.round(q.quantity)}g`))
      || (q.unit === 'ml' && text.includes(`${Math.round(q.quantity)}ml`))
      || (q.unit === 'piece' && new RegExp(`${Math.round(q.quantity)}\\s*piece`, 'i').test(text))
      || text.includes(food.slice(0, 8));
    if (ok) retained += 1;
  }
}
assert('quantity retention ≥99%', explicit > 0 && retained / explicit >= 0.99, `${retained}/${explicit}`);

console.log('\nDone.');
