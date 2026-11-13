// @ts-check
/**
 * The first place in the forest: one clearing, laid out by hand, with seeded
 * forest around it. It stands in for the endless world until M3, and it is
 * built from the same parts the endless world will use: kinds, a seed, stable
 * object ids and pure functions of position.
 */

import { hashOf, rngFrom, valueNoise } from '../core/rng.js';
import { kinds } from './kinds/index.js';

/**
 * @typedef {{ id: string, kind: import('./kinds/index.js').Kind, x: number, y: number }} WorldObject x and y are the foot on the ground
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{
 *   focus: Point,
 *   objects: WorldObject[],
 *   trail: Point[],
 *   openness: (x: number, y: number) => number,
 * }} Scene
 */

/** The meadow: an ellipse, pulled out of shape by noise. */
const MEADOW = { x: 4, y: 12, rx: 156, ry: 80 };

/** The trail, from the lower left to the upper right. */
const TRAIL = [
  [-760, 250], [-560, 190], [-400, 150], [-250, 104], [-144, 64], [-52, 42], [28, 54], [100, 32],
  [150, -12], [196, -60], [262, -96], [400, -138], [560, -200], [760, -250],
];

/** Hand placed around the meadow: [kind, x, y]. */
const RING = /** @type {[string, number, number][]} */ ([
  ['oak', -176, -42],
  ['oak', -34, -84],
  ['oak', 122, -70],
  ['oak', 250, 46],
  ['oak', -262, 14],
  ['birch', -216, 50],
  ['birch', -186, 36],
  ['birch', 64, -96],
  ['pine', 206, 128],
  ['pine', -108, -96],
  ['oak', -74, 214],
  ['oak', 108, 236],
  ['oak', -252, 196],
  ['bush', -112, -20],
  ['bush', 60, -34],
  ['bush', 150, 86],
  ['bush', -168, 122],
  ['bush', 222, -18],
  ['rock', -66, 8],
  ['rock', 38, 96],
  ['rock', 128, 50],
  ['rock', -20, 118],
]);

/**
 * @param {Point[]} points
 * @param {number} spacing rough distance between samples in pixels
 * @returns {Point[]}
 */
function sampleSpline(points, spacing) {
  /** @type {Point[]} */
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const steps = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** @param {number} a @param {number} b @param {number} v */
function smoothstep(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * @param {number} seed
 * @returns {Scene}
 */
export function buildClearing(seed) {
  const warpA = hashOf(seed, 0, 0, 'meadow-warp-a');
  const warpB = hashOf(seed, 0, 0, 'meadow-warp-b');
  const trail = sampleSpline(TRAIL.map(([x, y]) => ({ x, y })), 2);

  /** 1 in the open meadow, 0 under the trees. Smooth, so the ground can blend. */
  const openness = (/** @type {number} */ x, /** @type {number} */ y) => {
    const nx = (x - MEADOW.x) / MEADOW.rx;
    const ny = (y - MEADOW.y) / MEADOW.ry;
    const warp = (valueNoise(warpA, x / 96, y / 96) - 0.5) * 0.5 + (valueNoise(warpB, x / 38, y / 38) - 0.5) * 0.2;
    return smoothstep(1.18, 0.82, Math.sqrt(nx * nx + ny * ny) + warp);
  };

  /** @param {number} x @param {number} y */
  const trailDistance = (x, y) => {
    let best = Infinity;
    for (let i = 0; i < trail.length; i += 3) {
      const d = (trail[i].x - x) ** 2 + (trail[i].y - y) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  /** @type {WorldObject[]} */
  const objects = RING.map(([kind, x, y], i) => ({ id: `ring:${i}`, kind: kinds[kind], x, y }));

  /** Kept free of scattered things: the meadow and the foreground below it. */
  const keptClear = (/** @type {number} */ x, /** @type {number} */ y) => {
    const nx = (x - MEADOW.x) / (MEADOW.rx + 34);
    const ny = (y - (MEADOW.y + 44)) / (MEADOW.ry + 78);
    return nx * nx + ny * ny < 1;
  };

  /** @param {number} x @param {number} y @param {number} gap */
  const nearSomething = (x, y, gap) => objects.some((o) => Math.abs(o.x - x) < gap && Math.hypot(o.x - x, o.y - y) < gap);

  /**
   * One candidate per grid cell, nudged off the grid. Deterministic per cell.
   * @param {string} tag
   * @param {number} cell
   * @param {number} jitter
   * @param {(roll: () => number, x: number, y: number) => string | null} pick
   */
  const scatter = (tag, cell, jitter, pick) => {
    for (let gy = Math.floor(-780 / cell); gy <= Math.ceil(880 / cell); gy++) {
      for (let gx = Math.floor(-1180 / cell); gx <= Math.ceil(1180 / cell); gx++) {
        const roll = rngFrom(hashOf(seed, gx, gy, tag));
        const x = Math.round((gx + 0.5) * cell + (roll() - 0.5) * 2 * jitter);
        const y = Math.round((gy + 0.5) * cell + (roll() - 0.5) * 2 * jitter);
        if (keptClear(x, y)) continue;
        const kind = pick(roll, x, y);
        if (kind) objects.push({ id: `${tag}:${gx}:${gy}`, kind: kinds[kind], x, y });
      }
    }
  };

  scatter('tree', 94, 30, (roll, x, y) => {
    if (trailDistance(x, y) < 30 || nearSomething(x, y, 62)) return null;
    const r = roll();
    return r < 0.58 ? 'oak' : r < 0.8 ? 'birch' : 'pine';
  });
  scatter('bush', 128, 48, (roll, x, y) => {
    if (roll() > 0.6 || trailDistance(x, y) < 20 || nearSomething(x, y, 26)) return null;
    return 'bush';
  });
  scatter('rock', 188, 70, (roll, x, y) => {
    if (roll() > 0.45 || trailDistance(x, y) < 22 || nearSomething(x, y, 30)) return null;
    return 'rock';
  });

  // Draw order: things further up the screen first. Ties break on x, then id.
  objects.sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1));

  return { focus: { x: 0, y: 0 }, objects, trail, openness };
}
