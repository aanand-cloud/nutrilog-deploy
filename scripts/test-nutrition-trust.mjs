import {
  getItemNutritionTrust,
  summarizeItemTrust,
  photoScanTrustLead,
} from '../shared/nutrition-item-trust.js';
import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const composed = composeAnalysisFromVision({
  meal_summary: 'Chicken curry with rice',
  items: [
    { name: 'Chicken curry', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false },
    { name: 'Steamed rice', unit: 'g', estimated_amount: 150, cooking_method: 'steamed', visible_oil: false },
    { name: 'Mystery stew', unit: 'g', estimated_amount: 200, cooking_method: 'unknown', visible_oil: false },
  ],
  clarification_questions: [],
});

assert('curry item matched', getItemNutritionTrust(composed.items.find((i) => i._refId === 'chicken_curry')) === 'matched');
assert('rice item matched', getItemNutritionTrust(composed.items.find((i) => ['rice', 'plain_rice', 'cooked_rice', 'basmati_rice'].includes(i._refId))) === 'matched');
assert('unknown dish estimate', getItemNutritionTrust(composed.items.find((i) => i.name === 'Mystery stew')) === 'estimate');

const summary = summarizeItemTrust(composed.items);
assert('summary counts matched', summary.matched >= 2, `${summary.matched} matched`);
assert('summary counts estimate', summary.estimate >= 1, `${summary.estimate} estimate`);

const lead = photoScanTrustLead(composed);
assert('lead mentions matched and estimate', /matched/i.test(lead) && /estimate/i.test(lead), lead);

assert('ackee saltfish ref exists', composeAnalysisFromVision({
  meal_summary: 'Ackee and saltfish',
  items: [{ name: 'Ackee and saltfish', unit: 'g', estimated_amount: 220, cooking_method: 'pan_fried', visible_oil: true }],
  clarification_questions: [],
}).items.some((i) => i._refId === 'ackee_saltfish'));

assert('poutine ref exists', composeAnalysisFromVision({
  meal_summary: 'Poutine',
  items: [{ name: 'Poutine', unit: 'g', estimated_amount: 350, cooking_method: 'deep_fried', visible_oil: true }],
  clarification_questions: [],
}).items.some((i) => i._refId === 'poutine'));

console.log('\nDone.');
