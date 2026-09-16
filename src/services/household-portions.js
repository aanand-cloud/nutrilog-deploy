/**
 * Familiar household measures with transparent gram equivalents.
 * Mass/volume/count unit switches keep the underlying grams.
 */

import { roundDisplay } from './eaten-amount.js';

export const PORTION_UNITS = [
  { id: 'g', label: 'g', kind: 'mass', gramsPer: 1 },
  { id: 'kg', label: 'kg', kind: 'mass', gramsPer: 1000 },
  { id: 'oz', label: 'oz', kind: 'mass', gramsPer: 28.349523125 },
  { id: 'ml', label: 'ml', kind: 'volume', gramsPer: 1 },
  { id: 'tsp', label: 'tsp', kind: 'household', gramsPer: 5 },
  { id: 'tbsp', label: 'tbsp', kind: 'household', gramsPer: 15 },
  { id: 'cup', label: 'cup', kind: 'household', gramsPer: 240 },
  { id: 'slice', label: 'slice', kind: 'household', gramsPer: 30 },
  { id: 'piece', label: 'pieces', kind: 'household', gramsPer: 45 },
  { id: 'bowl', label: 'bowl', kind: 'household', gramsPer: 250 },
  { id: 'glass', label: 'glass', kind: 'household', gramsPer: 250 },
  { id: 'handful', label: 'handful', kind: 'household', gramsPer: 30 },
  { id: 'small', label: 'small', kind: 'size', factor: 0.75 },
  { id: 'medium', label: 'medium', kind: 'size', factor: 1 },
  { id: 'large', label: 'large', kind: 'size', factor: 1.35 },
  { id: 'unsure', label: 'not sure', kind: 'unsure' },
];

export function getPortionUnit(id) {
  return PORTION_UNITS.find((u) => u.id === id) || PORTION_UNITS[0];
}

export function keepsUnderlyingGrams(unitId) {
  const kind = getPortionUnit(unitId).kind;
  return kind === 'mass' || kind === 'volume' || kind === 'household';
}

export function displayAmountFromGrams(grams, unitId) {
  const unit = getPortionUnit(unitId);
  if (unit.kind === 'size' || unit.kind === 'unsure') return 1;
  const per = unit.gramsPer || 1;
  return grams / per;
}

export function gramsFromDisplayAmount(amount, unitId, baseGrams = 100) {
  const unit = getPortionUnit(unitId);
  if (unit.kind === 'unsure') return baseGrams;
  if (unit.kind === 'size') return baseGrams * (unit.factor || 1);
  return Number(amount) * (unit.gramsPer || 1);
}

export function householdEquivalentLabel(grams, unitId, amount) {
  const unit = getPortionUnit(unitId);
  if (unit.id === 'g') return `Entered serving: ${roundDisplay(grams)} g`;
  if (unit.id === 'kg') {
    return `Entered serving: ${roundDisplay(amount, 2)} kg (${roundDisplay(grams)} g)`;
  }
  if (unit.kind === 'unsure') {
    return `Estimated ${roundDisplay(grams)} g · amount not confirmed`;
  }
  if (unit.kind === 'size') {
    return `1 ${unit.label.toLowerCase()} · Estimated as approximately ${roundDisplay(grams)} g`;
  }
  const shown = roundDisplay(amount, unit.id === 'oz' || unit.kind === 'household' ? 1 : 0);
  return `${shown} ${unit.label.toLowerCase()} · Estimated as approximately ${roundDisplay(grams)} g`;
}

export function portionSourceLabel(item = {}) {
  if (item._weightSource === 'measured' || item._measuredWeight) return 'Measured weight';
  if (item._userEnteredWeight) return 'User-entered weight';
  if (item._labelServing) return 'Database serving';
  if (item._volumeConverted) return 'Converted volume-to-weight estimate';
  return 'Estimated portion';
}
