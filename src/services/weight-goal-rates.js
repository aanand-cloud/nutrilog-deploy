/** Weight change pace → daily calorie adjustment (wellness estimate, not medical advice). */

import { dailyKcalForGramsPerWeek } from './calorie-wizard.js';

const KCAL_PER_KG = 7700;
const WEEKS_PER_MONTH = 4.345;

/** @typedef {{ id: string, label: string, gramsPerWeek: number, group?: string }} WeightChangeRate */

/** @type {WeightChangeRate[]} */
export const WEIGHT_LOSS_RATES = [
  { id: 'lose_100g_week', label: '100 g / week (gentle)', gramsPerWeek: 100, group: 'Per week' },
  { id: 'lose_150g_week', label: '150 g / week', gramsPerWeek: 150, group: 'Per week' },
  { id: 'lose_200g_week', label: '200 g / week', gramsPerWeek: 200, group: 'Per week' },
  { id: 'lose_250g_week', label: '250 g / week', gramsPerWeek: 250, group: 'Per week' },
  { id: 'lose_300g_week', label: '300 g / week', gramsPerWeek: 300, group: 'Per week' },
  { id: 'lose_400g_week', label: '400 g / week', gramsPerWeek: 400, group: 'Per week' },
  { id: 'lose_500g_week', label: '0.5 kg / week (max)', gramsPerWeek: 500, group: 'Per week' },
  { id: 'lose_250g_month', label: '0.25 kg / month (very gentle)', gramsPerWeek: Math.round((250 / WEEKS_PER_MONTH) * 10) / 10, group: 'Per month' },
  { id: 'lose_500g_month', label: '0.5 kg / month', gramsPerWeek: Math.round((500 / WEEKS_PER_MONTH) * 10) / 10, group: 'Per month' },
  { id: 'lose_1kg_month', label: '1 kg / month', gramsPerWeek: Math.round((1000 / WEEKS_PER_MONTH) * 10) / 10, group: 'Per month' },
];

/** @type {WeightChangeRate[]} */
export const WEIGHT_GAIN_RATES = [
  { id: 'gain_100g_week', label: '100 g / week (gentle)', gramsPerWeek: 100, group: 'Per week' },
  { id: 'gain_150g_week', label: '150 g / week', gramsPerWeek: 150, group: 'Per week' },
  { id: 'gain_200g_week', label: '200 g / week', gramsPerWeek: 200, group: 'Per week' },
  { id: 'gain_250g_week', label: '250 g / week', gramsPerWeek: 250, group: 'Per week' },
  { id: 'gain_300g_week', label: '300 g / week', gramsPerWeek: 300, group: 'Per week' },
  { id: 'gain_400g_week', label: '400 g / week', gramsPerWeek: 400, group: 'Per week' },
  { id: 'gain_500g_week', label: '0.5 kg / week (max)', gramsPerWeek: 500, group: 'Per week' },
  { id: 'gain_250g_month', label: '0.25 kg / month (very gentle)', gramsPerWeek: Math.round((250 / WEEKS_PER_MONTH) * 10) / 10, group: 'Per month' },
  { id: 'gain_500g_month', label: '0.5 kg / month', gramsPerWeek: Math.round((500 / WEEKS_PER_MONTH) * 10) / 10, group: 'Per month' },
  { id: 'gain_1kg_month', label: '1 kg / month', gramsPerWeek: Math.round((1000 / WEEKS_PER_MONTH) * 10) / 10, group: 'Per month' },
];

const ALL_RATES = [...WEIGHT_LOSS_RATES, ...WEIGHT_GAIN_RATES];
const RATE_BY_ID = Object.fromEntries(ALL_RATES.map((r) => [r.id, r]));

export function defaultRateIdForGoal(weightGoal = 'maintain') {
  if (weightGoal === 'lose') return 'lose_200g_week';
  if (weightGoal === 'gain') return 'gain_250g_week';
  return '';
}

export function ratesForGoal(weightGoal = 'maintain') {
  if (weightGoal === 'lose') return WEIGHT_LOSS_RATES;
  if (weightGoal === 'gain') return WEIGHT_GAIN_RATES;
  return [];
}

export function resolveWeightChangeRate(weightGoal = 'maintain', rateId = '') {
  if (weightGoal !== 'lose' && weightGoal !== 'gain') {
    return { id: '', label: '', gramsPerWeek: 0, kcalDelta: 0 };
  }
  const list = ratesForGoal(weightGoal);
  const picked = RATE_BY_ID[rateId] && RATE_BY_ID[rateId].id.startsWith(`${weightGoal}_`)
    ? RATE_BY_ID[rateId]
    : RATE_BY_ID[defaultRateIdForGoal(weightGoal)] || list[0];
  const kcalDelta = Math.round(dailyKcalDeltaFromGramsPerWeek(picked.gramsPerWeek));
  return {
    id: picked.id,
    label: picked.label,
    gramsPerWeek: picked.gramsPerWeek,
    kcalDelta: weightGoal === 'lose' ? -kcalDelta : kcalDelta,
  };
}

export function dailyKcalDeltaFromGramsPerWeek(gramsPerWeek = 0) {
  return dailyKcalForGramsPerWeek(gramsPerWeek);
}

export function rateHintText(weightGoal, rateId) {
  const rate = resolveWeightChangeRate(weightGoal, rateId);
  if (!rate.kcalDelta) return 'We use your maintenance calories with no adjustment.';
  const dir = weightGoal === 'lose' ? 'below' : 'above';
  return `${rate.label} → about ${Math.abs(rate.kcalDelta)} kcal ${dir} maintenance.`;
}

export function weightGoalRateSelectHtml(
  weightGoal,
  selectedId,
  {
    id = 'onboardGoalRate',
    className = 'settings-select full',
    label = 'Target pace',
    showKcalHint = false,
  } = {},
) {
  const rates = ratesForGoal(weightGoal);
  if (!rates.length) return '';
  const resolved = resolveWeightChangeRate(weightGoal, selectedId);
  const groups = [...new Set(rates.map((r) => r.group || 'Options'))];
  const options = groups.map((group) => {
    const items = rates.filter((r) => (r.group || 'Options') === group);
    return `<optgroup label="${group}">${items.map((r) => `
      <option value="${r.id}" ${r.id === resolved.id ? 'selected' : ''}>${r.label}</option>
    `).join('')}</optgroup>`;
  }).join('');
  const hint = showKcalHint
    ? `<p class="fine-print onboarding-rate-hint" id="${id}Hint">${rateHintText(weightGoal, resolved.id)}</p>`
    : '';
  return `
    <label class="field full onboarding-rate-field">
      <span>${label}</span>
      <select id="${id}" class="${className}" aria-label="Weight change pace">
        ${options}
      </select>
      ${hint}
    </label>
  `;
}
