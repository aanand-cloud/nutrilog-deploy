import {
  composeAnalysisFromVision,
  isVisionAnalysis,
  normalizePhotoAnalysis,
} from '../shared/vision-analysis-compose.js';
import { geminiGenerate } from '../netlify/lib/gemini.mjs';
import { VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA } from '../netlify/lib/gemini-schemas.mjs';
import { ANALYSIS_PROMPT, CLARIFY_PROMPT } from '../netlify/lib/prompts.mjs';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

const vision = {
  meal_summary: 'Chicken curry with rice',
  confidence_score: 0.82,
  notes: 'Standard dinner plate',
  items: [
    {
      name: 'Chicken curry',
      unit: 'g',
      estimated_amount: 250,
      cooking_method: 'pan_fried',
      visible_oil: true,
      confidence: 0.8,
    },
    {
      name: 'Steamed rice',
      unit: 'g',
      estimated_amount: 150,
      cooking_method: 'steamed',
      visible_oil: false,
      confidence: 0.85,
    },
    {
      name: 'White coffee with milk',
      unit: 'ml',
      estimated_amount: 200,
      cooking_method: 'unknown',
      visible_oil: false,
      confidence: 0.9,
    },
  ],
  clarification_questions: [],
};

assert('detects vision-only payload', isVisionAnalysis(vision));
assert('legacy payload not vision', !isVisionAnalysis({
  meal_summary: 'Meal',
  total_calories_kcal: 400,
  items: [{ name: 'Rice', portion_estimate: '150g', calories_kcal: 200, nutrition: { protein_g: 4 } }],
}));

const composed = composeAnalysisFromVision(vision);
assert('composed has items', composed.items.length >= 3, `${composed.items.length} items`);
assert('curry uses reference profile', composed.items.some((i) => i._refId === 'chicken_curry'), composed.items.map((i) => i._refId).join(', '));
assert('rice uses rice ref', composed.items.some((i) => ['rice', 'plain_rice', 'cooked_rice', 'basmati_rice'].includes(i._refId)), composed.items.map((i) => i._refId).join(', '));
assert('coffee uses coffee_milk ref', composed.items.some((i) => i._refId === 'coffee_milk'), composed.items.map((i) => i._refId).join(', '));
assert('white coffee protein not milk-level', composed.items.find((i) => i._refId === 'coffee_milk')?.nutrition?.protein_g <= 5);
assert('items have per100 anchor', composed.items.every((i) => i._per100?.protein_g != null));
assert('totals calculated', composed.total_calories_kcal > 0, `${composed.total_calories_kcal} kcal`);
assert('vision flag set', composed._visionComposed === true);
assert('adds oil line when visible_oil', composed.items.some((i) => i._visionOil || i.name === 'Cooking oil'));

const normalized = normalizePhotoAnalysis(vision);
assert('normalize routes vision to composed', normalized._visionComposed === true);

const legacyBanana = normalizePhotoAnalysis({
  meal_summary: 'Banana',
  total_calories_kcal: 22,
  items: [{
    name: 'Banana',
    portion_estimate: '50g',
    calories_kcal: 22,
    nutrition: { protein_g: 0.2, carbs_g: 5, fat_g: 0.1 },
    confidence: 0.95,
  }],
  clarification_questions: [],
}, { forceVision: true });
const banana = legacyBanana.items[0];
assert('legacy AI nutrition is discarded', legacyBanana._visionComposed === true && legacyBanana.total_calories_kcal !== 22, `${legacyBanana.total_calories_kcal} kcal`);
assert('legacy banana resolves canonical reference', banana?._refId === 'banana', String(banana?._refId));
assert('legacy banana keeps visual portion', /50g/.test(banana?.portion_estimate || ''), banana?.portion_estimate);
assert('legacy banana uses authoritative nutrition', banana?._authoritative === true || /CoFID|IFCT|USDA/i.test(banana?._provenanceLabel || ''), banana?._provenanceLabel);

assert('initial prompt omits nutrition output fields', !/"total_calories_kcal"|"total_nutrition"|"calories_kcal"|"nutrition"\s*:/.test(ANALYSIS_PROMPT));
assert('clarification prompt forbids AI nutrition', /Do NOT calculate or return calories/i.test(CLARIFY_PROMPT));

const originalFetch = globalThis.fetch;
let generatedRequest;
globalThis.fetch = async (_url, options) => {
  generatedRequest = JSON.parse(options.body);
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"meal_summary":"Banana","items":[],"clarification_questions":[]}' }] } }] }),
  };
};
try {
  await geminiGenerate({
    apiKey: 'test',
    model: 'test-model',
    parts: [{ text: 'test' }],
    responseSchema: VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA,
  });
} finally {
  globalThis.fetch = originalFetch;
}
assert(
  'Gemini helper supports an optional response schema',
  JSON.stringify(generatedRequest?.generationConfig?.responseSchema) === JSON.stringify(VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA),
);

console.log('\nDone.');
