import {
  applyDeterministicAccompanimentFill,
  buildAccompanimentPassContext,
  detectMissingAccompaniments,
  isAccompanimentPassImprovement,
  needsAccompanimentGeminiPass,
} from '../shared/vision-accompaniment-pass.js';
import { composeAnalysisFromVision } from '../shared/vision-analysis-compose.js';
import { getMealNovaFlags } from '../shared/feature-flags.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('visionSecondPass on', getMealNovaFlags().visionSecondPass === true);

const biryaniVision = {
  meal_summary: 'Biryani with cucumber raita',
  confidence_score: 0.8,
  items: [{ name: 'Chicken biryani', unit: 'g', estimated_amount: 350, cooking_method: 'unknown', visible_oil: false, confidence: 0.82 }],
  clarification_questions: [],
};

const partialBiryani = {
  meal_summary: 'Biryani with cucumber raita',
  items: [{
    name: 'Chicken biryani',
    _refId: 'biryani',
    _hiddenGrams: 350,
    calories_kcal: 550,
    nutrition: { protein_g: 20, carbs_g: 60, fat_g: 15, fibre_g: 3, sugar_g: 2, salt_mg: 800 },
    portion_estimate: '350g',
  }],
  total_calories_kcal: 550,
  total_nutrition: { protein_g: 20, carbs_g: 60, fat_g: 15, fibre_g: 3, sugar_g: 2, salt_mg: 800 },
};

const missingBiryani = detectMissingAccompaniments(biryaniVision, partialBiryani);
assert('biryani+raita summary detects missing raita when only biryani item', missingBiryani.some((m) => m.side === 'raita'), missingBiryani.map((m) => m.side).join(', '));

const filled = applyDeterministicAccompanimentFill(partialBiryani, biryaniVision);
assert('deterministic fill adds raita component', filled.items.some((i) => /raita/i.test(i.name)), filled.items.map((i) => i.name).join(', '));
assert('fill marks accompaniment', filled._accompanimentFilled === true);
assert('improvement after fill', isAccompanimentPassImprovement(partialBiryani, filled));

const curryOnlyVision = {
  meal_summary: 'Chicken tikka masala',
  confidence_score: 0.78,
  items: [{ name: 'Chicken tikka masala', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.8 }],
  clarification_questions: [],
};
const curryComposed = composeAnalysisFromVision(curryOnlyVision);
const missingRice = detectMissingAccompaniments(curryOnlyVision, curryComposed);
assert('curry-only detects missing rice', missingRice.some((m) => m.side === 'rice'));
assert('needs gemini pass for curry-only', needsAccompanimentGeminiPass(curryOnlyVision, curryComposed));

const ctx = buildAccompanimentPassContext(curryOnlyVision, curryComposed);
assert('context lists missing sides', ctx.missing_accompaniments.includes('rice'), ctx.missing_accompaniments.join(', '));

const completePlate = composeAnalysisFromVision({
  meal_summary: 'Chicken curry with rice',
  confidence_score: 0.86,
  items: [
    { name: 'Chicken curry', unit: 'g', estimated_amount: 250, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.9 },
    { name: 'Steamed rice', unit: 'g', estimated_amount: 150, cooking_method: 'steamed', visible_oil: false, confidence: 0.88 },
  ],
  clarification_questions: [],
});
assert('complete curry+rce skips gemini pass', !needsAccompanimentGeminiPass(
  { meal_summary: 'Chicken curry with rice' },
  completePlate,
));

const dosaCurryVision = {
  meal_summary: 'Dosa with meat curry',
  confidence_score: 0.82,
  items: [
    { name: 'Dosa', unit: 'piece', estimated_amount: 2, cooking_method: 'griddled', visible_oil: false, confidence: 0.85 },
    { name: 'Meat curry', unit: 'g', estimated_amount: 200, cooking_method: 'pan_fried', visible_oil: false, confidence: 0.82 },
  ],
  clarification_questions: [],
};
const dosaCurryComposed = composeAnalysisFromVision(dosaCurryVision);
const dosaCurryMissing = detectMissingAccompaniments(dosaCurryVision, dosaCurryComposed);
assert('dosa+meat curry does not inject sambar/chutney', dosaCurryMissing.length === 0,
  dosaCurryMissing.map((m) => m.side).join(', '));
assert('dosa+meat curry skips gemini pass', !needsAccompanimentGeminiPass(dosaCurryVision, dosaCurryComposed));

const dosaPlateVision = {
  meal_summary: 'Masala dosa with sambar and chutney',
  confidence_score: 0.84,
  items: [{ name: 'Masala dosa', unit: 'g', estimated_amount: 220, cooking_method: 'griddled', visible_oil: false, confidence: 0.86 }],
  clarification_questions: [],
};
const dosaPlatePartial = {
  meal_summary: 'Masala dosa with sambar and chutney',
  items: [{
    name: 'Masala dosa',
    _refId: 'dosa',
    _hiddenGrams: 220,
    calories_kcal: 300,
    nutrition: { protein_g: 8, carbs_g: 45, fat_g: 10, fibre_g: 3, sugar_g: null, salt_mg: null },
    portion_estimate: '220g',
  }],
  total_calories_kcal: 300,
};
const dosaPlateMissing = detectMissingAccompaniments(dosaPlateVision, dosaPlatePartial);
assert('explicit dosa plate still detects missing sambar', dosaPlateMissing.some((m) => m.side === 'sambar'),
  dosaPlateMissing.map((m) => m.side).join(', '));

console.log('\nDone.');
