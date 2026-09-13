/** Lookup packaged food via Open Food Facts and local UK branded tables. */

import { barcodeNotFoundMessage } from './packaged-food-hints.js';
import { gtinCandidates, isValidGtin, normalizeGtin } from './gtin.js';
import { isZeroSugarSoftDrink, matchBrandedServing } from '../../shared/branded-uk-servings.js';

/** Official pack codes only — never invent GTINs. */
export const LOCAL_BRANDED_BY_GTIN = Object.freeze({});

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

function round1(v) {
  return Math.round(v * 10) / 10;
}

function overlayServing(analysis, serving) {
  const nutrition = { ...serving.nutrition };
  const item = {
    ...(analysis.items?.[0] || {}),
    name: serving.name,
    calories_kcal: serving.kcal,
    nutrition,
    confidence: 0.92,
    _labelBacked: true,
    _packServingKnown: true,
    _brandedServing: true,
    _nutritionSource: serving.source || 'official_brand_uk',
    _weightSource: 'official_brand_uk',
  };
  return {
    ...analysis,
    meal_summary: serving.name,
    total_calories_kcal: serving.kcal,
    total_nutrition: nutrition,
    confidence_score: 0.92,
    items: [item],
    _brandedServing: true,
  };
}

export function lookupLocalBrandedByGtin(code) {
  const gtin = normalizeGtin(code);
  const row = LOCAL_BRANDED_BY_GTIN[gtin] || LOCAL_BRANDED_BY_GTIN[String(code || '').replace(/\D/g, '')];
  if (!row) return null;
  return productToAnalysis({
    product_name: row.name,
    brands: row.brand || '',
    serving_size: row.serving_size || '1 serving',
    serving_quantity: row.serving_quantity || 100,
    nutriments: row.nutriments || {},
  }, gtin, 'local_branded');
}

export function applyBrandedBarcodeOverlay(analysis) {
  if (!analysis) return analysis;
  const name = analysis.meal_summary || analysis.items?.[0]?.name || '';
  const branded = matchBrandedServing(name);
  if (branded) return overlayServing(analysis, branded);
  if (isZeroSugarSoftDrink(name)) {
    const portion = String(analysis.items?.[0]?.portion_estimate || '');
    const ml = Number((portion.match(/(\d+(?:\.\d+)?)\s*ml/i) || [])[1]) || 330;
    const kcal = Math.max(1, Math.round(ml * 0.008));
    return overlayServing(analysis, {
      name: name.trim() || 'Zero-sugar soft drink',
      kcal,
      source: 'zero_sugar_soft_drink',
      nutrition: { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugar_g: 0, salt_mg: null },
    });
  }
  return analysis;
}

export async function lookupBarcodeProduct(code) {
  const codes = gtinCandidates(code).filter(isValidGtin);
  if (!codes.length) {
    throw new Error('Enter a valid barcode (8+ digits)');
  }

  let lastError = null;
  let sawMiss = false;
  for (const barcode of codes) {
    const local = lookupLocalBrandedByGtin(barcode);
    if (local) return applyBrandedBarcodeOverlay(local);

    try {
      const product = await fetchOffProduct(barcode);
      if (!product) {
        sawMiss = true;
        continue;
      }
      return applyBrandedBarcodeOverlay(productToAnalysis(product, barcode));
    } catch (err) {
      lastError = err;
    }
  }

  if (sawMiss && !lastError) throw new Error(barcodeNotFoundMessage());
  throw lastError || new Error(barcodeNotFoundMessage());
}

async function fetchOffProduct(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,quantity,serving_size,serving_quantity,nutriments,image_front_small_url`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not look up product');
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}

export function productToAnalysis(product, barcode, source = 'barcode') {
  const n = product.nutriments || {};
  const hasServing = Boolean(product.serving_quantity || product.serving_size);
  const servingG = num(product.serving_quantity) || 100;
  const factor = servingG / 100;
  const gtin = normalizeGtin(barcode) || String(barcode || '').replace(/\D/g, '');

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
        barcode: gtin,
        _labelBacked: true,
        _labelServing: hasServing,
        _packServingKnown: hasServing,
        _weightSource: hasServing ? 'label_serving' : 'per_100g',
      },
    ],
    clarification_questions: [],
    source,
    barcode: gtin,
    imageUrl: product.image_front_small_url || null,
    _labelBacked: true,
    _packServingKnown: hasServing,
  };
}
