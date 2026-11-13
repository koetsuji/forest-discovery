// @ts-check
/**
 * Loading. The atlas is one JSON file and, once sprites exist, one PNG.
 * Whatever goes wrong here ends in stand-ins, never in a crash.
 */

/**
 * @typedef {{ v: number, image?: string, sprites: Record<string, any>, palette?: string[], ground?: Record<string, string> }} AtlasData
 * @typedef {{ data: AtlasData, image: HTMLImageElement | null }} Atlas
 */

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image did not load: ${url}`));
    img.src = url;
  });
}

/**
 * @param {string} url relative path of the atlas JSON
 * @returns {Promise<Atlas>}
 */
export async function loadAtlas(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    /** @type {AtlasData} */
    const data = await response.json();
    if (!data || typeof data !== 'object' || typeof data.sprites !== 'object') {
      throw new Error('not an atlas');
    }
    const image = data.image ? await loadImage(new URL(data.image, response.url).href) : null;
    return { data, image };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[assets] ${url} did not load (${reason}). Showing stand-ins.`);
    return { data: { v: 1, sprites: {} }, image: null };
  }
}
