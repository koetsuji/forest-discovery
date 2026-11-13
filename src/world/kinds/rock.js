// @ts-check
/** A mossy boulder. It never moves. */
export const rock = {
  id: 'rock',
  sprite: 'rock-01',
  standIn: /** @type {const} */ ({ shape: 'rock', w: 40, h: 28 }),
  footprint: { rx: 16, ry: 7 },
  wind: null,
  sounds: {},
};
