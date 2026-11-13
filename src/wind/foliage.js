// @ts-check
/**
 * Foliage: every plant on screen gets a spring that leans it in a gust and,
 * on the pose clock, a whole pixel offset for each of its clumps. A plant is
 * redrawn into its own small canvas only when its pose changes, so a calm
 * forest costs one drawImage per plant.
 */

import { tuning } from '../tuning.js';
import { shadowOf, shadowShift } from '../render/shadows.js';
import { breeze, gust, phase } from './field.js';
import { leanOffset, loopOffset, loopSize, rowShift, stepLean } from './pose.js';

const W = tuning.wind;
/** Room around the sprite for clumps that move out of its box. */
const PAD_X = 14;
const PAD_TOP = 4;
/** Lean is compared in steps this fine to decide whether a bending trunk must be redrawn. */
const BEND_STEPS_PER_PX = 4;

/**
 * @typedef {import('../world/world.js').WorldObject} WorldObject
 * @typedef {import('../render/sprites.js').Sprite} Sprite
 * @typedef {import('../render/sprites.js').Layer} Layer
 * @typedef {{ canvas: HTMLCanvasElement, x: number, y: number }} Picture
 * @typedef {{
 *   sprite: Sprite,
 *   profile: { pushPx: number, swingSec: number, damping: number, trunkBend: number },
 *   lean: number,
 *   leanSpeed: number,
 *   dx: Int8Array,
 *   dy: Int8Array,
 *   bendStep: number,
 *   gust: number,
 *   gustOn: boolean,
 *   shed: number,
 *   seenAt: number,
 *   ctx: CanvasRenderingContext2D,
 *   image: Picture,
 *   shadowCtx: CanvasRenderingContext2D,
 *   shadowImage: Picture,
 * }} PlantView
 */

/** @type {WeakMap<HTMLCanvasElement, HTMLCanvasElement>} */
const tints = new WeakMap();

/** A lighter copy of a clump, for the debug view: it marks clumps away from rest. */
function tintOf(/** @type {HTMLCanvasElement} */ source) {
  let tint = tints.get(source);
  if (!tint) {
    tint = document.createElement('canvas');
    tint.width = source.width;
    tint.height = source.height;
    const ctx = /** @type {CanvasRenderingContext2D} */ (tint.getContext('2d'));
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tuning.debug.tint;
    ctx.fillRect(0, 0, tint.width, tint.height);
    tints.set(source, tint);
  }
  return tint;
}

/** @param {number} w @param {number} h */
function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')) };
}

/**
 * @param {ReturnType<typeof import('../world/world.js').createWorld>} world
 * @param {import('../core/events.js').Bus} bus
 * @param {{ roll: () => number, shed: (x: number, y: number, groundY: number, colour: string) => void }} opts
 *   roll: seeded random numbers. shed: called for every leaf a gust shakes loose.
 */
export function createFoliage(world, bus, { roll, shed }) {
  /** @type {Map<string, PlantView | null>} */
  const views = new Map();
  let tint = false;

  /** @param {WorldObject} object @returns {PlantView | null} */
  function viewOf(object) {
    const known = views.get(object.id);
    if (known !== undefined) return known;
    const sprite = world.spriteOf(object);
    const profile = sprite.profile ? W.profiles[sprite.profile] : null;
    if (!profile || sprite.clumps.length === 0) {
      views.set(object.id, null);
      return null;
    }
    const body = makeCanvas(sprite.w + 2 * PAD_X, sprite.h + PAD_TOP);
    const box = shadowOf(sprite).box;
    const shade = makeCanvas(box.x1 - box.x0 + 2 * PAD_X, box.y1 - box.y0 + 2 * PAD_TOP);
    /** @type {PlantView} */
    const view = {
      sprite,
      profile,
      lean: 0,
      leanSpeed: 0,
      dx: new Int8Array(sprite.clumps.length),
      dy: new Int8Array(sprite.clumps.length),
      bendStep: 0,
      gust: 0,
      gustOn: false,
      shed: 0,
      seenAt: 0,
      ctx: body.ctx,
      image: { canvas: body.canvas, x: -PAD_X, y: -PAD_TOP },
      shadowCtx: shade.ctx,
      shadowImage: { canvas: shade.canvas, x: box.x0 - PAD_X, y: box.y0 - PAD_TOP },
    };
    render(view);
    views.set(object.id, view);
    return view;
  }

  /**
   * Draws a layer that bends with the trunk: rows slide sideways by whole
   * pixels, more toward the top, so the foot stays where it is.
   * @param {CanvasRenderingContext2D} ctx @param {Layer} layer @param {Sprite} sprite @param {number} bend
   */
  function drawLayer(ctx, layer, sprite, bend) {
    const x = PAD_X + layer.x;
    const y = PAD_TOP + layer.y;
    if (bend === 0) {
      ctx.drawImage(layer.canvas, x, y);
      return;
    }
    const { width: w, height: h } = layer.canvas;
    const span = sprite.footY - sprite.riseTop;
    const shiftAt = (/** @type {number} */ row) =>
      rowShift(bend, Math.min(1, Math.max(0, (sprite.footY - layer.y - row) / span)));
    let start = 0;
    let shift = shiftAt(0);
    for (let row = 1; row <= h; row++) {
      const next = row < h ? shiftAt(row) : NaN;
      if (next === shift) continue;
      ctx.drawImage(layer.canvas, 0, start, w, row - start, x + shift, y + start, w, row - start);
      start = row;
      shift = next;
    }
  }

  /** Redraws a plant and its shadow from the current pose. @param {PlantView} view */
  function render(view) {
    const { sprite, ctx, shadowCtx } = view;
    const bend = view.profile.trunkBend > 0 ? (view.bendStep / BEND_STEPS_PER_PX) * view.profile.trunkBend : 0;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (sprite.base) drawLayer(ctx, sprite.base, sprite, bend);
    if (sprite.inside) drawLayer(ctx, sprite.inside, sprite, bend);
    const shadow = shadowOf(sprite);
    const sx = PAD_X - shadow.box.x0;
    const sy = PAD_TOP - shadow.box.y0;
    shadowCtx.clearRect(0, 0, shadowCtx.canvas.width, shadowCtx.canvas.height);
    if (shadow.base) shadowCtx.drawImage(shadow.base.canvas, sx + shadow.base.x, sy + shadow.base.y);
    for (let i = 0; i < sprite.clumps.length; i++) {
      const clump = sprite.clumps[i];
      const moved = view.dx[i] !== 0 || view.dy[i] !== 0;
      ctx.drawImage(tint && moved ? tintOf(clump.canvas) : clump.canvas, PAD_X + clump.x + view.dx[i], PAD_TOP + clump.y + view.dy[i]);
      const piece = shadow.clumps[i];
      const [px, py] = shadowShift(view.dx[i], view.dy[i]);
      shadowCtx.drawImage(piece.canvas, sx + piece.x + px, sy + piece.y + py);
    }
  }

  return {
    /**
     * Every simulation step: springs, gust events, leaves coming loose.
     * @param {number} dt @param {number} t
     * @param {import('./field.js').View} view
     * @param {WorldObject[]} objects the objects on screen
     */
    update(dt, t, view, objects) {
      for (const object of objects) {
        const plant = viewOf(object);
        if (!plant) continue;
        plant.seenAt = t;
        const g = gust(object.x, object.y, t, view);
        plant.gust = g;
        stepLean(plant, g, plant.profile, dt);
        if (!plant.gustOn && g > W.gustOnLevel) {
          plant.gustOn = true;
          // The field is a pure function of time, so the strength the gust
          // is about to reach here can be read ahead and sent with the event.
          const strength = Math.max(g, gust(object.x, object.y, t + 0.35, view), gust(object.x, object.y, t + 0.7, view));
          bus.emit('gust-enter', { id: object.id, x: object.x, y: object.y, strength, rustle: object.kind.sounds.rustle });
        } else if (plant.gustOn && g < W.gustOffLevel) {
          plant.gustOn = false;
        }
        if (!plant.gustOn) continue;
        // Leaves come loose only while a gust is on the plant. Bigger canopies shed more.
        const sprite = plant.sprite;
        plant.shed += dt * tuning.leaves.shedPerSecAtGust1 * g * (sprite.clumps.length / 16);
        while (plant.shed >= 1) {
          plant.shed -= 1;
          const i = Math.floor(roll() * sprite.clumps.length);
          const clump = sprite.clumps[i];
          const x = object.x - sprite.footX + clump.cx + plant.dx[i] + (roll() - 0.5) * 12;
          const y = object.y - sprite.footY + clump.cy + (roll() - 0.5) * 8;
          const colour = sprite.leafColours[Math.floor(roll() * sprite.leafColours.length)];
          shed(x, y, object.y + (roll() - 0.35) * 16, colour);
          bus.emit('leaf-fall', { x, y });
        }
      }
    },

    /**
     * On the pose clock: a new whole pixel offset for every clump on screen.
     * @param {number} t @param {import('./field.js').View} view @param {WorldObject[]} objects
     */
    pose(t, view, objects) {
      for (const object of objects) {
        const plant = viewOf(object);
        if (!plant) continue;
        const sprite = plant.sprite;
        const left = object.x - sprite.footX;
        const top = object.y - sprite.footY;
        let changed = false;
        for (let i = 0; i < sprite.clumps.length; i++) {
          const clump = sprite.clumps[i];
          const x = left + clump.cx;
          const y = top + clump.cy;
          const [ax, ay] = loopSize(breeze(x, y, t, view), gust(x, y, t, view));
          const [lx, ly] = loopOffset(ax * clump.weight, ay * clump.weight, phase(x, y, t));
          const dx = lx + leanOffset(plant.lean, clump, plant.profile);
          if (dx !== plant.dx[i] || ly !== plant.dy[i]) {
            plant.dx[i] = dx;
            plant.dy[i] = ly;
            changed = true;
          }
        }
        if (plant.profile.trunkBend > 0) {
          const step = Math.round(plant.lean * BEND_STEPS_PER_PX);
          if (step !== plant.bendStep) {
            plant.bendStep = step;
            changed = true;
          }
        }
        if (changed) render(plant);
      }
    },

    /** The current picture of a posed plant, or null for things the wind does not move. */
    imageOf(/** @type {WorldObject} */ object) {
      const plant = viewOf(object);
      return plant ? plant.image : null;
    },

    /** The current shadow of a posed plant. */
    shadowOf(/** @type {WorldObject} */ object) {
      const plant = viewOf(object);
      return plant ? plant.shadowImage : null;
    },

    /** Debug view: tint the clumps that are away from rest. */
    setTint(/** @type {boolean} */ on) {
      if (tint === on) return;
      tint = on;
      for (const plant of views.values()) if (plant) render(plant);
    },

    /** Forget plants that have been off screen for a while. @param {number} t */
    prune(t) {
      if (views.size < 200) return;
      for (const [id, plant] of views) if (!plant || t - plant.seenAt > 20) views.delete(id);
    },

    /** For the checks: the offsets of every posed clump. */
    snapshot() {
      /** @type {{ id: string, lean: number, dx: number[], dy: number[] }[]} */
      const out = [];
      for (const [id, plant] of views) if (plant) out.push({ id, lean: plant.lean, dx: [...plant.dx], dy: [...plant.dy] });
      return out;
    },
  };
}
