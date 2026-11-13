// @ts-check
/**
 * The ground painter. Ground is drawn by code, because an endless world needs
 * ground with no seams: every pixel is a pure function of the seed and its
 * world position, so neighbouring chunks always meet.
 *
 * The painter returns palette indices, not colours. Colours come from
 * tuning.ground now and from the sprite palette once sprites are accepted.
 */

import { hashOf, mix32, rngFor, valueNoise } from '../core/rng.js';
import { tuning } from '../tuning.js';
import { CHUNK } from './chunks.js';

/** Index into this list is what the painter writes. */
export const GROUND_COLOURS = /** @type {const} */ ([
  'grassHi', 'grass', 'grassMid', 'grassLow',
  'floor', 'floorLow', 'floorDeep',
  'earth', 'earthLow',
  'trail', 'trailHi', 'trailLow',
]);

const HI = 0, GRASS = 1, MID = 2, LOW = 3;
const FLOOR = 4, FLOOR_LOW = 5, FLOOR_DEEP = 6;
const EARTH = 7, EARTH_LOW = 8;
const TRAIL = 9, TRAIL_HI = 10, TRAIL_LOW = 11;

/** Coarse fields are sampled on this lattice and interpolated. They are smooth, so nothing is lost. */
const COARSE = 4;
/** How far from the trail centre the distance field is exact. */
const TRAIL_REACH = 16;

/**
 * @typedef {{ indices: Uint8Array, streaks: Int16Array }} GroundChunk
 * `indices` is CHUNK * CHUNK palette indices. `streaks` is x, y, width triples
 * in chunk pixels: grass dashes that light up while a gust passes over them.
 */

/**
 * @param {number} seed
 * @param {import('./clearing.js').Scene} scene
 * @param {number} cx
 * @param {number} cy
 * @returns {GroundChunk}
 */
export function paintGroundChunk(seed, scene, cx, cy) {
  const S = CHUNK;
  const x0 = cx * S;
  const y0 = cy * S;
  const kLong = hashOf(seed, 0, 0, 'ground-long');
  const kShort = hashOf(seed, 0, 0, 'ground-short');
  const kPatch = hashOf(seed, 0, 0, 'ground-patch');
  const kEarth = hashOf(seed, 0, 0, 'ground-earth');
  const kRow = hashOf(seed, 0, 0, 'ground-row');

  // Smooth fields on a coarse lattice.
  const n = S / COARSE + 1;
  const open = new Float32Array(n * n);
  const patch = new Float32Array(n * n);
  const earth = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const wx = x0 + i * COARSE;
      const wy = y0 + j * COARSE;
      open[j * n + i] = scene.openness(wx, wy);
      patch[j * n + i] = valueNoise(kPatch, wx / 74, wy / 46);
      earth[j * n + i] = valueNoise(kEarth, wx / 92, wy / 66);
    }
  }

  // Squared distance to the trail, exact near it.
  const far = (TRAIL_REACH + 1) ** 2;
  const trailD2 = new Float32Array(S * S).fill(far);
  for (const p of scene.trail) {
    const px = p.x - x0;
    const py = p.y - y0;
    if (px < -TRAIL_REACH || py < -TRAIL_REACH || px > S + TRAIL_REACH || py > S + TRAIL_REACH) continue;
    const xa = Math.max(0, Math.ceil(px - TRAIL_REACH));
    const xb = Math.min(S - 1, Math.floor(px + TRAIL_REACH));
    const ya = Math.max(0, Math.ceil(py - TRAIL_REACH));
    const yb = Math.min(S - 1, Math.floor(py + TRAIL_REACH));
    for (let y = ya; y <= yb; y++) {
      const dy2 = (y - py) * (y - py);
      for (let x = xa; x <= xb; x++) {
        const d2 = (x - px) * (x - px) + dy2;
        if (d2 < trailD2[y * S + x]) trailD2[y * S + x] = d2;
      }
    }
  }

  const half = tuning.ground.trailHalfWidthPx;
  const indices = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    const wy = y0 + y;
    // Each row slides its streak pattern a little, so streak ends are ragged
    // the way hand placed pixel dashes are.
    const slide = (mix32(kRow ^ Math.imul(wy, 0x9e3779b1)) / 4294967296 - 0.5) * 14;
    const gy = y / COARSE;
    const j = Math.floor(gy);
    const fy = gy - j;
    for (let x = 0; x < S; x++) {
      const wx = x0 + x;
      const gx = x / COARSE;
      const i = Math.floor(gx);
      const fx = gx - i;
      const at = j * n + i;
      const lerp2 = (/** @type {Float32Array} */ f) =>
        (f[at] * (1 - fx) + f[at + 1] * fx) * (1 - fy) + (f[at + n] * (1 - fx) + f[at + n + 1] * fx) * fy;

      // Two streak fields: long soft bands and short dashes one or two rows tall.
      const a = valueNoise(kLong, (wx + slide) / 26, wy / 5.5);
      const b = valueNoise(kShort, (wx - slide) / 14, wy / 1.7);
      // Patches get ragged edges from the streaks, or they read as thumbprints.
      const p = lerp2(patch) + (a - 0.5) * 0.34 + (b - 0.5) * 0.24;

      const d = Math.sqrt(trailD2[y * S + x]) + (b - 0.5) * 3.4 + (a - 0.5) * 2.2;
      let c;
      if (d < half - 1.7) {
        c = b > 0.72 ? TRAIL_HI : a * 0.6 + b * 0.4 < 0.34 ? TRAIL_LOW : TRAIL;
      } else if (d < half) {
        c = TRAIL_LOW;
      } else {
        const m = lerp2(open) + (a - 0.5) * 0.34 + (b - 0.5) * 0.16;
        if (m > 0.5) {
          // Meadow: bright grass, darker dashes, low patches, and a dark rim
          // where the forest begins.
          if (m < 0.58) c = b < 0.42 ? FLOOR : LOW;
          else if (p < 0.33) c = b < 0.3 ? LOW : MID;
          else if (b < 0.2) c = MID;
          else if (b > 0.82 && a > 0.48) c = HI;
          else c = GRASS;
        } else if (lerp2(earth) + (a - 0.5) * 0.3 + (b - 0.5) * 0.12 > 0.68 && m < 0.34) {
          // Bare earth under the densest trees.
          c = b < 0.36 ? EARTH_LOW : EARTH;
        } else {
          if (p < 0.31) c = b < 0.36 ? FLOOR_DEEP : FLOOR_LOW;
          else if (b < 0.22) c = FLOOR_LOW;
          else if (b > 0.86 && m > 0.16) c = LOW;
          else c = FLOOR;
        }
      }
      indices[y * S + x] = c;
    }
  }

  // Dashes of open grass that brighten under a gust.
  const roll = rngFor(seed, cx, cy, 'gust-streak');
  /** @type {number[]} */
  const streaks = [];
  for (let k = 0; k < tuning.ground.streaksPerChunk; k++) {
    const w = 3 + Math.floor(roll() * 7);
    const x = Math.floor(roll() * (S - w));
    const y = Math.floor(roll() * S);
    let ok = true;
    for (let i = 0; i < w && ok; i++) {
      const c = indices[y * S + x + i];
      ok = c === GRASS || c === MID;
    }
    if (ok) streaks.push(x, y, w);
  }

  return { indices, streaks: Int16Array.from(streaks) };
}
