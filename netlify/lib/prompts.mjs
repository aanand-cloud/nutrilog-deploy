export const ANALYSIS_PROMPT = `Analyse this photo of food and return ONLY valid JSON matching the format below — no extra text.

Rules:
1. Identify ALL visible food and drink items separately in items[].
2. Support ANY cuisine worldwide (home cooking, restaurants, packed lunches).
3. Estimate portions with estimated_amount and unit: use g for solids/snacks and ml for drinks.
4. Identify food and estimate portions only. Do NOT calculate or return calories, macros, or nutrition.
5. Use user meal hints when provided — do NOT ask about anything already stated in hints.
6. If unsure about something that would change calories by 50+ kcal, add up to 3 clarification_questions (never 4+).
7. Ask ONE topic per question. Plain English, under 14 words. No jargon.

When to ask (pick only what applies):

DRINKS — use drink-specific topics (ml for volume, g for sugar when relevant):
- Coffee / tea / chai / latte: drink_coffee_tea_size ("How much coffee/tea?") AND drink_coffee_tea_style ("How prepared? milk & sugar") if milk/sugar unclear
- Wine / prosecco: drink_wine_size
- Whisky / vodka / rum / gin / spirits: drink_spirits_size
- Beer / cider / lager: drink_beer_size
- Soft drinks / cola / soda: drink_soft_size AND drink_soft_type (regular vs diet) if unclear
- Juice / smoothie / lassi: drink_juice_size
- Water: drink_water_size (or skip if obvious)
- Other drinks: drink_generic_size

FOOD (not drinks):
- SNACKS: portion_snack (grams)
- RICE / pasta / curry / meat / veg: portion_solid (grams)
- Roti / naan / bread / dosa: bread_count
- Oily / fried dishes: oil_fat
- Curry / gravy: sauce_gravy
- Unclear protein: protein_type

Do NOT ask cooking method AND oil. Do NOT ask if photo or hints already answer it.

JSON FORMAT:
{
  "meal_summary": "Short name",
  "confidence_score": number,
  "notes": "Short visual observation",
  "items": [{ "name": string, "unit": "g|ml", "estimated_amount": number, "cooking_method": string, "visible_oil": boolean, "confidence": number }],
  "clarification_questions": [
    { "topic": "drink_coffee_tea_size|drink_coffee_tea_style|drink_wine_size|drink_spirits_size|drink_beer_size|drink_soft_size|drink_soft_type|drink_juice_size|drink_water_size|drink_generic_size|portion_snack|portion_solid|bread_count|oil_fat|sauce_gravy|protein_type", "question": "Short plain question?", "about": "optional item name" }
  ]
}

Use structured clarification question objects with a topic.`;

export const CLARIFY_PROMPT = `Refine the previous visual food identification and portion estimate using the user's clarification answers.

Rules:
1. Return ONLY valid JSON in the same vision-only format as the initial analysis.
2. Set clarification_questions to [].
3. Apply user answers precisely:
   - Drink volumes in ml (e.g. "350 ml", "175 ml wine", "25 ml whisky")
   - Coffee/tea style answers: apply milk type and sugar grams stated (e.g. "2 tsp sugar (~8 g)", "oat milk")
   - Soft drink: apply regular vs diet/zero sugar
   - Solid food as estimated_amount in grams; convert bread pieces to approximate grams
4. Preserve every identified item unless an answer explicitly corrects it.
5. Do NOT calculate or return calories, macros, or nutrition. The application resolves nutrition separately.`;
