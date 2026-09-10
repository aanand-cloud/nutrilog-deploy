/** Barcode lookup for packaged supplements via Open Food Facts (free, no API key). */

import { barcodeNotFoundMessage } from './packaged-food-hints.js';

const OFF_FIELDS = [
  'code',
  'product_name',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'image_front_small_url',
  'categories_tags',
].join(',');

/** Micronutrients we surface on supplement cards (per serving when available). */
export const SUPPLEMENT_MICRO_FIELDS = [
  { key: 'vitamin_d', off: 'vitamin-d', unit: 'µg', label: 'Vitamin D' },
  { key: 'vitamin_c', off: 'vitamin-c', unit: 'mg', label: 'Vitamin C' },
  { key: 'vitamin_b12', off: 'vitamin-b12', unit: 'µg', label: 'Vitamin B12' },
  { key: 'calcium', off: 'calcium', unit: 'mg', label: 'Calcium' },
  { key: 'iron', off: 'iron', unit: 'mg', label: 'Iron' },
  { key: 'magnesium', off: 'magnesium', unit: 'mg', label: 'Magnesium' },
  { key: 'zinc', off: 'zinc', unit: 'mg', label: 'Zinc' },
  { key: 'folate', off: 'folates', unit: 'µg', label: 'Folate' },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

export function extractMicronutrientsFromProduct(nutriments, servingFactor = 1) {
  const n = nutriments || {};
  const out = {};
  for (const field of SUPPLEMENT_MICRO_FIELDS) {
    const per100 = num(n[`${field.off}_100g`]);
    const perServing = num(n[`${field.off}_serving`]);
    const val = perServing > 0 ? perServing : per100 * servingFactor;
    if (val > 0) {
      out[field.key] = {
        value: round2(val),
        unit: field.unit,
        label: field.label,
      };
    }
  }
  return out;
}

export async function lookupSupplementProduct(code) {
  const barcode = String(code || '').replace(/\D/g, '');
  if (barcode.length < 8) {
    throw new Error('Enter a valid barcode (8+ digits)');
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not look up product');
  const data = await res.json();
  if (data.status !== 1 || !data.product) {
    throw new Error(barcodeNotFoundMessage());
  }

  const product = data.product;
  const n = product.nutriments || {};
  const servingG = num(product.serving_quantity) || 100;
  const factor = servingG / 100;
  const micronutrients = extractMicronutrientsFromProduct(n, factor);

  const productName = String(product.product_name || '').trim() || 'Supplement';
  const brand = String(product.brands || '').trim();
  const dose = product.serving_size || product.quantity || '';

  return {
    name: productName,
    brand,
    dose: String(dose || '').trim(),
    barcode,
    micronutrients,
    imageUrl: product.image_front_small_url || null,
    categories: product.categories_tags || [],
  };
}
