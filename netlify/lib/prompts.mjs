export const ANALYSIS_PROMPT = `Analyse this photo of food and return ONLY valid JSON matching the format below — no extra text.

Rules:
1. Identify ALL visible food and drink items separately in items[]. A cup, mug, glass, or takeaway coffee/tea/soft drink is a drink — include it with unit ml.
2. Support ANY cuisine worldwide (home cooking, restaurants, takeaway, packed lunches).
3. Preserve the most specific regional dish name visible or strongly implied (for example jollof rice, biryani, nasi goreng), never a generic substitute such as "seasoned rice".
4. Estimate edible portions with estimated_amount and unit: use g for solids/snacks and ml for drinks (never kg or lb). Convert any kilogram/pound estimate into grams. Compute grams from estimated 3D volume and food density, not 2D area. Exclude plates, bowls, bones and packaging. If the photo shows a bag, pile, crate, or bulk of one food, estimate the full edible weight pictured — not a typical single-fruit serving. Use user-stated weights exactly.
5. Provide a precise usda_search_term for each item so MealNova can look up nutrition (e.g. "rice, white, long-grain, cooked", "fritter, urad dal, fried").
6. Account for hidden fats: estimate absorbed cooking oil/ghee in estimated_oil_tbsp from frying, basting, or curry bases.
7. If the image appears to show a shared spread rather than one person's plate, say so in notes and lower confidence.
8. Only include a restaurant brand (McDonald's, KFC, Pizza Hut, Domino's, etc.) when a readable logo, packaging, menu text, barcode, or user hint supports it. Never infer a brand from the food's appearance alone. If brand evidence is absent, use a generic food name.
9. For branded products, preserve the exact visible product name and size when readable (for example KFC Fillet Burger, regular Signature Fries, Pepsi Max, Big Mac, medium fries). Do not replace branded fries with wedges or branded burgers with plain chicken.
10. For drinks, read visible words such as Zero, Max, Diet, No Sugar, Sugar Free, Original or Classic. If the drink type is not readable, use a generic soft-drink name and ask drink_soft_type.
11. Pizza brand cannot be determined from pizza appearance alone. Preserve Pizza Hut or Domino's only when packaging/text or a user hint proves it; otherwise say pepperoni pizza, margherita pizza, etc.
12. Identify food and estimate portions only. Do NOT calculate or return calories, macros, or nutrition. MealNova looks those up from usda_search_term.
13. Use user meal hints when provided — do NOT ask about anything already stated in hints, including piece counts ("4 idlis"), meal slot ("for breakfast"), and weights ("2.5kg hog plum"). Convert kg/lb in hints to grams.
14. Only add clarification_questions when meal confidence_score is below 0.90, an item confidence is below 0.90, or one choice would change calories by 50+ kcal (e.g. Paneer vs Chicken, Plain vs Stuffed Dosa, Regular vs Diet). Otherwise return clarification_questions: [].
15. Maximum 3 questions. Each must include an options array of 2–4 short 1-tap answers. Ask ONE topic per question. Plain English, under 14 words. No jargon. Do not ask breakfast/lunch/dinner — the app asks that later.

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
- Roti / naan / bread / dosa / idli: bread_count. Name the actual food ("How many idlis?"), never say roti/naan unless that food is on the plate. Skip if the user already gave a piece count. Do not also ask grams for the same countable food.
- Oily / fried dishes: oil_fat
- Curry / gravy: sauce_gravy
- Unclear protein: protein_type (e.g. "Is this chicken, paneer, or gobi?")

Do NOT ask cooking method AND oil together. Do NOT ask if photo or hints already answer it.

JSON FORMAT:
{
  "meal_summary": "Short descriptive name",
  "confidence_score": 0.95,
  "notes": "Short visual observation",
  "items": [
    {
      "name": "Medu Vada",
      "usda_search_term": "fritter, urad dal, deep fried",
      "estimated_amount": 120,
      "unit": "g",
      "cooking_method": "deep_fried",
      "estimated_oil_tbsp": 1.5,
      "visible_oil": true,
      "confidence": 0.88
    }
  ],
  "clarification_questions": [
    {
      "topic": "protein_type",
      "question": "Is this Chicken 65 or Paneer 65?",
      "about": "65 Dish",
      "options": ["Chicken", "Paneer", "Gobi"]
    }
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
   - Protein/dish choice: update item name and usda_search_term
   - Solid food as estimated_amount in grams; convert bread pieces to approximate grams
4. Recalculate estimated_oil_tbsp if the user clarifies cooking style (e.g. Ghee Roast vs Plain Dosa).
5. Preserve every identified item unless an answer explicitly corrects it.
6. Do NOT calculate or return calories, macros, or nutrition. MealNova looks those up from usda_search_term.`;
