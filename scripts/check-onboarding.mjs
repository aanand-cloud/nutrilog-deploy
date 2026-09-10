import { DEFAULT_GOALS, normalizeGoals, isDefaultGoals } from '../src/services/goals.js';
import { buildGoalsFromWizardState, resolveBodyMetrics } from '../src/services/wizard-targets.js';
import { estimateDailyCalories, macroCalories, suggestMacros } from '../src/services/calorie-wizard.js';

function assert(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
}

const sampleProfile = {
  sex: 'female',
  age: 34,
  heightUnit: 'cm',
  heightCm: 165,
  weightUnit: 'kg',
  weightKg: 68,
  weightGoal: 'maintain',
  activity: 'moderate',
};

assert('string calories are normalized', isDefaultGoals(normalizeGoals({ calories_kcal: '2000' })));
assert('custom goals are detected', !isDefaultGoals(normalizeGoals({ calories_kcal: 1847 })));
assert('normalize fills missing keys', normalizeGoals({ calories_kcal: 1500 }).protein_g === DEFAULT_GOALS.protein_g);

let threw = false;
try {
  buildGoalsFromWizardState({
    sex: 'female',
    age: '',
    heightUnit: 'cm',
    heightCm: '',
    weightUnit: 'kg',
    weightKg: '',
    weightGoal: 'maintain',
    activity: 'moderate',
  });
} catch {
  threw = true;
}
assert('blank profile is rejected for accurate targets', threw);

const built = buildGoalsFromWizardState(sampleProfile);
assert('profile builds targets', built.goals.calories_kcal >= 1200 && built.goals.calories_kcal <= 5000);
assert('wizard personalises calories only', built.goals.calories_kcal === built.estimate.target);
assert('wizard keeps default protein target', built.goals.protein_g === DEFAULT_GOALS.protein_g);
assert('wizard keeps default carbs target', built.goals.carbs_g === DEFAULT_GOALS.carbs_g);
assert('wizard keeps default fat target', built.goals.fat_g === DEFAULT_GOALS.fat_g);
assert('invalid age on optional defaults uses fallback age', resolveBodyMetrics({ sex: 'female', age: '12' }, { strict: false, allowDefaults: true }).age === 35);
assert('corrupt activity still builds with valid body stats', buildGoalsFromWizardState({ ...sampleProfile, activity: 'bogus', weightGoal: 'bogus' }).goals.calories_kcal > 0);

const gentleLoss = buildGoalsFromWizardState({
  ...sampleProfile,
  weightGoal: 'lose',
  weightChangeRateId: 'lose_150g_week',
});
const aggressiveLoss = buildGoalsFromWizardState({
  ...gentleLoss.safeState,
  weightChangeRateId: 'lose_500g_week',
});
assert('gentler loss pace lowers calorie target', gentleLoss.goals.calories_kcal > aggressiveLoss.goals.calories_kcal);
assert('150g/week loss uses custom rate', gentleLoss.safeState.weightChangeRateId === 'lose_150g_week');

const estimate = estimateDailyCalories({
  sex: 'female',
  age: 34,
  weightKg: 68,
  heightCm: 165,
  activity: 'moderate',
  weightGoal: 'lose',
  gramsPerWeek: 150,
});
assert('mifflin st jeor maintenance for sample profile', estimate.tdee === 2139);
assert('150g/week deficit is 165 kcal', estimate.kcalDelta === -165);
assert('sample loss target matches formula', estimate.target === 1974);

const macros = suggestMacros(estimate.target, 68);
assert('macros sum to calorie target', macroCalories(macros) === estimate.target);

assert(
  'stone weight converts to kg',
  Math.abs(resolveBodyMetrics({ weightUnit: 'st_lb', weightSt: 11, weightStLb: 4 }, { strict: false, allowDefaults: true }).weightKg - 71.7) < 0.2,
);
assert(
  'ft/in height converts to cm',
  resolveBodyMetrics({ heightUnit: 'ft_in', heightFt: 5, heightIn: 7 }, { strict: false, allowDefaults: true }).heightCm === 170,
);

console.log('check-onboarding: ok');
