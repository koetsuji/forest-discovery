// @ts-check
/**
 * Falling leaves. A gust shakes them loose, the wind carries them along its
 * axis, they flip between flat and edge-on as they fall, rest on the ground
 * for a moment and fade.
 */

import { tuning } from '../tuning.js';
import { gust } from './field.js';

const L = tuning.leaves;
const SLOPE = tuning.wind.axisSlope;

/**
 * @typedef {{ x: number, ground: number, up: number, age: number, landedAt: number, flutter: number, colour: string }} Leaf
 *   x and ground are where the leaf would land. up is its height above that point.
 */

/**
 * @param {() => number} roll seeded random numbers
 */
export function createLeaves(roll) {
  /** @type {Leaf[]} */
  const leaves = [];
  let flip = 0;

  return {
    /**
     * @param {number} x where the leaf appears on screen, in world pixels
     * @param {number} y
     * @param {number} groundY the ground line it will land on
     * @param {string} colour
     */
    shed(x, y, groundY, colour) {
      if (leaves.length >= L.maxAlive) return;
      leaves.push({ x, ground: groundY, up: Math.max(2, groundY - y), age: 0, landedAt: -1, flutter: roll() * 6.28, colour });
    },

    /**
     * @param {number} dt @param {number} t
     * @param {import('./field.js').View} view
     */
    update(dt, t, view) {
      for (let i = leaves.length - 1; i >= 0; i--) {
        const leaf = leaves[i];
        leaf.age += dt;
        if (leaf.landedAt < 0) {
          // Carried along the wind axis, faster inside a gust.
          const drift = L.driftPxPerSec + L.driftGustPxPerSec * gust(leaf.x, leaf.ground - leaf.up, t, view);
          leaf.x += drift * dt;
          leaf.ground += drift * SLOPE * dt;
          // Falling is not steady: a leaf stalls and drops as it turns.
          leaf.up -= L.fallPxPerSec * (1 + 0.6 * Math.sin(leaf.age * 5 + leaf.flutter)) * dt;
          if (leaf.up <= 0) {
            leaf.up = 0;
            leaf.landedAt = leaf.age;
          }
        } else if (leaf.age - leaf.landedAt > L.restSec + L.fadeSec) {
          leaves[i] = leaves[leaves.length - 1];
          leaves.pop();
        }
      }
    },

    /**
     * On the pose clock: leaves in the air turn over. The tick number decides
     * which way up they are, so the same moment always looks the same.
     * @param {number} tick
     */
    pose(tick) {
      flip = tick;
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/camera.js').View} view
     */
    draw(ctx, view) {
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i];
        const x = Math.round(leaf.x) - view.x;
        const y = Math.round(leaf.ground - leaf.up) - view.y;
        if (x < -2 || y < -2 || x > view.w || y > view.h) continue;
        ctx.fillStyle = leaf.colour;
        if (leaf.landedAt >= 0) {
          // Fading in three steps, not smoothly: this is pixel art.
          const gone = (leaf.age - leaf.landedAt - L.restSec) / L.fadeSec;
          if (gone > 0) ctx.globalAlpha = gone < 0.34 ? 0.7 : gone < 0.67 ? 0.45 : 0.2;
          ctx.fillRect(x, y, 2, 1);
          ctx.globalAlpha = 1;
        } else if (((flip + i) >> 1) & 1) {
          ctx.fillRect(x, y, 2, 1);
        } else {
          ctx.fillRect(x, y, 1, 2);
        }
      }
    },

    get count() {
      return leaves.length;
    },
  };
}
