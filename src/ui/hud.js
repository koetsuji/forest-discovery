// @ts-check
/**
 * What stays on screen while playing. For now one control: the sound switch,
 * because sound needs one visible control as well as its key (M).
 */

import { attachButton } from './feel.js';
import { icons } from './icons.js';
import { strings } from './strings.js';

/**
 * @param {HTMLElement} root
 * @param {import('../core/events.js').Bus} bus
 * @param {{ isMuted: () => boolean, toggleMute: () => void }} sound
 */
export function createHud(root, bus, sound) {
  const el = document.createElement('div');
  el.className = 'hud';

  const mute = document.createElement('button');
  mute.type = 'button';
  mute.className = 'btn btn--icon';
  el.append(mute);
  root.append(el);

  function refresh() {
    const muted = sound.isMuted();
    mute.innerHTML = muted ? icons.soundOff : icons.soundOn;
    mute.setAttribute('aria-label', muted ? strings.unmute : strings.mute);
    mute.setAttribute('aria-pressed', String(muted));
  }

  attachButton(mute, { bus, id: 'mute', tone: 'toggle', onRelease: sound.toggleMute });
  bus.on('settings-changed', refresh);
  bus.on('game-began', () => el.classList.add('is-in'));
  refresh();
}
