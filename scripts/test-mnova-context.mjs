import { buildContextualMnovaStarterChips } from '../src/services/mnova-starter-chips.js';
import { MNOVA_LOG_FAILURE_CHIP } from '../src/services/mnova-log-issue.js';
import { buildMnovaWeeklyContext, weekRangeEnding } from '../src/services/mnova-weekly-context.js';
import { MNOVA_ACTION } from '../src/services/mnova-action-chips.js';

function assert(label, pass) {
  if (!pass) {
    console.error(`FAIL | ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}`);
}

function chipLabel(chip) {
  return typeof chip === 'string' ? chip : chip?.label || '';
}

const emptyDay = buildContextualMnovaStarterChips({
  screen: 'today',
  today: { mealsLogged: 0, recentMeals: [] },
});
assert('empty day suggests first meal', emptyDay.some((c) => /first meal/i.test(chipLabel(c))));
assert('empty day has log action', emptyDay.some((c) => c.type === 'action' && c.action === MNOVA_ACTION.OPEN_LOG));

const proteinGap = buildContextualMnovaStarterChips({
  screen: 'today',
  today: {
    mealsLogged: 2,
    progress: { protein_g: { remaining: 40 } },
    recentMeals: [{ summary: 'Lunch', kcal: 400, itemCount: 2 }],
  },
});
assert('protein gap chip', proteinGap.some((c) => /protein/i.test(chipLabel(c))));

const lowPlate = buildContextualMnovaStarterChips({
  screen: 'log',
  today: {
    mealsLogged: 1,
    lastMealId: 'meal-1',
    recentMeals: [{ summary: 'Dosa with sambar and egg', kcal: 135, itemCount: 1, id: 'meal-1' }],
  },
});
assert('suspicious low plate chat chip', lowPlate.some((c) => chipLabel(c) === 'My plate calories look too low'));
assert('suspicious low plate edit action', lowPlate.some((c) => c.action === MNOVA_ACTION.EDIT_LAST_MEAL));

const logIssue = buildContextualMnovaStarterChips({
  lastLogIssue: { type: 'photo_analysis_failed', message: 'failed' },
  today: { mealsLogged: 0, recentMeals: [] },
});
assert('log failure chip present', logIssue.some((c) => chipLabel(c) === "Why didn't that work?"));
assert('log issue describe action', logIssue.some((c) => c.action === MNOVA_ACTION.OPEN_LOG_DESCRIBE));

const range = weekRangeEnding('2026-08-29');
assert('week range is 7 days', range.start === '2026-08-23' && range.end === '2026-08-29');

const weeklyLocked = buildMnovaWeeklyContext([], { reportsAccess: false });
assert('weekly locked without reports', weeklyLocked.locked === true);

console.log(`\nDone${process.exitCode ? ' with failures' : ''}.`);
