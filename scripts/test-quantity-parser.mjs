import {
  splitMealPhrases,
  parseQuantityFromText,
  parseMealDescription,
  phraseHasExplicitQuantity,
} from '../shared/quantity-parser.js';

function assert(label, condition, detail = '') {
  if (!condition) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const meal = parseMealDescription('2 chapatis, 200g dal and 150g vegetable curry');
assert('compound meal splits into 3 phrases', meal.length === 3, `${meal.length} phrases`);

const chapati = meal.find((m) => /chapati/i.test(m.phrase));
assert('chapati count parsed', chapati?.quantity === 2 && chapati?.unit === 'piece', JSON.stringify(chapati));

const dal = meal.find((m) => /dal/i.test(m.phrase));
assert('dal grams parsed', dal?.quantity === 200 && dal?.unit === 'g', JSON.stringify(dal));

const curry = meal.find((m) => /curry/i.test(m.phrase));
assert('curry grams parsed', curry?.quantity === 150 && curry?.unit === 'g', JSON.stringify(curry));

const largeEggs = parseQuantityFromText('2 large boiled eggs');
assert('large egg size modifier', largeEggs.size === 'large' && largeEggs.quantity === 2, JSON.stringify(largeEggs));

const halfCup = parseQuantityFromText('half cup cooked rice');
assert('word fraction quantity', halfCup.quantity === 120 && halfCup.unit === 'g', JSON.stringify(halfCup));

const phrases = splitMealPhrases('masala dosa + 150g potato masala + 100ml sambar');
assert('plus-separated phrases', phrases.length === 3, phrases.join(' | '));

const explicit = parseQuantityFromText('250g chips');
assert('explicit grams flagged', phraseHasExplicitQuantity(explicit), JSON.stringify(explicit));

const vague = parseQuantityFromText('some rice');
assert('vague serving not explicit', !phraseHasExplicitQuantity(vague), JSON.stringify(vague));

const jacketBeans = splitMealPhrases('jacket potato with baked beans');
assert('jacket potato splits from baked beans', jacketBeans.length === 2, jacketBeans.join(' | '));

const palakRoti = splitMealPhrases('palak paneer with 2 roti');
assert('palak paneer splits from counted roti', palakRoti.length === 2, palakRoti.join(' | '));

const doroInjera = splitMealPhrases('doro wat with injera');
assert('doro wat splits from injera', doroInjera.length === 2, doroInjera.join(' | '));

const dosaMeatCurry = splitMealPhrases('2 dosa with meat curry');
assert('dosa splits from unrelated meat curry', dosaMeatCurry.length === 2, dosaMeatCurry.join(' | '));

console.log('\nDone.');
