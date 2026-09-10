import {
  computeKcalRange,
  formatMealKcalDisplay,
  kcalRangeHtml,
  scoreMealConfidence,
} from '../shared/nutrition-confidence.js';
import { getMealNovaFlags, resetMealNovaFlagsCache } from '../shared/feature-flags.js';
import { resolveMealFromText } from '../shared/meal-resolution-pipeline.js';
import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

resetMealNovaFlagsCache();
assert('uncertaintyRanges flag on', getMealNovaFlags().uncertaintyRanges === true);

const weighed = resolveMealFromText('180g battered cod, 250g chips, 80g mushy peas');
const weighedScore = scoreMealConfidence(weighed);
assert('weighed fish+chips medium band with range', weighedScore.band === 'medium', weighedScore.band);
assert('weighed fish+chips has kcal range', Boolean(weighedScore.kcalRange), weighedScore.band);

const vision = composeAnalysisFromVision({
  meal_summary: 'Mixed plate',
  confidence_score: 0.62,
  items: [
    { name: 'Mystery stew', unit: 'g', estimated_amount: 200, cooking_method: 'unknown', visible_oil: false, confidence: 0.55 },
    { name: 'Side veg', unit: 'g', estimated_amount: 80, cooking_method: 'steamed', visible_oil: false, confidence: 0.58 },
  ],
  clarification_questions: [],
});
const visionScore = scoreMealConfidence(vision);
assert('vision low-confidence has range', Boolean(visionScore.kcalRange), visionScore.band);
assert('vision range wider than 12%', visionScore.kcalRange.max - visionScore.kcalRange.min > visionScore.kcalRange.point * 0.2);

const recipeVision = composeAnalysisFromVision({
  meal_summary: 'Fish and chips',
  confidence_score: 0.84,
  items: [{ name: 'Fish and chips', unit: 'g', estimated_amount: 430, cooking_method: 'deep_fried', visible_oil: true, confidence: 0.82 }],
  clarification_questions: [],
});
const recipeRange = computeKcalRange(recipeVision, recipeVision._confidence?.band || 'medium');
assert('recipe decomposed range exists when not high', Boolean(recipeRange) || recipeVision._confidence?.band === 'high');

assert(
  'formatMealKcalDisplay shows band when enabled',
  formatMealKcalDisplay(vision, { showRange: true }).includes('–'),
  formatMealKcalDisplay(vision, { showRange: true }),
);
assert(
  'kcalRangeHtml renders span',
  kcalRangeHtml(visionScore).includes('confidence-band__range'),
);

console.log('\nDone.');
