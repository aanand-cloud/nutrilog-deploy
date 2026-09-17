/**
 * Shared Wave 1 image title classification — used by collect + upgrade scripts.
 */

export function normalizeTitle(title = '') {
  return String(title).replace(/^File:/i, '').toLowerCase();
}

export function isRejectedTitle(title = '') {
  return /stamp|logo|icon|map|video|webm|svg|gif|falooda|illustration|drawing|cartoon|poster|advert|recipe book|packaging|packet|wiki\s*love|flour|batter\b|dry mix|healthmix|mexican|pizza|chaat|\.pdf$|\.djvu$|seven deadly sins/i.test(title);
}

export function classifyFood(title = '') {
  const t = normalizeTitle(title);
  if (isRejectedTitle(t)) return null;
  if (!/(biryani|biriyani|briyani|dosa|dosai|idli|idly)/i.test(t)) return null;
  if (/leftover|ghee from|biryani rice with|counter - biryani/i.test(t)) return null;

  if (/dindigul|thalappakatti/.test(t) && /biry|briy/.test(t)) {
    if (/chicken|murg/.test(t)) return 'dindigul chicken biryani';
    if (/mutton|lamb|goat|gosht/.test(t)) return 'dindigul mutton biryani';
    // Brand photos without protein are ambiguous (often chicken) — family only.
    return 'family:biryani';
  }
  if (/ambur/.test(t) && /biry|briy/.test(t)) {
    if (/chicken|murg/.test(t)) return 'ambur chicken biryani';
    if (/mutton|lamb|goat|gosht/.test(t)) return 'ambur mutton biryani';
    return 'family:biryani';
  }
  if (/thalassery|tellicherry/.test(t) && /biry|briy/.test(t)) {
    return 'thalassery mutton biryani';
  }
  if (/hydr[ao]bad/.test(t) && /biry|briy/.test(t)) {
    if (/veg|vegetable|chana|chickpea/.test(t)) return 'vegetable biryani';
    if (/paneer|panner/.test(t)) return 'paneer biryani';
    if (/chicken|murg/.test(t)) return 'hyderabadi chicken biryani';
    if (/mutton|gosht|lamb|goat/.test(t)) return 'hyderabadi mutton biryani';
    return 'hyderabadi mutton biryani';
  }
  if (/paneer|panner/.test(t) && /biry|briy/.test(t)) return 'paneer biryani';
  if (/(vegetable|veg|chana|chickpea)\b/.test(t) && /biry|briy/.test(t)) return 'vegetable biryani';
  if (/ghee\s*roast/.test(t) && /dosa/.test(t)) return 'ghee roast dosa';
  if (/(rava|ravva|sooji|semolina)/.test(t) && /dosa/.test(t)) return 'rava dosa';
  if (/set\s*dosa|set\s*dosai|set\s*dosey|thattu\s*dosa/.test(t)) return 'set dosa';
  if (/masala/.test(t) && /dosa/.test(t)) return 'masala dosa';
  if (/podi/.test(t) && /idli|idly/.test(t)) return 'ghee podi idli';
  if (/sambar|sambaar/.test(t) && /idli|idly/.test(t)) return 'sambar idli';
  if (/idli|idly/.test(t) && !/dosa/.test(t)) return 'plain idli';
  if (/plain\s*dosa|dosai/.test(t) && !/masala|rava|set|ghee\s*roast/.test(t)) return 'plain dosa';
  if (/dosa|dosai/.test(t)) return 'plain dosa';
  if (/mutton|gosht|lamb|goat/.test(t) && /biry|briy/.test(t)) return 'family:mutton_biryani';
  if (/chicken|murg/.test(t) && /biry|briy/.test(t)) return 'family:chicken_biryani';
  if (/biry|briy/.test(t)) return 'family:biryani';
  return null;
}

export function titleCompatibleWithFood(food, title = '') {
  const t = normalizeTitle(title);
  if (isRejectedTitle(t)) return false;
  if (/\bflour\b|\bbatter\b|\bfor\s+idli\s+making\b/.test(t)) return false;
  if (/mutton biryani/.test(food)) {
    if (/(chicken|murg|chana|chickpea|vegetable|\bveg\b|paneer|fish)/.test(t) && !/(mutton|lamb|goat|gosht)/.test(t)) {
      return false;
    }
    // Thalappakatti / unnamed Dindigul brand shots are usually chicken — require protein.
    if (/thalappakatti/.test(t) && !/(mutton|lamb|goat|gosht)/.test(t)) return false;
    if (/dindigul/.test(t) && /biry|briy/.test(t) && !/(mutton|lamb|goat|gosht|chicken|murg)/.test(t)) return false;
    // "Chicken Biryani and Mutton Curry" — biryani subject is chicken.
    if (/chicken\s+biry|chicken\s+briy|murg.*biry/.test(t) && !/mutton\s+biry|mutton\s+briy|gosht.*biry|lamb\s+biry/.test(t)) {
      return false;
    }
  }
  if (/chicken biryani/.test(food)) {
    if (/(mutton|lamb|goat|gosht|chana|chickpea|vegetable|\bveg\b|paneer)/.test(t) && !/(chicken|murg)/.test(t)) {
      return false;
    }
  }
  if (food === 'paneer biryani' && /(mutton|chicken|lamb|goat|gosht|murg)/.test(t) && !/paneer/.test(t)) {
    return false;
  }
  if (food === 'vegetable biryani' && /(mutton|chicken|lamb|goat|gosht|murg|paneer)/.test(t) && !/(veg|vegetable|chana)/.test(t)) {
    return false;
  }
  if (/set dosa/.test(food) && /mexican|chaat|pizza|uttapam|uthappam|aate|atta|wheat|ballon|balloon|leaf|leaves/.test(t)) return false;
  if (/ghee roast dosa/.test(food) && /plain\s*dosa|aate|wheat/.test(t) && !/ghee\s*roast/.test(t)) return false;
  if (/sambar idli/.test(food) && /(millet|ragi|korralu|kempu|aritha)/.test(t) && !/sambar/.test(t)) return false;
  // Mixed platters: dosa on an idli case tends to steal calorie-primary scoring.
  if (/sambar idli/.test(food) && /\bdosa/.test(t)) return false;
  if (food === 'plain idli' && /\b(vada|vadai|dosa)\b/.test(t)) return false;
  return true;
}

export function familyFallback(food) {
  if (/mutton biryani/.test(food)) return ['family:mutton_biryani'];
  if (/chicken biryani/.test(food)) return ['family:chicken_biryani'];
  if (food === 'vegetable biryani' || food === 'paneer biryani') return ['family:biryani'];
  if (/idli/.test(food)) return ['plain idli'];
  if (/dosa/.test(food)) return ['plain dosa', 'masala dosa'];
  return [];
}

export function mappingRank(food, matchKey, title) {
  if (!titleCompatibleWithFood(food, title)) return -1;
  const t = normalizeTitle(title);
  let rank = 20;
  if (matchKey === food) rank = 100;
  else if (String(matchKey).startsWith('family:')) rank = 40;
  else if (matchKey === 'plain idli' || matchKey === 'plain dosa' || matchKey === 'masala dosa') rank = 55;

  // Prefer focused plates over busy breakfast platters.
  if (/sambar idli/.test(food) && /sambar/.test(t) && /idli|idly/.test(t) && !/vada|dosa/.test(t)) rank += 15;
  if (food === 'plain idli' && /idli|idly/.test(t) && !/vada|dosa|sambar|chutney/.test(t)) rank += 10;
  if (/idli/.test(food) && /vada|vadai/.test(t)) rank -= 25;
  return rank;
}
