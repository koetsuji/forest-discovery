// @ts-check
/**
 * Pose maths for one plant: the loop every clump walks, and the spring that
 * leans the whole plant in a gust. Pure functions. Every result that reaches
 * the screen is a whole number of pixels.
 */

import { tuning } from '../tuning.js';

const W = tuning.wind;

/** Rounds half away from zero, so leaning left mirrors leaning right. */
export function roundPx(/** @type {number} */ v) {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

/**
 * Loop size from the local wind, in pixels, before the clump's weight.
 * @param {number} breeze
 * @param {number} gust
 * @returns {[number, number]} sideways and upward
 */
export function loopSize(breeze, gust) {
  return [W.loopXBreezePx * breeze + W.loopXGustPx * gust, W.loopYBreezePx * breeze + W.loopYGustPx * gust];
}

/**
 * Where a clump is on its loop. With a size of 1 it steps through
 * (0,0), (0,-1), (1,-1), (1,0): up, right, down, back.
 * @param {number} ax loop size sideways
 * @param {number} ay loop size upward
 * @param {number} ph wave phase at the clump
 * @returns {[number, number]} whole pixel offset
 */
export function loopOffset(ax, ay, ph) {
  const right = 0.5 + Math.SQRT1_2 * Math.sin(ph - (3 * Math.PI) / 4);
  const up = 0.5 + Math.SQRT1_2 * Math.sin(ph - Math.PI / 4);
  // The clamp keeps bigger loops inside their size, and loops under half a pixel at rest.
  const dx = Math.min(Math.max(Math.round(ax * right), 0), Math.round(ax));
  const dy = Math.min(Math.max(Math.round(ay * up), 0), Math.round(ay));
  return [dx, dy === 0 ? 0 : -dy];
}

/**
 * One step of the damped spring that leans a plant. Semi-implicit Euler.
 * @param {{ lean: number, leanSpeed: number }} state changed in place
 * @param {number} gustAtBase
 * @param {{ pushPx: number, swingSec: number, damping: number }} profile
 * @param {number} dt
 */
export function stepLean(state, gustAtBase, profile, dt) {
  const w = (2 * Math.PI) / profile.swingSec;
  const target = profile.pushPx * gustAtBase;
  state.leanSpeed += (w * w * (target - state.lean) - 2 * profile.damping * w * state.leanSpeed) * dt;
  state.lean += state.leanSpeed * dt;
}

/**
 * How far the lean moves one clump sideways.
 * @param {number} lean
 * @param {{ weight: number, height: number, rise: number }} clump
 * @param {{ trunkBend: number }} profile
 */
export function leanOffset(lean, clump, profile) {
  // On a bending trunk a tier rides the trunk at its own height.
  if (profile.trunkBend > 0) return rowShift(lean * profile.trunkBend, clump.rise);
  return roundPx(lean * clump.weight * (0.5 + 0.5 * clump.height));
}

/**
 * Sideways shift of one row of a bending trunk: nothing at the foot, the full
 * lean at the top.
 * @param {number} lean
 * @param {number} rise 0 at the foot, 1 at the top
 */
export function rowShift(lean, rise) {
  return roundPx(lean * rise * rise);
}
