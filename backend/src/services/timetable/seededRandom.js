/**
 * Deterministic Seeded Pseudo-Random Number Generator (Mulberry32)
 *
 * Ensures 100% reproducible timetable generation runs when given the same seed.
 */

class SeededRandom {
  constructor(seed) {
    this.seed = typeof seed === 'number' ? seed : SeededRandom.hashSeed(seed || Date.now());
    this.state = this.seed >>> 0;
  }

  /**
   * Hashes string or number to 32-bit unsigned integer
   */
  static hashSeed(input) {
    if (typeof input === 'number') {
      return (Math.floor(input) >>> 0) || 1;
    }
    const str = String(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return (hash >>> 0) || 1;
  }

  /**
   * Returns a float in [0, 1)
   */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns integer in [min, max] inclusive
   */
  nextInt(min, max) {
    if (min === max) return min;
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Shuffles an array deterministically
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Selects random element from array
   */
  choice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(this.next() * array.length)];
  }
}

module.exports = SeededRandom;
