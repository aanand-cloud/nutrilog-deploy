/**
 * Split describe-meal text into phrases and extract quantity + unit per phrase.
 * @deprecated Import from shared/quantity-parser.js — kept for backward compatibility.
 */

export {
  splitMealPhrases,
  extractQuantityFromPhrase,
  phraseHasExplicitQuantity,
  parseQuantityFromText,
  parseMealDescription,
  parseGramsFromText,
  WORD_NUMBERS,
} from '../../shared/quantity-parser.js';
