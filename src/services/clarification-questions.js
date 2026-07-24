import { drinkCategoryForSubtype, getDrinkSubtype } from './drink-logging.js';

/** Max quick questions after a photo scan — keeps the flow fast. */
export const MAX_CLARIFICATION_QUESTIONS = 3;

const DRINK_SIZE_TOPICS = new Set([
  'drink_coffee_tea_size',
  'drink_wine_size',
  'drink_spirits_size',
  'drink_beer_size',
  'drink_soft_size',
  'drink_juice_size',
  'drink_water_size',
  'drink_generic_size',
]);

const TOPIC_PRIORITY = [
  'drink_coffee_tea_size',
  'drink_coffee_tea_style',
  'drink_wine_size',
  'drink_spirits_size',
  'drink_beer_size',
  'drink_soft_size',
  'drink_soft_type',
  'drink_juice_size',
  'drink_water_size',
  'drink_generic_size',
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
  ...DRINK_SIZE_TOPICS,
  'drink_coffee_tea_style',
  'drink_soft_type',
  'portion_snack',
  'portion_solid',
  'oil_fat',
  'bread_count',
]);

const OPTION_SETS = {
  drink_coffee_tea_size: [
    'Espresso / short (~30 ml)',
    'Small cup (~200 ml)',
    'Regular mug (~350 ml)',
    'Large / takeaway (~475 ml)',
  ],
  drink_coffee_tea_style: [
    'Black — no milk, no sugar',
    'Splash of milk, no sugar',
    'Regular milk (semi-skim), no sugar',
    'Oat / almond milk, no sugar',
    '1 tsp sugar (~4 g), little or no milk',
    '2 tsp sugar (~8 g)',
    'Sweetened — chai / karak / latte (~15 g sugar)',
  ],
  drink_wine_size: [
    'Small glass (~125 ml)',
    'Standard glass (~175 ml)',
    'Large glass (~250 ml)',
    'Shared bottle — my share (~200 ml)',
  ],
  drink_spirits_size: [
    'Single measure (~25 ml)',
    'Double measure (~50 ml)',
    'With mixer — short (~150 ml total)',
    'With mixer — long (~250 ml total)',
  ],
  drink_beer_size: [
    'Half pint (~284 ml)',
    'Pint (~568 ml)',
    'Can / small bottle (~330 ml)',
    'Large bottle (~500 ml)',
  ],
  drink_soft_size: [
    'Small cup (~250 ml)',
    'Can (~330 ml)',
    'Standard bottle (~500 ml)',
    'Large bottle (~750 ml)',
  ],
  drink_soft_type: [
    'Regular / full sugar',
    'Diet / zero sugar',
    'Low sugar version',
    'Not sure',
  ],
  drink_juice_size: [
    'Small glass (~200 ml)',
    'Regular glass (~300 ml)',
    'Large glass (~400 ml)',
    'Bottle (~500 ml)',
  ],
  drink_water_size: [
    'Small glass (~200 ml)',
    'Regular glass (~350 ml)',
    'Large bottle (~500 ml)',
    '1 litre bottle (~1000 ml)',
  ],
  drink_generic_size: [
    'Small (~150 ml)',
    'Regular (~250 ml)',
    'Can / bottle (~330 ml)',
    'Large (~500 ml)',
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
  drink_coffee_tea_size: {
    helper: 'Pick the cup size — millilitres (ml) are in brackets.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 350 ml',
    inputMode: 'decimal',
  },
  drink_coffee_tea_style: {
    helper: 'Milk and sugar change calories a lot. Pick the closest match — sugar is in grams (g).',
    inputLabel: 'Or describe your drink',
    inputPlaceholder: 'e.g. oat latte, 2 sugars',
    inputMode: 'text',
  },
  drink_wine_size: {
    helper: 'Wine is counted in millilitres (ml) — a standard pub glass is about 175 ml.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 175 ml red wine',
    inputMode: 'decimal',
  },
  drink_spirits_size: {
    helper: 'Spirits are usually measured in ml — a single is about 25 ml.',
    inputLabel: 'Or type measure',
    inputPlaceholder: 'e.g. 25 ml whisky, 50 ml rum',
    inputMode: 'decimal',
  },
  drink_beer_size: {
    helper: 'Beer and cider are counted in millilitres (ml).',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 568 ml pint',
    inputMode: 'decimal',
  },
  drink_soft_size: {
    helper: 'Soft drinks are counted in millilitres (ml).',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 330 ml can',
    inputMode: 'decimal',
  },
  drink_soft_type: {
    helper: 'Regular vs diet/zero changes sugar and calories significantly.',
    inputLabel: 'Or name the drink',
    inputPlaceholder: 'e.g. diet cola, regular lemonade',
    inputMode: 'text',
  },
  drink_juice_size: {
    helper: 'Juice and smoothies are counted in millilitres (ml).',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 300 ml orange juice',
    inputMode: 'decimal',
  },
  drink_water_size: {
    helper: 'Water has no calories — volume is optional but helps your log stay accurate.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 500 ml',
    inputMode: 'decimal',
  },
  drink_generic_size: {
    helper: 'Drinks are counted in millilitres (ml). A rough estimate is fine.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 250 ml',
    inputMode: 'decimal',
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

  const subtypeHint = analysis?._drinkLogSubtype
    ? getDrinkSubtype(analysis._drinkLogSubtype)?.aiHint || ''
    : '';

  let drinkCategory = detectDrinkCategory(`${text} ${subtypeHint}`);
  if (!drinkCategory && analysis?._drinkLogSubtype) {
    drinkCategory = drinkCategoryForSubtype(analysis._drinkLogSubtype);
    if (analysis._drinkLogSubtype === 'alcohol') {
      drinkCategory = detectDrinkCategory(text) || 'generic';
    }
  }

  return {
    text,
    drinkCategory,
    hasDrink: /\b(drink|beverage|coffee|tea|juice|water|soda|cola|beer|wine|whisky|whiskey|spirit|milkshake|smoothie|latte|cappuccino|lassi|chaa|chai|prosecco|champagne|rum|gin|vodka|ml\b|cup of)\b/.test(
      text,
    ),
    hasSnack: /\b(snack|chip|crisp|nut|biscuit|cookie|bar|popcorn|samosa|pakora|fries|chips|namkeen|murukku|mixture|chocolate)\b/.test(
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

export function detectDrinkCategory(text = '') {
  const t = text.toLowerCase();
  if (/\b(espresso|coffee|latte|cappuccino|americano|mocha|macchiato|flat white|tea|chai|chaa|karak|matcha|milk tea|bubble tea|boba)\b/.test(t)) {
    return 'coffee_tea';
  }
  if (/\b(whisky|whiskey|vodka|rum|gin|brandy|bourbon|scotch|tequila|spirit|liqueur|shot)\b/.test(t)) {
    return 'spirits';
  }
  if (/\b(wine|prosecco|champagne|rosé|rose wine|red wine|white wine|pinot|merlot|shiraz)\b/.test(t)) {
    return 'wine';
  }
  if (/\b(beer|lager|ale|stout|cider|pint)\b/.test(t)) {
    return 'beer';
  }
  if (/\b(coke|cola|pepsi|fanta|sprite|soda|soft drink|energy drink|lemonade|irn-bru|dr pepper)\b/.test(t)) {
    return 'soft_drink';
  }
  if (/\b(juice|smoothie|lassi|milkshake|shake|nectar)\b/.test(t)) {
    return 'juice_smoothie';
  }
  if (/\b(water)\b/.test(t) && !/\b(watermelon)\b/.test(t)) {
    return 'water';
  }
  if (/\b(drink|beverage|cup|glass|ml\b)\b/.test(t)) {
    return 'generic';
  }
  return null;
}

function defaultDrinkSizeTopic(category) {
  switch (category) {
    case 'coffee_tea':
      return 'drink_coffee_tea_size';
    case 'wine':
      return 'drink_wine_size';
    case 'spirits':
      return 'drink_spirits_size';
    case 'beer':
      return 'drink_beer_size';
    case 'soft_drink':
      return 'drink_soft_size';
    case 'juice_smoothie':
      return 'drink_juice_size';
    case 'water':
      return 'drink_water_size';
    default:
      return 'drink_generic_size';
  }
}

function topicGroup(topic) {
  if (DRINK_SIZE_TOPICS.has(topic) || topic === 'drink_volume') return 'drink_size';
  if (topic === 'drink_coffee_tea_style' || topic === 'drink_soft_type' || topic === 'drink_type') {
    return 'drink_style';
  }
  return topic;
}

function resolveDrinkTopic(topic, question, analysis) {
  const q = (question || '').toLowerCase();
  const ctx = mealContext(analysis);
  const cat = ctx.drinkCategory;

  if (OPTION_SETS[topic]) return topic;

  if (/\b(sugar|milk|sweet|black|latte|chai|karak|cream|dairy|plant milk|oat|almond|semi.?skim)\b/.test(q)) {
    if (cat === 'coffee_tea' || /\b(coffee|tea|chai|latte)\b/.test(q)) {
      return 'drink_coffee_tea_style';
    }
  }

  if (/\b(diet|zero|sugar.?free|regular|full sugar|sweetened)\b/.test(q) && cat === 'soft_drink') {
    return 'drink_soft_type';
  }

  if (topic === 'drink_type') {
    if (cat === 'coffee_tea') return 'drink_coffee_tea_style';
    if (cat === 'soft_drink') return 'drink_soft_type';
    return defaultDrinkSizeTopic(cat);
  }

  if (topic === 'drink_volume' || !topic) {
    return defaultDrinkSizeTopic(cat);
  }

  return topic;
}

function parseQuestionItem(item) {
  if (!item) return { question: '', topic: null, about: '' };
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

  if (/\b(sugar|milk|sweet|black|cream|dairy|oat milk|almond milk|semi.?skim)\b/.test(q)
    && /\b(coffee|tea|chai|latte|drink|beverage)\b/.test(q)) {
    return 'drink_coffee_tea_style';
  }

  if (/\b(diet|zero|sugar.?free|regular|full sugar)\b/.test(q) && ctx.drinkCategory === 'soft_drink') {
    return 'drink_soft_type';
  }

  if (/\b(ml|millilitre|milliliter|glass|cup|drink|beverage|pour|measure|how much)\b/.test(q)
    && (ctx.hasDrink || /\b(coffee|tea|wine|beer|whisky|whiskey|juice|soda|cola|latte)\b/.test(q))) {
    return resolveDrinkTopic('drink_volume', question, analysis);
  }

  if (ctx.hasDrink && /\bhow much|portion|size|amount|volume|cup|glass|measure\b/.test(q)) {
    return resolveDrinkTopic('drink_volume', question, analysis);
  }

  if (/\b(chip|crisp|snack|nut|biscuit|cookie|popcorn|namkeen|handful|bag)\b/.test(q)
    || (ctx.hasSnack && /\bhow much|portion|size|amount|weight|gram|\bg\b/.test(q))) {
    return 'portion_snack';
  }
  if (/\b(roti|naan|chapati|paratha|slice|piece|bread|dosa|idli|puri|wrap)\b/.test(q)
    || (ctx.hasBread && /\bhow many|count|pieces?\b/.test(q))) {
    return 'bread_count';
  }
  if (/\b(oil|ghee|butter|fat|greasy|deep.?fried|fried)\b/.test(q)
    || (ctx.hasFried && /\bhow much|cooking|prepared\b/.test(q))) {
    return 'oil_fat';
  }
  if (/\b(sauce|gravy|curry|dressing|masala|korma)\b/.test(q)
    || (ctx.hasCurry && /\bhow much|amount|thick|thin\b/.test(q))) {
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
  if (ctx.hasDrink) {
    return resolveDrinkTopic('drink_volume', question, analysis);
  }
  return 'generic_portion';
}

export function normalizeClarificationQuestions(analysis) {
  const raw = analysis?.clarification_questions || [];
  const ctx = mealContext(analysis);
  const seenGroups = new Set();
  const steps = [];

  for (const item of raw) {
    const parsed = parseQuestionItem(item);
    if (!parsed.question) continue;

    let topic = resolveDrinkTopic(
      parsed.topic && (OPTION_SETS[parsed.topic] || parsed.topic.startsWith('drink_'))
        ? parsed.topic
        : classifyQuestion(parsed.question, analysis),
      parsed.question,
      analysis,
    );

    if (topic === 'portion_solid' && ctx.hasSnack && !ctx.hasRicePasta) {
      topic = 'portion_snack';
    }
    if (topic === 'generic_portion' && ctx.hasDrink) {
      topic = defaultDrinkSizeTopic(ctx.drinkCategory);
    }

    const group = topicGroup(topic);
    if (seenGroups.has(group)) continue;
    seenGroups.add(group);

    steps.push({
      question: polishQuestion(parsed.question, topic, parsed.about, analysis),
      topic,
    });
  }

  if (ctx.drinkCategory === 'coffee_tea') {
    const hasSize = steps.some((s) => s.topic === 'drink_coffee_tea_size');
    const hasStyle = steps.some((s) => s.topic === 'drink_coffee_tea_style');
    if (hasSize && !hasStyle && steps.length < MAX_CLARIFICATION_QUESTIONS) {
      steps.push({
        question: defaultQuestionForTopic('drink_coffee_tea_style', '', analysis),
        topic: 'drink_coffee_tea_style',
      });
    }
  }

  if (ctx.drinkCategory === 'soft_drink') {
    const hasSize = steps.some((s) => s.topic === 'drink_soft_size');
    const hasType = steps.some((s) => s.topic === 'drink_soft_type');
    if (hasSize && !hasType && steps.length < MAX_CLARIFICATION_QUESTIONS) {
      steps.push({
        question: defaultQuestionForTopic('drink_soft_type', '', analysis),
        topic: 'drink_soft_type',
      });
    }
  }

  steps.sort(
    (a, b) => TOPIC_PRIORITY.indexOf(a.topic) - TOPIC_PRIORITY.indexOf(b.topic),
  );

  return steps.slice(0, MAX_CLARIFICATION_QUESTIONS);
}

function polishQuestion(question, topic, about, analysis) {
  const q = question.replace(/\?$/, '').trim();
  if (q.length > 90) {
    return defaultQuestionForTopic(topic, about, analysis);
  }
  return `${q}?`;
}

function defaultQuestionForTopic(topic, about, analysis) {
  const item = about ? ` ${about}` : '';
  const ctx = mealContext(analysis);
  const drinkName = drinkLabel(ctx.drinkCategory);

  switch (topic) {
    case 'drink_coffee_tea_size':
      return `How much ${drinkName || 'coffee or tea'} did you have?`;
    case 'drink_coffee_tea_style':
      return `How was your ${drinkName || 'coffee or tea'} prepared? (milk & sugar)`;
    case 'drink_wine_size':
      return `How much wine did you have?`;
    case 'drink_spirits_size':
      return `What measure of spirits${item}? (whisky, vodka, rum, etc.)`;
    case 'drink_beer_size':
      return `How much beer or cider did you have?`;
    case 'drink_soft_size':
      return `How much of the soft drink did you have?`;
    case 'drink_soft_type':
      return `Was it regular sugar or diet / zero?`;
    case 'drink_juice_size':
      return `How much juice or smoothie did you have?`;
    case 'drink_water_size':
      return `How much water did you drink?`;
    case 'drink_generic_size':
    case 'drink_volume':
      return `Roughly how much did you drink${item}?`;
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

function drinkLabel(category) {
  switch (category) {
    case 'coffee_tea':
      return 'coffee or tea';
    case 'wine':
      return 'wine';
    case 'spirits':
      return 'spirit';
    case 'beer':
      return 'beer';
    case 'soft_drink':
      return 'soft drink';
    case 'juice_smoothie':
      return 'juice or smoothie';
    case 'water':
      return 'water';
    default:
      return '';
  }
}

export function getClarificationStepConfig(step, analysis) {
  const topic = resolveDrinkTopic(
    step?.topic || classifyQuestion(step?.question, analysis),
    step?.question,
    analysis,
  );
  const ui = STEP_UI[topic] || STEP_UI.generic_portion;
  return {
    question: step?.question || defaultQuestionForTopic(topic, '', analysis),
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
