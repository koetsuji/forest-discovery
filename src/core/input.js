// @ts-check
/**
 * Devices are translated into intents. The game reads only intents, so a new
 * device (gamepad, later) never touches game code.
 *
 * In the base so far: the keys that work before there is a wanderer.
 * Walking and interacting arrive with M2 through the same `on` path.
 */

/** @type {Record<string, string>} */
const KEY_INTENTS = {
  KeyM: 'mute',
  KeyG: 'show-wind',
};

/**
 * @param {Window} target
 */
export function createInput(target) {
  /** @type {Map<string, Set<() => void>>} */
  const handlers = new Map();

  target.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const intent = KEY_INTENTS[event.code];
    if (!intent) return;
    const set = handlers.get(intent);
    if (set) for (const fn of [...set]) fn();
  });

  return {
    /**
     * @param {string} intent
     * @param {() => void} fn
     */
    on(intent, fn) {
      let set = handlers.get(intent);
      if (!set) {
        set = new Set();
        handlers.set(intent, set);
      }
      set.add(fn);
    },
  };
}
