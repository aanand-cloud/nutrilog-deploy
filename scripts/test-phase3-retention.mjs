/**
 * MealNova Phase 3 — barcode GTIN, Health sync, 14-day adaptive TDEE.
 * TAP + PASS/FAIL. Does not touch the photo / V4 matcher path.
 */

import { computeAdaptiveTdee, dailyIntakeFromMeals, daysBetween } from '../shared/adaptive-tdee.js';
import { gtinCandidates, isValidGtin, normalizeGtin } from '../src/services/gtin.js';
import {
  applyBrandedBarcodeOverlay,
  productToAnalysis,
} from '../src/services/barcode.js';
import { analysisToDailyMealFields, barcodeFieldForMeal } from '../src/services/packaged-log.js';
import { addWeighIn, listWeighIns } from '../src/services/weigh-ins.js';
import {
  applyHealthImport,
  buildHealthSyncBundle,
  detectHealthBridge,
  parseHealthImport,
  setActiveEnergyForDate,
  tryNativeHealthSync,
} from '../src/services/health-sync.js';
import { phase3RetentionHtml } from '../src/views/phase3-settings.js';
import { sumNutrition } from '../src/services/storage.js';

let passed = 0;
let failed = 0;
const lines = ['TAP version 13'];

function mem(init = {}) {
  const data = { ...init };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function ok(label, pass, detail = '') {
  if (pass) {
    passed += 1;
    lines.push(`ok ${passed + failed} - ${label}`);
    console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
    return;
  }
  failed += 1;
  lines.push(`not ok ${passed + failed} - ${label}${detail ? ` # ${detail}` : ''}`);
  console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
}

ok('UPC-A 12-digit becomes EAN-13', normalizeGtin('012345678905') === '0012345678905');
ok('EAN-13 stays 13 digits', normalizeGtin('5000159407236') === '5000159407236');
ok('gtinCandidates includes 12- and 13-digit forms', gtinCandidates('012345678905').includes('012345678905') && gtinCandidates('012345678905').includes('0012345678905'));
ok('8+ digit codes are valid GTINs', isValidGtin('50123456') && !isValidGtin('123'));

const yogurt = productToAnalysis({
  product_name: 'Greek style yogurt',
  brands: 'Test Brand',
  serving_size: '1 pot (150g)',
  serving_quantity: 150,
  nutriments: { 'energy-kcal_serving': 146, proteins_serving: 9.5 },
}, '5000159407236');
ok('OFF product keeps scanned GTIN', yogurt.barcode === '5000159407236', yogurt.barcode);
ok('UPC-A meal field stores EAN-13', barcodeFieldForMeal({ barcode: '012345678905' }) === '0012345678905');

const kfc = applyBrandedBarcodeOverlay(productToAnalysis({
  product_name: 'KFC Fillet Burger',
  brands: 'KFC',
  serving_quantity: 180,
  nutriments: { 'energy-kcal_100g': 200 },
}, '0000000000000'));
ok('Local UK branded overlay wins over OFF kcal', kfc.total_calories_kcal === 463, `${kfc.total_calories_kcal}`);
ok('KFC overlay stays a barcode analysis', kfc.source === 'barcode' && kfc.barcode === '0000000000000');

const pepsi = applyBrandedBarcodeOverlay(productToAnalysis({
  product_name: 'Pepsi Max',
  brands: 'Pepsi',
  serving_size: '330ml',
  serving_quantity: 330,
  nutriments: { 'energy-kcal_serving': 80 },
}, '5012345678900'));
ok('Zero-sugar drink overlay is near 0 kcal', pepsi.total_calories_kcal <= 5, `${pepsi.total_calories_kcal}`);

const scanned = analysisToDailyMealFields(yogurt, { date: '2026-09-13', meal_type: 'snack' });
const photoMeal = {
  date: '2026-09-13',
  meal_type: 'lunch',
  meal_summary: 'Rice and dal',
  total_calories_kcal: 540,
  total_nutrition: { protein_g: 18, carbs_g: 70, fat_g: 12 },
  source: 'photo',
};
const dayTotals = sumNutrition([photoMeal, { ...scanned, total_nutrition: scanned.total_nutrition || yogurt.total_nutrition }]);
ok('Scanned pack fields include GTIN for daily save', scanned.barcode === '5000159407236' && scanned.source === 'barcode');
ok('Barcode meal kcal joins the same daily summary as photo meals', dayTotals.calories_kcal === 686, `${dayTotals.calories_kcal}`);

const meals = [];
for (let d = 1; d <= 10; d += 1) {
  const day = `2026-09-${String(d).padStart(2, '0')}`;
  meals.push({
    date: day,
    meal_type: 'lunch',
    source: 'barcode',
    barcode: '5000159407236',
    total_calories_kcal: 1800,
  });
}
meals.push({
  date: '2026-09-10',
  meal_type: 'supplement',
  source: 'supplement',
  total_calories_kcal: 9999,
});
ok('Supplements are excluded from TDEE intake', dailyIntakeFromMeals(meals).every((row) => row.kcal === 1800));
ok('daysBetween is calendar days', daysBetween('2026-09-01', '2026-09-14') === 13);

const ready = computeAdaptiveTdee({
  meals,
  weighIns: [
    { date: '2026-09-01', kg: 80 },
    { date: '2026-09-14', kg: 79 },
  ],
  asOf: '2026-09-14',
});
ok('14-day TDEE is ready with 10 intake days and 13-day weight span', ready.ok === true, ready.reason);
ok('Weight loss raises TDEE above intake', ready.ok && ready.tdee > 1800, `${ready.tdee}`);
ok('TDEE uses 7700 kcal/kg', ready.ok && ready.tdee === Math.round(1800 - ((-1 * 7700) / 13)), `${ready.tdee}`);

const notReady = computeAdaptiveTdee({
  meals: meals.slice(0, 3),
  weighIns: [{ date: '2026-09-01', kg: 80 }],
  asOf: '2026-09-14',
});
ok('TDEE waits for enough intake days', notReady.ok === false && notReady.reason === 'need_intake_days');

const storage = mem();
addWeighIn({ date: '2026-09-01', kg: 72.4 }, storage);
addWeighIn({ date: '2026-09-13', kg: 71.8 }, storage);
ok('Weigh-ins persist two scale rows', listWeighIns(storage).length === 2);

setActiveEnergyForDate('2026-09-13', 420, storage);
const bundle = buildHealthSyncBundle({
  meals: [photoMeal, { ...scanned, date: '2026-09-13', total_calories_kcal: 146, total_nutrition: yogurt.total_nutrition }],
  weighIns: listWeighIns(storage),
  activeEnergy: { '2026-09-13': 420 },
  exportedAt: '2026-09-13T12:00:00.000Z',
});
ok('Health bundle kind is mealnova-health-sync-v1', bundle.kind === 'mealnova-health-sync-v1');
ok('Health bundle exports intake + active energy + macros', bundle.daily[0].intake_kcal === 686 && bundle.daily[0].active_energy_kcal === 420 && bundle.daily[0].protein_g > 0);

const imported = parseHealthImport({
  records: [
    { type: 'activeEnergy', date: '2026-09-12', kcal: 380 },
    { type: 'bodyMass', date: '2026-09-12', kg: 72 },
  ],
});
ok('Health Connect-style records parse active energy', imported.activeEnergy['2026-09-12'] === 380);
ok('Health records can carry a weigh-in', imported.weighIns.some((row) => row.date === '2026-09-12' && row.kg === 72));

const applied = applyHealthImport(imported, { storage, addWeighInFn: addWeighIn });
ok('Imported active energy is stored', applied.activeEnergy['2026-09-12'] === 380);

const native = await tryNativeHealthSync({
  bundle,
  globalObj: {
    Capacitor: {
      getPlatform: () => 'ios',
      Plugins: {
        HealthKit: {
          async requestAuthorization() { return true; },
          async saveSample() { return true; },
        },
      },
    },
  },
});
ok('Native Apple Health adapter writes when HealthKit plugin exists', native.ok === true && native.bridge.name === 'Apple Health');

const webBridge = detectHealthBridge({});
ok('Web build reports no native Health plugin', webBridge.available === false);

const html = phase3RetentionHtml({
  tdee: ready,
  lastWeighIn: { date: '2026-09-14', kg: 79 },
  todayEnergyKcal: 420,
  health: { label: 'File export / import', detail: 'Use export' },
  dateKey: '2026-09-14',
});
ok('Settings expose adaptive TDEE controls', html.includes('id="saveWeighInBtn"') && html.includes('id="applyAdaptiveTdeeBtn"'));
ok('Settings expose Health export/import', html.includes('id="exportHealthBtn"') && html.includes('id="importHealthBtn"') && html.includes('id="nativeHealthBtn"'));

lines.push(`1..${passed + failed}`);
console.log(`\n${passed}/${passed + failed} passed`);
console.log(lines.join('\n'));
process.exit(failed ? 1 : 0);
