import {
  applyUserNotesToAnalysis,
  enrichAnalysisWithUserNotes,
  deriveClarifyAnswersFromNotes,
  filterClarificationStepsByNotes,
  extractRawUserNotes,
  parseHiddenAdditions,
  parseCookingMethod,
} from '../shared/user-notes-apply.js';
import { normalizeClarificationQuestions } from '../src/services/clarification-questions.js';

function meal(base = {}) {
  return {
    meal_summary: base.summary || 'Rice and dal',
    total_calories_kcal: base.kcal || 520,
    confidence_score: 0.72,
    total_nutrition: { protein_g: 14, carbs_g: 72, fat_g: 12, fibre_g: 6, sugar_g: 3, salt_mg: 600 },
    items: base.items || [
      { name: 'Rice', portion_estimate: '1 serving (~200g)', calories_kcal: 260, nutrition: { protein_g: 5, carbs_g: 56, fat_g: 2, fibre_g: 1, sugar_g: 0, salt_mg: 200 } },
      { name: 'Dal', portion_estimate: '1 bowl (~250g)', calories_kcal: 260, nutrition: { protein_g: 9, carbs_g: 16, fat_g: 10, fibre_g: 5, sugar_g: 2, salt_mg: 400 } },
    ],
    clarification_questions: base.questions || [{ topic: 'oil_fat', question: 'How oily was it?' }],
  };
}

const results = [];

function assert(label, ok, detail = '') {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${detail ? ` — ${detail}` : ''}`);
}

const halfPortion = applyUserNotesToAnalysis(meal(), 'half portion');
assert('Half portion lowers kcal', halfPortion.total_calories_kcal < 520, `${halfPortion.total_calories_kcal} kcal`);

const gheeNote = applyUserNotesToAnalysis(meal(), 'half tbsp ghee on rice');
assert('Half tbsp ghee adds fat item', gheeNote.items.some((i) => /ghee/i.test(i.name)), gheeNote.items.map((i) => i.name).join(', '));
assert('Half tbsp ghee raises kcal', gheeNote.total_calories_kcal > 520, `${gheeNote.total_calories_kcal} kcal`);
assert('Half tbsp ghee is not half portion', gheeNote.total_calories_kcal > 400, `${gheeNote.total_calories_kcal} kcal`);

const enriched = enrichAnalysisWithUserNotes(meal(), 'minimal oil');
assert('Minimal oil auto clarify', deriveClarifyAnswersFromNotes('minimal oil').some((a) => a.topic === 'oil_fat'));
assert('Minimal oil lowers vs baseline when oily', enriched.total_calories_kcal <= 520, `${enriched.total_calories_kcal} kcal`);

const steps = normalizeClarificationQuestions(meal({ questions: [{ topic: 'oil_fat', question: 'How oily?' }] }), 'half tbsp ghee');
assert('Notes skip redundant oil question', !steps.some((s) => s.topic === 'oil_fat'), steps.map((s) => s.topic).join(', '));

const filtered = filterClarificationStepsByNotes(
  [{ topic: 'oil_fat' }, { topic: 'portion_rice' }],
  'minimal oil',
);
assert('Filter drops oil topic from notes', filtered.length === 1 && filtered[0].topic === 'portion_rice');

const raw = extractRawUserNotes('The user photographed food.\nUser notes: chicken biryani half portion');
assert('Extract raw user notes', raw === 'chicken biryani half portion');

const idempotent = enrichAnalysisWithUserNotes(enriched, 'minimal oil');
assert('Enrich is idempotent', idempotent.total_calories_kcal === enriched.total_calories_kcal);

const sugarNote = applyUserNotesToAnalysis(meal(), '1 tsp sugar in tea');
assert('Tsp sugar adds sugar item', sugarNote.items.some((i) => /sugar/i.test(i.name)), sugarNote.items.map((i) => i.name).join(', '));

const cheeseNote = applyUserNotesToAnalysis(meal(), 'extra cheese on pasta');
assert('Extra cheese adds cheese', cheeseNote.items.some((i) => /cheese/i.test(i.name)));

const eggNote = applyUserNotesToAnalysis(meal(), '2 eggs on the side');
assert('Two eggs adds egg line', eggNote.items.some((i) => /egg/i.test(i.name)));

const chutneyParsed = parseHiddenAdditions('with mint chutney');
assert('With chutney parsed', chutneyParsed.some((i) => /mint chutney/i.test(i.name)));

const coconutChutney = parseHiddenAdditions('with coconut chutney')[0];
assert(
  'Coconut chutney uses coconut profile',
  coconutChutney && /coconut chutney/i.test(coconutChutney.name) && coconutChutney.calories_kcal > 15,
  coconutChutney?.name,
);

const tomatoChutney = parseHiddenAdditions('side of thakkali chutney')[0];
assert(
  'Thakkali chutney maps to tomato chutney',
  tomatoChutney && /tomato chutney/i.test(tomatoChutney.name),
  tomatoChutney?.name,
);

const gonguraChutney = parseHiddenAdditions('with gongura pachadi')[0];
assert(
  'Gongura pachadi maps to gongura chutney',
  gonguraChutney && /gongura chutney/i.test(gonguraChutney.name),
  gonguraChutney?.name,
);

const kaaraChutney = parseHiddenAdditions('extra kaara chutney')[0];
assert(
  'Kaara chutney matched',
  kaaraChutney && /kaara chutney/i.test(kaaraChutney.name),
  kaaraChutney?.name,
);

const imliChutney = parseHiddenAdditions('with imli chutney')[0];
assert(
  'Imli chutney maps to tamarind chutney',
  imliChutney && /tamarind chutney/i.test(imliChutney.name),
  imliChutney?.name,
);

const ulliChammanthi = parseHiddenAdditions('with ulli chammanthi')[0];
assert(
  'Ulli chammanthi maps to onion chutney',
  ulliChammanthi && /onion chutney/i.test(ulliChammanthi.name),
  ulliChammanthi?.name,
);

const dosaPlate = {
  total_calories_kcal: 405,
  total_nutrition: { protein_g: 10, carbs_g: 40, fat_g: 12 },
  items: [
    { name: 'Masala dosa', portion_estimate: '1 piece (~220g)', calories_kcal: 350, nutrition: {} },
    { name: 'Coconut chutney', portion_estimate: 'side (~30g)', calories_kcal: 55, nutrition: {} },
  ],
};

const correctedChutney = applyUserNotesToAnalysis(dosaPlate, 'onion chutney');
const chutneyItems = correctedChutney.items.filter((i) => /chutney/i.test(i.name));
assert(
  'Onion chutney note replaces AI coconut chutney',
  chutneyItems.length === 1 && /onion chutney/i.test(chutneyItems[0].name),
  chutneyItems.map((i) => i.name).join(', '),
);

const correctedUlli = applyUserNotesToAnalysis(dosaPlate, 'ulli chammanthi');
assert(
  'Ulli chammanthi note replaces coconut chutney',
  correctedUlli.items.some((i) => /onion chutney/i.test(i.name))
    && !correctedUlli.items.some((i) => /coconut chutney/i.test(i.name)),
  correctedUlli.items.map((i) => i.name).join(', '),
);

const brinjalGosthu = parseHiddenAdditions('side of brinjal gosthu')[0];
assert(
  'Brinjal gosthu side parsed with side portion',
  brinjalGosthu && /brinjal gosthu/i.test(brinjalGosthu.name) && brinjalGosthu.grams >= 90,
  brinjalGosthu ? `${brinjalGosthu.name}, ${brinjalGosthu.grams}g` : 'missing',
);

const onionRaita = parseHiddenAdditions('with onion raita')[0];
assert(
  'Onion raita matched specifically',
  onionRaita && /onion raita/i.test(onionRaita.name) && onionRaita.calories_kcal > 40,
  onionRaita?.name,
);

const breadHalwa = parseHiddenAdditions('extra bread halwa')[0];
assert(
  'Bread halwa side parsed',
  breadHalwa && /bread halwa/i.test(breadHalwa.name) && breadHalwa.grams >= 100,
  breadHalwa?.name,
);

const mirchiSalan = parseHiddenAdditions('with mirchi ka salan')[0];
assert(
  'Mirchi ka salan matched',
  mirchiSalan && /mirchi ka salan/i.test(mirchiSalan.name),
  mirchiSalan?.name,
);

const salnaSide = parseHiddenAdditions('with chicken salna')[0];
assert(
  'Chicken salna side parsed',
  salnaSide && /salna/i.test(salnaSide.name) && salnaSide.grams >= 100,
  salnaSide ? `${salnaSide.name}, ${salnaSide.grams}g` : 'missing',
);

const rotiDal = parseHiddenAdditions('roti with dal tadka')[0];
assert(
  'Roti with dal side parsed',
  rotiDal && /dal/i.test(rotiDal.name),
  rotiDal?.name,
);

const muttonSukka = parseHiddenAdditions('side of mutton sukka')[0];
assert(
  'Mutton sukka starter parsed',
  muttonSukka && /mutton sukka/i.test(muttonSukka.name) && muttonSukka.calories_kcal > 300,
  muttonSukka ? `${muttonSukka.name}, ${muttonSukka.calories_kcal} kcal` : 'missing',
);

const gobiManchurian = parseHiddenAdditions('with gobi manchurian')[0];
assert(
  'Gobi manchurian matched',
  gobiManchurian && /gobi manchurian/i.test(gobiManchurian.name),
  gobiManchurian?.name,
);

const chickenLollipop = parseHiddenAdditions('extra chicken lollipop')[0];
assert(
  'Chicken lollipop matched',
  chickenLollipop && /chicken lollipop/i.test(chickenLollipop.name),
  chickenLollipop?.name,
);

const mayoNote = applyUserNotesToAnalysis(meal(), '1 tbsp mayo on sandwich');
assert('Tbsp mayo adds mayo', mayoNote.items.some((i) => /mayo/i.test(i.name)));

const nutsNote = applyUserNotesToAnalysis(meal(), 'handful of almonds');
assert('Handful of nuts adds nuts', nutsNote.items.some((i) => /nuts|almond/i.test(i.name)));

const cheeseClarify = deriveClarifyAnswersFromNotes('extra cheese');
assert('Extra cheese skips cheese clarify', cheeseClarify.some((a) => a.topic === 'cheese_cream'));

const halfTspOil = parseHiddenAdditions('1/2 tsp oil')[0];
assert(
  '1/2 tsp oil is 2.5 ml not 2 tsp',
  halfTspOil && /2\.5\s*ml/i.test(halfTspOil.portion_estimate) && halfTspOil.grams < 3,
  halfTspOil ? `${halfTspOil.portion_estimate}, ${halfTspOil.grams}g, ${halfTspOil.calories_kcal} kcal` : 'missing',
);

const halfTspWord = parseHiddenAdditions('half tsp oil')[0];
assert(
  'half tsp oil matches 1/2 tsp volume',
  halfTspWord && Math.abs(halfTspWord.volumeMl - 2.5) < 0.1,
  halfTspWord?.portion_estimate,
);

const mlOil = parseHiddenAdditions('2.5 ml oil')[0];
assert(
  '2.5 ml oil converts to grams',
  mlOil && Math.abs(mlOil.volumeMl - 2.5) < 0.1 && mlOil.grams > 2 && mlOil.grams < 2.5,
  mlOil ? `${mlOil.portion_estimate}, ${mlOil.grams}g` : 'missing',
);

const airFried = enrichAnalysisWithUserNotes(meal({
  kcal: 520,
  items: [{ name: 'Chicken wings', portion_estimate: '6 pieces (~180g)', calories_kcal: 520, nutrition: { protein_g: 38, carbs_g: 4, fat_g: 36 } }],
}), 'air fried');
assert('Air fried lowers vs baseline', airFried.total_calories_kcal < 520, `${airFried.total_calories_kcal} kcal`);
assert('Air fried sets cooking clarify', deriveClarifyAnswersFromNotes('air fried').some((a) => a.topic === 'cooking_method'));

const deepFried = enrichAnalysisWithUserNotes(meal({
  kcal: 400,
  items: [{ name: 'Samosa', portion_estimate: '2 pieces (~160g)', calories_kcal: 400, nutrition: { protein_g: 8, carbs_g: 44, fat_g: 20 } }],
}), 'deep fried');
assert('Deep fried raises kcal', deepFried.total_calories_kcal > 400, `${deepFried.total_calories_kcal} kcal`);
assert('Deep fried skips oil_fat question', filterClarificationStepsByNotes(
  [{ topic: 'oil_fat' }, { topic: 'cooking_method' }],
  'deep fried',
).every((s) => s.topic !== 'oil_fat' && s.topic !== 'cooking_method'));

const ovenBaked = parseCookingMethod('oven baked salmon');
assert('Oven baked parsed', ovenBaked?.id === 'oven', ovenBaked?.chip);

const idliesNotes = deriveClarifyAnswersFromNotes('4 idlies with sambar for breakfast');
assert('Idlies note applies bread count', idliesNotes.some((a) => a.topic === 'bread_count' && /4/.test(a.answer)), JSON.stringify(idliesNotes));
const idliStepsFromNotes = normalizeClarificationQuestions(meal({
  summary: 'Idli with sambar',
  items: [
    { name: 'Idli', portion_estimate: '1 piece (~60g)', calories_kcal: 40, nutrition: { protein_g: 1, carbs_g: 8, fat_g: 0.2 } },
    { name: 'Sambar', portion_estimate: '1 bowl (~150g)', calories_kcal: 90, nutrition: { protein_g: 4, carbs_g: 12, fat_g: 3 } },
  ],
  questions: [{ topic: 'bread_count', question: 'How many pieces of roti/naan?' }],
}), '4 idlies with sambar for breakfast');
assert('Idlies note skips roti/naan question', !idliStepsFromNotes.some((s) => s.topic === 'bread_count'), idliStepsFromNotes.map((s) => s.topic).join(', '));

const countedIdliMeal = enrichAnalysisWithUserNotes(meal({
  kcal: 130,
  items: [
    { name: 'Idli', portion_estimate: '1 piece (~60g)', calories_kcal: 40, nutrition: { protein_g: 1, carbs_g: 8, fat_g: 0.2 } },
    { name: 'Sambar', portion_estimate: '1 bowl (~150g)', calories_kcal: 90, nutrition: { protein_g: 4, carbs_g: 12, fat_g: 3 } },
  ],
}), '4 idlies with sambar for breakfast');
assert(
  'Idlies note scales to 4 pieces',
  /4 pieces/i.test(countedIdliMeal.items.find((i) => /idli/i.test(i.name))?.portion_estimate || ''),
  countedIdliMeal.items.map((i) => `${i.name} ${i.portion_estimate}`).join(' | '),
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
