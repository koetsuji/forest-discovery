// @ts-check
/** A tall pine. Its trunk bends in a gust and its tiers bob on top. */
export const pine = {
  id: 'pine',
  sprite: 'pine-01',
  standIn: /** @type {const} */ ({ shape: 'cone', w: 90, h: 200 }),
  footprint: { rx: 6, ry: 3 },
  wind: 'pine',
  sounds: { rustle: 'needles' },
};
