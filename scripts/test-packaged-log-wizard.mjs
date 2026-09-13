import { productToAnalysis } from '../src/services/barcode.js';
import {
  applyPackagedAmount,
  isPackagedLogSource,
  packagedAmountChoices,
  packagedAmountUnit,
  packagedServingGrams,
  resolvePackagedServing,
} from '../src/services/packaged-log.js';
import { packagedAmountPrompt } from '../src/services/packaged-log-wizard.js';

let passed = 0;
let failed = 0;
console.log('TAP version 13');

function ok(label, pass, detail = '') {
  if (pass) {
    passed += 1;
    console.log(`ok ${passed + failed} - ${label}`);
    return;
  }
  failed += 1;
  console.error(`not ok ${passed + failed} - ${label}${detail ? ` # ${detail}` : ''}`);
}

const yogurt = productToAnalysis({
  product_name: 'Greek style yogurt',
  brands: 'Test Brand',
  serving_size: '1 pot (150g)',
  serving_quantity: 150,
  nutriments: {
    'energy-kcal_serving': 146,
    proteins_serving: 9.5,
    carbohydrates_serving: 12.4,
    fat_serving: 6,
  },
}, '5000159407236');

ok('packaged sources are barcode and search only', isPackagedLogSource('barcode') && isPackagedLogSource('food_search') && !isPackagedLogSource('photo'));
ok('reads 150 g from the pack serving', packagedServingGrams(yogurt) === 150, `${packagedServingGrams(yogurt)}`);

const choices = packagedAmountChoices(yogurt);
ok('pack serving is the default grams hint', packagedServingGrams(yogurt) === 150 && choices[0].id === 'serving');

const half = applyPackagedAmount(yogurt, { amountId: 'half' });
ok('half a serving is 73 kcal', half.total_calories_kcal === 73, `${half.total_calories_kcal}`);
ok('half a serving is 75 g', Math.round(half._consumedGrams) === 75, `${half._consumedGrams}`);

const custom = applyPackagedAmount(yogurt, { amountId: 'custom', customGrams: 300 });
ok('typed 300 g doubles the pack kcal', custom.total_calories_kcal === 292, `${custom.total_calories_kcal}`);

let threw = false;
try { applyPackagedAmount(yogurt, { amountId: 'custom', customGrams: 0 }); } catch { threw = true; }
ok('custom grams must be greater than zero', threw);

ok('yogurt pot stays in grams', resolvePackagedServing({
  product_name: 'Greek style yogurt',
  serving_size: '1 pot (150g)',
  serving_quantity: 150,
}).unit === 'g');

const cola = productToAnalysis({
  product_name: 'Pepsi',
  brands: 'Pepsi',
  quantity: '330 ml',
  serving_size: '330ml',
  serving_quantity: 330,
  serving_quantity_unit: 'ml',
  nutriments: { 'energy-kcal_serving': 6, 'energy-kcal_100g': 2 },
}, '5449000000996');
ok('soft drink uses ml', packagedAmountUnit(cola) === 'ml' && packagedServingGrams(cola) === 330);
ok('soft drink asks for ml', packagedAmountPrompt(cola).question === 'How many ml did you have?');
ok('yogurt still asks for grams', packagedAmountPrompt(yogurt).question === 'How many grams did you have?');

const drunk = applyPackagedAmount(cola, { amountId: 'custom', customGrams: 165 });
ok('half a can scales drink kcal', drunk.total_calories_kcal === 3, `${drunk.total_calories_kcal}`);
ok('drink save keeps ml on the item', drunk.items[0]._displayUnit === 'ml' && drunk.items[0]._volumeMl === 165);

console.log(`1..${passed + failed}`);
console.log(`${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
