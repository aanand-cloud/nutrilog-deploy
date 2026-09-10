/**
 * Phase 1 — parsing integrity and input/output reconciliation.
 * Ensures every recognised food, quantity and preparation reaches the final calculation.
 * Suspicious mismatches block the result — no silent repair.
 */

import {
  splitMealPhrases,
  parseQuantityFromText,
  phraseHasExplicitQuantity,
  parsePreparationState,
} from './quantity-parser.js';

export const PHASE1_TARGETS = {
  quantityRetention: 0.99,
  quantityFoodBinding: 0.999,
  componentSplitting: 0.98,
  silentOmissions: 0.005,
  falseDuplicates: 0.005,
};

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function itemBlob(item = {}) {
  return `${item.name || ''} ${item.portion_estimate || ''} ${item._refId || ''} ${item._sourcePhrase || ''}`.toLowerCase();
}

function quantityReflectedInItem(item, q) {
  if (!item || !q) return false;
  if (item._boundQuantity?.amount != null && item._boundQuantity?.unit === q.unit) {
    return Math.abs(num(item._boundQuantity.amount) - num(q.amount)) < 0.01;
  }
  const blob = itemBlob(item);
  const food = String(q.foodText || '').toLowerCase();
  if (q.unit === 'g' && blob.includes(`${Math.round(q.quantity)}g`)) return true;
  if (q.unit === 'ml' && blob.includes(`${Math.round(q.quantity)}ml`)) return true;
  if (q.unit === 'piece') {
    if (new RegExp(`\\b${Math.round(q.quantity)}\\s*piece`, 'i').test(item.portion_estimate || '')) return true;
    if (item._hiddenGrams && q.quantity > 0) {
      const nameCount = String(item.name || '').match(/^(\d+)\b/);
      if (nameCount && Number(nameCount[1]) === Math.round(q.quantity)) return true;
    }
  }
  if (food.length > 2 && blob.includes(food.slice(0, Math.min(food.length, 12)))) return true;
  return false;
}

function phraseReflectedInItems(phrase, items = []) {
  const q = parseQuantityFromText(phrase);
  const prep = parsePreparationState(q.foodText || phrase);
  const foodNeedle = (prep.foodText || q.foodText || phrase).toLowerCase().trim();
  if (!foodNeedle) return false;

  const bound = items.filter((item) => item._sourcePhrase === phrase);
  const pool = bound.length ? bound : items;

  if (phraseHasExplicitQuantity(q)) {
    return pool.some((item) => quantityReflectedInItem(item, q));
  }

  return pool.some((item) => {
    const blob = itemBlob(item);
    const tokens = foodNeedle.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length === 0) return blob.includes(foodNeedle.slice(0, 8));
    return tokens.some((t) => blob.includes(t));
  });
}

function phraseMentionsRef(phrase = '', refId = '') {
  const q = parseQuantityFromText(phrase);
  const food = (parsePreparationState(q.foodText || phrase).foodText || q.foodText || phrase).toLowerCase();
  const id = String(refId || '').replace(/_/g, ' ').toLowerCase();
  return food.includes(id) || id.split(' ').some((tok) => tok.length > 3 && food.includes(tok));
}

function detectFalseDuplicateRefs(sourceText = '', items = []) {
  const phrases = splitMealPhrases(sourceText);
  const refCounts = new Map();
  for (const item of items) {
    if (!item._refId) continue;
    refCounts.set(item._refId, (refCounts.get(item._refId) || 0) + 1);
  }

  const errors = [];
  for (const [refId, count] of refCounts) {
    if (count <= 1) continue;
    const mentions = phrases.filter((phrase) => phraseMentionsRef(phrase, refId)).length;
    if (mentions <= 1) {
      errors.push({
        code: 'duplicate_component',
        severity: 'error',
        refId,
        count,
        message: `"${refId.replace(/_/g, ' ')}" appears ${count} times but the input mentions it once — merge or remove the duplicate.`,
      });
    }
  }
  return errors;
}

function detectQuantityMismatches(phrases = [], items = []) {
  const errors = [];
  for (const phrase of phrases) {
    const q = parseQuantityFromText(phrase);
    if (!phraseHasExplicitQuantity(q)) continue;
    const bound = items.filter((item) => item._sourcePhrase === phrase);
    if (!bound.length) continue;

    for (const item of bound) {
      const expected = (q.unit === 'g' || q.unit === 'ml') ? num(q.amount) : null;
      const actual = num(item._hiddenGrams) || num(item._boundQuantity?.amount);
      if (expected == null || actual <= 0) continue;
      const tolerance = Math.max(1, expected * 0.05);
      if (Math.abs(actual - expected) > tolerance) {
        errors.push({
          code: 'quantity_changed',
          severity: 'error',
          phrase,
          expected,
          actual: Math.round(actual),
          item: item.name,
          message: `Quantity for "${phrase}" changed from ${Math.round(expected)}${q.unit} to ~${Math.round(actual)}g in "${item.name}".`,
        });
      }
    }
  }
  return errors;
}

function detectUnexpectedComponents(phrases = [], items = []) {
  if (phrases.length <= 1) return [];
  const errors = [];
  for (const item of items) {
    if (item._unmatched || item._recipeDerived || item._hiddenOil) continue;
    if (item._sourcePhrase && phrases.includes(item._sourcePhrase)) continue;
    if (!item._sourcePhrase) {
      errors.push({
        code: 'unexpected_component',
        severity: 'error',
        item: item.name,
        message: `"${item.name}" was added but was not in your description.`,
      });
    }
  }
  return errors;
}

function detectUnusedExplicitQuantities(phrases = [], items = []) {
  const errors = [];
  for (const phrase of phrases) {
    const q = parseQuantityFromText(phrase);
    if (!phraseHasExplicitQuantity(q)) continue;
    const bound = items.filter((item) => item._sourcePhrase === phrase);
    const pool = bound.length ? bound : items;
    if (!pool.some((item) => quantityReflectedInItem(item, q))) {
      errors.push({
        code: 'quantity_unused',
        severity: 'error',
        phrase,
        message: `Entered quantity in "${phrase}" is not reflected in any logged item.`,
      });
    }
  }
  return errors;
}

/**
 * Compare original input phrases with resolved line items.
 * @param {string} sourceText
 * @param {object} analysis
 */
export function reconcileMealInputOutput(sourceText = '', analysis = {}) {
  const phrases = analysis?._sourcePhrases?.length
    ? analysis._sourcePhrases
    : splitMealPhrases(sourceText);
  const items = analysis?.items || [];

  const phraseCoverage = phrases.map((phrase) => ({
    phrase,
    reflected: phraseReflectedInItems(phrase, items),
  }));

  const missingPhrases = phraseCoverage.filter((p) => !p.reflected).map((p) => p.phrase);

  let explicitTotal = 0;
  let explicitRetained = 0;
  for (const phrase of phrases) {
    const q = parseQuantityFromText(phrase);
    if (!phraseHasExplicitQuantity(q)) continue;
    explicitTotal += 1;
    const bound = items.filter((item) => item._sourcePhrase === phrase);
    const pool = bound.length ? bound : items;
    if (pool.some((item) => quantityReflectedInItem(item, q))) explicitRetained += 1;
  }

  const duplicateKeys = new Map();
  for (const item of items) {
    const key = `${item._sourcePhrase || ''}|${item._refId || item.name || ''}`.toLowerCase();
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
  }
  const falseDuplicates = [...duplicateKeys.values()].filter((count) => count > 1).length;

  const componentSplitting = phrases.length
    ? Math.min(1, items.length / phrases.length)
    : 1;

  const quantityRetention = explicitTotal ? explicitRetained / explicitTotal : 1;
  const quantityFoodBinding = phrases.length
    ? phraseCoverage.filter((p) => p.reflected).length / phrases.length
    : 1;
  const silentOmissionRate = phrases.length ? missingPhrases.length / phrases.length : 0;
  const falseDuplicateRate = items.length ? falseDuplicates / items.length : 0;

  const metrics = {
    quantityRetention,
    quantityFoodBinding,
    componentSplitting,
    silentOmissions: silentOmissionRate,
    falseDuplicates: falseDuplicateRate,
    phraseCount: phrases.length,
    itemCount: items.length,
    explicitQuantityCount: explicitTotal,
    missingPhrases,
  };

  const passes = {
    quantityRetention: quantityRetention >= PHASE1_TARGETS.quantityRetention,
    quantityFoodBinding: quantityFoodBinding >= PHASE1_TARGETS.quantityFoodBinding,
    componentSplitting: componentSplitting >= PHASE1_TARGETS.componentSplitting,
    silentOmissions: silentOmissionRate < PHASE1_TARGETS.silentOmissions,
    falseDuplicates: falseDuplicateRate < PHASE1_TARGETS.falseDuplicates,
  };

  return {
    phrases,
    metrics,
    passes,
    pass: Object.values(passes).every(Boolean),
    missingPhrases,
  };
}

/**
 * Attach reconciliation metadata — block suspicious results, do not silently repair.
 * @param {object} analysis
 * @param {string} [sourceText]
 */
export function applyParsingIntegrity(analysis, sourceText = '') {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const raw = sourceText || analysis._sourceText || '';
  const items = [...(analysis.items || [])];

  const reconciliation = reconcileMealInputOutput(raw, { ...analysis, items });
  const issues = [...(analysis._mealValidation?.issues || [])];

  for (const phrase of reconciliation.missingPhrases) {
    if (issues.some((i) => i.code === 'silent_omission' && i.phrase === phrase)) continue;
    issues.push({
      code: 'silent_omission',
      severity: 'error',
      phrase,
      message: `Input phrase not reflected in logged items: "${phrase}".`,
    });
  }

  for (const dup of detectFalseDuplicateRefs(raw, items)) {
    if (issues.some((i) => i.code === 'duplicate_component' && i.refId === dup.refId)) continue;
    issues.push(dup);
  }

  for (const mismatch of detectQuantityMismatches(reconciliation.phrases, items)) {
    if (issues.some((i) => i.code === 'quantity_changed' && i.phrase === mismatch.phrase)) continue;
    issues.push(mismatch);
  }

  for (const unexpected of detectUnexpectedComponents(reconciliation.phrases, items)) {
    if (issues.some((i) => i.code === 'unexpected_component' && i.item === unexpected.item)) continue;
    issues.push(unexpected);
  }

  for (const unused of detectUnusedExplicitQuantities(reconciliation.phrases, items)) {
    if (issues.some((i) => i.code === 'quantity_unused' && i.phrase === unused.phrase)) continue;
    issues.push(unused);
  }

  const duplicateByPhraseRef = new Map();
  for (const item of items) {
    const key = `${item._sourcePhrase || ''}|${item._refId || ''}`.toLowerCase();
    if (!key.trim()) continue;
    duplicateByPhraseRef.set(key, (duplicateByPhraseRef.get(key) || 0) + 1);
  }
  const warnings = [...(analysis._mealValidation?.warnings || [])];
  for (const [key, count] of duplicateByPhraseRef) {
    if (count <= 1) continue;
    const [, refId] = key.split('|');
    if (issues.some((i) => i.code === 'duplicate_component' && i.refId === refId)) continue;
    warnings.push({
      code: 'duplicate_component',
      severity: 'warning',
      refId,
      count,
      message: `"${refId || key}" appears ${count} times from the same phrase — check for duplication.`,
    });
  }

  const blocked = issues.some((i) => i.severity === 'error');
  const validation = {
    ...(analysis._mealValidation || {}),
    issues,
    warnings,
    valid: issues.length === 0,
    complete: issues.length === 0,
    status: issues.length ? 'incomplete' : (warnings.length ? 'uncertain' : 'complete'),
  };

  return {
    ...analysis,
    items,
    _inputOutputReconciliation: reconciliation,
    _reconciliationBlocked: blocked,
    _reconciliationIssues: issues,
    _mealValidation: validation,
    _mealIncomplete: !validation.complete,
    _mealStatus: validation.status,
  };
}
