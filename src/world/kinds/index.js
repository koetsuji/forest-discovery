// @ts-check
/**
 * Every placeable thing has a definition here: sprite, stand-in size,
 * footprint, wind profile, sounds, and later optional `interact` and `light`
 * blocks. A new thing in the world is a new file in this folder, not a change
 * to the engine.
 */

import { oak } from './oak.js';
import { pine } from './pine.js';
import { birch } from './birch.js';
import { bush } from './bush.js';
import { rock } from './rock.js';

/**
 * @typedef {{
 *   id: string,
 *   sprite: string,
 *   standIn: import('../../render/sprites.js').StandInSpec,
 *   footprint: { rx: number, ry: number },
 *   wind: string | null,
 *   sounds: Record<string, string>,
 *   interact?: Record<string, unknown>,
 *   light?: Record<string, unknown>,
 * }} Kind
 */

/** @type {Record<string, Kind>} */
export const kinds = { oak, pine, birch, bush, rock };
