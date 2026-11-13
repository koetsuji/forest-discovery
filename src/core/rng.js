// @ts-check
/**
 * Deterministic randomness. World code never calls Math.random: every number
 * comes from a hash of the seed, a position and a purpose tag, so the same
 * seed always gives the same forest.
 */

/**
 * Mixes a 32 bit integer into another one with good avalanche.
 * @param {number} n
 * @returns {number} unsigned 32 bit
 */
export function mix32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return (n ^ (n >>> 15)) >>> 0;
}

/**
 * FNV-1a hash of a purpose tag.
 * @param {string} tag
 * @returns {number} unsigned 32 bit
 */
export function hashTag(tag) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Hash of a seed, two integer coordinates and a purpose tag.
 * @param {number} seed
 * @param {number} x
 * @param {number} y
 * @param {string} tag
 * @returns {number} unsigned 32 bit
 */
export function hashOf(seed, x, y, tag) {
  let h = mix32(seed ^ hashTag(tag));
  h = mix32(h ^ Math.imul(x | 0, 0x27d4eb2d));
  h = mix32(h ^ Math.imul(y | 0, 0x165667b1));
  return h;
}

/**
 * A small fast generator (mulberry32) started from a hash.
 * @param {number} h
 * @returns {() => number} numbers in [0, 1)
 */
export function rngFrom(h) {
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generator for one purpose in one chunk.
 * @param {number} seed
 * @param {number} cx
 * @param {number} cy
 * @param {string} tag
 */
export function rngFor(seed, cx, cy, tag) {
  return rngFrom(hashOf(seed, cx, cy, tag));
}

/**
 * Smooth value noise in [0, 1). Continuous in x and y, the same everywhere
 * for the same key, so baked chunks meet without seams.
 * @param {number} key seed already mixed with a purpose
 * @param {number} x
 * @param {number} y
 */
export function valueNoise(key, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = lattice(key, ix, iy);
  const b = lattice(key, ix + 1, iy);
  const c = lattice(key, ix, iy + 1);
  const d = lattice(key, ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
}

/**
 * @param {number} key
 * @param {number} ix
 * @param {number} iy
 */
function lattice(key, ix, iy) {
  return mix32(key ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1)) / 4294967296;
}

/**
 * Reads a seed from text: digits are taken as a number, anything else is hashed.
 * @param {string | null | undefined} text
 * @param {number} fallback
 * @returns {number} unsigned 32 bit
 */
export function parseSeed(text, fallback) {
  if (text == null || text === '') return fallback >>> 0;
  if (/^\d{1,10}$/.test(text)) return Number(text) >>> 0;
  return hashTag(text);
}
