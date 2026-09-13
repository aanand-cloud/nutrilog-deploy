/** Official UK brand servings — used by photo compose and barcode overlay. */

export const ZERO_DRINK_RE = /\b(pepsi\s*max|diet\s+pepsi|coke\s*zero|coca[ -]?cola\s*zero|diet\s+coke|7\s*up\s*free|sprite\s*zero|tango[^,]*sugar[ -]?free|zero[ -]?sugar|sugar[ -]?free|diet\s+(?:cola|soda|soft\s*drink))\b/i;

export const BRANDED_SERVINGS = [
  {
    id: 'kfc_uk_fillet_burger',
    re: /\bkfc\b.*\b(?:(?:original\s+recipe\s+)?(?:fillet|chicken)\s+burger|original\s+recipe\s+burger)\b/i,
    name: 'KFC Fillet Burger', kcal: 463,
    nutrition: { protein_g: 28.8, carbs_g: 43, fat_g: 18.7, fibre_g: null, sugar_g: 6.5, salt_mg: 2200 },
  },
  {
    id: 'kfc_uk_signature_fries_regular',
    re: /\bkfc\b.*\b(?:signature\s+)?(?:fries|chips|potato\s+wedges)\b/i,
    name: 'KFC Regular Signature Fries', kcal: 261,
    nutrition: { protein_g: 3.1, carbs_g: 38, fat_g: 9.8, fibre_g: null, sugar_g: 0.5, salt_mg: 740 },
  },
];

export function matchBrandedServing(name = '') {
  const text = String(name || '');
  return BRANDED_SERVINGS.find((row) => row.re.test(text)) || null;
}

export function isZeroSugarSoftDrink(name = '') {
  return ZERO_DRINK_RE.test(String(name || ''));
}
