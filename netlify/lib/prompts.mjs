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
- DRINKS (tea, coffee, juice, lassi, soda, alcohol): ask volume in ml — NOT grams. Example topic: drink_volume — "How much did you drink?"
- SNACKS (chips, nuts, biscuits, samosa, chocolate): ask weight in grams. topic: portion_snack
- RICE / pasta / curry / meat / veg on plate: ask rough grams. topic: portion_solid
- Roti, naan, bread, dosa, slices: ask piece count. topic: bread_count
- Oily, fried, or ghee-heavy dishes: ask oil level. topic: oil_fat
- Curry, gravy, saucy dishes: ask sauce amount. topic: sauce_gravy
- Mixed dish with unclear protein: ask main protein. topic: protein_type
- Do NOT ask cooking method AND oil — pick the one that matters more for calories.
- Do NOT ask if the photo or hints already make it obvious.

JSON FORMAT:
{
  "meal_summary": "Short name",
  "total_calories_kcal": number,
  "total_nutrition": { "protein_g": number, "carbs_g": number, "fat_g": number, "sugar_g": number, "fibre_g": number, "salt_mg": number },
  "confidence_score": number,
  "items": [{ "name": string, "portion_estimate": string, "calories_kcal": number, "nutrition": { "protein_g": number, "carbs_g": number, "fat_g": number }, "confidence": number }],
  "clarification_questions": [
    { "topic": "drink_volume|drink_type|portion_snack|portion_solid|bread_count|oil_fat|sauce_gravy|protein_type|cooking_method", "question": "Short plain question?", "about": "optional item name" }
  ]
}

clarification_questions may also be plain strings (legacy). Prefer structured objects with topic.`;

export const CLARIFY_PROMPT = `Refine the previous meal estimate using the user's clarification answers.

Rules:
1. Return ONLY valid JSON in the same format as the initial analysis.
2. Set clarification_questions to [].
3. Apply user answers precisely — if they say "250 ml", "180 g", or "2 roti", use those in portion_estimate and recalculate nutrition.
4. Drinks must stay in ml; solid food and snacks in grams; bread can be pieces with approximate gram weight.
5. Use USDA / UK reference values.`;
