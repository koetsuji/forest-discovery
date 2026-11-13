// @ts-check
/**
 * Chunk bookkeeping: the world is cut into squares that are made when they
 * come near the view and dropped when they are far away.
 */

import { tuning } from '../tuning.js';

export const CHUNK = tuning.world.chunkSizePx;

/** @param {number} cx @param {number} cy */
export function chunkKey(cx, cy) {
  return `${cx},${cy}`;
}

/**
 * The range of chunks touched by a rectangle.
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {number} [margin] extra pixels on every side
 * @returns {{ cx0: number, cy0: number, cx1: number, cy1: number }} inclusive range
 */
export function chunksIn(rect, margin = 0) {
  return {
    cx0: Math.floor((rect.x - margin) / CHUNK),
    cy0: Math.floor((rect.y - margin) / CHUNK),
    cx1: Math.floor((rect.x + rect.w - 1 + margin) / CHUNK),
    cy1: Math.floor((rect.y + rect.h - 1 + margin) / CHUNK),
  };
}

/**
 * @template T
 * @param {(cx: number, cy: number) => T} make pure function of the chunk coordinates
 * @param {number} keep how many chunks stay in memory
 */
export function createChunkCache(make, keep) {
  /** @type {Map<string, { cx: number, cy: number, value: T }>} */
  const chunks = new Map();
  return {
    /** @param {number} cx @param {number} cy @returns {T | undefined} */
    peek(cx, cy) {
      return chunks.get(chunkKey(cx, cy))?.value;
    },
    /** @param {number} cx @param {number} cy @returns {T} */
    ensure(cx, cy) {
      const key = chunkKey(cx, cy);
      let entry = chunks.get(key);
      if (!entry) {
        entry = { cx, cy, value: make(cx, cy) };
        chunks.set(key, entry);
      }
      return entry.value;
    },
    /**
     * Drops the chunks farthest from a point until `keep` are left.
     * @param {number} cx @param {number} cy
     */
    prune(cx, cy) {
      if (chunks.size <= keep) return;
      const far = [...chunks.entries()].sort(
        (a, b) =>
          Math.max(Math.abs(b[1].cx - cx), Math.abs(b[1].cy - cy)) -
          Math.max(Math.abs(a[1].cx - cx), Math.abs(a[1].cy - cy)),
      );
      for (let i = 0; chunks.size > keep && i < far.length; i++) chunks.delete(far[i][0]);
    },
    get size() {
      return chunks.size;
    },
  };
}
