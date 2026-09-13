/** Gemini structured output schemas — keeps responses short and parseable. */

export const FOOD_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    meal_summary: { type: 'string' },
    total_calories_kcal: { type: 'number' },
    total_nutrition: {
      type: 'object',
      properties: {
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
        sugar_g: { type: 'number' },
        fibre_g: { type: 'number' },
        salt_mg: { type: 'number' },
      },
    },
    confidence_score: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion_estimate: { type: 'string' },
          calories_kcal: { type: 'number' },
          nutrition: {
            type: 'object',
            properties: {
              protein_g: { type: 'number' },
              carbs_g: { type: 'number' },
              fat_g: { type: 'number' },
            },
          },
          confidence: { type: 'number' },
        },
      },
    },
    clarification_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          question: { type: 'string' },
          about: { type: 'string' },
        },
      },
    },
  },
  required: ['meal_summary', 'total_calories_kcal', 'total_nutrition', 'items', 'clarification_questions'],
};

/** Vision identifies food + portions only — MealNova looks up nutrition. */
export const VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    meal_summary: { type: 'string' },
    confidence_score: { type: 'number' },
    notes: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          usda_search_term: { type: 'string' },
          unit: { type: 'string' },
          estimated_amount: { type: 'number' },
          cooking_method: { type: 'string' },
          estimated_oil_tbsp: { type: 'number' },
          visible_oil: { type: 'boolean' },
          confidence: { type: 'number' },
        },
        required: ['name', 'unit', 'estimated_amount'],
      },
    },
    clarification_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          question: { type: 'string' },
          about: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  required: ['meal_summary', 'items', 'clarification_questions'],
};

export const CUISINE_TIPS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    patterns: { type: 'array', items: { type: 'string' } },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          cuisine: { type: 'string' },
        },
      },
    },
  },
  required: ['patterns', 'tips'],
};

export const MNOVA_CHAT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['reply', 'suggestions'],
};
