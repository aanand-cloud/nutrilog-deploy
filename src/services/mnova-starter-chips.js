import { mergeMnovaStarterChips, MNOVA_LOG_FAILURE_CHIP } from './mnova-log-issue.js';
import { mergeMnovaChips } from './mnova-action-chips.js';
import { isSuspiciousLowPlateMeal, MNOVA_LOW_PLATE_CHIP } from './mnova-low-plate.js';

export const MNOVA_STARTER_CHIPS = [
  'How are my calories calculated?',
  "What's free to log without scans?",
  'Explain my Today totals',
  MNOVA_LOW_PLATE_CHIP,
];

export function buildContextualMnovaStarterChips(context = {}) {
  const chatLabels = [];
  const issue = context?.lastLogIssue;
  if (issue) chatLabels.push(MNOVA_LOG_FAILURE_CHIP);

  const today = context?.today || {};
  const progress = today.progress || {};
  const screen = context?.screen || 'today';

  if (today.mealsLogged === 0) {
    chatLabels.push('How do I log my first meal?');
  } else if (Number(progress.protein_g?.remaining) > 15) {
    chatLabels.push('How can I hit my protein goal?');
  } else if (Number(progress.calories?.remaining) > 100) {
    chatLabels.push('What fits my calories left today?');
  } else if (today.mealsLogged > 0) {
    chatLabels.push('Explain my Today totals');
  }

  if (screen === 'log') chatLabels.push('Photo vs barcode vs describe?');
  else if (screen === 'reports') chatLabels.push('Explain my weekly trends');
  else if (screen === 'calendar') chatLabels.push('How do I browse past days?');
  else if (screen === 'supplements') chatLabels.push('How does supplement logging work?');
  else if (screen === 'settings') chatLabels.push('How do goals & scans work?');

  const suspiciousMeal = (today.recentMeals || []).find((m) => isSuspiciousLowPlateMeal({
    meal_summary: m.summary,
    total_calories_kcal: m.kcal,
    items: Array.from({ length: m.itemCount || 0 }),
  }));
  if (suspiciousMeal) chatLabels.push(MNOVA_LOW_PLATE_CHIP);

  for (const fallback of MNOVA_STARTER_CHIPS) {
    if (chatLabels.length >= 6) break;
    if (!chatLabels.includes(fallback)) chatLabels.push(fallback);
  }

  return mergeMnovaChips(context, chatLabels);
}

export function getMnovaStarterChips(context = null) {
  if (context && typeof context === 'object') {
    return buildContextualMnovaStarterChips(context);
  }
  return mergeMnovaStarterChips(MNOVA_STARTER_CHIPS).map((label) => ({ type: 'chat', label }));
}
