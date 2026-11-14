// @ts-check
/**
 * The world as the rest of the game sees it: the scene, the sprites that its
 * kinds use, and which objects are on screen.
 */

import { flatStandIn } from '../render/sprites.js';
import { shadowOf } from '../render/shadows.js';
import { buildClearing } from './clearing.js';
import { kinds } from './kinds/index.js';

/**
 * @typedef {import('./clearing.js').WorldObject} WorldObject
 * @typedef {import('../render/sprites.js').Sprite} Sprite
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} Reach box around the foot
 */

/** Room for a clump that sways or lifts out of its sprite's box (see wind/foliage.js). */
const SWAY_X = 14;
const SWAY_UP = 4;

/**
 * Everything a sprite can paint, as a box around its foot: its own pixels,
 * however far its clumps sway, and its shadow.
 * @param {Sprite} sprite
 * @returns {Reach}
 */
export function reachOf(sprite) {
  const shadow = shadowOf(sprite).box;
  return {
    x0: Math.min(-sprite.footX - SWAY_X, shadow.x0 - SWAY_X),
    y0: Math.min(-sprite.footY - SWAY_UP, shadow.y0 - SWAY_UP),
    x1: Math.max(sprite.w - sprite.footX + SWAY_X, shadow.x1 + SWAY_X),
    y1: Math.max(sprite.h - sprite.footY, shadow.y1 + SWAY_UP),
  };
}

/**
 * @param {number} seed
 */
export function createWorld(seed) {
  const scene = buildClearing(seed);
  /** @type {Map<string, Sprite>} */
  const sprites = new Map();
  /** @type {Map<string, Reach>} */
  const reaches = new Map();
  /** The furthest any sprite reaches above and below its foot. */
  let maxUp = 0;
  let maxDown = 0;

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
        const reach = reachOf(sprite);
        reaches.set(kind.sprite, reach);
        maxUp = Math.max(maxUp, -reach.y0);
        maxDown = Math.max(maxDown, reach.y1);
      }
      // Expected while the art is still being made, so it is not a warning.
      if (missing.length) console.debug(`[assets] flat stand-ins for: ${missing.join(', ')}`);
    },
    /** @param {WorldObject} object @returns {Sprite} */
    spriteOf(object) {
      return /** @type {Sprite} */ (sprites.get(object.kind.sprite));
    },
    /**
     * Objects that can paint into the rectangle, body or shadow, in draw order.
     * @param {{ x: number, y: number, w: number, h: number }} rect
     * @returns {WorldObject[]}
     */
    visible(rect) {
      /** @type {WorldObject[]} */
      const out = [];
      if (!sprites.size) return out;
      const right = rect.x + rect.w;
      const bottom = rect.y + rect.h;
      for (const object of scene.objects) {
        if (object.y + maxDown <= rect.y) continue;
        // Objects are sorted by y, so nothing further down the list can show.
        if (object.y - maxUp >= bottom) break;
        const reach = /** @type {Reach} */ (reaches.get(object.kind.sprite));
        if (
          object.x + reach.x1 > rect.x &&
          object.x + reach.x0 < right &&
          object.y + reach.y1 > rect.y &&
          object.y + reach.y0 < bottom
        ) {
          out.push(object);
        }
      }
      return out;
    },
  };
}
