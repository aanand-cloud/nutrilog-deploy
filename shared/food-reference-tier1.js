/**
 * Tier 1 — precompiled regex reference matcher (high-confidence layer).
 */

import { FOOD_REFERENCES } from './food-references.js';
import { matchChutneyRef } from './chutney-catalog.js';
import { isEggDishName } from './nutrition-reference.js';
import { dishRefCoversCompound } from './description-anchor.js';

export function matchFoodReferenceTier1(text = '') {
  const t = String(text).toLowerCase();
  let best = null;
  let bestScore = -1;
  if (/\b(chutney|chammanthi|pachadi)\b/i.test(t)) {
    const chutney = matchChutneyRef(t);
    if (chutney) {
      const ref = FOOD_REFERENCES.find((row) => row.id === chutney.id);
      if (ref) return ref;
    }
  }
  for (const ref of FOOD_REFERENCES) {
    if (ref.id === 'egg' && isEggDishName(t)) continue;
    if (ref.id === 'egg' && /\bgammon\s+egg\b|\bham\s+egg\b/.test(t)) continue;
    if (ref.id === 'chicken' && /\b(65|chilli|chili|manchurian|lollipop|dragon|schezwan|szechuan|sukka|chukka|varuval|pepper\s+chicken|chicken\s+fry|chicken\s+dry)\b/.test(t)) continue;
    if (ref.id === 'chicken' && /\bkorean\s+fried\s+chicken\b|\byangnyeom\s+chicken\b|\byang\s+nyeom\s+chicken\b|\bsouthern\s+fried\s+chicken\b|\bfried\s+chicken\b/.test(t)) continue;
    if (ref.id === 'chicken' && /\bfajitas?\b/.test(t)) continue;
    if (ref.id === 'chicken' && /\bjollof\b/.test(t)) continue;
    if (ref.id === 'chicken' && /\bpepper\s+soup\b/.test(t)) continue;
    if (ref.id === 'lamb_curry' && /\b(sukka|chukka|varuval|dry\s+fry)\b/.test(t)) continue;
    if (ref.id === 'fish' && /\b(fry|varuval|65)\b/.test(t)) continue;
    if (ref.id === 'prawns' && /\b(65|fry)\b/.test(t)) continue;
    if (ref.id === 'paneer' && /\b(65|chilli|chili|manchurian)\b/.test(t)) continue;
    if (ref.id === 'beef' && /\bsuya\b/.test(t)) continue;
    if (ref.id === 'beef' && /\b(tibs|kitfo|nyama\s+choma|choma)\b/.test(t)) continue;
    if (ref.id === 'fish' && /\b(banku|pepper\s+soup|catfish)\b/.test(t)) continue;
    if (ref.id === 'white_fish' && /\bbanku\b/.test(t)) continue;
    if (ref.id === 'rice' && /\b(jollof|ofada|waakye|pilau|pilaf|ugali|banku|kenkey|jambalaya|red\s+beans|grits)\b/.test(t)) continue;
    if (ref.id === 'curry' && /\b(egusi|efo|ogbono|banga|afang|draw\s+soup|groundnut\s+soup|bitterleaf|okro|bunny\s+chow)\b/.test(t)) continue;
    if (ref.id === 'soup' && /\b(pepper\s+soup|egusi|banga|bitterleaf|afang|draw|ogbono|okro|okra\s+soup|groundnut\s+soup|gbegiri|ewedu|efo|clam\s+chowder|gumbo)\b/.test(t)) continue;
    if (ref.id === 'fried_rice' && /\b(nigerian|jollof)\b/.test(t)) continue;
    if (ref.id === 'falafel' && /\b(wrap|pitta|pita|sandwich)\b/.test(t)) continue;
    if (ref.id === 'hummus' && /\b(carrot|pitta|pita|sticks)\b/.test(t)) continue;
    if (ref.id === 'cauliflower' && /\b(aloo\s+gobi|gobi\s+manchurian|gobi\s+65|cauliflower\s+cheese|cauli\s+cheese)\b/.test(t)) continue;
    if (ref.id === 'french_beans' && /\b(baked\s+beans|beans\s+on\s+toast|rajma|kidney\s+beans)\b/.test(t)) continue;
    if (ref.id === 'olives' && /\bolive\s+oil\b/.test(t)) continue;
    if (ref.id === 'berries' && /\b(strawberr|blueberr)\b/.test(t)) continue;
    if (ref.id === 'grapes' && /\braisins?\b/.test(t)) continue;
    if (ref.id === 'mango' && /\b(lassi|pickle|chutney)\b/.test(t)) continue;
    if (ref.id === 'pineapple' && /\bbanana/.test(t)) continue;
    if (ref.id === 'bread' && /\b(peanut\s+butter|nutella|marmite|almond\s+butter)\b/.test(t)) continue;
    if (ref.id === 'southern_fried' && /\b(buffalo|wings?|tenders?|sandwich|waffles?)\b/.test(t)) continue;
    if (ref.id === 'chicken' && /\b(buffalo|wings?|tenders?|sandwich|waffles?|fried\s+steak|caesar)\b/.test(t)) continue;
    if (ref.id === 'beef' && /\b(cheesesteak|brisket|meatloaf|pot\s+roast|philly|reuben)\b/.test(t)) continue;
    if (ref.id === 'burger' && /\b(cheeseburger|hamburger|smash|bacon\s+burger|burger\s+and)\b/.test(t)) continue;
    if (ref.id === 'sandwich' && /\b(reuben|blt|club|grilled\s+cheese|po\s+boy|cuban|cheesesteak|lobster\s+roll|chicken\s+sandwich)\b/.test(t)) continue;
    if (ref.id === 'salad' && /\b(cobb|caesar)\b/.test(t)) continue;
    if (ref.id === 'bacon' && /\bpancakes?\s+and\s+bacon\b|\bbacon\s+and\s+pancakes?\b/.test(t)) continue;
    if (ref.id === 'ewedu' && /\bamala\s+and\s+ewedu\b|\bewedu\s+and\s+amala\b/.test(t)) continue;
    if (ref.id === 'pancake' && /\b(chicken\s+and\s+waffles?|pancakes?\s+and\s+bacon|american\s+pancakes?|dorayaki|taiyaki|scallion|okonomiyaki)\b/.test(t)) continue;
    if (ref.id === 'halwa' && /\b(gajar|carrot)\s+halwa\b/.test(t)) continue;
    if (ref.id === 'halwa' && /\b(turkish|tahini)\s+helv/i.test(t)) continue;
    if (ref.id === 'dessert_slice' && /\b(chocolate|cheesecake|carrot|red\s+velvet|lemon\s+drizzle|victoria|black\s+forest|sticky\s+toffee|banoffee)\b/.test(t)) continue;
    if (ref.id === 'baklava' && /\b(künefe|kunefe|kunafa|knafeh|knafe)\b/.test(t)) continue;
    if (ref.id === 'mochi' && /\bmochi\s+ice\s+cream\b/.test(t)) continue;
    if (ref.id === 'mooncake' && /\bsnow\s+skin\b/.test(t)) continue;
    if (ref.id === 'cake' && /\b(cheesecake|carrot\s+cake|red\s+velvet|cupcake|victoria\s+sponge|lemon\s+drizzle|black\s+forest|sachertorte|lava\s+cake|boston\s+cream|strawberry\s+shortcake|castella|eccles|welsh\s+cakes|mince\s+pie|sticky\s+toffee|banoffee|whoopie|profiterole|mooncake|snow\s+skin|dessert\s+slice|chocolate\s+cake)\b/.test(t)) continue;
    if (ref.id === 'ice_cream' && /\b(sundae|banana\s+split|kulfi|mochi\s+ice|kakigori|sutlac|root\s+beer\s+float|milkshake|falooda)\b/.test(t)) continue;
    if (ref.id === 'croissant' && /\b(pain\s+au\s+chocolat|chocolatine|danish|profiterole|eclair|éclair)\b/.test(t)) continue;
    if (ref.id === 'purin' && /\b(?:leche\s+)?flan\b/.test(t) && !/\bjapanese\s+flan\b|\bpurin\b/.test(t)) continue;
    if (ref.id === 'sauerkraut' && /\bbratwurst\b/.test(t)) continue;
    if (ref.id === 'pudding' && /\b(sticky\s+toffee|christmas|bread\s+and\s+butter|rice\s+pudding|mango\s+pudding|steamed\s+egg|purin)\b/.test(t)) continue;
    if (ref.id === 'milk' && /\b(coffee|tea|latte|cappuccino|chai|karak|mocha|hot\s+chocolate|white\s+coffee|flat\s+white|americano)\b/i.test(t)) continue;
    if (ref.id === 'coffee_black' && /\b(white\s+coffee|with\s+milk|condensed\s+milk|evaporated\s+milk|flat\s+white|latte|cappuccino|mocha|milky)\b/i.test(t)) continue;
    if (ref.id === 'chicken' && /\bcurry\b/i.test(t)) continue;
    if (ref.id === 'chicken_tikka' && /\bmasala\b/.test(t)) continue;
    if (ref.id === 'rice' && /\b(biryani|pilau|pilaf|fried\s+rice|jollof|risotto|paella|congee|kedgeree)\b/i.test(t)) continue;
    if (ref.id === 'beef' && /\bcurry\b/i.test(t)) continue;
    if (ref.id === 'lamb' && /\bcurry\b/i.test(t)) continue;
    if (ref.id === 'fish' && /\bcurry\b/i.test(t)) continue;
    if (ref.id === 'paneer' && /\b(curry|masala|tikka|butter|palak|matar|lababdar)\b/i.test(t)) continue;
    if (ref.re.test(t)) {
      const match = t.match(ref.re);
      let score = match ? match[0].length : 0;
      if (dishRefCoversCompound(ref)) score += 200;
      if ((ref.id || '').includes('_')) score += 30;
      if (score > bestScore) {
        bestScore = score;
        best = ref;
      }
    }
  }
  return best;
}
