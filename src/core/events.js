// @ts-check
/**
 * The event bus. It carries facts in the past tense ("ui-press", "gust-enter").
 * Sound and interface listen here. Game logic never calls them directly.
 */

/**
 * @typedef {{ on: (type: string, fn: (detail: any) => void) => () => void, emit: (type: string, detail?: any) => void }} Bus
 */

/** @returns {Bus} */
export function createBus() {
  /** @type {Map<string, Set<(detail: any) => void>>} */
  const listeners = new Map();
  return {
    on(type, fn) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    emit(type, detail) {
      const set = listeners.get(type);
      if (!set) return;
      // Copy first: a listener may unsubscribe while we iterate.
      for (const fn of [...set]) fn(detail);
    },
  };
}
