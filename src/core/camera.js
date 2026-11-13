// @ts-check
/**
 * The camera eases toward a target and reports a view rectangle in whole
 * pixels. The world is always drawn at integer positions.
 */

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} View
 */

/**
 * @param {{ settleSec: number }} opts
 */
export function createCamera({ settleSec }) {
  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;
  let speedX = 0;
  let speedY = 0;

  /**
   * Critically damped follow: quick to start, no overshoot, exact for any dt.
   * @param {number} from
   * @param {number} to
   * @param {number} speed
   * @param {number} dt
   * @returns {[number, number]} new position and speed
   */
  function ease(from, to, speed, dt) {
    const omega = 4 / settleSec;
    const k = omega * dt;
    const decay = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k);
    const change = from - to;
    const temp = (speed + omega * change) * dt;
    return [to + (change + temp) * decay, (speed - omega * temp) * decay];
  }

  return {
    /** @param {number} tx @param {number} ty */
    lookAt(tx, ty) {
      targetX = tx;
      targetY = ty;
    },
    /** Jump to the target at once. Used at start and with reduced motion. */
    snap() {
      x = targetX;
      y = targetY;
      speedX = 0;
      speedY = 0;
    },
    /** @param {number} dt */
    update(dt) {
      [x, speedX] = ease(x, targetX, speedX, dt);
      [y, speedY] = ease(y, targetY, speedY, dt);
    },
    /**
     * The visible part of the world, snapped to whole pixels.
     * @param {number} w view width in art pixels
     * @param {number} h view height in art pixels
     * @returns {View}
     */
    view(w, h) {
      return { x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h };
    },
    get x() {
      return x;
    },
    get y() {
      return y;
    },
  };
}
