// @ts-check
/**
 * The draw order from docs/architecture.md, as named layers. A system adds
 * its drawing to a layer. It never needs to know what else is on screen.
 * The interface is HTML above the canvas and is not part of this list.
 */

export const LAYER_ORDER = /** @type {const} */ ([
  'ground',
  'details',
  'shadows',
  'standing',
  'particles',
  'atmosphere',
  'lights',
  'debug',
]);

/**
 * @typedef {(ctx: CanvasRenderingContext2D, view: import('../core/camera.js').View) => void} DrawFn
 */

export function createLayers() {
  /** @type {Map<string, DrawFn[]>} */
  const layers = new Map(LAYER_ORDER.map((name) => [name, []]));
  return {
    /**
     * @param {typeof LAYER_ORDER[number]} name
     * @param {DrawFn} fn
     */
    add(name, fn) {
      const list = layers.get(name);
      if (!list) throw new Error(`unknown layer: ${name}`);
      list.push(fn);
    },
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/camera.js').View} view
     */
    draw(ctx, view) {
      for (const name of LAYER_ORDER) {
        const list = /** @type {DrawFn[]} */ (layers.get(name));
        for (const fn of list) fn(ctx, view);
      }
    },
  };
}
