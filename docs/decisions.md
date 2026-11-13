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
| Sprites for M1 | Built with stand-ins. No SpriteCook tools were available in the session, so the owner gets the order for the style anchor | Owner's instruction for this case |
| Stand-in plants | The art pipeline draws grey clump trees for every sprite that has settings but no PNG, and sends them through the real split and pack | A flat silhouette cannot show clump motion, and this way the whole pipeline and the atlas format are proven before the art exists. Grey keeps them plainly placeholders |
| Bringing in a sprite | Drop the PNG in art/source/ under the sprite's name and run the pipeline. The stand-in disappears on its own | One step, no code change |
| Wind values | Kimo's exact values as the starting point: wave 1.54 s and 69 px, his six gust patches, his spring profiles | They are tuned against the video we are matching. Recorded in wind-system.md under "As built" |
| Loop size | Two values, sideways and upward, as in the article. The lift stays at 1 px in a gust | The spec had one value. The article's own formula keeps the lift small, which is what the video shows |
| Gust bands | Band positions stretch with the height of the view | A tall phone view would otherwise have gusts only in its top third |
| Gust strength in events | `gust-enter` carries the strength the gust is about to reach, read ahead from the field | At the moment a gust arrives its level is always the threshold, so every rustle sounded the same |
| Pine | Trunk and inside layers bend by sliding rows, tiers ride at `lean * rise^2` | From the article. A static inside left a dark ghost of the tree top behind |
| Pine tiers | Cut where the needle rows are suddenly narrower, then each cut follows the dark underside of the skirt above | A straight cut sliced through the tier below |
| Shadows | Wood and rocks projected upright, clumps as squashed blobs where their centre lands, all into one buffer laid over the ground once | Reads as a canopy shadow instead of a cardboard cutout, moves clump by clump, and overlaps do not darken twice |
| Ground under gusts | Short dashes of open grass go one shade lighter while a gust is over them | The article's meadow effect. Tufts and flowers are M3 sprites |
| Leaf colours | Taken by the pipeline from the brightest leaf colours of each sprite | Grey on stand-ins, gold as soon as the real oak is in |
| Ground palette | The game snaps each ground colour to the nearest colour of the sprite palette at load. Empty palette, provisional colours | "Sampled from the accepted sprites" without baking tuning values into a tool |
| Sound switch | A visible mute control arrives with M1 instead of M5 | M1 is where sound becomes continuous, and a phone has no M key |
| Toggle sound | A toggle stays quiet on release and answers with one note, up for on, down for off. Muting waits 0.14 s so its own note is heard | Two plucks and a toggle note on one press was too much |
| Rustle limits | At most 6 at once, 90 ms apart, and none that would peak below a floor | Faint far rustles were taking the voices of near ones |
| Debug handle | `window.fd` exposes the simulation to the checks, with `fd.advance(seconds)` | Lets the check step the forest pose by pose and measure it |
