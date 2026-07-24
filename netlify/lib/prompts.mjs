export const ANALYSIS_PROMPT = `Analyse this photo of food and return ONLY valid JSON matching the format below — no extra text.

Rules:
1. Identify ALL visible food and drink items separately in items[].
2. Support ANY cuisine worldwide (home cooking, restaurants, packed lunches).
3. Estimate portions with units in portion_estimate: use grams (g) for solid food and snacks, millilitres (ml) for drinks.
4. Calculate approximate nutrition using USDA / UK reference values.
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
  "total_calories_kcal": number,
  "total_nutrition": { "protein_g": number, "carbs_g": number, "fat_g": number, "sugar_g": number, "fibre_g": number, "salt_mg": number },
  "confidence_score": number,
  "items": [{ "name": string, "portion_estimate": string, "calories_kcal": number, "nutrition": { "protein_g": number, "carbs_g": number, "fat_g": number }, "confidence": number }],
  "clarification_questions": [
    { "topic": "drink_coffee_tea_size|drink_coffee_tea_style|drink_wine_size|drink_spirits_size|drink_beer_size|drink_soft_size|drink_soft_type|drink_juice_size|drink_water_size|drink_generic_size|portion_snack|portion_solid|bread_count|oil_fat|sauce_gravy|protein_type", "question": "Short plain question?", "about": "optional item name" }
  ]
}

clarification_questions may also be plain strings (legacy). Prefer structured objects with topic.`;

export const CLARIFY_PROMPT = `Refine the previous meal estimate using the user's clarification answers.

Rules:
1. Return ONLY valid JSON in the same format as the initial analysis.
2. Set clarification_questions to [].
3. Apply user answers precisely:
   - Drink volumes in ml (e.g. "350 ml", "175 ml wine", "25 ml whisky")
   - Coffee/tea style answers: apply milk type and sugar grams stated (e.g. "2 tsp sugar (~8 g)", "oat milk")
   - Soft drink: apply regular vs diet/zero sugar
   - Solid food in grams; bread in pieces with approximate gram weight
4. Recalculate total_nutrition including sugar_g from stated sugar.
5. Use USDA / UK reference values.`;
