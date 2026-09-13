import {
  getClarificationStepConfig,
  normalizeClarificationQuestions,
  wordCount,
} from '../src/services/clarification-questions.js';
import {
  isLowConfidenceItem,
  mealOilTbspFromItems,
  rebuildVisionReview,
} from '../shared/vision-review-adjust.js';
import { composeVerifiedNutrition } from '../netlify/lib/nutrition-db.mjs';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const gemini = normalizeClarificationQuestions({
  meal_summary: '65 dish',
  confidence_score: 0.55,
  items: [{ name: '65 dish', portion_estimate: '~180g', calories_kcal: 390, nutrition: {} }],
  clarification_questions: [{
    topic: 'protein_type',
    question: 'Is this Chicken 65 or Paneer 65?',
    about: '65 Dish',
    options: ['Chicken', 'Paneer', 'Gobi'],
  }],
});
const protein = gemini.find((s) => s.topic === 'protein_type');
const proteinUi = getClarificationStepConfig(protein, { meal_summary: '65 dish' });
assert('keeps Gemini 1-tap options', proteinUi.options.includes('Chicken') && proteinUi.options.includes('Paneer'), proteinUi.options.join(','));
assert('Gemini question stays under 14 words', wordCount(protein.question) <= 14, protein.question);

const longQ = normalizeClarificationQuestions({
  meal_summary: 'Curry',
  confidence_score: 0.5,
  items: [{ name: 'Chicken curry', portion_estimate: '~200g' }],
  clarification_questions: [{
    topic: 'oil_fat',
    question: 'Could you please tell us approximately how much extra cooking oil or ghee you think was used when this curry was prepared at home or in the restaurant?',
  }],
});
assert('long Gemini question is shortened', wordCount(longQ.find((s) => s.topic === 'oil_fat')?.question || '') <= 14);

const grouped = normalizeClarificationQuestions({
  meal_summary: 'Fried chicken',
  confidence_score: 0.5,
  items: [{ name: 'Fried chicken', portion_estimate: '~180g' }],
  clarification_questions: [
    { topic: 'oil_fat', question: 'How much oil or ghee?', options: ['None', '1 tbsp'] },
    { topic: 'cooking_method', question: 'How was the chicken cooked?', options: ['Fried', 'Grilled'] },
  ],
});
assert('oil and cooking stay one question', grouped.filter((s) => s.topic === 'oil_fat' || s.topic === 'cooking_method').length === 1, grouped.map((s) => s.topic).join(','));

assert('low confidence below 0.90 is flagged', isLowConfidenceItem({ name: 'Rice', confidence: 0.7 }));
assert('high confidence is not flagged', !isLowConfidenceItem({ name: 'Banana', confidence: 0.95 }));

const composed = composeVerifiedNutrition({
  meal_summary: 'Medu vada',
  confidence_score: 0.8,
  items: [{
    name: 'Medu Vada',
    usda_search_term: 'fritter, urad dal, deep fried',
    estimated_amount: 120,
    unit: 'g',
    cooking_method: 'deep_fried',
    estimated_oil_tbsp: 1.5,
    visible_oil: false,
    confidence: 0.88,
  }],
  clarification_questions: [],
});
const oilTbsp = mealOilTbspFromItems(composed.items);
assert('composed 1.5 tbsp oil is recovered', oilTbsp === 1.5, String(oilTbsp));

const doubled = rebuildVisionReview(composed, composed.items.map((item) => (
  item._visionOil ? item : { ...item, grams: 240, _originalGrams: 240, _hiddenGrams: 240, _visionMeta: { ...item._visionMeta, amount: 240 } }
)), 1.5);
const vada = doubled.items.find((item) => item._refId === 'medu_vada');
const baseVada = composed.items.find((item) => item._refId === 'medu_vada');
assert('gram edit re-runs Phase 1 lookup', vada && baseVada && vada.calories_kcal > baseVada.calories_kcal, `${baseVada?.calories_kcal} → ${vada?.calories_kcal}`);
assert('oil line stays one item after rebuild', doubled.items.filter((item) => item._visionOil).length <= 1);

console.log('\nDone.');
