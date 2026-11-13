# Forest Discovery: game brief

Working title: Forest Discovery.
Repo: https://github.com/koetsuji/forest-discovery
Live: https://koetsuji.github.io/forest-discovery/ (after the first deploy)

## One line

A small browser game about wandering through an old forest that feels alive.

## Where it comes from

The starting point is a 25 second video by Kimo (@asynkimo): a pixel art forest clearing, seen from above at a three quarter angle, where the tree canopies ripple in the wind. Leaves are split into clumps, each clump walks a one pixel loop, the clumps move in sequence along the wind, and gusts push them further and shake leaves loose. That look is the first thing the game has to nail. The method is in wind-system.md.

- Video: https://x.com/asynkimo/status/2121230694860890582
- Article: https://www.spritecook.ai/blog/pixel-art-trees-wind-animation

The video is a technique demo, not a game. We take the living forest from it and build our own game, layout and art around it.

## Pillars

Every choice is checked against these five, in this order.

1. **The forest is alive.** Wind you can see and hear. Nothing on screen is frozen, and nothing moves at random.
2. **Wandering is the game.** No timer, no score, no way to lose. The reward is the next thing you find.
3. **Light as a leaf.** Opens in a second or two, runs on a phone, the whole base stays under 1 MB.
4. **Small touches.** Every button, step and discovery answers back with motion and sound. Quiet, fast, physical.
5. **Ready to grow.** The base is built so fire, collecting and creatures can be added without rewriting it.

## Mood

A hooded outlaw in an old enchanted greenwood. Robin Hood by day, a little magic at the edges.

- **Greenwood, the body of it:** big old oaks, pines and birches, warm daylight through the canopy, dirt trails, moss, ferns, wildflowers. Things made by hands are rare and old: a rope, a camp, a carved stone.
- **Magic, the seasoning:** mist in the hollows, fireflies at dusk, standing stones, mushroom rings, a glow that might be a trick of the light. Hinted, never explained.
- **Never:** neon colours, cluttered screens, combat, jump scares, jokes that break the mood, walls of text.

Time drifts slowly between warm day and blue dusk. Day leans Robin Hood. Dusk leans mystic.

## The player

The wanderer: a small hooded figure in green and brown with a bow on the back, always near the middle of the screen.

Verbs in the base: **walk, look, discover.**
Verbs for later: gather, light a fire, meet.

## The world

An endless forest that generates itself from a seed as you walk. The same seed always gives the same forest, so a forest can be shared as a link.

- **Regions** blend into each other: oak wood, pine stand, birch grove, open glade, misty hollow.
- **Trails** wind through the trees and tend to lead somewhere.
- **Landmarks** are rare special places: a stone circle, a giant ancient oak, a ruined arch, a spring, an old outlaw camp. Finding one is the "discover" moment: a quiet phrase of music, a short name on screen, one more in the found count.

## Base scope

In the base:

- The living forest: wind, gusts, falling leaves, moving shadows
- The wanderer, walking by keyboard, mouse or touch
- The endless seeded world with trails and landmarks
- Sound: wind, rustle, footsteps, birds, interface sounds, the discovery phrase
- Shell: title screen, pause, settings, save and resume
- Feel: every interaction answers back (sound-and-feel.md)

Not in the base, but the base must stay ready for them (architecture.md, "Extension points"):

- Making fire
- Collecting things
- Meeting strange, fantastic animals

Parked ideas: full night, weather, a map, a story, multiplayer.

## Decisions

Made by the owner on 13 Nov 2026:

| Topic | Decision |
|---|---|
| Art source | AI generated sprites from day one (art-guide.md) |
| World | Endless forest from a seed |
| Mood | Blend: outlaw greenwood with a little magic |

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

Still open, owner's call, not urgent: the final name, a license for the repo.

## Glossary

- **Clump:** one cluster of leaves, cut out of a tree sprite as its own layer.
- **Pose clock:** the 10 per second tick on which foliage moves.
- **Gust patch:** a moving zone of stronger wind.
- **Chunk:** one square of generated world.
- **Placer:** a step that fills a chunk with one type of thing.
- **Kind:** the definition of a placeable thing.
- **Landmark:** a rare special place that can be discovered.
- **Delta:** a saved change to the generated world.
- **Stand-in:** a grey placeholder shown until a real sprite exists.
