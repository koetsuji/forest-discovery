// @ts-check
/**
 * Ground colours are sampled from the sprites: each role the ground painter
 * uses is moved to the nearest colour of the shared sprite palette, so ground
 * and trees are painted from one set of colours. With no accepted sprites yet
 * the palette is empty and the provisional colours are used as they are.
 */

/** @param {string} hex @returns {[number, number, number]} */
function rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/**
 * Distance between two colours, weighted the way the eye weighs them.
 * @param {string} a @param {string} b
 */
export function colourDistance(a, b) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const mean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db);
}

/**
 * @param {Record<string, string>} roles provisional colour per role
 * @param {string[]} palette shared sprite palette
 * @param {number} [reach] a role keeps its own colour if nothing in the palette is this close
 * @returns {Record<string, string>}
 */
export function snapToPalette(roles, palette, reach = 60) {
  /** @type {Record<string, string>} */
  const out = {};
  const taken = new Set();
  for (const [role, colour] of Object.entries(roles)) {
    let best = colour;
    let bestDistance = reach;
    for (const candidate of palette) {
      // Two roles never share a colour, or the ground would lose its texture.
      if (taken.has(candidate)) continue;
      const d = colourDistance(colour, candidate);
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    out[role] = best;
    taken.add(best);
  }
  return out;
}
