/** Max quick questions after a photo scan — keeps the flow fast. */
export const MAX_CLARIFICATION_QUESTIONS = 3;

const TOPIC_PRIORITY = [
  'drink_volume',
  'drink_type',
  'portion_snack',
  'portion_solid',
  'bread_count',
  'oil_fat',
  'sauce_gravy',
  'protein_type',
  'cooking_method',
  'generic_portion',
];

const HIGH_IMPACT_TOPICS = new Set([
  'drink_volume',
  'portion_snack',
  'portion_solid',
  'oil_fat',
  'bread_count',
]);

const OPTION_SETS = {
  drink_volume: [
    'Small glass (~150 ml)',
    'Regular glass (~250 ml)',
    'Can / bottle (~330 ml)',
    'Large (~500 ml)',
  ],
  drink_type: [
    'Water / plain tea',
    'Juice or smoothie',
    'Soft drink (regular)',
    'Coffee / milk tea',
    'Alcohol',
  ],
  portion_snack: [
    'Small handful (~30 g)',
    'Snack size (~50 g)',
    'Standard (~100 g)',
    'Large (~150 g+)',
  ],
  portion_solid: [
    'Small (~100 g)',
    'Medium (~150 g)',
    'Large (~250 g)',
    'Extra large (~350 g+)',
  ],
  bread_count: [
    '1 piece / roti / slice',
    '2 pieces',
    '3 pieces',
    '4 or more',
  ],
  oil_fat: [
    'Very little oil / butter',
    'Normal home cooking',
    'Oily / restaurant-style',
    'Deep-fried',
  ],
  sauce_gravy: [
    'Mostly dry — little sauce',
    'Normal sauce / curry',
    'Lots of gravy or sauce',
  ],
  protein_type: [
    'Chicken',
    'Lamb / beef',
    'Fish / seafood',
    'Vegetarian (paneer / tofu / dal)',
    'Mixed / not sure',
  ],
  cooking_method: [
    'Grilled / baked',
    'Pan-fried / stir-fried',
    'Steamed / boiled',
    'Deep-fried',
    'Raw / salad',
  ],
  generic_portion: [
    'Small portion',
    'Medium portion',
    'Large portion',
    'Extra large',
  ],
};

const STEP_UI = {
  drink_volume: {
    helper: 'Drinks are counted in millilitres (ml). A rough estimate is fine.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 250 ml',
    inputMode: 'decimal',
  },
  drink_type: {
    helper: 'This helps us estimate sugar and calories in your drink.',
    inputLabel: 'Or name the drink',
    inputPlaceholder: 'e.g. mango lassi, diet cola',
    inputMode: 'text',
  },
  portion_snack: {
    helper: 'Snacks are easiest to estimate in grams (g).',
    inputLabel: 'Or type weight',
    inputPlaceholder: 'e.g. 40 g',
    inputMode: 'decimal',
  },
  portion_solid: {
    helper: 'A rough gram (g) weight improves accuracy for solid food.',
    inputLabel: 'Or type weight',
    inputPlaceholder: 'e.g. 180 g',
    inputMode: 'decimal',
  },
  bread_count: {
    helper: 'Count pieces if easier — we convert to a sensible portion.',
    inputLabel: 'Or type your answer',
    inputPlaceholder: 'e.g. 2 roti, 1 naan',
    inputMode: 'text',
  },
  oil_fat: {
    helper: 'Oil and frying style change calories more than most people expect.',
    inputLabel: 'Or describe',
    inputPlaceholder: 'e.g. shallow fried in ghee',
    inputMode: 'text',
  },
  sauce_gravy: {
    helper: 'Sauces and curry gravies can add a lot of hidden calories.',
    inputLabel: 'Or describe',
    inputPlaceholder: 'e.g. thick coconut curry',
    inputMode: 'text',
  },
  protein_type: {
    helper: 'Pick the main protein if the dish is mixed.',
    inputLabel: 'Or type protein',
    inputPlaceholder: 'e.g. prawns, soya chunks',
    inputMode: 'text',
  },
  cooking_method: {
    helper: 'How it was cooked affects fat and calories.',
    inputLabel: 'Or describe',
    inputPlaceholder: 'e.g. air-fried, tandoori',
    inputMode: 'text',
  },
  generic_portion: {
    helper: 'Pick the closest match — exact numbers are not required.',
    inputLabel: 'Or type your answer',
    inputPlaceholder: 'Your answer…',
    inputMode: 'text',
  },
};

function mealContext(analysis) {
  const text = [
    analysis?.meal_summary,
    ...(analysis?.items || []).map((i) => `${i.name || ''} ${i.portion_estimate || ''}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    text,
    hasDrink: /\b(drink|beverage|coffee|tea|juice|water|soda|cola|beer|wine|milkshake|smoothie|latte|cappuccino|lassi|chaa|chai|ml\b|cup of)\b/.test(
      text,
    ),
    hasSnack: /\b(snack|chip|crisp|nut|biscuit|cookie|bar|popcorn|samosa|pakora|fries|chips|namkeen|murukku|mixture| chocolate)\b/.test(
      text,
    ),
    hasBread: /\b(bread|roti|naan|chapati|paratha|toast|pita|tortilla|wrap| bun|roll|dosa|idli|vada|puri)\b/.test(
      text,
    ),
    hasRicePasta: /\b(rice|biryani|pulao|pasta|noodle|noodles|spaghetti|udon|fried rice)\b/.test(text),
    hasCurry: /\b(curry|gravy|masala|korma|tikka|stew|dal|sambar|sauce)\b/.test(text),
    hasFried: /\b(fried|fry|deep|crisp|pakora|samosa|vada|tempura|katsu)\b/.test(text),
  };
}

function parseQuestionItem(item) {
  if (!item) return { question: '', topic: 'generic_portion', about: '' };
  if (typeof item === 'string') {
    return { question: item.trim(), topic: null, about: '' };
  }
  return {
    question: String(item.question || item.text || '').trim(),
    topic: item.topic || item.type || null,
    about: String(item.about || '').trim(),
  };
}

export function classifyQuestion(question, analysis) {
  const q = (question || '').toLowerCase();
  const ctx = mealContext(analysis);

  if (/\b(ml|millilitre|milliliter|litre|liter|glass|cup|drink|beverage|coffee|tea|juice|soda|beer|wine|smoothie|lassi)\b/.test(q)) {
    if (/\bwhat|which|type|kind|flavour|flavor|sweet|sugar|alcohol\b/.test(q) && !/\bhow much|volume|size|ml\b/.test(q)) {
      return 'drink_type';
    }
    return 'drink_volume';
  }
  if (ctx.hasDrink && /\bhow much|portion|size|amount|volume|cup|glass\b/.test(q)) {
    return 'drink_volume';
  }
  if (/\b(chip|crisp|snack|nut|biscuit|cookie|popcorn|namkeen|handful|bag)\b/.test(q) || (ctx.hasSnack && /\bhow much|portion|size|amount|weight|gram|\bg\b/.test(q))) {
    return 'portion_snack';
  }
  if (/\b(roti|naan|chapati|paratha|slice|piece|bread|dosa|idli|puri|wrap)\b/.test(q) || (ctx.hasBread && /\bhow many|count|pieces?\b/.test(q))) {
    return 'bread_count';
  }
  if (/\b(oil|ghee|butter|fat|greasy|deep.?fried|fried)\b/.test(q) || (ctx.hasFried && /\bhow much|cooking|prepared\b/.test(q))) {
    return 'oil_fat';
  }
  if (/\b(sauce|gravy|curry|dressing|masala|korma)\b/.test(q) || (ctx.hasCurry && /\bhow much|amount|thick|thin\b/.test(q))) {
    return 'sauce_gravy';
  }
  if (/\b(chicken|meat|fish|protein|paneer|tofu|lamb|beef|prawn|seafood|veg|vegetarian|mutton)\b/.test(q)) {
    return 'protein_type';
  }
  if (/\b(grill|grilled|fried|steam|steamed|bake|baked|raw|air.?fry|cook)\b/.test(q)) {
    return 'cooking_method';
  }
  if (
    /\b(portion|size|serving|bowl|plate|rice|pasta|noodle|gram|\bg\b|weight|how much)\b/.test(q)
    || ctx.hasRicePasta
  ) {
    return ctx.hasSnack ? 'portion_snack' : 'portion_solid';
  }
  return 'generic_portion';
}

export function normalizeClarificationQuestions(analysis) {
  const raw = analysis?.clarification_questions || [];
  const ctx = mealContext(analysis);
  const seenTopics = new Set();
  const steps = [];

  for (const item of raw) {
    const parsed = parseQuestionItem(item);
    if (!parsed.question) continue;

    let topic = parsed.topic && OPTION_SETS[parsed.topic] ? parsed.topic : classifyQuestion(parsed.question, analysis);
    if (topic === 'portion_solid' && ctx.hasSnack && !ctx.hasRicePasta) {
      topic = 'portion_snack';
    }
    if (topic === 'generic_portion' && ctx.hasDrink) {
      topic = 'drink_volume';
    }
    if (seenTopics.has(topic)) continue;
    seenTopics.add(topic);

    steps.push({
      question: polishQuestion(parsed.question, topic, parsed.about),
      topic,
    });
  }

  steps.sort(
    (a, b) => TOPIC_PRIORITY.indexOf(a.topic) - TOPIC_PRIORITY.indexOf(b.topic),
  );

  return steps.slice(0, MAX_CLARIFICATION_QUESTIONS);
}

function polishQuestion(question, topic, about) {
  const q = question.replace(/\?$/, '').trim();
  if (q.length > 90) {
    return defaultQuestionForTopic(topic, about);
  }
  return q.endsWith('?') ? q : `${q}?`;
}

function defaultQuestionForTopic(topic, about) {
  const item = about ? ` ${about}` : '';
  switch (topic) {
    case 'drink_volume':
      return `Roughly how much did you drink${item}?`;
    case 'drink_type':
      return `What type of drink${item}?`;
    case 'portion_snack':
      return `About how much of the snack${item}? (grams)`;
    case 'portion_solid':
      return `About how much${item}? (rough grams)`;
    case 'bread_count':
      return `How many pieces${item}?`;
    case 'oil_fat':
      return `How much oil or fat was used${item}?`;
    case 'sauce_gravy':
      return `How much sauce or gravy${item}?`;
    case 'protein_type':
      return `What is the main protein${item}?`;
    case 'cooking_method':
      return `How was it cooked${item}?`;
    default:
      return `What portion size${item}?`;
  }
}

export function getClarificationStepConfig(step, analysis) {
  const topic = step?.topic || classifyQuestion(step?.question, analysis);
  const ui = STEP_UI[topic] || STEP_UI.generic_portion;
  return {
    question: step?.question || defaultQuestionForTopic(topic),
    topic,
    helper: ui.helper,
    options: OPTION_SETS[topic] || OPTION_SETS.generic_portion,
    inputLabel: ui.inputLabel,
    inputPlaceholder: ui.inputPlaceholder,
    inputMode: ui.inputMode,
  };
}

export function needsClarification(analysis, threshold = 0.72) {
  const steps = normalizeClarificationQuestions(analysis);
  if (!steps.length) return false;
  const confidence = analysis?.confidence_score ?? 1;
  const lowConfidence = confidence < threshold;
  const highImpact = steps.some((s) => HIGH_IMPACT_TOPICS.has(s.topic));
  return lowConfidence || steps.length >= 2 || highImpact;
}
