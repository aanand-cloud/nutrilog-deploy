/**
 * Trust the user's meal description when it matches the food reference DB.
 * Fixes "chicken curry" → generic curry+r/chicken and stops protein questions for aviyal etc.
 */

import { matchFoodReference, nutritionForAmount, per100FromReference, parseGramsFromText } from './nutrition-density.js';
import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import { isEggDishName } from './nutrition-reference.js';
import { shouldSkipDescriptionAnchor } from './plate-tighten.js';
import { defaultPieceGramsForCanonical } from './canonical-food-identity.js';
import { getVerifiedRecord } from './verified-nutrition.js';

const VEG_DISH_REF_IDS = new Set([
  'avial', 'sambar', 'rasam', 'kootu', 'thoran', 'veg_curry', 'veg_kurma', 'dal_tadka', 'dal_makhani',
  'dal_fry', 'dal_palak', 'dal_bati', 'dal_bafla', 'dalma', 'dal_pakwan', 'saag_aloo',
  'dum_aloo', 'chana_masala', 'rajma', 'aloo_gobi', 'aloo_matar', 'baingan_bharta', 'bhindi_masala',
  'navratan_korma', 'methi_malai', 'mushroom_masala', 'undhiyu', 'erissery', 'labra', 'shukto',
  'kafuli', 'sai_bhaji', 'pithla', 'cauliflower_cheese', 'mushy_peas', 'colcannon', 'bubble_and_squeak',
]);

const VEG_DISH_TEXT_RES = [
  /\baviyal\b/, /\bavial\b/, /\bsambar\b/, /\bsambhar\b/, /\brasam\b/, /\bporiyal\b/, /\bkootu\b/,
  /\bveg(?:etable)?\s+curry\b/, /\bmixed\s+veg\b/, /\bsabzi\b/, /\bsabji\b/, /\bdal\b/, /\bdaal\b/,
  /\bkeerai\b/, /\bthoran\b/, /\bolan\b/, /\bpachadi\b/, /\bchole\b/, /\bchana\s+masala\b/,
  /\brajma\b/, /\baloo\s+gobi\b/, /\bbhindi\b/, /\bkofta\b/, /\bkhichdi\b/, /\bdhokla\b/,
  /\bpav\s+bhaji\b/, /\bupma\b/, /\bpoha\b/, /\bpongal\b/, /\bputtu\b/, /\bappam\b/,
];

const PROTEIN_NAMED_RES = [
  /\bchicken\b/, /\blamb\b/, /\bmutton\b/, /\bbeef\b/, /\bpork\b/, /\bfish\b/, /\bprawn\b/, /\bshrimp\b/,
  /\bpaneer\b/, /\btofu\b/, /\beggs?\b/, /\btikka\b/, /\bbiryani\b/,
];

const DEFAULT_GRAMS = {
  avial: 200,
  sambar: 250,
  rasam: 200,
  chicken_curry: 280,
  lamb_curry: 280,
  fish_curry: 280,
  butter_chicken: 280,
  paneer_tikka: 220,
  palak_paneer: 220,
  chana_masala: 250,
  chole_bhature: 350,
  pav_bhaji: 320,
  veg_curry: 220,
  dal_tadka: 250,
  dal_makhani: 250,
  biryani: 350,
  chicken_biryani: 350,
  mutton_biryani: 350,
  hyderabadi_biryani: 380,
  chicken_65: 180,
  gobi_65: 160,
  paneer_65: 170,
  chilli_chicken: 200,
  chicken_manchurian: 200,
  gobi_manchurian: 180,
  chicken_lollipop: 200,
  dragon_chicken: 200,
  mutton_sukka: 180,
  mutton_chukka: 180,
  pepper_chicken: 180,
  fish_fry: 170,
  prawn_fry: 160,
  schezwan_chicken: 190,
  onion_raita: 80,
  cucumber_raita: 80,
  boondi_raita: 80,
  mint_raita: 80,
  raita: 80,
  brinjal_gosthu: 100,
  bagara_baingan: 100,
  ennai_kathirikai: 90,
  mirchi_salan: 80,
  dalcha: 100,
  kachumber: 50,
  kosambari: 60,
  papad_side: 15,
  biryani_shorba: 150,
  bread_halwa: 120,
  firni_side: 100,
  gulab_jamun_side: 80,
  dosa: 180,
  masala_dosa: 220,
  idli: 60,
  chow_mein: 350,
  fried_rice: 320,
  sweet_sour: 320,
  chinese_takeaway: 350,
  tonkotsu_ramen: 480,
  miso_ramen: 450,
  ramen: 450,
  sushi_platter: 320,
  maki_roll: 240,
  sashimi: 250,
  chirashi: 380,
  bento: 400,
  gyudon: 380,
  katsudon: 400,
  tonkatsu: 280,
  japanese_curry: 350,
  katsu_curry: 400,
  gyoza: 160,
  miso_soup: 250,
  tempura: 220,
  karaage: 200,
  margherita: 280,
  pepperoni_pizza: 280,
  european_pizza: 260,
  carbonara: 350,
  bolognese: 350,
  lasagne: 350,
  risotto: 320,
  paella: 380,
  wiener_schnitzel: 280,
  moussaka: 320,
  coq_au_vin: 300,
  boeuf_bourguignon: 320,
  goulash: 350,
  tapas: 300,
  kung_pao: 300,
  peking_duck: 280,
  dim_sum_platter: 320,
  mapo_tofu: 280,
  char_siu: 250,
  beans_on_toast: 280,
  avocado_toast: 180,
  scrambled_eggs_toast: 220,
  overnight_oats: 250,
  greek_yogurt: 170,
  skyr: 150,
  cottage_cheese: 150,
  full_english: 450,
  continental_breakfast: 320,
  avocado: 160,
  green_curry: 280,
  red_curry: 280,
  massaman_curry: 320,
  tom_yum: 300,
  rendang: 280,
  nasi_lemak: 380,
  roti_canai: 120,
  bulgogi: 280,
  korean_fried_chicken: 250,
  tteokbokki: 300,
  japchae: 320,
  pumpkin_seeds: 15,
  sunflower_seeds: 15,
  chia_seeds: 15,
  flax_seeds: 15,
  peanut_butter: 32,
  almond_butter: 32,
  nutella: 20,
  marmite: 8,
  marmite_toast: 90,
  protein_powder: 30,
  rice_cakes: 20,
  oat_bar: 45,
  trail_mix: 30,
  hummus_carrots: 120,
  ghee_rice: 250,
  tomato_rice: 250,
  idli_vada: 220,
  kulcha: 90,
  vada: 80,
  burrito_bowl: 400,
  fajitas: 320,
  quesadilla: 180,
  chilaquiles: 280,
  huevos_rancheros: 250,
  carnitas: 200,
  chicken_tinga: 280,
  tortilla_chips: 40,
  manakish: 120,
  falafel_wrap: 250,
  shawarma_plate: 350,
  mujadara: 300,
  fattoush: 200,
  dolma: 150,
  borek: 120,
  kibbeh: 150,
  hummus_pitta: 180,
  jollof_rice: 350,
  party_jollof: 380,
  ofada_rice: 360,
  rice_and_stew: 380,
  egusi_soup: 280,
  pepper_soup: 350,
  pounded_yam: 250,
  amala: 220,
  amala_ewedu: 420,
  eba: 220,
  fufu: 250,
  moi_moi: 200,
  moi_moi_akara: 450,
  akara: 120,
  suya: 180,
  suya_plantain: 420,
  dodo: 150,
  abacha: 250,
  waakye: 380,
  banku: 280,
  banku_tilapia: 400,
  ugali: 250,
  nyama_choma_ugali: 450,
  pilau: 350,
  doro_wat: 320,
  injera: 180,
  nyama_choma: 220,
  peri_peri_chicken: 200,
  thai_green_curry: 280,
  thai_red_curry: 280,
  chicken_karahi: 280,
  palak_paneer: 250,
  chapli_kebab: 160,
  chilli_con_carne: 300,
  chicken_nuggets: 150,
  fish_fingers: 140,
  hash_browns: 80,
  steak: 180,
  scampi_fried: 160,
  pie_and_mash: 420,
  weetabix: 40,
  granola: 50,
  oat_milk: 200,
  bagel: 90,
  halloumi_wrap: 260,
  tuna_mayo_sandwich: 200,
  sausage_chips: 380,
  pasta_bake: 350,
  chicken_rice_bowl: 380,
  protein_yogurt: 170,
  english_muffin: 60,
  doner_chips: 420,
  cheeseburger: 220,
  hamburger: 220,
  bacon_cheeseburger: 240,
  burger_fries: 450,
  chicken_waffles: 420,
  chicken_waffles: 420,
  mac_and_cheese: 300,
  buffalo_wings: 200,
  philly_cheesesteak: 320,
  meatloaf: 280,
  biscuits_gravy: 350,
  eggs_benedict: 280,
  clam_chowder: 350,
  jambalaya: 380,
  cobb_salad: 320,
  milkshake: 400,
  gulab_jamun: 80,
  jalebi: 90,
  rasgulla: 80,
  rasmalai: 100,
  kulfi: 90,
  kheer: 200,
  halwa: 150,
  carrot_halwa: 150,
  barfi: 50,
  sandesh: 60,
  kaju_katli: 50,
  peda: 50,
  phirni: 180,
  malpua: 100,
  soan_papdi: 45,
  rabri: 150,
  mysore_pak: 60,
  modak: 80,
  shrikhand: 150,
  kalakand: 60,
  falooda: 350,
  sticky_toffee: 120,
  trifle: 180,
  banoffee_pie: 120,
  eton_mess: 150,
  knickerbocker_glory: 280,
  victoria_sponge: 120,
  mince_pie: 60,
  profiterole: 100,
  eclair: 80,
  custard_tart: 100,
  doughnut: 70,
  apple_pie: 120,
  pecan_pie: 120,
  cheesecake: 120,
  brownie: 80,
  chocolate_chip_cookie: 50,
  key_lime_pie: 120,
  carrot_cake: 120,
  red_velvet_cake: 120,
  cupcake: 80,
  ice_cream_sundae: 200,
  banana_split: 350,
  apple_crumble: 180,
  pumpkin_pie: 120,
  lemon_meringue_pie: 120,
  funnel_cake: 120,
  lava_cake: 100,
  mooncake: 80,
  egg_tart: 60,
  mango_pudding: 150,
  sesame_ball: 60,
  tangyuan: 120,
  baklava: 80,
  kunefe: 150,
  turkish_delight: 40,
  sutlac: 200,
  lokma: 100,
  revani: 120,
  mochi: 60,
  mochi_ice_cream: 80,
  dorayaki: 120,
  taiyaki: 120,
  anmitsu: 250,
  castella: 80,
  purin: 150,
  melon_pan: 80,
  kakigori: 250,
  manju: 80,
  strawberry_shortcake: 120,
  tiramisu: 120,
  cannoli: 100,
  panna_cotta: 150,
  creme_brulee: 150,
  macaron: 30,
  churros: 100,
  ice_cream: 100,
  dessert_slice: 120,
  chocolate_cake: 120,
  cake: 120,
  rice: 180,
  pancakes_bacon: 380,
  bacon: 40,
  ewedu: 150,
  default: 250,
  banana: 120,
  bread: 35,
  baked_beans: 210,
  butter: 10,
  oats: 40,
  porridge: 250,
  milk: 200,
};

const RICE_SIDE_SKIP_REF_IDS = new Set([
  'rice',
  'chinese_fried_rice',
  'special_fried_rice',
  'fried_rice',
  'chicken_fried_rice',
  'prawn_fried_rice',
  'vegetable_fried_rice',
  'yangzhou_fried_rice',
  'paella',
  'risotto',
  'jollof_rice',
  'party_jollof',
  'ofada_rice',
  'rice_and_stew',
  'coconut_rice',
  'nigerian_fried_rice',
  'waakye',
  'pilau',
  'ugali',
  'banku',
  'kenkey',
  'jambalaya',
  'red_beans_rice',
  'shrimp_and_grits',
  'pilau',
]);

function round1(v) {
  return Math.round(v * 10) / 10;
}

const DISPLAY_OVERRIDES = {
  avial: 'Aviyal',
  chicken_curry: 'Chicken curry',
  lamb_curry: 'Lamb curry',
  fish_curry: 'Fish curry',
  butter_chicken: 'Butter chicken',
  paneer_tikka: 'Paneer tikka',
  palak_paneer: 'Palak paneer',
  chana_masala: 'Chana masala',
  chole_bhature: 'Chole bhature',
  pav_bhaji: 'Pav bhaji',
  veg_curry: 'Vegetable curry',
  hyderabadi_biryani: 'Hyderabadi biryani',
  chicken_65: 'Chicken 65',
  chilli_chicken: 'Chilli chicken',
  mutton_sukka: 'Mutton sukka',
  gobi_manchurian: 'Gobi manchurian',
  chicken_lollipop: 'Chicken lollipop',
  brinjal_gosthu: 'Brinjal gosthu',
  bagara_baingan: 'Bagara baingan',
  mirchi_salan: 'Mirchi ka salan',
  bread_halwa: 'Bread halwa',
  sambar_rice: 'Sambar rice',
  curd_rice: 'Curd rice',
  chow_mein: 'Chow mein',
  crispy_chow_mein: 'Crispy chow mein',
  lo_mein: 'Lo mein',
  chinese_fried_rice: 'Egg fried rice',
  special_fried_rice: 'Special fried rice',
  fried_rice: 'Fried rice',
  sweet_sour: 'Sweet and sour',
  sweet_and_sour_chicken: 'Sweet and sour chicken',
  sweet_and_sour_pork: 'Sweet and sour pork',
  general_tso_chicken: 'General Tso chicken',
  kung_pao: 'Kung pao',
  kung_pao_chicken: 'Kung pao chicken',
  peking_duck: 'Peking duck',
  crispy_duck: 'Crispy duck',
  dim_sum_platter: 'Dim sum platter',
  mapo_tofu: 'Mapo tofu',
  char_siu: 'Char siu',
  green_curry: 'Green curry',
  red_curry: 'Red curry',
  massaman_curry: 'Massaman curry',
  tom_yum: 'Tom yum soup',
  rendang: 'Rendang',
  nasi_lemak: 'Nasi lemak',
  roti_canai: 'Roti canai',
  bulgogi: 'Bulgogi',
  korean_fried_chicken: 'Korean fried chicken',
  tteokbokki: 'Tteokbokki',
  japchae: 'Japchae',
  avocado_toast: 'Avocado toast',
  scrambled_eggs_toast: 'Scrambled eggs on toast',
  overnight_oats: 'Overnight oats',
  greek_yogurt: 'Greek yogurt',
  skyr: 'Skyr',
  cottage_cheese: 'Cottage cheese',
  pumpkin_seeds: 'Pumpkin seeds',
  sunflower_seeds: 'Sunflower seeds',
  chia_seeds: 'Chia seeds',
  flax_seeds: 'Flax seeds',
  peanut_butter: 'Peanut butter',
  almond_butter: 'Almond butter',
  nutella: 'Nutella',
  marmite: 'Marmite',
  protein_powder: 'Protein powder',
  rice_cakes: 'Rice cakes',
  oat_bar: 'Oat bar',
  trail_mix: 'Trail mix',
  hummus_carrots: 'Hummus and carrot sticks',
  ghee_rice: 'Ghee rice',
  tomato_rice: 'Tomato rice',
  idli_vada: 'Idli and vada',
  kulcha: 'Kulcha',
  burrito_bowl: 'Burrito bowl',
  fajitas: 'Fajitas',
  quesadilla: 'Quesadilla',
  chilaquiles: 'Chilaquiles',
  huevos_rancheros: 'Huevos rancheros',
  carnitas: 'Carnitas',
  chicken_tinga: 'Chicken tinga',
  tortilla_chips: 'Tortilla chips',
  manakish: 'Manakish',
  falafel_wrap: 'Falafel wrap',
  shawarma_plate: 'Shawarma plate',
  mujadara: 'Mujadara',
  fattoush: 'Fattoush',
  dolma: 'Dolma',
  borek: 'Borek',
  kibbeh: 'Kibbeh',
  hummus_pitta: 'Hummus and pitta',
  jollof_rice: 'Jollof rice',
  party_jollof: 'Party jollof',
  ofada_rice: 'Ofada rice',
  rice_and_stew: 'Rice and stew',
  egusi_soup: 'Egusi soup',
  pepper_soup: 'Pepper soup',
  ogbono_soup: 'Ogbono soup',
  banga_soup: 'Banga soup',
  pounded_yam: 'Pounded yam',
  amala: 'Amala',
  eba: 'Eba',
  moi_moi: 'Moi moi',
  akara: 'Akara',
  suya: 'Suya',
  dodo: 'Fried plantain',
  plantain_eggs: 'Plantain and eggs',
  abacha: 'Abacha',
  waakye: 'Waakye',
  banku: 'Banku',
  nyama_choma: 'Nyama choma',
  peri_peri_chicken: 'Peri-peri chicken',
  thai_green_curry: 'Thai green curry',
  thai_red_curry: 'Thai red curry',
  chicken_karahi: 'Chicken karahi',
  palak_paneer: 'Palak paneer',
  chapli_kebab: 'Chapli kebab',
  chilli_con_carne: 'Chilli con carne',
  chicken_nuggets: 'Chicken nuggets',
  fish_fingers: 'Fish fingers',
  hash_browns: 'Hash browns',
  steak: 'Steak',
  scampi_fried: 'Scampi',
  pie_and_mash: 'Pie and mash',
  weetabix: 'Weetabix',
  granola: 'Granola',
  oat_milk: 'Oat milk',
  bagel: 'Bagel',
  halloumi_wrap: 'Halloumi wrap',
  tuna_mayo_sandwich: 'Tuna mayo sandwich',
  sausage_chips: 'Sausage and chips',
  pasta_bake: 'Pasta bake',
  chicken_rice_bowl: 'Chicken and rice',
  protein_yogurt: 'Protein yogurt',
  english_muffin: 'English muffin',
  doner_chips: 'Doner and chips',
  ugali: 'Ugali',
  pilau: 'Pilau',
  doro_wat: 'Doro wat',
  shiro: 'Shiro',
  tibs: 'Tibs',
  kitfo: 'Kitfo',
  bunny_chow: 'Bunny chow',
  cheeseburger: 'Cheeseburger',
  hamburger: 'Hamburger',
  bacon_cheeseburger: 'Bacon cheeseburger',
  smash_burger: 'Smash burger',
  burger_fries: 'Burger and fries',
  chicken_waffles: 'Chicken and waffles',
  chicken_sandwich: 'Chicken sandwich',
  philly_cheesesteak: 'Philly cheesesteak',
  hot_dog: 'Hot dog',
  chili_dog: 'Chili dog',
  buffalo_wings: 'Buffalo wings',
  bbq_ribs: 'BBQ ribs',
  mac_and_cheese: 'Mac and cheese',
  meatloaf: 'Meatloaf',
  meatloaf_mash: 'Meatloaf and mashed potatoes',
  biscuits_gravy: 'Biscuits and gravy',
  eggs_benedict: 'Eggs Benedict',
  french_toast: 'French toast',
  pancakes_bacon: 'Pancakes and bacon',
  diner_breakfast: 'Diner breakfast',
  cobb_salad: 'Cobb salad',
  caesar_salad: 'Caesar salad',
  clam_chowder: 'Clam chowder',
  gumbo: 'Gumbo',
  jambalaya: 'Jambalaya',
  red_beans_rice: 'Red beans and rice',
  shrimp_and_grits: 'Shrimp and grits',
  reuben: 'Reuben sandwich',
  blt: 'BLT',
  grilled_cheese: 'Grilled cheese',
  lobster_roll: 'Lobster roll',
  apple_pie: 'Apple pie',
  cheesecake: 'Cheesecake',
  milkshake: 'Milkshake',
  singapore_noodles: 'Singapore noodles',
  hot_and_sour_soup: 'Hot and sour soup',
  hainanese_chicken: 'Hainanese chicken rice',
  chinese_takeaway: 'Chinese takeaway',
  szechuan_chicken: 'Szechuan chicken',
  black_bean_sauce: 'Black bean sauce',
  tonkotsu_ramen: 'Tonkotsu ramen',
  miso_ramen: 'Miso ramen',
  shoyu_ramen: 'Shoyu ramen',
  ramen: 'Ramen',
  sushi_platter: 'Sushi platter',
  maki_roll: 'Maki roll',
  nigiri: 'Nigiri',
  sashimi: 'Sashimi',
  chirashi: 'Chirashi bowl',
  bento: 'Bento box',
  gyudon: 'Gyudon',
  katsudon: 'Katsudon',
  oyakodon: 'Oyakodon',
  unadon: 'Unadon',
  tonkatsu: 'Tonkatsu',
  katsu_curry: 'Katsu curry',
  katsu_sando: 'Katsu sando',
  japanese_curry: 'Japanese curry',
  gyoza: 'Gyoza',
  miso_soup: 'Miso soup',
  karaage: 'Karaage',
  yakitori: 'Yakitori',
  teriyaki: 'Teriyaki',
  tempura: 'Tempura',
  takoyaki: 'Takoyaki',
  okonomiyaki: 'Okonomiyaki',
  omurice: 'Omurice',
  udon: 'Udon',
  soba: 'Soba',
  onigiri: 'Onigiri',
  edamame: 'Edamame',
  agedashi_tofu: 'Agedashi tofu',
  margherita: 'Margherita pizza',
  pepperoni_pizza: 'Pepperoni pizza',
  european_pizza: 'Pizza',
  carbonara: 'Spaghetti carbonara',
  bolognese: 'Spaghetti bolognese',
  lasagne: 'Lasagne',
  risotto: 'Risotto',
  paella: 'Paella',
  tapas: 'Tapas',
  wiener_schnitzel: 'Wiener schnitzel',
  moussaka: 'Moussaka',
  coq_au_vin: 'Coq au vin',
  boeuf_bourguignon: 'Beef bourguignon',
  goulash: 'Goulash',
  souvlaki: 'Souvlaki',
  quiche_lorraine: 'Quiche Lorraine',
  croque_monsieur: 'Croque monsieur',
  tiramisu: 'Tiramisu',
  bratwurst: 'Bratwurst',
  gravlax: 'Gravlax',
  gulab_jamun: 'Gulab jamun',
  jalebi: 'Jalebi',
  rasgulla: 'Rasgulla',
  rasmalai: 'Rasmalai',
  kulfi: 'Kulfi',
  kheer: 'Kheer',
  shrikhand: 'Shrikhand',
  kalakand: 'Kalakand',
  falooda: 'Falooda',
  banoffee_pie: 'Banoffee pie',
  eton_mess: 'Eton mess',
  knickerbocker_glory: 'Knickerbocker glory',
  sticky_toffee: 'Sticky toffee pudding',
  kunefe: 'Kunefe',
  baklava: 'Baklava',
  turkish_delight: 'Turkish delight',
  sutlac: 'Sutlac',
  mochi: 'Mochi',
  dorayaki: 'Dorayaki',
  taiyaki: 'Taiyaki',
  anmitsu: 'Anmitsu',
  castella: 'Castella',
  purin: 'Purin',
  kakigori: 'Kakigori',
  strawberry_shortcake: 'Strawberry shortcake',
  ice_cream_sundae: 'Ice cream sundae',
  lava_cake: 'Lava cake',
  macaron: 'Macaron',
};

export function refDisplayName(refId = '') {
  if (DISPLAY_OVERRIDES[refId]) return DISPLAY_OVERRIDES[refId];
  return String(refId)
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

const COUNT_WORDS = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseCountablePieces(userText = '') {
  const lower = String(userText).toLowerCase();
  if (!/\b(?:idli|idly|idlies|idlys)\b/.test(lower)) return null;
  const numeric = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:idli|idly|idlies|idlys)\b/);
  if (numeric) return Number(numeric[1]);
  const reverse = lower.match(/\b(?:idli|idly|idlies|idlys)\s*(?:x\s*)?(\d+)\b/);
  if (reverse) return Number(reverse[1]);
  const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+(?:idli|idly|idlies|idlys)\b/);
  if (word) return COUNT_WORDS[word[1]] || 1;
  return 1;
}

function gramsForRef(ref, userText = '') {
  const fromText = parseGramsFromText(userText);
  if (fromText > 0) return fromText;
  const lower = String(userText).toLowerCase();
  if (ref?.id === 'idli') {
    const count = parseCountablePieces(userText);
    const pieceG = defaultPieceGramsForCanonical('idli', getVerifiedRecord('idli'));
    return Math.round(count * pieceG);
  }
  if (ref?.id === 'bread' && /\btoast\b/.test(lower)) return DEFAULT_GRAMS.bread;
  if (ref?.id === 'banana' && !/\b(split|bread|flower|poori|pudding)\b/.test(lower)) {
    return DEFAULT_GRAMS.banana;
  }
  if (ref?.id === 'avocado') {
    const pieceG = DEFAULT_GRAMS.avocado;
    if (/\bhalf\b/.test(lower)) return Math.round(pieceG / 2);
    if (/\bquarter\b/.test(lower)) return Math.round(pieceG / 4);
    return pieceG;
  }
  if (ref?.id === 'butter' && !/\b(chicken|paneer|milk|cream|scotch|peanut)\b/.test(lower)) {
    return DEFAULT_GRAMS.butter;
  }
  if ((ref?.id === 'oats' || ref?.id === 'porridge') && /\bdry\b|\braw\b/.test(lower)) {
    return DEFAULT_GRAMS.oats;
  }
  if (ref?.id && /biryani/.test(ref.id) && !/shorba|side/.test(ref.id)) {
    return DEFAULT_GRAMS[ref.id] || (ref.id.startsWith('hyderabadi_') ? DEFAULT_GRAMS.hyderabadi_biryani : DEFAULT_GRAMS.biryani);
  }
  return DEFAULT_GRAMS[ref.id] || DEFAULT_GRAMS.default;
}

/** Default plate/serving grams for a matched reference (describe/voice pipeline). */
export function servingGramsForReference(ref, userText = '') {
  return servingGramsMeta(ref, userText).grams;
}

/**
 * Same grams as servingGramsForReference, plus a benchmarkable portion source.
 * Photo/vision amounts are not computed here.
 */
export function servingGramsMeta(ref, userText = '') {
  if (!ref) {
    return { grams: DEFAULT_GRAMS.default, portionSource: 'default_fallback', portionSourceDetail: 'catalog_default' };
  }
  const fromText = parseGramsFromText(userText);
  if (fromText > 0) {
    return { grams: fromText, portionSource: 'user_declared', portionSourceDetail: 'explicit_grams' };
  }
  const grams = gramsForRef(ref, userText);
  const biryaniDefault = Boolean(ref.id && /biryani/.test(ref.id) && !/shorba|side/.test(ref.id));
  if (biryaniDefault) {
    const hyderabadi = ref.id.startsWith('hyderabadi_');
    return {
      grams,
      portionSource: 'default_fallback',
      portionSourceDetail: hyderabadi ? 'hyderabadi_biryani_default_380g' : 'biryani_default_350g',
    };
  }
  return { grams, portionSource: 'default_fallback', portionSourceDetail: 'catalog_default' };
}

function analysisText(analysis = {}, extra = '') {
  return [
    extra,
    analysis._userDescription,
    analysis.meal_summary,
    ...(analysis.items || []).map((i) => `${i.name || ''} ${i.portion_estimate || ''}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function shouldSkipProteinClarification(analysis = {}, extraText = '') {
  const text = analysisText(analysis, extraText);

  if (VEG_DISH_TEXT_RES.some((re) => re.test(text))) return true;

  const ref = matchFoodReference(text);
  if (ref && (VEG_DISH_REF_IDS.has(ref.id) || ref.protein100 <= 4)) return true;

  if (PROTEIN_NAMED_RES.some((re) => re.test(text)) && !isEggDishName(text)) return true;

  if (/\b(chicken|lamb|mutton|beef|fish|prawn|shrimp|paneer|tofu)\s+(curry|masala|tikka|biryani|korma|jalfrezi|madras|vindaloo|roast|fry)\b/.test(text)) {
    return true;
  }

  return false;
}

function filterClarificationQuestions(questions = [], analysis = {}) {
  if (!shouldSkipProteinClarification(analysis)) return questions;
  return questions.filter((item) => {
    if (typeof item === 'string') {
      return !/\b(chicken|meat|fish|protein|paneer|tofu|lamb|beef|prawn|mutton|veg or meat)\b/i.test(item);
    }
    if (item?.topic === 'protein_type') return false;
    const q = String(item.question || '').toLowerCase();
    return !/\b(chicken|meat|fish|protein|paneer|tofu|lamb|beef|prawn|mutton)\b/.test(q);
  });
}

function buildItemFromRef(ref, grams, displayName) {
  const per100 = per100FromReference(ref);
  const scaled = nutritionForAmount(per100, grams);
  return {
    name: displayName,
    portion_estimate: `1 serving (~${grams}g)`,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    confidence: 0.78,
  };
}

/**
 * Build a single-dish (plus optional sides) analysis from a food reference row.
 */
export function buildAnalysisFromReference(ref, userText = '', { source = 'voice' } = {}) {
  const lower = String(userText).toLowerCase();
  let name = refDisplayName(ref.id);
  if (ref.id === 'chow_mein') {
    if (/\bchicken\b/.test(lower)) name = 'Chicken chow mein';
    else if (/\b(prawn|shrimp)\b/.test(lower)) name = 'Prawn chow mein';
    else if (/\bbeef\b/.test(lower)) name = 'Beef chow mein';
    else if (/\bvegetable\b|\bveg\b/.test(lower)) name = 'Vegetable chow mein';
  }
  if (ref.id === 'maki_roll') {
    if (/\bcalifornia\s+roll\b/.test(lower)) name = 'California roll';
    else if (/\bdragon\s+roll\b/.test(lower)) name = 'Dragon roll';
    else if (/\bspicy\s+tuna\s+roll\b/.test(lower)) name = 'Spicy tuna roll';
  }
  if (ref.id === 'jollof_rice' || ref.id === 'party_jollof') {
    if (/\bchicken\b/.test(lower)) name = 'Jollof rice and chicken';
    else if (/\bbeef\b/.test(lower)) name = 'Jollof rice and beef';
    else if (/\bgoat\b/.test(lower)) name = 'Jollof rice and goat';
  }
  if (ref.id === 'pepper_soup') {
    if (/\bgoat\b/.test(lower)) name = 'Goat pepper soup';
    else if (/\bcatfish\b/.test(lower)) name = 'Catfish pepper soup';
    else if (/\bchicken\b/.test(lower)) name = 'Chicken pepper soup';
  }
  if (ref.id === 'suya') {
    if (/\bchicken\b/.test(lower)) name = 'Chicken suya';
    else if (/\bbeef\b/.test(lower)) name = 'Beef suya';
  }
  const grams = gramsForRef(ref, userText);
  const items = [buildItemFromRef(ref, grams, name)];

  const wantsSteamedRiceSide = /\b(?<!fried\s)(?:steamed\s+rice|plain\s+rice|basmati|chawal|sadam)\b/.test(lower)
    || (/\brice\b/.test(lower)
      && !/\bfried\s+rice\b/.test(lower)
      && !/\bbiryani\b/.test(lower)
      && !/\bjollof\b/.test(lower)
      && !/\bofada\b/.test(lower)
      && !/\bwaakye\b/.test(lower)
      && !/\bpilau\b/.test(lower)
      && !/\bpilaf\b/.test(lower)
      && !/\bjambalaya\b/.test(lower)
      && !/\bred\s+beans\b/.test(lower));
  if (wantsSteamedRiceSide && !RICE_SIDE_SKIP_REF_IDS.has(ref.id)) {
    const riceRef = matchFoodReference('steamed rice') || matchFoodReference('rice');
    if (riceRef) {
      items.push(buildItemFromRef(riceRef, DEFAULT_GRAMS.rice, 'Rice'));
    }
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.kcal += item.calories_kcal;
      const n = item.nutrition || {};
      acc.protein_g += n.protein_g || 0;
      acc.carbs_g += n.carbs_g || 0;
      acc.fat_g += n.fat_g || 0;
      acc.fibre_g += n.fibre_g || 0;
      acc.sugar_g += n.sugar_g || 0;
      acc.salt_mg += n.salt_mg || 0;
      return acc;
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugar_g: 0, salt_mg: 0 },
  );

  const meal_summary = items.map((i) => i.name).join(' + ');

  return {
    meal_summary,
    total_calories_kcal: totals.kcal,
    total_nutrition: {
      protein_g: round1(totals.protein_g),
      carbs_g: round1(totals.carbs_g),
      fat_g: round1(totals.fat_g),
      fibre_g: round1(totals.fibre_g),
      sugar_g: round1(totals.sugar_g),
      salt_mg: Math.round(totals.salt_mg),
    },
    confidence_score: 0.78,
    items,
    clarification_questions: [],
    _voiceEstimate: source === 'voice',
    _anchored: true,
    _refId: ref.id,
    source,
  };
}

/** True when a reference regex describes a multi-part dish (not a single ingredient). */
export function dishRefCoversCompound(ref = null) {
  if (!ref) return false;
  const src = String(ref.re?.source || '');
  if (/\s+and\s+|\s+with\s+/i.test(src)) return true;
  if (/_and_|_with_|_plate$|_tilapia|_ugali|_ewedu|_stew|_bacon|_gravy|_waffles|_fries|_cheese|_raita|_sambar|_bhature|_bhaji/.test(ref.id || '')) {
    return true;
  }
  return false;
}

/** True when user text clearly names a reference dish (not a vague word like "curry" alone). */
export function isStrongDescriptionMatch(userText = '', ref = null) {
  if (!ref) return false;
  const t = String(userText).trim().toLowerCase();
  if (t.length < 3) return false;

  if (ref.re) {
    if (!ref.re.test(t)) return false;
  } else if (ref._v4) {
    const normalized = normalizeFoodAlias(t);
    const fromId = normalizeFoodAlias(String(ref.id || '').replace(/_/g, ' '));
    const tokens = String(ref.id || '').split('_').filter((tok) => tok.length >= 4);
    const tokenHit = tokens.some((tok) => normalized.includes(tok));
    if (normalized !== fromId && !normalized.includes(fromId) && !fromId.includes(normalized) && !tokenHit) {
      return false;
    }
  } else {
    return false;
  }

  const genericIds = new Set(['curry', 'rice', 'bread', 'chicken', 'soup', 'salad', 'sandwich', 'pasta', 'burger', 'egg', 'bacon']);
  if (genericIds.has(ref.id) && t.split(/\s+/).length < 2) return false;

  if (/\b(and|with|plus|\+)\b/i.test(t) && !dishRefCoversCompound(ref)) {
    return false;
  }

  return true;
}

/**
 * When the user named the dish (photo notes or describe), reshape AI output to match.
 */
export function anchorAnalysisToDescription(analysis, descriptionText = '') {
  const desc = String(descriptionText || '').trim();
  if (!analysis || typeof analysis !== 'object') return analysis;

  const base = {
    ...analysis,
    _userDescription: desc || analysis._userDescription || '',
    clarification_questions: filterClarificationQuestions(analysis.clarification_questions || [], {
      ...analysis,
      _userDescription: desc || analysis._userDescription,
    }),
  };

  if (!desc) return base;

  if (shouldSkipDescriptionAnchor(analysis, desc)) return base;

  const ref = matchFoodReference(desc);
  if (!isStrongDescriptionMatch(desc, ref)) return base;

  const anchored = buildAnalysisFromReference(ref, desc, { source: analysis.source || 'photo' });
  return {
    ...anchored,
    confidence_score: Math.max(Number(analysis.confidence_score) || 0, anchored.confidence_score),
    clarification_questions: filterClarificationQuestions(analysis.clarification_questions || [], anchored),
    _userDescription: desc,
    _photoItems: analysis.items,
  };
}
