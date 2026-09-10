import { matchFoodReference } from '../shared/nutrition-density.js';
import { getItemNutritionTrust } from '../shared/nutrition-item-trust.js';
import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const PHASE5_MATCHES = [
  ['Mixed vegetables', 'mixed_vegetables'],
  ['Side veg', 'side_vegetables'],
  ['Steamed broccoli', 'steamed_broccoli'],
  ['Roast potatoes', 'roast_potatoes'],
  ['Garlic bread', 'garlic_bread'],
  ['Plain rice', 'plain_rice'],
  ['Steamed rice', 'plain_rice'],
  ['Chicken wings', 'chicken_wings'],
  ['Scrambled eggs', 'scrambled_eggs'],
  ['Dal', 'dal'],
  ['Lentils', 'lentils'],
  ['Chickpeas', 'chickpeas'],
  ['Refried beans', 'refried_beans'],
  ['Adobo', 'adobo'],
  ['Sinigang', 'sinigang'],
  ['Lechon', 'lechon'],
  ['Pancit', 'pancit'],
  ['Mee goreng', 'mee_goreng'],
  ['Doubles', 'doubles'],
  ['Pelau', 'pelau'],
  ['Macaroni pie', 'macaroni_pie'],
  ['Spring rolls', 'spring_rolls'],
  ['Dumplings', 'dumplings'],
  ['Enchiladas', 'enchilada'],
  ['Plain noodles', 'plain_noodles'],
  ['Glass noodles', 'plain_noodles'],
  ['Flatbread', 'flatbread'],
  ['Tortilla', 'tortilla_wrap'],
  ['Salsa', 'salsa'],
  ['Quinoa bowl', 'quinoa_bowl'],
  ['Buddha bowl', 'buddha_bowl'],
  ['Tempeh', 'tempeh'],
  ['Parmesan', 'parmesan'],
  ['Blue cheese', 'blue_cheese'],
  ['Sweetcorn', 'sweetcorn'],
  ['Vegetable soup', 'vegetable_soup'],
  ['Chicken soup', 'chicken_soup'],
  ['Chicken stew', 'chicken_stew'],
  ['Kottu roti', 'kottu_roti'],
  ['Hoppers', 'hoppers'],
  ['Side dish', 'side_dish'],
  ['Grilled vegetables', 'grilled_vegetables'],
  ['Sauce', 'cooking_sauce'],
  ['Tomato sauce', 'tomato_sauce'],
  ['Curry sauce', 'curry_sauce'],
  ['Mushy peas', 'mushy_peas'],
  ['Corn on the cob', 'corn_on_cob'],
  ['Yorkshire pudding', 'yorkshire_pudding'],
];

let matched = 0;
for (const [name, expectedId] of PHASE5_MATCHES) {
  const ref = matchFoodReference(name);
  const ok = ref?.id === expectedId;
  if (ok) matched += 1;
  assert(`${name} → ${expectedId}`, ok, ref?.id || 'none');
}

assert('phase5 coverage majority', matched >= PHASE5_MATCHES.length - 2, `${matched}/${PHASE5_MATCHES.length}`);

const composed = composeAnalysisFromVision({
  meal_summary: 'Adobo with rice and side veg',
  confidence_score: 0.8,
  items: [
    { name: 'Chicken adobo', unit: 'g', estimated_amount: 200, cooking_method: 'pan_fried', visible_oil: true, confidence: 0.85 },
    { name: 'Steamed rice', unit: 'g', estimated_amount: 150, cooking_method: 'steamed', visible_oil: false, confidence: 0.9 },
    { name: 'Side veg', unit: 'g', estimated_amount: 80, cooking_method: 'steamed', visible_oil: false, confidence: 0.8 },
  ],
  clarification_questions: [],
});

const trusts = composed.items.map((item) => getItemNutritionTrust(item, composed));
assert('adobo plate mostly matched', trusts.filter((t) => t === 'matched').length >= 2, trusts.join(', '));

console.log('\nDone.');
