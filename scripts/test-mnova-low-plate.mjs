import {
  isSuspiciousLowPlateMeal,
  buildLowPlateToastMessage,
  recordMnovaLowPlateTip,
  MNOVA_LOW_PLATE_CHIP,
} from '../src/services/mnova-low-plate.js';

function assert(label, pass) {
  if (!pass) {
    console.error(`FAIL | ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}`);
}

const mixedLow = {
  meal_summary: 'Dosa with sambar and egg',
  total_calories_kcal: 135,
  items: [{ name: 'Dosa' }],
};

assert('detects suspicious mixed plate', isSuspiciousLowPlateMeal(mixedLow));
assert('skips multi-item plate', !isSuspiciousLowPlateMeal({
  ...mixedLow,
  items: [{ name: 'Dosa' }, { name: 'Sambar' }],
}));
assert('skips high kcal', !isSuspiciousLowPlateMeal({ ...mixedLow, total_calories_kcal: 400 }));
assert('toast mentions kcal', /135 kcal/i.test(buildLowPlateToastMessage(mixedLow)));

const tip = recordMnovaLowPlateTip({ ...mixedLow, id: 'meal-1' });
assert('records tip with meal id', tip?.mealId === 'meal-1' && tip.kcal === 135);
assert('chip label set', MNOVA_LOW_PLATE_CHIP === 'My plate calories look too low');

console.log(`\nDone${process.exitCode ? ' with failures' : ''}.`);
