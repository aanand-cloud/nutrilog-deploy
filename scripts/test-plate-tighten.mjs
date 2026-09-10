import {
  dedupePlateItems,
  detectPlateGaps,
  isCompoundMealDescription,
  isUndercountedMixedPlate,
  mergePhotoItemsIfCollapsed,
  shouldSkipDescriptionAnchor,
  tightenPlateAnalysis,
} from '../shared/plate-tighten.js';
import { applyClarificationsLocally } from '../shared/clarification-apply.js';

function assert(label, pass, detail = '') {
  if (!pass) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`PASS | ${label}`);
  return true;
}

assert('compound meal text detected', isCompoundMealDescription('2 dosas with sambar and egg'));
assert('single dish not compound', !isCompoundMealDescription('masala dosa'));

const sambarOnly = {
  meal_summary: 'Dosa with sambar and fried egg',
  total_calories_kcal: 135,
  items: [{ name: 'Sambar', portion_estimate: '1 bowl (~300g)', calories_kcal: 135, nutrition: { protein_g: 6, carbs_g: 20, fat_g: 4 } }],
};
const gaps = detectPlateGaps(sambarOnly);
assert('detects missing bread on dosa plate', gaps.missingBread);
assert('detects missing egg on dosa plate', gaps.missingEgg);
assert('flags undercounted mixed plate', isUndercountedMixedPlate(sambarOnly));

const merged = mergePhotoItemsIfCollapsed({
  meal_summary: 'Dosa with sambar',
  total_calories_kcal: 135,
  _anchored: true,
  items: [{ name: 'Sambar', portion_estimate: '1 bowl (~300g)', calories_kcal: 135, nutrition: { protein_g: 6, carbs_g: 20, fat_g: 4 } }],
  _photoItems: [
    { name: 'Sambar', portion_estimate: '1 bowl (~250g)', calories_kcal: 112, nutrition: { protein_g: 5, carbs_g: 18, fat_g: 3 } },
    { name: 'Dosa', portion_estimate: '1 piece (~170g)', calories_kcal: 286, nutrition: { protein_g: 7, carbs_g: 42, fat_g: 9 } },
    { name: 'Fried egg', portion_estimate: '1 egg (~58g)', calories_kcal: 90, nutrition: { protein_g: 6, carbs_g: 1, fat_g: 7 } },
  ],
});
assert('merges collapsed photo items', (merged.items || []).length >= 3, `items=${(merged.items || []).length}`);

const deduped = dedupePlateItems([
  { name: 'Chicken biryani', portion_estimate: '1 serving (~350g)', calories_kcal: 684, nutrition: {} },
  { name: 'Basmati rice', portion_estimate: '1 serving (~200g)', calories_kcal: 260, nutrition: {} },
]);
assert('drops extra plain rice with biryani', deduped.length === 1);

const tightened = tightenPlateAnalysis(sambarOnly);
assert('injects bread clarify when dosa missing', (tightened.clarification_questions || []).some((q) => q.topic === 'bread_count'));

const withBreadAnswer = applyClarificationsLocally(tightened, [{ topic: 'bread_count', answer: '2 dosas (~340g)' }]);
assert('tightened plate + 2 dosas clears undercount on bread', (withBreadAnswer.total_calories_kcal || 0) >= 450);

assert('skip anchor for multi-item photo', shouldSkipDescriptionAnchor({ items: [{ name: 'A' }, { name: 'B' }] }, 'sambar'));
assert('skip anchor for compound notes', shouldSkipDescriptionAnchor({ items: [] }, 'dosa with sambar'));

console.log(`\nDone${process.exitCode ? ' with failures' : ''}.`);
