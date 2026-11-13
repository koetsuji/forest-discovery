// @ts-check
/** Interface icons: small SVGs in the Geist style, 16 px with a 1.5 px line. */

const open = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const speaker = '<path d="M2.5 6h2.25L8 3.25v9.5L4.75 10H2.5z"/>';

export const icons = {
  soundOn: `${open}${speaker}<path d="M10.5 5.75a3 3 0 0 1 0 4.5"/><path d="M12.4 3.9a5.6 5.6 0 0 1 0 8.2"/></svg>`,
  soundOff: `${open}${speaker}<path d="M10.75 6.25l3 3.5m0-3.5l-3 3.5"/></svg>`,
};
