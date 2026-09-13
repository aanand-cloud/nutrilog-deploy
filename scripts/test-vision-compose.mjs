import {
  composeAnalysisFromVision,
  isVisionAnalysis,
  normalizePhotoAnalysis,
} from '../shared/vision-analysis-compose.js';
import { geminiGenerate } from '../netlify/lib/gemini.mjs';
import { VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA } from '../netlify/lib/gemini-schemas.mjs';
import { ANALYSIS_PROMPT, CLARIFY_PROMPT } from '../netlify/lib/prompts.mjs';
import { itemProvenanceSummary } from '../shared/nutrition-provenance.js';

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
assert('adds no more than one meal-level oil item', composed.items.filter((i) => i._visionOil).length <= 1);

const oilyPlatter = composeAnalysisFromVision({
  meal_summary: 'Mixed fried platter',
  items: [
    { name: 'Chicken wings', unit: 'g', estimated_amount: 150, cooking_method: 'fried', visible_oil: true },
    { name: 'Stir-fried vegetables', unit: 'g', estimated_amount: 200, cooking_method: 'stir_fried', visible_oil: true },
    { name: 'Fish cakes', unit: 'g', estimated_amount: 120, cooking_method: 'fried', visible_oil: true },
  ],
  clarification_questions: [],
});
assert('multiple oily dishes do not create duplicate oil servings', oilyPlatter.items.filter((i) => i._visionOil).length === 1);

const steamedIdli = composeAnalysisFromVision({
  meal_summary: 'Idli',
  items: [{ name: 'Idli', unit: 'g', estimated_amount: 300, cooking_method: 'steamed', visible_oil: false }],
  clarification_questions: [],
}).items[0];
assert('authoritative cooked food is not double-adjusted', steamedIdli.calories_kcal === 318, `${steamedIdli.calories_kcal} kcal`);
assert('displayed calories match provenance calculation', itemProvenanceSummary(steamedIdli).includes('= 318 kcal'));

const jollof = composeAnalysisFromVision({
  meal_summary: 'Nigerian jollof rice with chicken skewers',
  items: [
    { name: 'Seasoned red rice', unit: 'g', estimated_amount: 250, cooking_method: 'cooked', visible_oil: false },
    { name: 'Chicken skewers', unit: 'g', estimated_amount: 150, cooking_method: 'grilled', visible_oil: false },
  ],
  clarification_questions: [],
});
assert('meal context preserves regional rice identity', jollof.items.some((i) => /jollof/.test(i._refId || '')), jollof.items.map((i) => i._refId).join(', '));
assert('regional rice name remains visible', jollof.items.some((i) => /jollof/i.test(i.name)), jollof.items.map((i) => i.name).join(', '));

const oversizedSides = composeAnalysisFromVision({
  meal_summary: 'Idli plate',
  items: [
    { name: 'Idli', unit: 'g', estimated_amount: 300, cooking_method: 'steamed', visible_oil: false },
    { name: 'Coconut chutney', unit: 'g', estimated_amount: 100, cooking_method: 'raw', visible_oil: false },
    { name: 'Tomato chutney', unit: 'g', estimated_amount: 100, cooking_method: 'cooked', visible_oil: false },
    { name: 'Fresh basil', unit: 'g', estimated_amount: 30, cooking_method: 'raw', visible_oil: false },
  ],
  clarification_questions: [],
});
const cappedSides = oversizedSides.items.filter((i) => i._portionCapped);
assert('small accompaniments receive plausible photo caps', cappedSides.length === 3, cappedSides.map((i) => `${i.name}:${i._hiddenGrams}`).join(', '));
assert('chutney photo cap is 60g', cappedSides.filter((i) => /chutney/i.test(i.name)).every((i) => i._hiddenGrams === 60));
assert('garnish photo cap is 15g', cappedSides.find((i) => /basil/i.test(i.name))?._hiddenGrams === 15);

const kfcMeal = composeAnalysisFromVision({
  meal_summary: 'KFC Fillet Burger Meal with Pepsi Max',
  items: [
    { name: 'KFC Original Recipe chicken burger', unit: 'g', estimated_amount: 220, cooking_method: 'fried', visible_oil: true },
    { name: 'KFC potato wedges', unit: 'g', estimated_amount: 130, cooking_method: 'fried', visible_oil: true },
    { name: 'Pepsi Max', unit: 'ml', estimated_amount: 400, cooking_method: 'unknown', visible_oil: false },
  ],
  clarification_questions: [],
});
assert('KFC fillet burger uses official serving', kfcMeal.items.find((i) => i._refId === 'kfc_uk_fillet_burger')?.calories_kcal === 463);
assert('KFC wedges recognition is corrected to Signature Fries', kfcMeal.items.find((i) => i._refId === 'kfc_uk_signature_fries_regular')?.calories_kcal === 261);
assert('Pepsi Max is constrained to near-zero calories', kfcMeal.items.find((i) => i._refId === 'zero_sugar_soft_drink')?.calories_kcal <= 5);
assert('prepared branded meal receives no separate oil', !kfcMeal.items.some((i) => i._visionOil));
assert('KFC meal total stays plausible', kfcMeal.total_calories_kcal >= 725 && kfcMeal.total_calories_kcal <= 730, `${kfcMeal.total_calories_kcal} kcal`);

const pizzaMeal = composeAnalysisFromVision({
  meal_summary: 'Pepperoni pizza',
  items: [{ name: 'Pepperoni pizza', unit: 'g', estimated_amount: 650, cooking_method: 'baked', visible_oil: true }],
  clarification_questions: [],
});
assert('prepared pizza receives no separate oil', !pizzaMeal.items.some((i) => i._visionOil));

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
    json: async () => ({ candidates: [{ content: { parts: [
      { text: 'Model preamble without JSON' },
      { text: '{"meal_summary":"Banana","items":[],"clarification_questions":[]}' },
    ] } }] }),
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
assert('Gemini parser reads JSON from later response parts', true);

console.log('\nDone.');
