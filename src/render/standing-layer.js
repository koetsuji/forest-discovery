// @ts-check
/**
 * Everything that stands in the world, drawn in order of the y of its base,
 * so things further down the screen cover things behind them.
 */

/**
 * @param {ReturnType<typeof import('../world/world.js').createWorld>} world
 * @param {{ imageOf?: (object: import('../world/world.js').WorldObject) => { canvas: HTMLCanvasElement, x: number, y: number } | null }} [opts]
 *   imageOf lets a system that poses an object (the wind) supply its current picture.
 */
export function createStandingLayer(world, opts = {}) {
  return {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/camera.js').View} view
     */
    draw(ctx, view) {
      for (const object of world.visible(view)) {
        const sprite = world.spriteOf(object);
        const left = object.x - sprite.footX - view.x;
        const top = object.y - sprite.footY - view.y;
        const posed = opts.imageOf ? opts.imageOf(object) : null;
        if (posed) {
          ctx.drawImage(posed.canvas, left + posed.x, top + posed.y);
        } else if (sprite.base) {
          ctx.drawImage(sprite.base.canvas, left + sprite.base.x, top + sprite.base.y);
        }
      }
    },
  };
}
