import { normalizeDishReportName, shouldOfferMissingDishReport } from '../shared/missing-dish-report.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('normalize dish name', normalizeDishReportName('  Chicken  Curry  ') === 'chicken curry');
assert('estimate offers report', shouldOfferMissingDishReport('estimate'));
assert('matched skips report', !shouldOfferMissingDishReport('matched'));
assert('label skips report', !shouldOfferMissingDishReport('label'));

console.log('\nDone.');
