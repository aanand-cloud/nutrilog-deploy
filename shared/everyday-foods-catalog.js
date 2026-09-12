/**
 * Everyday dishes that were missing or only matched a generic (cereal, prawns, chicken).
 * Keep specific patterns before broader FOOD_REFERENCES entries.
 */

/** @type {import('./food-references.js').FoodRef[]} */
export const EVERYDAY_FOODS_PRIORITY = [
  { id: 'peri_peri_chicken', re: /\bperi[\s-]?peri\s+chicken\b|\bnando'?s\s+chicken\b|\bperi\s+peri\b/i, kcal100: 175, protein100: 22, carbs100: 3, fat100: 8, fibre100: 0.5, salt100: 620 },
  { id: 'thai_green_curry', re: /\bthai\s+green\s+curry\b|\bgreen\s+curry\b/i, kcal100: 145, protein100: 9, carbs100: 8, fat100: 9, fibre100: 1.5, salt100: 580 },
  { id: 'thai_red_curry', re: /\bthai\s+red\s+curry\b|\bred\s+curry\b(?!\s+powder)/i, kcal100: 150, protein100: 9, carbs100: 8, fat100: 10, fibre100: 1.5, salt100: 600 },
  { id: 'chicken_karahi', re: /\bchicken\s+karahi\b|\bkarahi\s+chicken\b|\bkarahi\b|\bkarahi\s+gosht\b/i, kcal100: 165, protein100: 16, carbs100: 5, fat100: 9, fibre100: 1.5, salt100: 560 },
  { id: 'palak_paneer', re: /\bpalak\s+paneer\b|\bsaag\s+paneer\b|\bpalak\s+saag\b/i, kcal100: 140, protein100: 8, carbs100: 7, fat100: 9, fibre100: 2.5, salt100: 480 },
  { id: 'chapli_kebab', re: /\bchapli\s+kebab\b|\bchapli\s+kabab\b/i, kcal100: 230, protein100: 16, carbs100: 6, fat100: 16, fibre100: 1, salt100: 640 },
  { id: 'chilli_con_carne', re: /\bchilli\s+con\s+carne\b|\bchili\s+con\s+carne\b|\bchilli\s+con\b|\bchili\s+con\b/i, kcal100: 135, protein100: 10, carbs100: 10, fat100: 6, fibre100: 3, salt100: 520 },
  { id: 'chicken_nuggets', re: /\bchicken\s+nuggets?\b|\bnuggets?\b/i, kcal100: 265, protein100: 14, carbs100: 18, fat100: 15, fibre100: 1, salt100: 680 },
  { id: 'fish_fingers', re: /\bfish\s+fingers?\b|\bfish\s+sticks?\b/i, kcal100: 215, protein100: 12, carbs100: 18, fat100: 10, fibre100: 1, salt100: 520 },
  { id: 'hash_browns', re: /\bhash\s+browns?\b|\bhashbrown/i, kcal100: 265, protein100: 2.5, carbs100: 28, fat100: 16, fibre100: 2, salt100: 420 },
  { id: 'steak', re: /\b(?:sirloin|ribeye|rump\s+steak|fillet\s+steak|rump\s+steak)\b|\bsteak\b(?!\s+(bake|and\s+ale|pie|pudding))/i, kcal100: 210, protein100: 28, carbs100: 0, fat100: 11, fibre100: 0, salt100: 80 },
  { id: 'scampi_fried', re: /\bscampi\b|\bbreaded\s+scampi\b/i, kcal100: 230, protein100: 12, carbs100: 18, fat100: 12, fibre100: 1, salt100: 620 },
  { id: 'pie_and_mash', re: /\bpie\s+and\s+mash\b|\bpie\s+mash\b|\bliquor\s+and\s+mash\b/i, kcal100: 155, protein100: 7, carbs100: 18, fat100: 6, fibre100: 1.5, salt100: 540 },
  { id: 'weetabix', re: /\bweetabix\b|\bweetabixs?\b|\bshredded\s+wheat\b/i, kcal100: 362, protein100: 12, carbs100: 69, fat100: 2, fibre100: 10, sugar100: 4.4, salt100: 10 },
  { id: 'granola', re: /\bgranola\b|\bcrunchy\s+granola\b/i, kcal100: 420, protein100: 9, carbs100: 62, fat100: 14, fibre100: 6, sugar100: 18, salt100: 120 },
  { id: 'oat_milk', re: /\boat\s+milk\b|\boatly\b/i, kcal100: 45, protein100: 1, carbs100: 7, fat100: 1.5, fibre100: 0.8, sugar100: 4, salt100: 40 },
  { id: 'bagel', re: /\bbagel\b(?!\s+(and|with|cream|salmon|salt))/i, kcal100: 260, protein100: 10, carbs100: 50, fat100: 1.5, fibre100: 2.5, salt100: 480 },
  { id: 'halloumi_wrap', re: /\bhalloumi\s+wrap\b|\bhalloumi\s+pitta\b|\bgrilled\s+halloumi\s+wrap\b/i, kcal100: 230, protein100: 12, carbs100: 22, fat100: 11, fibre100: 2.5, salt100: 780 },
  { id: 'tuna_mayo_sandwich', re: /\btuna\s+mayo\b|\btuna\s+mayonnaise\s+sandwich\b|\btuna\s+sandwich\b/i, kcal100: 210, protein100: 12, carbs100: 22, fat100: 8, fibre100: 1.5, salt100: 520 },
  { id: 'sausage_chips', re: /\bsausage\s+and\s+chips\b|\bsausages?\s+and\s+chips\b|\bsausage\s+chips\b/i, kcal100: 230, protein100: 8, carbs100: 20, fat100: 13, fibre100: 1.5, salt100: 680 },
  { id: 'pasta_bake', re: /\bpasta\s+bake\b|\bcheesy\s+pasta\s+bake\b/i, kcal100: 160, protein100: 7, carbs100: 18, fat100: 6, fibre100: 1.5, salt100: 480 },
  { id: 'chicken_rice_bowl', re: /\bchicken\s+(and|&)\s+rice\b|\bchicken\s+rice\s+bowl\b|\bgrilled\s+chicken\s+rice\b/i, kcal100: 155, protein100: 14, carbs100: 16, fat100: 4, fibre100: 1, salt100: 420 },
  { id: 'protein_yogurt', re: /\bprotein\s+yogurt\b|\bhigh[\s-]?protein\s+yogurt\b|\bskyr\b/i, kcal100: 68, protein100: 10, carbs100: 4, fat100: 0.4, sugar100: 3.5, salt100: 50 },
  { id: 'english_muffin', re: /\benglish\s+muffin\b/i, kcal100: 227, protein100: 8, carbs100: 44, fat100: 2, fibre100: 2.5, salt100: 420 },
  { id: 'doner_chips', re: /\bdoner\s+and\s+chips\b|\bdoner\s+chips\b|\bkebab\s+and\s+chips\b|\bkebab\s+chips\b/i, kcal100: 230, protein100: 12, carbs100: 20, fat100: 12, fibre100: 1.5, salt100: 720 },
];
