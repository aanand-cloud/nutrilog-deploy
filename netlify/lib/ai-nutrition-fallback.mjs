/**
 * Server-only: ask Gemini for missed mixed foods.
 * Identification still comes from the photo pass. This never writes catalogs.
 */

import { geminiGenerate, defaultTextModel } from './gemini.mjs';
import { logGeminiUsage } from './gemini-usage.mjs';
import {
  applyLowConfidenceNutritionResult,
  listAiNutritionFallbackItems,
} from '../../shared/low-confidence-nutrition.js';
import { sanitizeAnalysisTotals } from '../../shared/nutrition-sanitize.js';
import { scoreMealConfidence } from '../../shared/nutrition-confidence.js';
import { isFlagEnabled } from '../../shared/feature-flags.js';

export const AI_NUTRITION_FALLBACK_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          components: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                grams: { type: 'number' },
                usda_search_term: { type: 'string' },
              },
              required: ['name', 'grams'],
            },
          },
          per100: {
            type: 'object',
            properties: {
              kcal: { type: 'number' },
              protein_g: { type: 'number' },
              carbs_g: { type: 'number' },
              fat_g: { type: 'number' },
              fibre_g: { type: 'number' },
            },
            required: ['kcal', 'protein_g', 'carbs_g', 'fat_g'],
          },
        },
        required: ['index', 'per100'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM_PROMPT = 'You help MealNova only when it has no official nutrition row. Split mixed foods into identifiable ingredients with grams so they can be looked up. Also give a last-resort per-100 g estimate for the whole food as eaten. Never invent branded pack values. If fibre is unknown, omit it or use 0 — MealNova will treat 0 as unavailable. Always return JSON that matches the schema.';

function withTimeout(promise, ms = 8000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI nutrition fallback timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function fallbackPrompt(analysis, needy) {
  const rows = needy.map(({ item, index }) => ({
    index,
    name: item.name,
    grams: Math.round(Number(item._hiddenGrams || item._visionMeta?.amount) || 120),
    usda_search_term: item._usdaSearchTerm || item._visionMeta?.usda_search_term || '',
    cooking_method: item._visionMeta?.cooking_method || '',
    oil_tbsp: item._visionMeta?.estimated_oil_tbsp || 0,
  }));
  return `Meal: ${analysis.meal_summary || 'Meal'}
MealNova could not match these items to an official nutrition table. For each item:
1. Split into ordinary ingredients with grams (prefer names MealNova can look up: chicken, rice, onion, tomato, oil).
2. Also give per-100 g kcal, protein_g, carbs_g, fat_g for the whole item as eaten. fibre_g only if you are confident.

Items:
${JSON.stringify(rows, null, 2)}`;
}

async function askGemini(apiKey, prompt) {
  return geminiGenerate({
    apiKey,
    model: defaultTextModel(),
    systemPrompt: SYSTEM_PROMPT,
    parts: [{ text: prompt }],
    temperature: 0.1,
    maxOutputTokens: 800,
    responseSchema: AI_NUTRITION_FALLBACK_SCHEMA,
  });
}

/**
 * @param {object} analysis
 * @param {{ geminiKey?: string }} keys
 */
export async function enrichAnalysisWithAiNutritionFallback(analysis, keys = {}) {
  if (!analysis || analysis._labelBacked || analysis.source === 'barcode') return analysis;
  if (!isFlagEnabled('aiNutritionFallback')) return analysis;
  const needy = listAiNutritionFallbackItems(analysis);
  if (!needy.length) return analysis;
  const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY || '';
  if (!geminiKey) return analysis;

  try {
    const prompt = fallbackPrompt(analysis, needy);
    const response = await withTimeout(askGemini(geminiKey, prompt));
    if (!response?.result) return analysis;

    if (response.usage && response.model) {
      logGeminiUsage({
        operation: 'analyze-food-nutrition-fallback',
        model: response.model,
        usage: response.usage,
        extra: { itemCount: needy.length },
      });
    }

    const byIndex = new Map(
      (response.result.items || []).map((row) => [Number(row.index), row]),
    );
    const items = (analysis.items || []).map((item, index) => {
      const row = byIndex.get(index);
      if (!row) return item;
      return applyLowConfidenceNutritionResult(item, row);
    });

    const next = sanitizeAnalysisTotals({
      ...analysis,
      items,
      _aiNutritionFallbackApplied: items.some((item) => item._aiNutritionFallback || item._aiDecomposed),
    });
    next._confidence = scoreMealConfidence(next);
    return next;
  } catch {
    return analysis;
  }
}
