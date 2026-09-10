/**
 * Phase 5 — generic ingredients & common side-dish coverage (CoFID / USDA approximations).
 * PRIORITY entries must appear before broad patterns like chicken, egg, roti.
 */

/** @type {import('./food-references.js').FoodRef[]} */
export const COVERAGE_PHASE5_PRIORITY = [
  { id: 'scrambled_eggs', re: /\bscrambled\s+eggs?\b/i, kcal100: 148, protein100: 10, carbs100: 2, fat100: 11, fibre100: 0, salt100: 320 },
  { id: 'chicken_soup', re: /\bchicken\s+soup\b/i, kcal100: 50, protein100: 4, carbs100: 5, fat100: 2, fibre100: 0.8, salt100: 480 },
  { id: 'generic_stew', re: /\b(?:meat|beef|lamb|chicken|vegetable|tomato)\s+stew\b/i, kcal100: 110, protein100: 8, carbs100: 8, fat100: 5, fibre100: 1.5, salt100: 480 },
  { id: 'kottu_roti', re: /\bkottu\b|\bkottu\s+roti\b|\bkothu\b/i, kcal100: 185, protein100: 8, carbs100: 22, fat100: 7, fibre100: 2, salt100: 560 },
];

/** @type {import('./food-references.js').FoodRef[]} */
export const COVERAGE_PHASE5_REFERENCES = [
  // Vision often returns vague side names — give them real profiles
  { id: 'mixed_vegetables', re: /\bmixed\s+vegetables?\b|\bmixed\s+veg\b|\bsteamed\s+vegetables?\b|\broasted\s+vegetables?\b|\bstir[\s-]?fried\s+vegetables?\b/i, kcal100: 45, protein100: 2, carbs100: 6, fat100: 2, fibre100: 2.5, salt100: 280 },
  { id: 'side_vegetables', re: /\bside\s+veg\b|\bvegetable\s+side\b|\bveg\s+side\b|\bgreen\s+vegetables?\b/i, kcal100: 40, protein100: 2, carbs100: 5, fat100: 1.5, fibre100: 2.5, salt100: 260 },
  { id: 'broccoli_side', re: /\bsteamed\s+broccoli\b|\bbroccoli\s+side\b/i, kcal100: 35, protein100: 2.5, carbs100: 5, fat100: 0.5, fibre100: 2.5, salt100: 40 },
  { id: 'roast_potatoes', re: /\broast\s+potatoes?\b|\broasted\s+potatoes?\b|\bjacket\s+potato\b|\bbaked\s+potato\b/i, kcal100: 120, protein100: 2.5, carbs100: 20, fat100: 3.5, fibre100: 2, salt100: 280 },
  { id: 'side_salad', re: /\bside\s+salad\b|\bgreen\s+salad\b|\bhouse\s+salad\b|\bside\s+salad\b/i, kcal100: 25, protein100: 1.5, carbs100: 3, fat100: 1, fibre100: 2, salt100: 180 },
  { id: 'garlic_bread', re: /\bgarlic\s+bread\b|\bgarlic\s+toast\b/i, kcal100: 290, protein100: 8, carbs100: 42, fat100: 10, fibre100: 2, salt100: 620 },
  { id: 'plain_rice', re: /\bplain\s+rice\b|\bwhite\s+rice\b|\bbrown\s+rice\b|\brice\s+side\b|\bsteamed\s+rice\b/i, kcal100: 130, protein100: 2.7, carbs100: 28, fat100: 0.3, fibre100: 0.4, salt100: 5 },
  { id: 'chicken_wings', re: /\bchicken\s+wings?\b(?!(\s+buffalo|\s+hot))/i, kcal100: 220, protein100: 18, carbs100: 3, fat100: 15, fibre100: 0.5, salt100: 580 },

  // Legumes (cooked, CoFID-style)
  { id: 'dal', re: /\bdal\b|\bdaal\b|\blentils?\b|\blentil\s+soup\b|\blentil\s+curry\b/i, kcal100: 105, protein100: 7, carbs100: 14, fat100: 2, fibre100: 4, salt100: 380 },
  { id: 'chickpeas', re: /\bchickpeas?\b|\bgarbanzo\b|\bchana\b(?!(\s+masala))/i, kcal100: 120, protein100: 7, carbs100: 16, fat100: 2.5, fibre100: 5, salt100: 320 },
  { id: 'black_beans', re: /\bblack\s+beans?\b|\brefried\s+beans?\b/i, kcal100: 115, protein100: 7, carbs100: 17, fat100: 1.5, fibre100: 6, salt100: 420 },
  { id: 'kidney_beans', re: /\bkidney\s+beans?\b/i, kcal100: 110, protein100: 7, carbs100: 16, fat100: 1, fibre100: 5.5, salt100: 450 },
  { id: 'baked_beans', re: /\bbaked\s+beans?\b(?!(\s+on\s+toast))/i, kcal100: 105, protein100: 5, carbs100: 16, fat100: 1, fibre100: 4.5, salt100: 480 },

  // Filipino
  { id: 'adobo', re: /\badobo\b|\bchicken\s+adobo\b|\bpork\s+adobo\b/i, kcal100: 165, protein100: 16, carbs100: 4, fat100: 10, fibre100: 0.5, salt100: 680 },
  { id: 'sinigang', re: /\bsinigang\b|\bpork\s+sinigang\b|\bfish\s+sinigang\b/i, kcal100: 55, protein100: 6, carbs100: 4, fat100: 2, fibre100: 1, salt100: 520 },
  { id: 'lechon', re: /\blechon\b|\blechon\s+kawali\b|\bcrispy\s+pork\s+belly\b/i, kcal100: 290, protein100: 18, carbs100: 0, fat100: 24, fibre100: 0, salt100: 620 },
  { id: 'pancit', re: /\bpancit\b|\bpancit\s+canton\b|\bpancit\s+bihon\b/i, kcal100: 145, protein100: 6, carbs100: 20, fat100: 4.5, fibre100: 1.5, salt100: 540 },

  // Southeast Asian
  { id: 'mee_goreng', re: /\bmee\s+goreng\b|\bindomie\s+goreng\b/i, kcal100: 165, protein100: 6, carbs100: 22, fat100: 6, fibre100: 1.5, salt100: 580 },
  { id: 'char_kway_teow', re: /\bchar\s+kway\s+teow\b|\bchar\s+kwai\s+teow\b/i, kcal100: 175, protein100: 7, carbs100: 20, fat100: 8, fibre100: 1.5, salt100: 620 },
  { id: 'hoppers', re: /\bhoppers?\b|\bstring\s+hoppers?\b/i, kcal100: 150, protein100: 3, carbs100: 28, fat100: 2.5, fibre100: 1, salt100: 280 },

  // Caribbean
  { id: 'doubles', re: /\bdoubles\b|\btrinidad\s+doubles\b/i, kcal100: 245, protein100: 8, carbs100: 28, fat100: 11, fibre100: 4, salt100: 620 },
  { id: 'pelau', re: /\bpelau\b|\bpelau\s+rice\b|\bone\s+pot\s+pelau\b/i, kcal100: 165, protein100: 8, carbs100: 22, fat100: 6, fibre100: 2, salt100: 480 },
  { id: 'macaroni_pie', re: /\bmacaroni\s+pie\b|\btrini\s+macaroni\s+pie\b/i, kcal100: 175, protein100: 6, carbs100: 22, fat100: 7, fibre100: 1.5, salt100: 520 },

  // Noodles & breads
  { id: 'plain_noodles', re: /\bplain\s+noodles?\b|\begg\s+noodles?\b|\brice\s+noodles?\b|\bglass\s+noodles?\b|\budon\b|\bsoba\b/i, kcal100: 130, protein100: 4, carbs100: 24, fat100: 1.5, fibre100: 1, salt100: 320 },
  { id: 'flatbread', re: /\bflatbread\b|\bpita\b|\bpitta\b(?!(\s+and\s+hummus))/i, kcal100: 280, protein100: 9, carbs100: 48, fat100: 5, fibre100: 2.5, salt100: 520 },
  { id: 'tortilla_wrap', re: /\btortilla\b(?!(\s+chips|\s+española|\s+espanola))/i, kcal100: 310, protein100: 8, carbs100: 52, fat100: 7, fibre100: 4, salt100: 680 },
  { id: 'salsa', re: /\bsalsa\b|\bpico\s+de\s+gallo\b/i, kcal100: 35, protein100: 1, carbs100: 7, fat100: 0.3, fibre100: 2, salt100: 420 },

  // Bowls
  { id: 'quinoa_bowl', re: /\bquinoa\s+bowl\b|\bquinoa\b/i, kcal100: 120, protein100: 4.5, carbs100: 21, fat100: 2, fibre100: 2.5, salt100: 280 },
  { id: 'buddha_bowl', re: /\bbuddha\s+bowl\b|\bgrain\s+bowl\b|\bpower\s+bowl\b/i, kcal100: 110, protein100: 5, carbs100: 15, fat100: 3.5, fibre100: 3, salt100: 320 },
  { id: 'poke_bowl', re: /\bpoke\s+bowl\b|\bpoké\s+bowl\b/i, kcal100: 125, protein100: 10, carbs100: 12, fat100: 4, fibre100: 1.5, salt100: 480 },

  // Dairy & alt proteins
  { id: 'tempeh', re: /\btempeh\b/i, kcal100: 195, protein100: 19, carbs100: 9, fat100: 11, fibre100: 4, salt100: 40 },
  { id: 'parmesan', re: /\bparmesan\b|\bparmigiano\b|\bgrated\s+parmesan\b/i, kcal100: 420, protein100: 36, carbs100: 2, fat100: 30, salt100: 1200 },
  { id: 'cream_cheese', re: /\bcream\s+cheese\b|\bphiladelphia\b/i, kcal100: 340, protein100: 6, carbs100: 4, fat100: 34, salt100: 380 },
  { id: 'mozzarella_fresh', re: /\bmozzarella\b|\bfresh\s+mozzarella\b/i, kcal100: 280, protein100: 22, carbs100: 3, fat100: 20, salt100: 620 },
  { id: 'blue_cheese', re: /\bblue\s+cheese\b|\bstilton\b|\broquefort\b|\bgorgonzola\b/i, kcal100: 360, protein100: 21, carbs100: 2, fat100: 30, salt100: 980 },
  { id: 'brie', re: /\bbrie\b|\bcamembert\b/i, kcal100: 335, protein100: 18, carbs100: 1, fat100: 28, salt100: 620 },

  // Other common sides
  { id: 'sweetcorn', re: /\bsweetcorn\b|\bcorn\s+on\s+the\s+cob\b|\bcorn\s+cob\b/i, kcal100: 85, protein100: 3, carbs100: 16, fat100: 1.5, fibre100: 2.5, salt100: 45 },
  { id: 'yogurt_bowl', re: /\byogurt\s+bowl\b|\byoghurt\s+bowl\b|\bgreek\s+yogurt\s+bowl\b/i, kcal100: 95, protein100: 8, carbs100: 10, fat100: 2.5, sugar100: 8, salt100: 60 },
  { id: 'mixed_plate', re: /\bmixed\s+plate\b|\bcombo\s+plate\b/i, kcal100: 140, protein100: 8, carbs100: 14, fat100: 6, fibre100: 2, salt100: 480 },
  { id: 'vegetable_soup', re: /\bvegetable\s+soup\b|\btomato\s+soup\b/i, kcal100: 40, protein100: 1.5, carbs100: 6, fat100: 1.5, fibre100: 1.5, salt100: 420 },

  // Phase 5 batch 2 — more vague vision side names
  { id: 'grilled_vegetables', re: /\bgrilled\s+vegetables?\b|\bgrilled\s+veg\b|\broasted\s+veg\b/i, kcal100: 55, protein100: 2, carbs100: 7, fat100: 2.5, fibre100: 2.5, salt100: 320 },
  { id: 'side_dish', re: /\bside\s+dish\b|\bside\s+order\b|\bvegetable\s+dish\b/i, kcal100: 45, protein100: 2, carbs100: 6, fat100: 2, fibre100: 2.5, salt100: 280 },
  { id: 'cooking_sauce', re: /\b(?:tomato|brown|pepper|cream|white|bbq|barbecue|hot|curry|mushroom|cheese)\s+sauce\b|\bsauce\b(?!\s+(and|with|on|for))/i, kcal100: 85, protein100: 2, carbs100: 8, fat100: 5, fibre100: 1, salt100: 480 },
  { id: 'chip_shop_curry_sauce', re: /\bcurry\s+sauce\b|\bchip\s+shop\s+curry\b|\bcurry\s+dip\b/i, kcal100: 95, protein100: 1.5, carbs100: 12, fat100: 4, fibre100: 1, salt100: 520 },
  { id: 'mushy_peas_side', re: /\bmushy\s+peas\b|\bpeas\s+side\b/i, kcal100: 85, protein100: 5, carbs100: 12, fat100: 1.5, fibre100: 4, salt100: 380 },
  { id: 'corn_on_cob', re: /\bcorn\s+on\s+the\s+cob\b|\bcorn\s+cob\b|\bsweet\s+corn\s+cob\b/i, kcal100: 85, protein100: 3, carbs100: 16, fat100: 1.5, fibre100: 2.5, salt100: 45 },
  { id: 'house_dressing', re: /\bhouse\s+dressing\b|\bsalad\s+dressing\b|\bvinaigrette\b/i, kcal100: 320, protein100: 0.5, carbs100: 4, fat100: 34, fibre100: 0, salt100: 680 },
];
