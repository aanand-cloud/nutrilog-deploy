import { applyClarificationsLocally, previewClarificationImpact } from '../shared/clarification-apply.js';
import { normalizeClarificationQuestions, getClarificationStepConfig } from '../src/services/clarification-questions.js';

function meal(base = {}) {
  return {
    meal_summary: base.summary || 'Chicken curry with rice',
    total_calories_kcal: base.kcal || 520,
    confidence_score: 0.72,
    total_nutrition: { protein_g: 28, carbs_g: 55, fat_g: 18, fibre_g: 4, sugar_g: 3, salt_mg: 800 },
    items: base.items || [
      { name: 'Chicken curry', portion_estimate: '1 serving (~250g)', calories_kcal: 320, nutrition: { protein_g: 22, carbs_g: 12, fat_g: 16, fibre_g: 2, sugar_g: 2, salt_mg: 500 } },
      { name: 'Rice', portion_estimate: '1 serving (~180g)', calories_kcal: 200, nutrition: { protein_g: 4, carbs_g: 43, fat_g: 2, fibre_g: 1, sugar_g: 0, salt_mg: 300 } },
    ],
    clarification_questions: base.questions || [],
    ...(base.extra || {}),
  };
}

const results = [];

function run(label, analysis, answers, expect = {}) {
  const out = applyClarificationsLocally(analysis, answers);
  const delta = out.total_calories_kcal - analysis.total_calories_kcal;
  const row = {
    label,
    before: analysis.total_calories_kcal,
    after: out.total_calories_kcal,
    delta,
    items: out.items.map((i) => `${i.name}: ${i.portion_estimate} (${i.calories_kcal} kcal)`),
    pass: true,
    notes: [],
  };

  if (expect.minAfter && out.total_calories_kcal < expect.minAfter) {
    row.pass = false;
    row.notes.push(`expected min ${expect.minAfter} kcal`);
  }
  if (expect.maxAfter && out.total_calories_kcal > expect.maxAfter) {
    row.pass = false;
    row.notes.push(`expected max ${expect.maxAfter} kcal`);
  }
  if (expect.mustInclude && !row.items.join(' ').toLowerCase().includes(expect.mustInclude.toLowerCase())) {
    row.pass = false;
    row.notes.push(`missing "${expect.mustInclude}" in items`);
  }
  if (expect.direction === 'up' && delta <= 0) {
    row.pass = false;
    row.notes.push('expected calories to increase');
  }
  if (expect.direction === 'down' && delta >= 0) {
    row.pass = false;
    row.notes.push('expected calories to decrease');
  }

  results.push(row);
  return out;
}

run('Rice chip: Large plate 300g', meal(), [{ topic: 'portion_rice', answer: 'Large plate (~300 g)' }], { direction: 'up', minAfter: 600 });
run('Side rice 100g labels items', meal(), [{ topic: 'portion_rice', answer: 'Side rice (~100 g)' }], { mustInclude: '100g' });

const sideRiceOut = applyClarificationsLocally(meal(), [{ topic: 'portion_rice', answer: 'Side rice (~100 g)' }]);
const riceItem = sideRiceOut.items.find((i) => /\brice\b/i.test(i.name));
const curryItem = sideRiceOut.items.find((i) => /\bcurry\b/i.test(i.name));
results.push({
  label: 'Side rice hint on rice + unchanged curry',
  pass: /100g/i.test(riceItem?._reviewHint || '') && /unchanged|photo estimate/i.test(curryItem?._reviewHint || ''),
  before: meal().total_calories_kcal,
  after: sideRiceOut.total_calories_kcal,
  delta: sideRiceOut.total_calories_kcal - meal().total_calories_kcal,
  items: [riceItem?._reviewHint, curryItem?._reviewHint].filter(Boolean),
  notes: [],
});

run('Rice custom: 280 g', meal(), [{ topic: 'portion_rice', answer: '280 g' }], { direction: 'up', minAfter: 650 });
run('Bread custom: 2 roti', meal({
  summary: 'Dal with roti',
  items: [
    { name: 'Dal tadka', portion_estimate: '1 bowl (~250g)', calories_kcal: 260, nutrition: { protein_g: 14, carbs_g: 28, fat_g: 8 } },
    { name: 'Roti', portion_estimate: '1 piece (~60g)', calories_kcal: 108, nutrition: { protein_g: 3, carbs_g: 20, fat_g: 2 } },
  ],
}), [{ topic: 'bread_count', answer: '2 roti' }], { direction: 'up', mustInclude: '2 piece' });
run('Biryani regular plate', meal({
  summary: 'Hyderabadi biryani',
  kcal: 684,
  extra: { _refId: 'hyderabadi_biryani' },
  items: [{ name: 'Hyderabadi biryani', portion_estimate: '1 serving (~350g)', calories_kcal: 684, nutrition: { protein_g: 24, carbs_g: 58, fat_g: 22 } }],
}), [{ topic: 'portion_rice', answer: 'Regular plate (~350 g)' }], { minAfter: 620, maxAfter: 690 });
run('Gravy: lots of sauce', meal(), [{ topic: 'sauce_gravy', answer: 'Lots of gravy or sauce' }], { direction: 'up' });
run('Samosa deep-fried', meal({
  summary: 'Samosa',
  kcal: 400,
  items: [{ name: 'Samosa', portion_estimate: '2 pieces (~160g)', calories_kcal: 400, nutrition: { protein_g: 8, carbs_g: 44, fat_g: 20 } }],
}), [{ topic: 'oil_fat', answer: 'Deep-fried' }], { direction: 'up' });
run('Cooking method: air-fried', meal({
  summary: 'Chicken wings',
  kcal: 520,
  items: [{ name: 'Chicken wings', portion_estimate: '6 pieces (~180g)', calories_kcal: 520, nutrition: { protein_g: 38, carbs_g: 4, fat_g: 36 } }],
}), [{ topic: 'cooking_method', answer: 'Air-fried' }], { direction: 'down', maxAfter: 510 });
run('Cooking method: deep-fried', meal({
  summary: 'Fish and chips',
  kcal: 680,
  items: [
    { name: 'Battered fish', portion_estimate: '1 fillet (~180g)', calories_kcal: 420, nutrition: { protein_g: 24, carbs_g: 28, fat_g: 22 } },
    { name: 'Plain rice', portion_estimate: '1 serving (~150g)', calories_kcal: 260, nutrition: { protein_g: 5, carbs_g: 56, fat_g: 2 } },
  ],
}), [{ topic: 'cooking_method', answer: 'Deep-fried' }], { direction: 'up', minAfter: 700 });
run('Takeaway custom 200g', meal({
  summary: 'Chicken chow mein takeaway',
  kcal: 620,
  items: [{ name: 'Chicken chow mein', portion_estimate: '1 box (~400g)', calories_kcal: 620, nutrition: { protein_g: 26, carbs_g: 68, fat_g: 22 } }],
}), [{ topic: 'portion_takeaway', answer: 'small side about 200g' }], { direction: 'down', maxAfter: 350 });
run('Dosa count: 2 dosas', meal({
  summary: 'Masala dosa',
  kcal: 340,
  items: [{ name: 'Masala dosa', portion_estimate: '1 piece (~180g)', calories_kcal: 340, nutrition: { protein_g: 8, carbs_g: 42, fat_g: 14 } }],
}), [{ topic: 'bread_count', answer: '2 dosas (~340g)' }], { direction: 'up', mustInclude: '2 piece', minAfter: 500 });
run('Dosa count: tiny AI guess scaled to 2 standard dosas', meal({
  summary: 'Dosa',
  kcal: 67,
  items: [{ name: 'Dosa', portion_estimate: '1 piece (~40g)', calories_kcal: 67, nutrition: { protein_g: 2, carbs_g: 10, fat_g: 2 } }],
}), [{ topic: 'bread_count', answer: '2 dosas' }], { direction: 'up', minAfter: 500, mustInclude: '2 piece' });
run('Dosa count: adds missing dosa line', meal({
  summary: 'Dosa with sambar',
  kcal: 135,
  items: [{ name: 'Sambar', portion_estimate: '1 bowl (~300g)', calories_kcal: 135, nutrition: { protein_g: 6, carbs_g: 20, fat_g: 4 } }],
}), [{ topic: 'bread_count', answer: '2 dosas (~340g)' }], { direction: 'up', minAfter: 450, mustInclude: 'Dosa' });
run('Idli count: 3 idlis', meal({
  summary: 'Idli sambar',
  kcal: 23,
  items: [{ name: 'Idli', portion_estimate: '1 piece (~60g)', calories_kcal: 23, nutrition: { protein_g: 1, carbs_g: 4.7, fat_g: 0.1 } }],
}), [{ topic: 'bread_count', answer: '3 idlis (~180g)' }], { direction: 'up', minAfter: 65, mustInclude: '3 piece' });
run('Latte large + 2 sugars', meal({
  summary: 'Latte',
  kcal: 120,
  items: [{ name: 'Latte', portion_estimate: '1 cup (~250ml)', calories_kcal: 120, nutrition: { protein_g: 6, carbs_g: 10, fat_g: 5, sugar_g: 8 } }],
}), [
  { topic: 'drink_coffee_tea_size', answer: 'Large / takeaway (~475 ml)' },
  { topic: 'drink_coffee_tea_style', answer: '2 tsp sugar (~8 g)' },
], { direction: 'up', minAfter: 180 });

const aviyal = {
  meal_summary: 'Aviyal',
  total_calories_kcal: 190,
  confidence_score: 0.78,
  _refId: 'avial',
  _anchored: true,
  items: [{ name: 'Aviyal', portion_estimate: '1 serving (~200g)', calories_kcal: 190, nutrition: { protein_g: 4, carbs_g: 16, fat_g: 12 } }],
  clarification_questions: [
    { question: 'What protein?', topic: 'protein_type' },
    { question: 'How much portion?', topic: 'portion_solid' },
  ],
};
const avSteps = normalizeClarificationQuestions(aviyal).map((s) => s.topic);
results.push({
  label: 'Aviyal skips protein question',
  pass: !avSteps.includes('protein_type'),
  before: 190,
  after: 190,
  delta: 0,
  items: avSteps,
  notes: avSteps.includes('protein_type') ? ['protein_type should be skipped'] : [],
});

const biryaniCfg = getClarificationStepConfig(
  { topic: 'portion_rice', question: '' },
  { meal_summary: 'Chicken biryani', _refId: 'hyderabadi_biryani', items: [] },
);
results.push({
  label: 'Biryani-specific question text',
  pass: /biryani/i.test(biryaniCfg.question),
  before: null,
  after: null,
  delta: 0,
  items: [biryaniCfg.question, biryaniCfg.options[0]],
  notes: /biryani/i.test(biryaniCfg.question) ? [] : ['question should mention biryani'],
});

const chicken65Steps = normalizeClarificationQuestions({
  meal_summary: 'Chicken 65',
  total_calories_kcal: 392,
  confidence_score: 0.78,
  _refId: 'chicken_65',
  _anchored: true,
  items: [{ name: 'Chicken 65', portion_estimate: '1 serving (~180g)', calories_kcal: 392, nutrition: { protein_g: 29, carbs_g: 18, fat_g: 29 } }],
  clarification_questions: [],
});
const chicken65Step = chicken65Steps.find((s) => s.topic === 'portion_starter');
const chicken65Cfg = getClarificationStepConfig(
  chicken65Step || { topic: 'portion_starter', question: '' },
  { meal_summary: 'Chicken 65', _refId: 'chicken_65', items: [{ name: 'Chicken 65', portion_estimate: '1 serving (~180g)' }] },
);
results.push({
  label: 'Chicken 65 starter portion question',
  pass: Boolean(chicken65Step) && /chicken 65/i.test(chicken65Cfg.question) && chicken65Cfg.options.some((o) => /180\s*g/i.test(o)),
  before: 392,
  after: null,
  delta: 0,
  items: [chicken65Cfg.question, ...(chicken65Cfg.options || []).slice(0, 2)],
  notes: chicken65Step ? [] : ['expected portion_starter step for chicken 65'],
});

run('Mutton sukka large plate', meal({
  summary: 'Mutton sukka',
  kcal: 369,
  extra: { _refId: 'mutton_sukka' },
  items: [{ name: 'Mutton sukka', portion_estimate: '1 serving (~180g)', calories_kcal: 369, nutrition: { protein_g: 32, carbs_g: 5, fat_g: 23 } }],
}), [{ topic: 'portion_starter', answer: 'Large plate (~240 g)' }], { direction: 'up', minAfter: 420 });

const lollipopCfg = getClarificationStepConfig(
  { topic: 'portion_starter', question: '' },
  { meal_summary: 'Chicken lollipop', _refId: 'chicken_lollipop', items: [{ name: 'Chicken lollipop', portion_estimate: '1 serving (~200g)' }] },
);
results.push({
  label: 'Lollipop piece-based starter options',
  pass: lollipopCfg.options.some((o) => /pieces/i.test(o)),
  before: null,
  after: null,
  delta: 0,
  items: lollipopCfg.options,
  notes: lollipopCfg.options.some((o) => /pieces/i.test(o)) ? [] : ['expected piece counts for lollipop'],
});

const preview = previewClarificationImpact(meal(), [], '300 g', 'portion_rice');
results.push({
  label: 'Live preview rice 300g',
  pass: preview.afterKcal > preview.beforeKcal,
  before: preview.beforeKcal,
  after: preview.afterKcal,
  delta: preview.afterKcal - preview.beforeKcal,
  items: [],
  notes: preview.afterKcal > preview.beforeKcal ? [] : ['preview should increase kcal'],
});

let passed = 0;
let failed = 0;
for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL';
  if (r.pass) passed += 1;
  else failed += 1;
  console.log(`${status} | ${r.label}`);
  if (r.before != null) console.log(`       ${r.before} -> ${r.after} kcal (delta ${r.delta >= 0 ? '+' : ''}${r.delta})`);
  if (r.items.length) console.log(`       ${r.items.join(' | ')}`);
  if (r.notes.length) console.log(`       notes: ${r.notes.join('; ')}`);
}

console.log(`\nSummary: ${passed} passed, ${failed} failed, ${results.length} total`);
process.exit(failed ? 1 : 0);
