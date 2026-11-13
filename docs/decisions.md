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
