# Roadmap

The base is six milestones. Each one ends live on the Pages site and is checked against its "done when" list. One milestone at a time. Features beyond the base wait until the base is done.

Claude updates this file at the end of every session.

| | Milestone | Status |
|---|---|---|
| M0 | Skeleton | built, live check pending |
| M1 | Living forest | todo |
| M2 | The wanderer | todo |
| M3 | Endless forest | todo |
| M4 | Sound and atmosphere | todo |
| M5 | Shell and polish | todo |

## M0 Skeleton

Goal: a page that loads at once and already feels right to touch.

- Repo layout, docs, CLAUDE.md, README, .nojekyll
- Page shell, canvas with integer scaling, game loop, camera
- Asset loader with stand-ins, and a small scene of stand-in trees on code-drawn ground
- Title screen with one button that has the full press and release feel, with sound
- Tests, screenshot check, size report
- GitHub Pages live

Done when:

- The live URL shows the title screen over the stand-in scene, on desktop and on a phone
- The button passes every state in sound-and-feel.md
- All checks in architecture.md pass

## M1 Living forest

Goal: one clearing that reads like the video, with our own layout.

Needs from the owner: the M1 sprites in art-guide.md, style anchor first.

- Art pipeline: normalize, split, pack, contact sheets
- Wind field, pose clock, clump loops, lean spring
- Gust patches, falling leaves, pose shadows
- Ground colours sampled from the accepted sprites
- Wind debug overlay
- First ambience: the wind bed and the rustle follow the gusts

Done when:

- Every point under "Done when" in wind-system.md holds
- Each plant's contact sheet has been looked at and accepted
- 60 fps on a phone with a full clearing on screen

## M2 The wanderer

Goal: walking through the clearing feels good.

Needs from the owner: the wanderer sprites (idle, walk down, walk up, walk right).

- Wanderer actor: movement in 8 directions, easing in and out, walk animation
- Input intents: keyboard, hold to walk, drag to steer
- Camera follow with look-ahead
- Depth sorting against trees, collision with trunks and rocks
- Footsteps with sound. Bushes and flowers react when brushed

Done when:

- The wanderer passes behind and in front of every object correctly
- Controls work with keyboard, mouse and touch, and nothing stays stuck after the tab loses focus
- Steps are in sync with the animation

## M3 Endless forest

Goal: walk in any direction forever and keep finding things.

Needs from the owner: the M3 sprites and landmarks in art-guide.md.

- Seeded chunks, placers, kinds
- Regions: oak wood, pine stand, birch grove, glade, hollow
- Trails
- Landmarks with the interact verb, the discovery toast, the found count
- Saving: seed, position, found landmarks, settings
- The seed in the URL, so a forest can be shared

Done when:

- The same seed gives the same forest on two devices
- Walking in a straight line for five minutes shows no seams, no pop-in, no slowdown and no growth in memory
- A landmark turns up roughly every one to two minutes of walking
- Reloading the page resumes at the same spot

## M4 Sound and atmosphere

Goal: the forest sounds as alive as it looks.

- The full mix from sound-and-feel.md: birds, dusk voices, footsteps per ground type, the discovery phrase, sparse music
- Time of day drifting between day and dusk, with mist and fireflies at dusk
- Volume, mute, muffled world under menus

Done when:

- Ten minutes of listening with eyes closed: nothing harsh, nothing that repeats exactly, and gusts can be heard passing
- No clipping when everything plays at once
- Still zero audio files

## M5 Shell and polish

Goal: it feels like a finished small game.

- Pause, settings, reset by press and hold
- Every item in Part 2 of sound-and-feel.md checked off
- Reduced motion pass, keyboard-only pass, contrast pass
- Performance and size pass against the budgets
- README with a screenshot

Done when:

- A new player can open the link, press Begin, wander, find a landmark, pause, change the volume and come back later, without reading anything
- The budgets hold
- The extension points in architecture.md are intact: a test kind with an `interact` block works without touching the engine

## After the base

Not started until the owner asks. Suggested order:

1. Collecting. The smallest one. It proves deltas and the inventory.
2. Making fire. Uses collecting, adds light and full night.
3. Strange animals. New actors, and the journal.
4. Weather, a map, more regions.
