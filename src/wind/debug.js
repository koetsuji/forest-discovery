// @ts-check
/**
 * The wind made visible, for tuning: gust patches as a blocky haze and wind
 * streaks that ride the wave. Off by default. G toggles it, and so does
 * ?wind=1 in the link.
 */

import { tuning } from '../tuning.js';
import { mix32 } from '../core/rng.js';
import { breeze, gust, waveSpeedPxPerSec } from './field.js';

const D = tuning.debug;
const SLOPE = tuning.wind.axisSlope;

/**
 * @param {{ t: number }} sim
 */
export function createWindDebug(sim) {
  return {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/camera.js').View} view
     */
    draw(ctx, view) {
      // The pose clock, so the overlay steps with the leaves.
      const t = Math.floor(sim.t * tuning.loop.posesPerSec) / tuning.loop.posesPerSec;
      const cell = D.cellPx;
      ctx.fillStyle = D.gustColour;
      for (let y = 0; y < view.h; y += cell) {
        for (let x = 0; x < view.w; x += cell) {
          const g = gust(view.x + x + cell / 2, view.y + y + cell / 2, t, view);
          if (g < 0.08) continue;
          ctx.globalAlpha = Math.min(0.5, g * 0.4);
          ctx.fillRect(x, y, cell, cell);
        }
      }
      ctx.globalAlpha = 1;

      // Streaks: short lines that travel with the wave and stretch in a gust.
      ctx.fillStyle = D.streakColour;
      const lap = view.w + 80;
      const count = Math.round((view.w * view.h) / D.pxPerStreak);
      for (let i = 0; i < count; i++) {
        const h = mix32(i + 1);
        const speed = waveSpeedPxPerSec * (0.8 + ((h >>> 8) & 255) / 640);
        const x = (((h & 0xffff) / 0xffff) * lap + speed * t) % lap - 40;
        const y = (((h >>> 16) / 0xffff) * view.h + SLOPE * x + view.h) % view.h;
        const wx = view.x + x;
        const wy = view.y + y;
        const wind = breeze(wx, wy, t, view) + gust(wx, wy, t, view);
        if (wind < 0.2) continue;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(5 + 12 * Math.min(2, wind)), 1);
      }
    },
  };
}
