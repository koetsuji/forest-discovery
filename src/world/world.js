// @ts-check
/**
 * The world as the rest of the game sees it: the scene, the sprites that its
 * kinds use, and which objects are on screen.
 */

import { flatStandIn } from '../render/sprites.js';
import { buildClearing } from './clearing.js';
import { kinds } from './kinds/index.js';

/**
 * @typedef {import('./clearing.js').WorldObject} WorldObject
 * @typedef {import('../render/sprites.js').Sprite} Sprite
 */

/**
 * @param {number} seed
 */
export function createWorld(seed) {
  const scene = buildClearing(seed);
  /** @type {Map<string, Sprite>} */
  const sprites = new Map();
  let tallest = 0;
  let widest = 0;

  return {
    seed,
    scene,
    /** True once sprites or their stand-ins exist. Nothing stands in the world before that. */
    get ready() {
      return sprites.size > 0;
    },
    /**
     * Gives every kind its sprite. A sprite the atlas does not have becomes a
     * flat stand-in.
     * @param {(id: string) => Sprite | null} fromAtlas
     */
    setSprites(fromAtlas) {
      /** @type {string[]} */
      const missing = [];
      for (const kind of Object.values(kinds)) {
        let sprite = fromAtlas(kind.sprite);
        if (!sprite) {
          sprite = flatStandIn(kind.sprite, kind.standIn);
          missing.push(kind.sprite);
        }
        sprites.set(kind.sprite, sprite);
        tallest = Math.max(tallest, sprite.h);
        widest = Math.max(widest, sprite.w);
      }
      // Expected while the art is still being made, so it is not a warning.
      if (missing.length) console.debug(`[assets] flat stand-ins for: ${missing.join(', ')}`);
    },
    /** @param {WorldObject} object @returns {Sprite} */
    spriteOf(object) {
      return /** @type {Sprite} */ (sprites.get(object.kind.sprite));
    },
    /**
     * Objects whose sprite can touch the rectangle, in draw order.
     * @param {{ x: number, y: number, w: number, h: number }} rect
     * @param {number} [margin]
     * @returns {WorldObject[]}
     */
    visible(rect, margin = 0) {
      /** @type {WorldObject[]} */
      const out = [];
      if (!sprites.size) return out;
      const left = rect.x - widest - margin;
      const right = rect.x + rect.w + widest + margin;
      const top = rect.y - margin;
      const bottom = rect.y + rect.h + tallest + margin;
      for (const object of scene.objects) {
        if (object.y < top) continue;
        // Objects are sorted by y, so nothing further down the list can show.
        if (object.y > bottom) break;
        if (object.x > left && object.x < right) out.push(object);
      }
      return out;
    },
  };
}
