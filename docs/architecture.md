# Architecture

How Forest Discovery is built, and where future features plug in. These choices keep the game light and easy to extend. Change one only with a reason, and log it in docs/decisions.md.

## Principles

1. **No engine, no build step.** What is in the repo is what runs in the browser.
2. **Data over code.** A new tree, landmark or creature is a definition plus sprites, not a change to the engine.
3. **Deterministic.** The world and the wind are pure functions of seed, position and time. Same input, same forest.
4. **Whole pixels.** Everything in the world is drawn at integer positions and integer scale.
5. **Systems talk through events.** Sound and interface listen to what the game does. Game logic never calls them directly.

## Stack

| Layer | Choice |
|---|---|
| Language | JavaScript, native ES modules, JSDoc types with `// @ts-check` |
| Drawing | Canvas 2D, one low resolution canvas scaled up with nearest neighbour |
| Sound | Web Audio, synthesized, no audio files |
| Interface | HTML and CSS over the canvas, Geist tokens |
| Saving | `localStorage`, versioned JSON |
| Runtime dependencies | None |
| Dev tools | Python for the art pipeline, Node's built in test runner, headless Chrome for screenshots |
| Hosting | GitHub Pages from `main`, root folder |

Why no engine: the game needs a camera, sprites and sound, and the browser already provides all three. An engine would add download weight and a build step for features we would not use.

## Repo layout

    index.html            page shell, loads src/main.js
    styles/               tokens.css (Geist), ui.css
    src/
      main.js             boot and wiring
      tuning.js           every tunable number, grouped
      core/               loop, events, rng, input, camera, save, assets
      render/             renderer, layers, sprite drawing
      world/              chunks, placers/, kinds/, landmarks
      wind/               field, foliage posing, leaves
      actors/             player (later: creatures)
      systems/            interact, discovery (later: inventory, fire)
      audio/              engine, ambience, sfx
      ui/                 title, hud, menu, toast, feel, strings
    assets/               game-ready atlases and JSON (built, committed)
    art/source/           sprites exactly as generated (inputs)
    art/config/           per-sprite pipeline settings
    tools/                art pipeline, size report, screenshot script, local server
    tests/                node --test files
    docs/                 these documents, decisions.md, devlog.md
    CLAUDE.md             working rules for Claude sessions
    README.md             what it is, play link, credits
    package.json          marks the code as ES modules for Node. No dependencies
    jsconfig.json         lets an editor or tsc check the JSDoc types
    .nojekyll

## Frame

- The simulation runs at a fixed 60 steps per second, decoupled from drawing. Long frames are clamped.
- Foliage poses update on the pose clock, 10 times per second (wind-system.md).
- The loop stops when the tab is hidden and resumes without a jump in time.

## Rendering

- **Resolution.** Pick the largest integer scale that keeps the short side of the screen at 240 art pixels or more, aiming for 270. A 1080p screen gives 480 x 270 at scale 4. A portrait phone gets a tall view at the same pixel size.
- **Camera.** Follows the wanderer with light smoothing and a small look-ahead, then snaps to whole pixels.
- **Draw order.**
  1. Ground, baked once per chunk into an offscreen canvas
  2. Ground details and trails
  3. Shadows
  4. Everything standing, sorted by the y of its base: plants (trunk, inside, clumps), rocks, landmarks, actors
  5. Particles: leaves, fireflies, dust
  6. Mist and the time of day tint
  7. Light sources (reserved, first used by fire)
  8. Interface, in HTML above the canvas

## World

- **Seed.** One 32 bit seed. All randomness comes from a hash of seed, chunk coordinates and a purpose tag. No `Math.random` in world code.
- **Chunks.** 256 x 256 art pixels. Generated when they come near the view, dropped when far away. Generating a chunk is a pure function.
- **Placers.** A chunk is filled by an ordered list of placers: regions, ground, trails, trees, undergrowth, details, landmarks. A later feature adds a placer. It does not edit the others.
- **Kinds.** Every placeable thing has a definition in `src/world/kinds/`: sprite, footprint, wind profile, sounds, and optional `interact` and `light` blocks.
- **Landmarks.** Rare, placed from a coarse grid so they are never crowded. Each has a kind, a name pattern and a discovery radius.
- **Object ids.** Every generated object gets a stable id from its chunk, placer and index, so saved changes can point at it.
- **Deltas.** The generated world is never saved. Only changes are: `deltas[chunkKey][objectId] = {...}`. Empty in the base, used later by collecting and fire.

## Actors, systems, events

- An **actor** is anything that acts: position, velocity, sprite state, and an `update(dt, world)` function. The wanderer is the only actor in the base. Creatures arrive later as more actors with their own small state machines.
- A **system** is a module with `init`, `update` and optional `draw`, registered in `main.js` in a fixed order.
- The **event bus** carries facts in the past tense: `step`, `gust-enter`, `leaf-fall`, `landmark-found`, `ui-press`, `ui-release`. Audio and interface subscribe to them.
- **Interaction.** There is one verb, interact: E, Enter, or a tap on the thing. The interact system finds the nearest thing in range that has an `interact` block, highlights it, and runs its handler. In the base only landmarks use it. Fire, pickups and creatures will use the same path.

## Extension points

| Later feature | Plugs into | Needs new |
|---|---|---|
| Making fire | A `campfire` kind with `interact` and `light`, the light layer, an audio emitter, a delta for "lit here" | Fire particles, a darker dusk and night tint |
| Collecting | Kinds with `interact: pickup`, a placer for them, `state.inventory`, a delta for "taken" | Inventory panel, pickup sound and motion |
| Strange animals | Actors with a brain function, a spawn placer keyed to region and time of day, audio emitters, `interact: meet` | Creature sprites, journal pages |
| Journal | `state.found`, the `landmark-found` event | Journal screen |
| Weather, full night | The tint layer, a strength input on the wind field, the ambience mix | Rain particles, night palette |

If a change to the base would make one of these harder, stop and flag it before building.

## State and saving

    state = {
      v: 1,                      // schema version, migrations in core/save.js
      seed,
      player: { x, y, facing },
      found: [],                 // landmark ids
      inventory: [],             // unused in the base
      deltas: {},                // unused in the base
      settings: { volume, muted, reducedMotion, showWind }
    }

Saved on a timer, on pause, and when the tab is hidden. A broken or older save migrates or falls back to a fresh start. Never an error screen.

## Input

Devices are translated into intents (`move(x, y)`, `interact`, `pause`). The game reads only intents.

- Keyboard: WASD or arrows to walk, E or Enter to interact, Esc to pause, M to mute
- Mouse: hold the button to walk toward the pointer, click a thing to walk to it and interact
- Touch: drag anywhere to steer, tap a thing to walk to it and interact
- Gamepad: later, same intents

## Assets

- **Format.** PNG at exact pixel size, reduced to a shared palette, packed into a few atlases. SVG only for interface icons.
- **Atlas JSON** lists frames and, for plants, the layers from wind-system.md: trunk, inside, and clumps with centre, weight and height.
- **Loading.** The title screen needs only the first atlas. A sprite that fails to load is replaced by a flat stand-in and reported in the console. Never a crash.
- **Pipeline.** See art-guide.md.

## Budgets

| What | Limit |
|---|---|
| Whole game, transferred | 1 MB |
| Code, uncompressed | 200 KB |
| Art | 600 KB |
| Fonts | 60 KB |
| Audio files | 0 |
| First playable frame, mid-range phone on 4G | 2 s |
| Frame rate | 60 fps target, never under 30 |
| Network requests after loading | None |

`tools/size-report` prints these on every check. Going over a limit is a decision for the owner, not a default.

## Checks before every push

`node tools/check.mjs` runs all four.

1. `node --test` passes: rng and world determinism, wind math, save migration.
2. A local static server plus headless Chrome loads the game with a fixed seed and clock, takes screenshots at several moments, and the session looks at them. The page takes `?seed=7&t=12.5&freeze=1&title=0` for this.
3. The browser console is clean.
4. The size report is inside the budgets.

A change that was not seen running does not get pushed. If a session has no way to run a browser, it says so in its report and in docs/devlog.md.

## Deploy

- GitHub Pages serves `main` from the root. A push to `main` is live a few minutes later.
- The site lives under `/forest-discovery/`, so every path in the code is relative.
- `.nojekyll` keeps Pages from processing the files.
- No analytics, no external requests, no cookies.

## Code conventions

- Small modules, one job each. Split a file that passes about 300 lines.
- Plain functions and plain objects. No class hierarchies, no frameworks.
- Numbers that shape the feel live in `tuning.js`, with units in their names (`gustSpeedPxPerSec`).
- Comments say why, not what.
- Text the player reads lives in `src/ui/strings.js`. English for now.
