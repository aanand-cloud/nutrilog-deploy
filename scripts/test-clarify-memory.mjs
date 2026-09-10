import { getClarificationMemoryHints, buildClarifyControlState } from '../src/services/clarification-memory.js';
import { getClarificationStepConfig, shouldUseCombinedClarify, normalizeClarificationQuestions } from '../src/services/clarification-questions.js';

const meals = [
  {
    meal_summary: 'Chicken curry with rice',
    total_calories_kcal: 520,
    createdAt: '2026-08-20T12:00:00Z',
    clarifications: [
      { topic: 'portion_rice', answer: 'Main portion (~200 g)' },
      { topic: 'sauce_gravy', answer: 'Normal sauce / curry' },
    ],
  },
  {
    meal_summary: 'Butter chicken and rice',
    total_calories_kcal: 680,
    createdAt: '2026-08-22T12:00:00Z',
    clarifications: [{ topic: 'portion_rice', answer: 'Large plate (~300 g)' }],
  },
];

const analysis = {
  meal_summary: 'Chicken curry with rice',
  total_calories_kcal: 510,
  confidence_score: 0.72,
  items: [
    { name: 'Chicken curry', calories_kcal: 320 },
    { name: 'Rice', calories_kcal: 190 },
  ],
  clarification_questions: [
    { topic: 'portion_rice', question: 'How much rice?' },
    { topic: 'sauce_gravy', question: 'How much gravy?' },
  ],
};

const hints = getClarificationMemoryHints(analysis, meals);
const steps = normalizeClarificationQuestions(analysis);
const combined = shouldUseCombinedClarify(steps);
const riceUi = getClarificationStepConfig(steps[0], analysis);
const riceState = buildClarifyControlState(riceUi, hints.portion_rice);

console.log(JSON.stringify({
  hints,
  combined,
  steps: steps.map((s) => s.topic),
  ricePrefill: riceState,
  pass: hints.portion_rice && hints.sauce_gravy && combined && riceState.selectedChoice,
}, null, 2));

process.exit(hints.portion_rice && combined ? 0 : 1);
