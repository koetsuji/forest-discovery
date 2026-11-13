// @ts-check
/**
 * The wind field: pure functions of a world position, a time and the view.
 * Same input, same answer. Nothing here keeps state.
 *
 * The wave phase depends only on world position, which is what carries the
 * ripple from one tree to the next. Gust patches are measured from the view,
 * because the world is endless and gusts must always cross the screen.
 *
 * Method and starting values: Kimo's article (docs/wind-system.md).
 */

import { tuning } from '../tuning.js';

const W = tuning.wind;
const TAU = Math.PI * 2;

/** @typedef {{ x: number, y: number, w: number, h: number }} View */

/** Position along the wind: it blows to the right and a little toward the camera. */
export function along(/** @type {number} */ x, /** @type {number} */ y) {
  return x + W.axisSlope * y;
}

/** How fast a wave crest travels along the wind. */
export const waveSpeedPxPerSec = W.waveLengthPx / W.wavePeriodSec;

/**
 * Phase of the travelling wave at a world point.
 * @param {number} x
 * @param {number} y
 * @param {number} t seconds
 */
export function phase(x, y, t) {
  return TAU * (t / W.wavePeriodSec - along(x, y) / W.waveLengthPx);
}

/**
 * Sum of the patch envelopes at a point.
 * @param {number} x
 * @param {number} y
 * @param {number} t
 * @param {View} view
 * @param {number} lengthSpread 1 for a gust, wider for the breeze around it
 * @param {number} bandSpread
 */
function envelopes(x, y, t, view, lengthSpread, bandSpread) {
  const u = along(x - view.x, y - view.y);
  // Bands are placed for a view of the schedule's height and stretch with the real one.
  const v = ((y - view.y) * W.scheduleViewHeightPx) / view.h;
  let sum = 0;
  for (const patch of W.gusts) {
    // Each patch comes round again once per schedule period.
    const lap = W.schedulePeriodSec * patch.speedPxPerSec;
    let d = u - patch.speedPxPerSec * (t - patch.enterSec);
    d -= lap * Math.round(d / lap);
    const reach = d / (patch.lengthPx * lengthSpread);
    if (reach > 4 || reach < -4) continue;
    let level = patch.strength * Math.exp(-reach * reach);
    if (patch.bandHalfPx > 0) {
      const off = (v - patch.bandCentrePx) / (patch.bandHalfPx * bandSpread);
      level *= Math.exp(-off * off);
    }
    sum += level;
  }
  return sum;
}

/**
 * Gust strength at a world point: 0 in still air, about 1 in a full gust.
 * @param {number} x
 * @param {number} y
 * @param {number} t
 * @param {View} view
 */
export function gust(x, y, t, view) {
  return envelopes(x, y, t, view, 1, 1);
}

/**
 * The breeze: the same patches, wider and weaker, capped at 1. It starts the
 * loops before a gust arrives and lets them die out after it.
 * @param {number} x
 * @param {number} y
 * @param {number} t
 * @param {View} view
 */
export function breeze(x, y, t, view) {
  return Math.min(1, W.breezeBase + W.breezeBoost * envelopes(x, y, t, view, W.breezeLengthSpread, W.breezeBandSpread));
}
