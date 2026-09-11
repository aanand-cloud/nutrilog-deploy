/** Lookup packaged food via Open Food Facts (free, no API key). */

import { barcodeNotFoundMessage } from './packaged-food-hints.js';

export async function lookupBarcodeProduct(code) {
  const barcode = String(code || '').replace(/\D/g, '');
  if (barcode.length < 8) {
    throw new Error('Enter a valid barcode (8+ digits)');
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,quantity,serving_size,serving_quantity,nutriments,image_front_small_url`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not look up product');
  const data = await res.json();
  if (data.status !== 1 || !data.product) {
    throw new Error(barcodeNotFoundMessage());
  }
  return productToAnalysis(data.product, barcode);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fromLabel(n, keys, scale = 1) {
  for (const key of keys) {
    if (n[key] == null || n[key] === '') continue;
    const v = Number(n[key]);
    if (Number.isFinite(v)) return round1(v * scale);
  }
  return null;
}

export function productToAnalysis(product, barcode, source = 'barcode') {
  const n = product.nutriments || {};
  const hasServing = Boolean(product.serving_quantity || product.serving_size);
  const servingG = num(product.serving_quantity) || 100;
  const factor = servingG / 100;

  const kcal100 = num(n['energy-kcal_100g']) || num(n.energy_kcal_100g) || (num(n.energy_100g) / 4.184);
  const kcalServing = num(n['energy-kcal_serving']) || num(n.energy_kcal_serving);
  const kcal = hasServing && kcalServing
    ? Math.round(kcalServing)
    : Math.round(kcal100 * factor) || Math.round(kcalServing);

  const nutrition = {
    protein_g: fromLabel(n, ['proteins_serving']) ?? fromLabel(n, ['proteins_100g'], factor),
    carbs_g: fromLabel(n, ['carbohydrates_serving']) ?? fromLabel(n, ['carbohydrates_100g'], factor),
    fat_g: fromLabel(n, ['fat_serving']) ?? fromLabel(n, ['fat_100g'], factor),
    fibre_g: fromLabel(n, ['fiber_serving', 'fibre_serving']) ?? fromLabel(n, ['fiber_100g', 'fibre_100g'], factor),
    sugar_g: fromLabel(n, ['sugars_serving']) ?? fromLabel(n, ['sugars_100g'], factor),
    salt_mg: fromLabel(n, ['salt_serving'], 1000)
      ?? fromLabel(n, ['sodium_serving'], 2500)
      ?? fromLabel(n, ['salt_100g'], factor * 1000)
      ?? fromLabel(n, ['sodium_100g'], factor * 2500),
  };

  const name = [product.product_name, product.brands].filter(Boolean).join(' — ') || 'Packaged food';
  const portion = product.serving_size || (hasServing ? `${servingG}g serving` : 'Per 100 g — enter how much you ate');
  const confidence = hasServing ? 0.88 : 0.72;

  return {
    meal_summary: name,
    total_calories_kcal: kcal,
    total_nutrition: nutrition,
    confidence_score: confidence,
    items: [
      {
        name,
        portion_estimate: portion,
        calories_kcal: kcal,
        nutrition: { ...nutrition },
        confidence,
        _labelBacked: true,
        _labelServing: hasServing,
        _packServingKnown: hasServing,
        _weightSource: hasServing ? 'label_serving' : 'per_100g',
      },
    ],
    clarification_questions: [],
    source,
    barcode,
    imageUrl: product.image_front_small_url || null,
    _labelBacked: true,
    _packServingKnown: hasServing,
  };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
