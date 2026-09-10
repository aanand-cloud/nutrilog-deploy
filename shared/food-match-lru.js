/**
 * Tiny LRU cache for repeated food-name lookups.
 */

/** @template T */
export class MatchLruCache {
  /** @param {number} maxSize */
  constructor(maxSize = 512) {
    this.maxSize = maxSize;
    /** @type {Map<string, T>} */
    this.map = new Map();
  }

  /** @param {string} key @returns {T | undefined} */
  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /** @param {string} key @param {T} value */
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}
