// A small seeded random source (mulberry32): the same seed always deals the
// same game, which is what the screenshot scenes and the fixed-step loop need.
// Live play seeds it from the clock; a ?seed=N run is reproducible.
export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    /** The next float in [0, 1). */
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** The next float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** The next whole number in [min, max]. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** One entry of `list`, by weight: [[value, weight], ...]. */
    weighted(list) {
      let total = 0;
      for (const [, w] of list) total += w;
      let roll = this.next() * total;
      for (const [value, w] of list) {
        roll -= w;
        if (roll <= 0) return value;
      }
      return list[list.length - 1][0];
    },
  };
}
