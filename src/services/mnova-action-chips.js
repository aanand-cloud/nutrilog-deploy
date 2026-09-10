/**
 * MNova tap-to-action chips — client-only navigation, no extra API calls.
 */

import { isSuspiciousLowPlateMeal } from './mnova-low-plate.js';

/** @typedef {{ type: 'chat', label: string }} MnovaChatChip */
/** @typedef {{ type: 'action', action: string, label: string, mealId?: string }} MnovaActionChip */
/** @typedef {MnovaChatChip | MnovaActionChip} MnovaChip */

export const MNOVA_ACTION = {
  OPEN_LOG: 'open_log',
  OPEN_LOG_DESCRIBE: 'open_log_describe',
  OPEN_LOG_BARCODE: 'open_log_barcode',
  OPEN_TODAY: 'open_today',
  OPEN_REPORTS: 'open_reports',
  OPEN_SETTINGS_PLANS: 'open_settings_plans',
  OPEN_SETTINGS_GOALS: 'open_settings_goals',
  OPEN_CALENDAR: 'open_calendar',
  OPEN_SUPPLEMENTS: 'open_supplements',
  EDIT_LAST_MEAL: 'edit_last_meal',
};

const ACTION_LABELS = {
  [MNOVA_ACTION.OPEN_LOG]: 'Log a meal',
  [MNOVA_ACTION.OPEN_LOG_DESCRIBE]: 'Try describe',
  [MNOVA_ACTION.OPEN_LOG_BARCODE]: 'Scan barcode',
  [MNOVA_ACTION.OPEN_TODAY]: 'Open Today',
  [MNOVA_ACTION.OPEN_REPORTS]: 'View reports',
  [MNOVA_ACTION.OPEN_SETTINGS_PLANS]: 'See plans',
  [MNOVA_ACTION.OPEN_SETTINGS_GOALS]: 'Edit goals',
  [MNOVA_ACTION.OPEN_CALENDAR]: 'Open calendar',
  [MNOVA_ACTION.OPEN_SUPPLEMENTS]: 'Log supplement',
  [MNOVA_ACTION.EDIT_LAST_MEAL]: 'Edit last meal',
};

const LABEL_TO_ACTION = Object.fromEntries(
  Object.entries(ACTION_LABELS).flatMap(([action, label]) => [[label.toLowerCase(), action]]),
);

/** Short AI suggestion phrases → action (only when clearly navigational). */
const SUGGESTION_PATTERNS = [
  { re: /^(open|go to)\s+log\b/i, action: MNOVA_ACTION.OPEN_LOG },
  { re: /^log a meal$/i, action: MNOVA_ACTION.OPEN_LOG },
  { re: /^(try|use)\s+describe/i, action: MNOVA_ACTION.OPEN_LOG_DESCRIBE },
  { re: /^describe instead$/i, action: MNOVA_ACTION.OPEN_LOG_DESCRIBE },
  { re: /^(scan|try)\s+barcode/i, action: MNOVA_ACTION.OPEN_LOG_BARCODE },
  { re: /^edit (your )?last meal$/i, action: MNOVA_ACTION.EDIT_LAST_MEAL },
  { re: /^(open|view)\s+reports?$/i, action: MNOVA_ACTION.OPEN_REPORTS },
  { re: /^see plans$/i, action: MNOVA_ACTION.OPEN_SETTINGS_PLANS },
  { re: /^edit goals$/i, action: MNOVA_ACTION.OPEN_SETTINGS_GOALS },
];

export function actionChip(action, label = ACTION_LABELS[action], mealId) {
  /** @type {MnovaActionChip} */
  const chip = { type: 'action', action, label: label || action };
  if (mealId) chip.mealId = mealId;
  return chip;
}

export function chatChip(label) {
  return { type: 'chat', label: String(label || '').trim() };
}

export function resolveActionFromLabel(label = '') {
  const text = String(label || '').trim();
  if (!text) return null;

  const exact = LABEL_TO_ACTION[text.toLowerCase()];
  if (exact) return exact;

  for (const { re, action } of SUGGESTION_PATTERNS) {
    if (re.test(text)) return action;
  }
  return null;
}

/** @param {string | MnovaChip} chip */
export function normalizeMnovaChip(chip) {
  if (typeof chip === 'string') {
    const label = chip.trim();
    if (!label) return null;
    const action = resolveActionFromLabel(label);
    if (action) return actionChip(action, label);
    return chatChip(label);
  }
  if (chip?.type === 'action' && chip.action && chip.label) return chip;
  if (chip?.label) return chatChip(String(chip.label));
  return null;
}

/** @param {Array<string | MnovaChip>} chips */
export function normalizeMnovaChips(chips = []) {
  return chips.map(normalizeMnovaChip).filter(Boolean);
}

/** Contextual navigation chips (max 2). */
export function buildContextualActionChips(context = {}) {
  const chips = [];
  const issue = context?.lastLogIssue;
  const today = context?.today || {};
  const screen = context?.screen || 'today';
  const lowPlate = (today.recentMeals || []).find((m) => isSuspiciousLowPlateMeal({
    meal_summary: m.summary,
    total_calories_kcal: m.kcal,
    items: Array.from({ length: m.itemCount || 0 }),
  }));

  if (issue) {
    if (/barcode|packaged|product/i.test(issue.type)) {
      chips.push(actionChip(MNOVA_ACTION.OPEN_LOG_BARCODE));
    } else if (/describe|short/i.test(issue.type)) {
      chips.push(actionChip(MNOVA_ACTION.OPEN_LOG_DESCRIBE));
    } else if (/scan|photo|camera|consent|sign_in|limit/i.test(issue.type)) {
      chips.push(actionChip(MNOVA_ACTION.OPEN_LOG_DESCRIBE));
    } else {
      chips.push(actionChip(MNOVA_ACTION.OPEN_LOG));
    }
  }

  if (lowPlate && (today.lastMealId || context?.lowPlateTip?.mealId)) {
    chips.push(actionChip(
      MNOVA_ACTION.EDIT_LAST_MEAL,
      ACTION_LABELS[MNOVA_ACTION.EDIT_LAST_MEAL],
      today.lastMealId || context?.lowPlateTip?.mealId,
    ));
  }

  if (today.mealsLogged === 0 && screen !== 'log') {
    chips.push(actionChip(MNOVA_ACTION.OPEN_LOG));
  }

  if (context?.scanBudget?.allowed === false && screen !== 'log') {
    chips.push(actionChip(MNOVA_ACTION.OPEN_LOG_DESCRIBE, 'Describe instead'));
  }

  if (context?.weekly?.topInsight && screen !== 'reports' && context?.plan?.reportsAccess) {
    chips.push(actionChip(MNOVA_ACTION.OPEN_REPORTS));
  }

  if (screen === 'supplements' && today.mealsLogged > 0) {
    chips.push(actionChip(MNOVA_ACTION.OPEN_TODAY));
  }

  const seen = new Set();
  return chips.filter((c) => {
    if (seen.has(c.action)) return false;
    seen.add(c.action);
    return true;
  }).slice(0, 2);
}

/** Action chips first, then chat chips — up to 4 total. */
export function mergeMnovaChips(context, chatLabels = []) {
  const actions = buildContextualActionChips(context);
  const chat = chatLabels.map((label) => chatChip(label));
  const seen = new Set();
  const out = [];

  for (const chip of [...actions, ...chat]) {
    const key = chip.type === 'action' ? `a:${chip.action}:${chip.mealId || ''}` : `c:${chip.label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
    if (out.length >= 4) break;
  }
  return out;
}
