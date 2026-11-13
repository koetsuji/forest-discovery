// @ts-check
/**
 * Draws the ground: each chunk is painted once into an offscreen canvas and
 * then costs one drawImage per frame.
 */

import { tuning } from '../tuning.js';
import { CHUNK, chunksIn, createChunkCache } from '../world/chunks.js';
import { GROUND_COLOURS, paintGroundChunk } from '../world/ground.js';

/**
 * @typedef {{ canvas: HTMLCanvasElement, streaks: Int16Array, x: number, y: number }} BakedChunk
 */

/**
 * Packs "#rrggbb" for a little-endian Uint32 view over RGBA bytes.
 * @param {string} hex
 */
function packColour(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/**
 * @param {number} seed
 * @param {import('../world/clearing.js').Scene} scene
 * @param {Record<string, string>} colours ground colours by role
 */
export function createGroundLayer(seed, scene, colours) {
  const packed = GROUND_COLOURS.map((name) => packColour(colours[name]));
  let firstFrame = true;

  /** @param {number} cx @param {number} cy @returns {BakedChunk} */
  function bake(cx, cy) {
    const { indices, streaks } = paintGroundChunk(seed, scene, cx, cy);
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK;
    canvas.height = CHUNK;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const image = ctx.createImageData(CHUNK, CHUNK);
    const pixels = new Uint32Array(image.data.buffer);
    for (let i = 0; i < indices.length; i++) pixels[i] = packed[indices[i]];
    ctx.putImageData(image, 0, 0);
    return { canvas, streaks, x: cx * CHUNK, y: cy * CHUNK };
  }

  const cache = createChunkCache(bake, tuning.world.keepChunks);

  return {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/camera.js').View} view
     */
    draw(ctx, view) {
      // Under chunks that are not baked yet.
      ctx.fillStyle = colours.floor;
      ctx.fillRect(0, 0, view.w, view.h);
      const range = chunksIn(view);
      // The first frame paints everything it shows. After that one chunk per
      // frame is enough, and a long bake never stalls the wind.
      let budget = firstFrame ? Infinity : 1;
      firstFrame = false;
      for (let cy = range.cy0; cy <= range.cy1; cy++) {
        for (let cx = range.cx0; cx <= range.cx1; cx++) {
          let chunk = cache.peek(cx, cy);
          if (!chunk) {
            if (budget <= 0) continue;
            budget--;
            chunk = cache.ensure(cx, cy);
          }
          ctx.drawImage(chunk.canvas, chunk.x - view.x, chunk.y - view.y);
        }
      }
      cache.prune(Math.floor((view.x + view.w / 2) / CHUNK), Math.floor((view.y + view.h / 2) / CHUNK));
    },
    /**
     * Baked chunks under the view, for things that live on the ground.
     * @param {import('../core/camera.js').View} view
     * @returns {BakedChunk[]}
     */
    chunksUnder(view) {
      const range = chunksIn(view);
      /** @type {BakedChunk[]} */
      const out = [];
      for (let cy = range.cy0; cy <= range.cy1; cy++) {
        for (let cx = range.cx0; cx <= range.cx1; cx++) {
          const chunk = cache.peek(cx, cy);
          if (chunk) out.push(chunk);
        }
      }
      return out;
    },
  };
}
