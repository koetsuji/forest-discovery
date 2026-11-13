// @ts-check
/** A round bush. No trunk, quick small motion. */
export const bush = {
  id: 'bush',
  sprite: 'bush-01',
  standIn: /** @type {const} */ ({ shape: 'bush', w: 44, h: 34 }),
  footprint: { rx: 14, ry: 6 },
  wind: 'bush',
  sounds: { rustle: 'broadleaf' },
};
