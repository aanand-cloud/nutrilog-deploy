import { DEFAULT_GOALS, normalizeGoals } from './goals.js';
import { estimateDailyCalories } from './calorie-wizard.js';
import { defaultRateIdForGoal, resolveWeightChangeRate } from './weight-goal-rates.js';
import { validateBodyMetricInputs } from './body-metrics-units.js';

const VALID_WEIGHT_GOALS = new Set(['lose', 'maintain', 'gain']);
const VALID_ACTIVITY = new Set(['sedentary', 'moderate', 'active']);

export { validateBodyMetricInputs as resolveBodyMetrics } from './body-metrics-units.js';

export function buildGoalsFromWizardState(state, { allowDefaults = false } = {}) {
  const weightGoal = VALID_WEIGHT_GOALS.has(state.weightGoal) ? state.weightGoal : 'maintain';
  let weightChangeRateId = '';
  if (weightGoal !== 'maintain') {
    const id = state.weightChangeRateId;
    weightChangeRateId = id && id.startsWith(`${weightGoal}_`) ? id : defaultRateIdForGoal(weightGoal);
  }
  const safeState = {
    ...state,
    weightGoal,
    weightChangeRateId,
    activity: VALID_ACTIVITY.has(state.activity) ? state.activity : 'moderate',
    sex: state.sex === 'male' ? 'male' : 'female',
  };
  const metrics = validateBodyMetricInputs(safeState, { strict: true, allowDefaults });
  const rate = resolveWeightChangeRate(safeState.weightGoal, safeState.weightChangeRateId);
  const estimate = estimateDailyCalories({
    sex: safeState.sex,
    age: metrics.age,
    weightKg: metrics.weightKg,
    heightCm: metrics.heightCm,
    activity: safeState.activity,
    weightGoal: safeState.weightGoal,
    gramsPerWeek: rate.gramsPerWeek,
  });
  const goals = normalizeGoals({
    ...DEFAULT_GOALS,
    calories_kcal: estimate.target,
  });
  return { goals, estimate, metrics, safeState };
}
