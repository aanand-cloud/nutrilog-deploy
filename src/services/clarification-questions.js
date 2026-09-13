import { analysisIsMainlyDrink, drinkCategoryForSubtype, getDrinkSubtype } from './drink-logging.js';
import { ZERO_DRINK_RE } from '../../shared/branded-uk-servings.js';
import { filterClarificationStepsByNotes } from '../../shared/user-notes-apply.js';
import {
  resolveIndianStarterFromAnalysis,
  starterPortionOptions,
} from '../../shared/indian-starter-catalog.js';

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
  'drink_wine_size',
  'drink_spirits_size',
  'drink_beer_size',
  'drink_soft_size',
  'drink_juice_size',
  'drink_water_size',
  'drink_generic_size',
  'drink_volume',
  'drink_coffee_milk',
  'drink_coffee_sugar',
  'drink_soft_type',
  'drink_coffee_tea_style',
  'drink_type',
  'portion_snack',
  'portion_solid',
  'portion_rice',
  'portion_starter',
  'bread_count',
  'oil_fat',
  'sauce_gravy',
  'rice_type',
  'accompaniments',
  'protein_type',
  'cooking_method',
  'generic_portion',
];

const HIGH_IMPACT_TOPICS = new Set([
  ...DRINK_SIZE_TOPICS,
  'drink_coffee_milk',
  'drink_coffee_sugar',
  'drink_coffee_tea_style',
  'drink_soft_type',
  'portion_snack',
  'portion_solid',
  'oil_fat',
  'sauce_gravy',
  'rice_type',
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
  drink_coffee_milk: [
    'None',
    'Splash (~30 ml)',
    '50 ml',
    '100 ml',
    '150 ml',
  ],
  drink_coffee_sugar: [
    'None',
    '1 tsp (~4 g)',
    '2 tsp (~8 g)',
    '3 tsp (~12 g)',
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
    'Regular',
    'Diet / sugar-free / zero',
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
    'None',
    'About 1 teaspoon',
    'About 1 tablespoon',
    'More than 1 tablespoon',
  ],
  sauce_gravy: [
    'Mayonnaise-based',
    'Yoghurt-based',
    'Tomato-based',
    'Curry sauce',
    'Something else',
  ],
  rice_type: [
    'Plain boiled rice',
    'Pilau rice',
    'Fried rice',
    'Biryani rice',
    'Something else',
  ],
  accompaniments: [
    'Sambar',
    'Coconut chutney',
    'Tomato chutney',
    'Raita',
    'Pickle',
    'Papad',
    'None',
  ],
  protein_type: [
    'Chicken',
    'Lamb / beef',
    'Fish / seafood',
    'Vegetarian (paneer / tofu / dal)',
    'Mixed / not sure',
  ],
  cooking_method: [
    'Grilled',
    'Roasted',
    'Fried',
    'Air-fried',
    'Boiled',
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
    helper: 'Pick the closest cup size.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 350 ml',
    inputMode: 'decimal',
  },
  drink_coffee_tea_style: {
    helper: 'Milk and sugar change calories the most.',
    inputLabel: 'Or describe your drink',
    inputPlaceholder: 'e.g. oat latte, 2 sugars',
    inputMode: 'text',
  },
  drink_coffee_milk: {
    helper: 'Milk is the biggest calorie change in tea and coffee.',
    inputLabel: 'Or type ml',
    inputPlaceholder: 'e.g. 40 ml',
    inputMode: 'decimal',
  },
  drink_coffee_sugar: {
    helper: 'One teaspoon of sugar is about 4 g.',
    inputLabel: 'Or type grams',
    inputPlaceholder: 'e.g. 8 g',
    inputMode: 'decimal',
  },
  drink_wine_size: {
    helper: 'A standard glass is about 175 ml.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 175 ml red wine',
    inputMode: 'decimal',
  },
  drink_spirits_size: {
    helper: 'A single measure is about 25 ml.',
    inputLabel: 'Or type measure',
    inputPlaceholder: 'e.g. 25 ml whisky, 50 ml rum',
    inputMode: 'decimal',
  },
  drink_beer_size: {
    helper: 'Pick the closest pour.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 568 ml pint',
    inputMode: 'decimal',
  },
  drink_soft_size: {
    helper: 'Pick the closest drink size.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 330 ml can',
    inputMode: 'decimal',
  },
  drink_soft_type: {
    helper: 'Regular vs diet changes sugar a lot.',
    inputLabel: 'Or name the drink',
    inputPlaceholder: 'e.g. diet cola, regular lemonade',
    inputMode: 'text',
  },
  drink_juice_size: {
    helper: 'Pick the closest glass size.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 300 ml orange juice',
    inputMode: 'decimal',
  },
  drink_water_size: {
    helper: 'Volume is optional for water.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 500 ml',
    inputMode: 'decimal',
  },
  drink_generic_size: {
    helper: 'A rough pour is fine.',
    inputLabel: 'Or type volume',
    inputPlaceholder: 'e.g. 250 ml',
    inputMode: 'decimal',
  },
  portion_snack: {
    helper: 'A rough gram weight is enough.',
    inputLabel: 'Or type weight',
    inputPlaceholder: 'e.g. 40 g',
    inputMode: 'decimal',
  },
  portion_solid: {
    helper: 'A rough gram weight is enough.',
    inputLabel: 'Or type weight',
    inputPlaceholder: 'e.g. 180 g',
    inputMode: 'decimal',
  },
  bread_count: {
    helper: 'Count the pieces if that is easier.',
    inputLabel: 'Or type your answer',
    inputPlaceholder: 'e.g. 2 roti, 1 naan',
    inputMode: 'text',
  },
  oil_fat: {
    helper: 'Oil changes calories more than portion tweaks.',
    inputLabel: 'Or describe',
    inputPlaceholder: 'e.g. shallow fried in ghee',
    inputMode: 'text',
  },
  sauce_gravy: {
    helper: 'Sauce type can hide extra calories.',
    inputLabel: 'Or describe',
    inputPlaceholder: 'e.g. thick coconut curry',
    inputMode: 'text',
  },
  protein_type: {
    helper: 'Pick the main protein.',
    inputLabel: 'Or type protein',
    inputPlaceholder: 'e.g. prawns, soya chunks',
    inputMode: 'text',
  },
  cooking_method: {
    helper: 'Cooking style changes fat.',
    inputLabel: 'Or describe',
    inputPlaceholder: 'e.g. air-fried, tandoori',
    inputMode: 'text',
  },
  rice_type: {
    helper: 'Fried and biryani rice usually have more oil.',
    inputLabel: 'Or type the rice type',
    inputPlaceholder: 'e.g. lemon rice',
    inputMode: 'text',
  },
  accompaniments: {
    helper: 'Select every side on the plate.',
    inputLabel: 'Or type another side',
    inputPlaceholder: 'e.g. mint chutney',
    inputMode: 'text',
    multi: true,
  },
  generic_portion: {
    helper: 'Pick the closest match.',
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
    hasChicken: /\b(chicken|murgh)\b/.test(text),
    hasIdliDosa: /\b(idli|dosa|vada)\b/.test(text),
    riceTypeKnown: /\b(pilau|pulao|fried rice|biryani|boiled rice|steamed rice|basmati)\b/.test(text),
    cookingKnown: /\b(grilled|roasted|air.?fried|steamed|boiled|deep.?fried)\b/.test(text),
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
  if (topic === 'drink_coffee_milk') return 'drink_milk';
  if (topic === 'drink_coffee_sugar') return 'drink_sugar';
  if (topic === 'drink_coffee_tea_style' || topic === 'drink_soft_type' || topic === 'drink_type') {
    return 'drink_style';
  }
  if (topic === 'oil_fat' || topic === 'cooking_method') return 'fat_cook';
  if (
    topic === 'portion_solid'
    || topic === 'portion_snack'
    || topic === 'portion_rice'
    || topic === 'portion_starter'
    || topic === 'generic_portion'
  ) {
    return 'portion';
  }
  return topic;
}

function resolveDrinkTopic(topic, question, analysis) {
  const q = (question || '').toLowerCase();
  const ctx = mealContext(analysis);
  const cat = ctx.drinkCategory;

  if (OPTION_SETS[topic]) return topic;

  if (/\b(sugar|sweet)\b/.test(q) && !/\bmilk\b/.test(q) && (cat === 'coffee_tea' || /\b(coffee|tea|chai|latte)\b/.test(q))) {
    return 'drink_coffee_sugar';
  }
  if (/\b(milk|splash|dairy|oat|almond|semi.?skim)\b/.test(q) && (cat === 'coffee_tea' || /\b(coffee|tea|chai|latte)\b/.test(q))) {
    return 'drink_coffee_milk';
  }
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

function sanitizeQuestionOptions(options) {
  if (!Array.isArray(options)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of options) {
    const label = String(raw || '').trim();
    if (!label || label.length > 40) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 6) break;
  }
  return out;
}

function parseQuestionItem(item) {
  if (!item) return { question: '', topic: null, about: '', options: [] };
  if (typeof item === 'string') {
    return { question: item.trim(), topic: null, about: '', options: [] };
  }
  return {
    question: String(item.question || item.text || '').trim(),
    topic: item.topic || item.type || null,
    about: String(item.about || '').trim(),
    options: sanitizeQuestionOptions(item.options),
  };
}

export function classifyQuestion(question, analysis) {
  const q = (question || '').toLowerCase();
  const ctx = mealContext(analysis);

  if (/\bhow much (milk|dairy)\b/.test(q) || (/\bml\b/.test(q) && /\bmilk\b/.test(q))) {
    return 'drink_coffee_milk';
  }
  if (/\bhow much sugar\b/.test(q) || (/\b(grams?|tsp|teaspoon)\b/.test(q) && /\bsugar\b/.test(q))) {
    return 'drink_coffee_sugar';
  }

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
  if (/\bwhat type of rice|which rice|plain boiled rice|pilau|biryani rice\b/.test(q) || (ctx.hasRicePasta && /\btype of rice|kind of rice\b/.test(q))) {
    return 'rice_type';
  }
  if (/\baccompaniment|chutney|sambar|raita|papad|on the side\b/.test(q)) {
    return 'accompaniments';
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

export function normalizeClarificationQuestions(analysis, notes = '') {
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
    if (topic === 'drink_coffee_tea_style') continue;

    const group = topicGroup(topic);
    if (topic === 'protein_type' && (analysis._anchored || analysis._refId) && !/\b(mixed|unknown)\b/i.test(parsed.question)) {
      continue;
    }
    if (seenGroups.has(group)) continue;
    seenGroups.add(group);

    steps.push({
      question: polishQuestion(parsed.question, topic, parsed.about, analysis),
      topic,
      about: parsed.about,
      options: parsed.options,
    });
  }

  ensureEssentialQuestions(steps, analysis);
  ensureDrinkQuestions(steps, analysis);

  const filtered = notes ? filterClarificationStepsByNotes(steps, notes) : steps;
  filtered.sort(
    (a, b) => TOPIC_PRIORITY.indexOf(a.topic) - TOPIC_PRIORITY.indexOf(b.topic),
  );

  return filtered.slice(0, MAX_CLARIFICATION_QUESTIONS);
}

function drinkLooksMilky(text = '') {
  return /\b(latte|cappuccino|mocha|flat white|macchiato|hot chocolate|milk tea|bubble tea|boba)\b/i.test(text);
}

function ensureDrinkQuestions(steps, analysis) {
  const ctx = mealContext(analysis);
  if (!ctx.drinkCategory) return;
  const topics = new Set(steps.map((s) => s.topic));
  const groups = new Set(steps.map((s) => topicGroup(s.topic)));
  const add = (topic, question) => {
    if (topics.has(topic) || groups.has(topicGroup(topic)) || steps.length >= MAX_CLARIFICATION_QUESTIONS) return;
    steps.push({ question, topic });
    topics.add(topic);
    groups.add(topicGroup(topic));
  };

  add(defaultDrinkSizeTopic(ctx.drinkCategory), defaultQuestionForTopic(defaultDrinkSizeTopic(ctx.drinkCategory), '', analysis));

  if (ctx.drinkCategory === 'coffee_tea') {
    if (!drinkLooksMilky(ctx.text)) {
      add('drink_coffee_milk', defaultQuestionForTopic('drink_coffee_milk', '', analysis));
    }
    add('drink_coffee_sugar', defaultQuestionForTopic('drink_coffee_sugar', '', analysis));
  }
  if (ctx.drinkCategory === 'soft_drink' && !ZERO_DRINK_RE.test(ctx.text)) {
    add('drink_soft_type', defaultQuestionForTopic('drink_soft_type', '', analysis));
  }
}

function ensureEssentialQuestions(steps, analysis) {
  const ctx = mealContext(analysis);
  if (ctx.drinkCategory && analysisIsMainlyDrink(analysis)) return;
  const starter = resolveIndianStarterFromAnalysis(analysis);
  const topics = new Set(steps.map((s) => s.topic));
  const groups = new Set(steps.map((s) => topicGroup(s.topic)));
  const add = (topic, question) => {
    if (topics.has(topic) || groups.has(topicGroup(topic)) || steps.length >= MAX_CLARIFICATION_QUESTIONS) return;
    steps.push({ question, topic });
    topics.add(topic);
    groups.add(topicGroup(topic));
  };

  if (starter) {
    add('portion_starter', `How much ${starter.label} is on the plate?`);
  }
  if (ctx.hasFried || ctx.hasCurry) {
    add('oil_fat', 'How much oil or ghee?');
  }
  if (ctx.hasRicePasta && !ctx.riceTypeKnown) {
    add('rice_type', 'What type of rice is this?');
  }
  if (ctx.hasChicken && !ctx.cookingKnown && !starter) {
    add('cooking_method', 'How was the chicken cooked?');
  }
  if (ctx.hasCurry) {
    add('sauce_gravy', 'What type of sauce is this?');
  }
  if (ctx.hasIdliDosa) {
    add('accompaniments', 'Which sides are on the plate?');
  }
}

export function wordCount(text = '') {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function polishQuestion(question, topic, about, analysis) {
  const q = String(question || '').replace(/\?+$/, '').trim();
  const withMark = q ? `${q}?` : defaultQuestionForTopic(topic, about, analysis);
  if (wordCount(withMark) > 14) {
    return defaultQuestionForTopic(topic, about, analysis);
  }
  return withMark;
}

function defaultQuestionForTopic(topic, about, analysis) {
  const item = about ? ` ${about}` : '';
  const ctx = mealContext(analysis);
  const drinkName = drinkLabel(ctx.drinkCategory);

  switch (topic) {
    case 'drink_coffee_tea_size':
      return `How many ml of ${drinkName || 'coffee or tea'}?`;
    case 'drink_coffee_tea_style':
      return `Milk and sugar in the ${drinkName || 'drink'}?`;
    case 'drink_coffee_milk':
      return 'How much milk, in ml?';
    case 'drink_coffee_sugar':
      return 'How much sugar, in grams?';
    case 'drink_wine_size':
      return 'How many ml of wine?';
    case 'drink_spirits_size':
      return `What spirit measure${item}?`;
    case 'drink_beer_size':
      return 'How many ml of beer or cider?';
    case 'drink_soft_size':
      return 'How many ml of drink?';
    case 'drink_soft_type':
      return 'Regular, diet, or zero?';
    case 'drink_juice_size':
      return 'How many ml of juice or smoothie?';
    case 'drink_water_size':
      return 'How many ml of water?';
    case 'drink_generic_size':
    case 'drink_volume':
      return `How many ml did you drink${item}?`;
    case 'portion_snack':
      return `How much snack${item}?`;
    case 'portion_solid':
      return `How much${item || ' food'}?`;
    case 'portion_rice':
      return /\bbiryani\b/i.test(mealContext(analysis).text)
        ? 'How much biryani?'
        : `How much rice${item}?`;
    case 'portion_starter': {
      const starter = resolveIndianStarterFromAnalysis(analysis);
      return `How much ${starter?.label || about || 'starter'}?`;
    }
    case 'bread_count':
      return `How many pieces${item}?`;
    case 'oil_fat':
      return 'How much oil or ghee?';
    case 'sauce_gravy':
      return 'What type of sauce is this?';
    case 'protein_type':
      return `What is the main protein${item}?`;
    case 'cooking_method':
      return about ? `How was the ${about} cooked?` : 'How was it cooked?';
    case 'rice_type':
      return 'What type of rice is this?';
    case 'accompaniments':
      return 'Which sides are on the plate?';
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

function withNotSure(options = []) {
  const list = [...options];
  if (!list.some((o) => /^not sure$/i.test(String(o)))) list.push('Not sure');
  return list;
}

export function getClarificationStepConfig(step, analysis) {
  const topic = resolveDrinkTopic(
    step?.topic || classifyQuestion(step?.question, analysis),
    step?.question,
    analysis,
  );
  const ui = STEP_UI[topic] || STEP_UI.generic_portion;
  const starter = topic === 'portion_starter' ? resolveIndianStarterFromAnalysis(analysis) : null;
  const options = step?.options?.length >= 2
    ? step.options
    : (topic === 'portion_starter'
      ? starterPortionOptions(starter)
      : (OPTION_SETS[topic] || OPTION_SETS.generic_portion));
  return {
    question: step?.question || defaultQuestionForTopic(topic, '', analysis),
    topic,
    helper: ui.helper,
    options: withNotSure(options),
    inputLabel: ui.inputLabel,
    inputPlaceholder: ui.inputPlaceholder,
    inputMode: ui.inputMode,
    multi: Boolean(ui.multi),
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
