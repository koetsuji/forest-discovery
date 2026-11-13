// @ts-check
/** A broad old tree. The style anchor of the whole forest. */
export const oak = {
  id: 'oak',
  sprite: 'oak-01',
  standIn: /** @type {const} */ ({ shape: 'broad', w: 110, h: 120 }),
  /** Ground the trunk stands on, as an ellipse around the foot. */
  footprint: { rx: 9, ry: 4 },
  wind: 'oak',
  sounds: { rustle: 'broadleaf' },
};
