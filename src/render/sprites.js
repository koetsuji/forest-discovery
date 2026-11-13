// @ts-check
/**
 * Sprites as the game holds them in memory: a canvas size, a foot point, and
 * layers. A plant has a base (trunk), an inside and clumps. Anything else has
 * only a base.
 *
 * A sprite that is not in the atlas is replaced by a flat stand-in: a grey
 * silhouette of the right size, never styled to look final.
 */

import { tuning } from '../tuning.js';

/**
 * @typedef {{ canvas: HTMLCanvasElement, x: number, y: number }} Layer offset inside the sprite canvas
 * @typedef {Layer & { cx: number, cy: number, weight: number, height: number, rise: number }} Clump
 * @typedef {{
 *   id: string,
 *   w: number,
 *   h: number,
 *   footX: number,
 *   footY: number,
 *   standIn: boolean,
 *   profile: string | null,
 *   base: Layer | null,
 *   inside: Layer | null,
 *   clumps: Clump[],
 *   leafColours: string[],
 * }} Sprite
 * @typedef {{ shape: 'broad' | 'cone' | 'oval' | 'bush' | 'rock', w: number, h: number }} StandInSpec
 */

/**
 * The silhouette of a stand-in as a mask of 0 and 1. Pure, so it can be tested.
 * @param {StandInSpec} spec
 * @returns {Uint8Array} w * h cells, row by row
 */
export function standInMask(spec) {
  const { shape, w, h } = spec;
  const mask = new Uint8Array(w * h);
  const mid = (w - 1) / 2;

  /** @param {number} y @param {number} half half width of the row around the middle */
  const row = (y, half) => {
    if (y < 0 || y >= h || half < 0) return;
    const x0 = Math.max(0, Math.round(mid - half));
    const x1 = Math.min(w - 1, Math.round(mid + half));
    for (let x = x0; x <= x1; x++) mask[y * w + x] = 1;
  };

  /** @param {number} cy @param {number} rx @param {number} ry @param {number} [yMax] */
  const ellipse = (cy, rx, ry, yMax = h - 1) => {
    for (let y = Math.max(0, Math.ceil(cy - ry)); y <= Math.min(yMax, Math.floor(cy + ry)); y++) {
      const t = (y - cy) / ry;
      row(y, rx * Math.sqrt(Math.max(0, 1 - t * t)));
    }
  };

  /** @param {number} top @param {number} half @param {number} flare extra half width at the foot */
  const trunk = (top, half, flare) => {
    for (let y = top; y < h; y++) {
      const nearFoot = Math.max(0, 5 - (h - 1 - y)) / 5;
      row(y, half + flare * nearFoot * nearFoot);
    }
  };

  if (shape === 'broad') {
    trunk(Math.round(h * 0.5), w * 0.055, w * 0.04);
    ellipse(h * 0.36, w / 2 - 1, h * 0.36 - 1);
  } else if (shape === 'oval') {
    trunk(Math.round(h * 0.45), w * 0.04, w * 0.02);
    ellipse(h * 0.31, w * 0.44, h * 0.31 - 1);
  } else if (shape === 'cone') {
    trunk(Math.round(h * 0.7), w * 0.045, w * 0.03);
    // Stepped tiers: each one flares out and the next starts narrower.
    const tiers = 6;
    const bottom = Math.round(h * 0.84);
    for (let y = 1; y <= bottom; y++) {
      const f = (y - 1) / (bottom - 1);
      const tier = Math.min(tiers - 1, Math.floor(f * tiers));
      const within = f * tiers - tier;
      const reach = ((tier + 1) / tiers) * (w / 2 - 1);
      row(y, Math.max(1, reach * (0.5 + 0.5 * within)));
    }
  } else if (shape === 'bush') {
    ellipse(h * 0.56, w / 2 - 1, h * 0.56 - 1, h - 2);
  } else {
    ellipse(h * 0.62, w / 2 - 1, h * 0.62 - 1, h - 2);
  }
  return mask;
}

/**
 * @param {string} id
 * @param {StandInSpec} spec
 * @returns {Sprite}
 */
export function flatStandIn(id, spec) {
  const { w, h } = spec;
  const mask = standInMask(spec);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const fill = tuning.standIn.fill[spec.shape];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const edge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        !mask[y * w + x - 1] || !mask[y * w + x + 1] || !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x];
      ctx.fillStyle = edge ? tuning.standIn.outline : fill;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return {
    id,
    w,
    h,
    footX: Math.round((w - 1) / 2),
    footY: h - 1,
    standIn: true,
    profile: null,
    base: { canvas, x: 0, y: 0 },
    inside: null,
    clumps: [],
    leafColours: [],
  };
}
