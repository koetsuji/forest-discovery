// @ts-check
/**
 * The title screen: the live forest, the name, one button.
 * The first press on Begin is also what starts the sound.
 */

import { attachButton } from './feel.js';
import { strings } from './strings.js';

/**
 * @param {HTMLElement} root
 * @param {import('../core/events.js').Bus} bus
 */
export function createTitle(root, bus) {
  const el = document.createElement('section');
  el.className = 'title is-entering';
  el.setAttribute('aria-label', strings.title);

  const scrim = document.createElement('div');
  scrim.className = 'title__scrim';

  const body = document.createElement('div');
  body.className = 'title__body';

  const name = document.createElement('h1');
  name.className = 'title__name';
  name.textContent = strings.title;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--lg';
  button.disabled = true;
  button.textContent = strings.loading;

  body.append(name, button);
  el.append(scrim, body);
  root.append(el);

  let open = true;
  const feel = attachButton(button, { bus, id: 'begin', tone: 'confirm', onRelease: leave });

  // Two frames, so the browser has painted the starting state before the fade.
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-entering')));

  function leave() {
    if (!open) return;
    open = false;
    el.classList.add('is-leaving');
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    bus.emit('game-began');
    // Removed on a timer that matches the fade. A transitionend event is not
    // safe here: browsers can send one early, and the fade would be cut short.
    const fadeMs = parseFloat(getComputedStyle(scrim).transitionDuration) * 1000 || 0;
    window.setTimeout(() => el.remove(), fadeMs + 100);
  }

  // Enter or Space starts the game without tabbing to the button first.
  // The button still gets the whole press and release.
  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat || event.target === button) return;
    event.preventDefault();
    button.focus({ preventScroll: true });
    feel.press();
  }

  /** @param {KeyboardEvent} event */
  function onKeyUp(event) {
    // If the button had focus it has already handled this key and is no longer held.
    if (event.key === 'Enter' || event.key === ' ') feel.lift(true);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    /** The forest is loaded: the button wakes up. */
    setReady() {
      button.disabled = false;
      button.textContent = strings.begin;
    },
    /** Leave without a press. Used by the screenshot check. */
    skip() {
      if (!open) return;
      open = false;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      el.remove();
      bus.emit('game-began');
    },
    get open() {
      return open;
    },
  };
}
