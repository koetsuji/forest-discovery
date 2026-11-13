# Decisions

The running record of what was decided, by whom and why. It started as the Decisions section of game-brief.md. New decisions go into the log at the bottom, newest last. When a decision changes another file in docs/, that file changes in the same commit.

## Owner decisions

Made by the owner on 13 Nov 2026:

| Topic | Decision |
|---|---|
| Art source | AI generated sprites from day one (art-guide.md) |
| World | Endless forest from a seed |
| Mood | Blend: outlaw greenwood with a little magic |

## Claude's calls

Made by Claude, open to overrule by the owner:

| Topic | Call | Why |
|---|---|---|
| Engine | None. Plain JavaScript, Canvas 2D, Web Audio | Lightest option, no build step |
| Hosting | GitHub Pages from `main` | Push and it is live |
| Image format | PNG for pixel art, SVG only for interface icons | SVG suits flat shapes. Pixel art as SVG gets bigger and can blur |
| Ground | Drawn by code in the sprites' colours | Endless ground must have no seams |
| Sound | Synthesized, zero audio files | No download weight, and it can follow the wind exactly |
| Interface | HTML over the canvas, Geist design system | Crisp text, accessible, the owner's standing preference |
| Platforms | Desktop and phone from the first milestone | Feel has to be right on both |
| Controls | Keyboard, hold to walk with a mouse, drag to steer on touch | One simple scheme per device, no on-screen pad |
| Camera | Three quarter top-down, about 480 x 270 art pixels, wanderer centred | Matches the scale of the video |
| Size cap | 1 MB for the whole base | Makes "lightweight" measurable |
| Saving | In the browser, no accounts, no server | Nothing to host or protect |
| Time of day | Slow drift between day and dusk, no full night yet | Carries the mood blend. Night waits for fire |
| Discoveries | Landmarks are named and counted when found | A payoff for wandering without adding goals |
| Language | English, all text in one file | Easy to translate later |
| Git flow | Straight to `main`, small commits | One owner, no players yet |
| Tracking | None | Privacy and weight |

## Open, owner's call

Not urgent: the final name, a license for the repo.

## Log

### 13 Nov 2026, session 1

| Topic | Call | Why |
|---|---|---|
| Source of truth | The six knowledge files were copied into docs/ unchanged. From here on docs/ is the current copy | Project instructions: once docs/ exists, it wins |
| Pages | Turned on for `main`, root folder, through the owner's browser session | The owner asked for it. The session's own GitHub access is not allowed to change Pages settings |
| package.json | Added, with `"type": "module"`, three script names and no dependencies | Node's test runner must load the game's ES modules. Nothing is installed and nothing is built |
| Checks | `node tools/check.mjs` runs tests, the game in headless Chrome, the console check and the size report. The browser is driven over the DevTools protocol with plain Node | The four checks in architecture.md, with no dependency |
| Clock for checks | The page takes `?seed=`, `?t=`, `?freeze=1` and `?title=0` | A fixed seed and clock make screenshots repeatable |
| Seed until M3 | One fixed default seed. `?seed=` overrides it | The clearing is laid out by hand for now. A random seed per visit arrives with the endless world |
| First scene | A hand placed ring of trees around a meadow, with seeded forest around it, built from kinds, stable ids and pure functions of position | It is the M1 clearing already, so M0 work is not thrown away. M3 replaces the hand layout with placers |
| Flat stand-ins | One flat grey per kind with a darker outline, drawn by code from the size in the kind | A stand-in must look like a stand-in. One grey for everything turned overlapping trees into a single blob |
| Buttons | One button style for the game: near-black panel, hairline border, Geist large size | The shell stays quiet so the forest carries the colour. The border is what brightens on hover and darkens on press |
| Title contrast | A dark scrim over the forest while the title is up, lifted slowly on Begin | White text on bright grass fails WCAG AA without it |
| Title type | Geist Pixel Square, sized so one font grid cell is 2 or 3 whole screen pixels | Keeps the pixels of the name square |
| Fonts | Geist Sans, Mono and Pixel Square, cut to printable ASCII: 39 KB together. `tools/build-fonts.sh` rebuilds them | Inside the 60 KB budget. ASCII covers seeds, counts and landmark names |
| First press | Sound starts on the first gesture the browser accepts: at once with a mouse or a key, on lifting the finger on touch. Vibration starts with the second touch | Browsers refuse both before that and log a warning. The console has to stay clean |
| Assistive clicks | A click that arrives with no press before it runs the whole press and release at once | Screen readers and switch devices send only a click |
| Interface timing | Things that leave are removed on a timer that matches their fade, never on `transitionend` or `animationend` | Chrome can send those events early. The check caught the title vanishing at once in about one run in five |
| Module preloads | index.html lists every module the game imports. `tools/sync-preloads.mjs` writes the list and a test guards it | Without it the browser discovers imports one level at a time, which costs round trips on a phone |
| Ground texture | Two streak fields, long bands and short dashes, with each row slid sideways a little | Gives the ragged horizontal dashes of hand placed pixel art, with no seams |
