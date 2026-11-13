// @ts-check
/**
 * One low resolution canvas, scaled up by a whole number with nearest
 * neighbour. Everything in the world is drawn into it at integer positions.
 */

import { tuning } from '../tuning.js';

/**
 * Picks the largest whole scale that keeps the short side of the screen at
 * the minimum number of art pixels or more.
 * @param {number} deviceW screen width in device pixels
 * @param {number} deviceH screen height in device pixels
 * @param {number} [minShort]
 * @returns {{ scale: number, w: number, h: number }} scale and view size in art pixels
 */
export function pickView(deviceW, deviceH, minShort = tuning.view.minShortSideArtPx) {
  const scale = Math.max(1, Math.floor(Math.min(deviceW, deviceH) / minShort));
  return { scale, w: Math.ceil(deviceW / scale), h: Math.ceil(deviceH / scale) };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../core/events.js').Bus} bus
 */
export function createRenderer(canvas, bus) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { alpha: false }));
  let scale = 1;
  let w = 0;
  let h = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const deviceW = Math.max(1, Math.round(window.innerWidth * dpr));
    const deviceH = Math.max(1, Math.round(window.innerHeight * dpr));
    const next = pickView(deviceW, deviceH);
    const changed = next.w !== w || next.h !== h || next.scale !== scale;
    scale = next.scale;
    w = next.w;
    h = next.h;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    // One art pixel covers `scale` device pixels, whatever the device ratio is.
    canvas.style.width = `${(w * scale) / dpr}px`;
    canvas.style.height = `${(h * scale) / dpr}px`;
    // Resizing a canvas resets its state.
    ctx.imageSmoothingEnabled = false;
    if (changed) bus.emit('view-resized', { w, h, scale });
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    ctx,
    resize,
    get w() {
      return w;
    },
    get h() {
      return h;
    },
    get scale() {
      return scale;
    },
  };
}
