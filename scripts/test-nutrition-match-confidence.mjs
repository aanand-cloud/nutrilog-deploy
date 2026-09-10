import {
  MATCH_RATE_THRESHOLD,
  buildRetryVisionContext,
  countEstimateItems,
  isRetryImprovement,
  matchRateFromAnalysis,
  needsMatchCheckEmphasis,
  needsVisionRetryPass,
} from '../shared/nutrition-match-confidence.js';
import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const goodPlate = composeAnalysisFromVision({
  meal_summary: 'Chicken curry with rice',
  confidence_score: 0.86,
  items: [
    { name: 'Chicken curry', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.9 },
    { name: 'Steamed rice', unit: 'g', estimated_amount: 150, cooking_method: 'steamed', visible_oil: false, confidence: 0.88 },
  ],
  clarification_questions: [],
});

const weakPlate = composeAnalysisFromVision({
  meal_summary: 'Mixed plate',
  confidence_score: 0.62,
  items: [
    { name: 'Chicken curry', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.82 },
    { name: 'Mystery stew', unit: 'g', estimated_amount: 200, cooking_method: 'unknown', visible_oil: false, confidence: 0.55 },
    { name: 'Side veg', unit: 'g', estimated_amount: 80, cooking_method: 'steamed', visible_oil: false, confidence: 0.58 },
  ],
  clarification_questions: [],
});

assert('good plate high match rate', matchRateFromAnalysis(goodPlate) >= MATCH_RATE_THRESHOLD, `${Math.round(matchRateFromAnalysis(goodPlate) * 100)}%`);
assert('weak plate below threshold', matchRateFromAnalysis(weakPlate) < MATCH_RATE_THRESHOLD, `${Math.round(matchRateFromAnalysis(weakPlate) * 100)}%`);
assert('weak plate needs match emphasis', needsMatchCheckEmphasis(weakPlate));
assert('good plate skips match emphasis', !needsMatchCheckEmphasis(goodPlate));

assert('retry when match rate low', needsVisionRetryPass(
  { confidence_score: 0.62, items: weakPlate.items },
  weakPlate,
));
assert('skip retry when fully matched', !needsVisionRetryPass(
  { confidence_score: 0.86, items: goodPlate.items },
  goodPlate,
));

const ctx = buildRetryVisionContext(
  { meal_summary: 'Mixed plate', confidence_score: 0.62, items: [] },
  weakPlate,
);
assert('retry context lists unmatched', ctx.unmatched_item_names.includes('Mystery stew'), ctx.unmatched_item_names.join(', '));

const improved = composeAnalysisFromVision({
  meal_summary: 'Chicken curry with rice and veg',
  confidence_score: 0.78,
  items: [
    { name: 'Chicken curry', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false },
    { name: 'Steamed rice', unit: 'g', estimated_amount: 150, cooking_method: 'steamed', visible_oil: false },
    { name: 'Mixed vegetables', unit: 'g', estimated_amount: 80, cooking_method: 'steamed', visible_oil: false },
  ],
  clarification_questions: [],
});
assert('retry improvement detected', isRetryImprovement(weakPlate, improved));
assert('same plate not improvement', !isRetryImprovement(weakPlate, weakPlate));
assert('estimate count drops on improvement', countEstimateItems(improved) <= countEstimateItems(weakPlate));

console.log('\nDone.');
