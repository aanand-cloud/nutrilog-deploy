import {
  composeAnalysisFromVision,
  isVisionAnalysis,
  normalizePhotoAnalysis,
  resolveVisionFoodMatch,
  toVisionIdentification,
} from '../shared/vision-analysis-compose.js';
import { geminiGenerate, parseGeminiJson } from '../netlify/lib/gemini.mjs';
import { FOOD_ANALYSIS_SCHEMA, VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA } from '../netlify/lib/gemini-schemas.mjs';
import { ANALYSIS_PROMPT, CLARIFY_PROMPT } from '../netlify/lib/prompts.mjs';
import { capClarificationQuestions, composeVerifiedNutrition, lookupReferenceNutrition } from '../netlify/lib/nutrition-db.mjs';
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

const steamedRice = composeAnalysisFromVision({
  meal_summary: 'Boiled rice',
  items: [{ name: 'Cooked rice', unit: 'g', estimated_amount: 300, cooking_method: 'steamed', visible_oil: false }],
  clarification_questions: [],
}).items[0];
assert('authoritative cooked food is not double-adjusted', steamedRice.calories_kcal === 393, `${steamedRice.calories_kcal} kcal`);
assert('displayed calories match provenance calculation', itemProvenanceSummary(steamedRice).includes('= 393 kcal'));

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

const liveKfcName = composeAnalysisFromVision({
  meal_summary: 'KFC meal',
  items: [{ name: 'KFC Original Recipe Burger', unit: 'g', estimated_amount: 220, cooking_method: 'fried', visible_oil: true }],
  clarification_questions: [],
});
assert('live KFC burger wording uses official Fillet Burger serving', liveKfcName.items[0]?.calories_kcal === 463, `${liveKfcName.items[0]?.calories_kcal} kcal`);

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
assert('analysis prompt asks for usda search terms', /usda_search_term/.test(ANALYSIS_PROMPT));
assert('analysis prompt asks for oil tablespoons', /estimated_oil_tbsp/.test(ANALYSIS_PROMPT));

const originalFetch = globalThis.fetch;
let generatedRequest;
let parsedGemini;
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
  parsedGemini = await geminiGenerate({
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
assert('Gemini parser reads JSON from later response parts', parsedGemini?.result?.meal_summary === 'Banana');

const legacyPhoto = {
  meal_summary: 'Chicken Biryani',
  total_calories_kcal: 680,
  total_nutrition: { protein_g: 32, carbs_g: 85, fat_g: 22 },
  confidence_score: 0.95,
  items: [
    {
      name: 'Chicken Biryani',
      portion_estimate: '400g',
      calories_kcal: 680,
      nutrition: { protein_g: 32, carbs_g: 85, fat_g: 22 },
      confidence: 0.95,
    },
  ],
};
assert('legacy payload not vision-shaped', !isVisionAnalysis(legacyPhoto));
const forced = normalizePhotoAnalysis(legacyPhoto);
assert('legacy photo still composes through matcher', forced._visionComposed === true, String(forced._visionComposed));
assert('legacy photo keeps vision grams', forced.items[0]?._hiddenGrams === 400, String(forced.items[0]?._hiddenGrams));
assert('legacy photo discards Gemini kcal', forced.items[0]?.calories_kcal !== 680, String(forced.items[0]?.calories_kcal));
assert('legacy photo attaches a food reference', Boolean(forced.items[0]?._refId), String(forced.items[0]?._refId));
assert('already composed photos are not composed twice', normalizePhotoAnalysis(forced) === forced);

const keepName = resolveVisionFoodMatch('Medu Vada', 'fritter, urad dal, deep fried');
assert('usda term does not overwrite medu vada with dal', keepName.ref?.id === 'medu_vada', String(keepName.ref?.id));

const keepIdli = resolveVisionFoodMatch('Idli', 'rice cake, steamed, idli');
assert('usda term does not overwrite idli with rice cakes', keepIdli.ref?.id === 'idli', String(keepIdli.ref?.id));

const muttonPhrase = resolveVisionFoodMatch('Mutton plate', 'mutton biryani, cooked');
assert('comma-split usda phrase can recover mutton biryani', muttonPhrase.ref?.id === 'mutton_biryani', String(muttonPhrase.ref?.id));

const oily = composeAnalysisFromVision({
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
const oilLine = oily.items.find((item) => item._visionOil || item.name === 'Cooking oil');
assert('composed medu vada keeps vada ref', oily.items.some((item) => item._refId === 'medu_vada'), oily.items.map((item) => item._refId).join(', '));
assert('1.5 tbsp oil becomes ~21 g', Boolean(oilLine && /~21\s*g/i.test(oilLine.portion_estimate)), String(oilLine?.portion_estimate));

assert('Phase 1 schema is the vision schema, not legacy kcal', FOOD_ANALYSIS_SCHEMA === VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA);
assert('Phase 1 prompt gates questions at 0.90 confidence', /below 0\.90/.test(ANALYSIS_PROMPT));

const highConf = capClarificationQuestions({
  confidence_score: 0.95,
  items: [{ name: 'Banana', confidence: 0.94 }],
  clarification_questions: [
    { topic: 'portion_solid', question: 'How much banana?' },
    { topic: 'protein_type', question: 'Is this chicken or paneer?' },
  ],
});
assert('high confidence drops low-impact questions', highConf.clarification_questions.length === 1 && highConf.clarification_questions[0].topic === 'protein_type');

const lowConf = capClarificationQuestions({
  confidence_score: 0.7,
  items: [{ name: 'Curry', confidence: 0.7 }],
  clarification_questions: [
    { topic: 'oil_fat', question: 'How oily is this?' },
    { topic: 'portion_solid', question: 'How much curry?' },
    { topic: 'sauce_gravy', question: 'How much gravy?' },
    { topic: 'protein_type', question: 'What protein is this?' },
  ],
});
assert('low confidence keeps at most 3 questions', lowConf.clarification_questions.length === 3);

const lookup = lookupReferenceNutrition({
  name: 'Medu Vada',
  usda_search_term: 'fritter, urad dal, deep fried',
  estimated_amount: 120,
});
assert('nutrition-db keeps medu vada ref', lookup.refId === 'medu_vada', String(lookup.refId));
assert('nutrition-db scales grams to calories', lookup.grams === 120 && lookup.calories_kcal > 0, `${lookup.grams}g ${lookup.calories_kcal}kcal`);

const verified = composeVerifiedNutrition({
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
assert('nutrition-db compose is vision-composed', verified._visionComposed === true);
assert('nutrition-db compose keeps vada', verified.items.some((item) => item._refId === 'medu_vada'));

const hogKgId = toVisionIdentification({
  meal_summary: 'Hog plum',
  items: [{ name: 'Hog plum', estimated_amount: 2.5, unit: 'kg', confidence: 0.9 }],
  clarification_questions: [],
});
assert('vision kg converts to grams', hogKgId.items[0]?.estimated_amount === 2500 && hogKgId.items[0]?.unit === 'g', JSON.stringify(hogKgId.items[0]));

const hogBulk = composeAnalysisFromVision({
  meal_summary: 'Hog plum',
  confidence_score: 0.9,
  items: [{ name: 'Hog plum', estimated_amount: 2.5, unit: 'kg', cooking_method: 'raw', visible_oil: false, confidence: 0.9 }],
  clarification_questions: [],
});
const hogItem = hogBulk.items.find((item) => /hog|plum/i.test(item.name));
assert('hog plum is not European plum', hogItem?._refId === 'hog_plum', String(hogItem?._refId));
assert('2.5kg hog plum keeps bulk grams', hogItem?._hiddenGrams === 2500, String(hogItem?._hiddenGrams));
assert(
  '2.5kg hog plum fibre is bulk fruit not a 10g serving',
  Number(hogItem?.nutrition?.fibre_g) >= 40,
  String(hogItem?.nutrition?.fibre_g),
);

const coffeeBroken = `{
  "meal_summary": "Coffee",
  "confidence_score": 0.9,
  "notes": "Mug of coffee",
  "items": [
    {
      "name": "Coffee",
      "usda_search_term": "coffee, brewed",
      "unit": "ml",
      "estimated_amount": 250
    }
  ],
  "clarification_questions": [
    {
      "topic": "drink_coffee_tea_size",
      "question": "How much coffee?",
      "options": [
        "Small cup (~200 ml)"
        "Regular mug (~350 ml)"
      ]
    }
  ]
}`;
let coffeeParsed;
try {
  coffeeParsed = parseGeminiJson(coffeeBroken);
} catch (err) {
  coffeeParsed = { error: err.message };
}
assert('repairs coffee JSON missing commas between options', coffeeParsed?.items?.[0]?.name === 'Coffee', JSON.stringify(coffeeParsed?.error || coffeeParsed?.items?.[0]));
assert('coffee options survive JSON repair', coffeeParsed?.clarification_questions?.[0]?.options?.length >= 2, JSON.stringify(coffeeParsed?.clarification_questions?.[0]?.options));

const coffeeItemsBroken = `{
  "meal_summary": "Coffee",
  "items": [
    { "name": "Coffee", "unit": "ml", "estimated_amount": 250 }
    { "name": "Milk splash", "unit": "ml", "estimated_amount": 30 }
  ],
  "clarification_questions": []
}`;
const coffeeItems = parseGeminiJson(coffeeItemsBroken);
assert('repairs missing comma between coffee items', coffeeItems.items?.length === 2, String(coffeeItems.items?.length));

const coffeePhoto = composeAnalysisFromVision({
  meal_summary: 'Coffee',
  confidence_score: 0.9,
  items: [{ name: 'Coffee', estimated_amount: 250, unit: 'ml', cooking_method: 'unknown', visible_oil: false, confidence: 0.9 }],
  clarification_questions: [],
});
assert('coffee photo matches a coffee drink', /coffee/i.test(coffeePhoto.items[0]?._refId || ''), String(coffeePhoto.items[0]?._refId));

console.log('\nDone.');
