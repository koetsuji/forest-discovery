// @ts-check
/**
 * Shadows are never baked into sprites. A shadow is the current pose of a
 * thing, flattened onto the ground and darkened, so shadows move with the
 * canopy. Light comes from the top left, so shadows fall down and to the right.
 *
 * Wood and rocks are projected upright: every row lands further away the
 * higher it is. A leaf clump is treated as a blob in the air: its own shape,
 * squashed, lands where its centre would.
 */

import { tuning } from '../tuning.js';

const S = tuning.shadows;

/**
 * @typedef {{ canvas: HTMLCanvasElement, x: number, y: number }} ShadowPiece position relative to the foot
 * @typedef {{ base: ShadowPiece | null, clumps: ShadowPiece[], box: { x0: number, y0: number, x1: number, y1: number } }} SpriteShadow
 * @typedef {import('./sprites.js').Sprite} Sprite
 */

/** @type {WeakMap<Sprite, SpriteShadow>} */
const cache = new WeakMap();

/**
 * @param {import('./sprites.js').Layer} layer
 * @param {Sprite} sprite
 * @param {import('./sprites.js').Clump | null} clump
 * @returns {ShadowPiece}
 */
function project(layer, sprite, clump) {
  const w = layer.canvas.width;
  const h = layer.canvas.height;
  const source = /** @type {CanvasRenderingContext2D} */ (layer.canvas.getContext('2d')).getImageData(0, 0, w, h).data;
  const rowX = new Int16Array(h);
  const rowY = new Int16Array(h);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let ly = 0; ly < h; ly++) {
    const sy = layer.y + ly;
    const up = clump ? sprite.footY - clump.cy : Math.max(0, sprite.footY - sy);
    rowX[ly] = Math.round(S.reachXPerPx * up);
    rowY[ly] = Math.round(S.reachYPerPx * up + (clump ? S.squash * (sy - clump.cy) : 0));
    minX = Math.min(minX, rowX[ly]);
    maxX = Math.max(maxX, rowX[ly]);
    minY = Math.min(minY, rowY[ly]);
    maxY = Math.max(maxY, rowY[ly]);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w + maxX - minX;
  canvas.height = maxY - minY + 1;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.fillStyle = S.colour;
  for (let ly = 0; ly < h; ly++) {
    // Runs of solid pixels become one rectangle each.
    let start = -1;
    for (let lx = 0; lx <= w; lx++) {
      const solid = lx < w && source[(ly * w + lx) * 4 + 3] > 0;
      if (solid && start < 0) start = lx;
      if (!solid && start >= 0) {
        ctx.fillRect(start + rowX[ly] - minX, rowY[ly] - minY, lx - start, 1);
        start = -1;
      }
    }
  }
  return { canvas, x: layer.x - sprite.footX + minX, y: minY };
}

/**
 * The shadow pieces of a sprite at rest. Made once per sprite.
 * @param {Sprite} sprite
 * @returns {SpriteShadow}
 */
export function shadowOf(sprite) {
  let shadow = cache.get(sprite);
  if (shadow) return shadow;
  const base = sprite.base ? project(sprite.base, sprite, null) : null;
  const clumps = sprite.clumps.map((clump) => project(clump, sprite, clump));
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const piece of base ? [base, ...clumps] : clumps) {
    box.x0 = Math.min(box.x0, piece.x);
    box.y0 = Math.min(box.y0, piece.y);
    box.x1 = Math.max(box.x1, piece.x + piece.canvas.width);
    box.y1 = Math.max(box.y1, piece.y + piece.canvas.height);
  }
  shadow = { base, clumps, box };
  cache.set(sprite, shadow);
  return shadow;
}

/**
 * How far a lifted clump throws its shadow from where it lies at rest.
 * @param {number} dx clump offset sideways
 * @param {number} dy clump offset upward, zero or negative
 * @returns {[number, number]}
 */
export function shadowShift(dx, dy) {
  return [dx + Math.round(-dy * S.reachXPerPx), Math.round(-dy * S.reachYPerPx)];
}

/**
 * The shadow layer: every shadow goes into one buffer first, so overlapping
 * shadows do not darken twice, and the buffer is laid over the ground once.
 * @param {ReturnType<typeof import('../world/world.js').createWorld>} world
 * @param {(object: import('../world/world.js').WorldObject) => ShadowPiece | null} posedShadowOf
 */
export function createShadowLayer(world, posedShadowOf) {
  const buffer = document.createElement('canvas');
  const bufferCtx = /** @type {CanvasRenderingContext2D} */ (buffer.getContext('2d'));
  return {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/camera.js').View} view
     */
    draw(ctx, view) {
      if (buffer.width !== view.w || buffer.height !== view.h) {
        buffer.width = view.w;
        buffer.height = view.h;
      }
      bufferCtx.clearRect(0, 0, view.w, view.h);
      for (const object of world.visible(view, tuning.shadows.viewMarginPx)) {
        const piece = posedShadowOf(object) || shadowOf(world.spriteOf(object)).base;
        if (piece) bufferCtx.drawImage(piece.canvas, object.x + piece.x - view.x, object.y + piece.y - view.y);
      }
      ctx.globalAlpha = S.alpha;
      ctx.drawImage(buffer, 0, 0);
      ctx.globalAlpha = 1;
    },
  };
}
