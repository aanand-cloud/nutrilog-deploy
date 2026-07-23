/** Copy helpers for packaged-food search and barcode flows. */

const DISH_LIKE =
  /\b(biryani|biriyani|idli|idly|dosa|dosai|curry|pulao|pula[o]|thali|sambar|paratha|naan|roti|chapati|uttapam|vada|pakora|korma|tikka|masala|tiffin|homemade|restaurant|canteen|plate of|with rice)\b/i;

const BRAND_LIKE =
  /\b(mtr|haldiram|heinz|weetabix|nestl[eé]|kellogg|tesco|sainsbury|asda|morrisons|walkers|cadbury|quaker|danone|activia|innocent|birds eye|mcvitie|branston)\b/i;

export function looksLikeDishQuery(query) {
  const q = String(query || '').trim();
  if (!q) return false;
  if (BRAND_LIKE.test(q)) return false;
  return DISH_LIKE.test(q);
}

export function packagedSearchEmptyMessage(query) {
  if (looksLikeDishQuery(query)) {
    return {
      title: 'No packaged products found',
      lines: [
        'Fresh and restaurant dishes are not included in this product database.',
        'Close this search and photograph your plate on the log screen to estimate nutrition.',
      ],
    };
  }

  return {
    title: 'No packaged products found',
    lines: [
      'Try the exact brand name, an alternative spelling, or scan the barcode on the packaging.',
      'For homemade or restaurant meals, photograph your plate instead.',
    ],
  };
}

export function barcodeNotFoundMessage() {
  return 'Product not found in our database. For fresh or homemade food, photograph your plate on the log screen.';
}
