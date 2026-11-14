# Devlog

One entry per working session, newest first: what was done, what was seen running, what is open.

## 14 Nov 2026, session 3

Small fixes after the first look at the real sprites.

Done:

- White specks gone: the oak had a white blob at its trunk fork, the pine white and grey pixels in its needles. The pipeline's new `despeck` repaints them from the colour around them.
- The meadow has two rocks instead of four identical ones, and seeded trees no longer stand in front of the hand-placed clearing (a birch hid a rock on the phone).
- Culling by each sprite's exact reach: 47 plants posed for a phone view instead of 97, with identical pictures.
- The frame-time check now reads the median frame and prints the slow tail.

Seen running, in headless Chrome at 1920 x 1080, at the owner's 1518 x 923 at 1.6x, and as a 393 x 852 phone at 3x, and on the live page in the owner's Chrome before these changes:

- Begin, the sound switch and the wind overlay work on the live page. On the owner's screen the view is 405 x 247 at scale 6, about 2 ms of work per frame.
- 54 tests pass, the screenshot run passes, console clean.

Measured, honestly:

- With the processor slowed four times and no graphics card, the median frame is 3.4 ms of work, but the frame that carries a pose tick takes about 12 ms, and 1 frame in 20 goes over 25 ms. That is the plant canvases being redrawn 10 times a second. Before the culling it was 26 ms and over 45 ms. A real phone draws canvases on its graphics chip, so this is a pessimistic stand-in. It still has to be tried on a real phone.

Open:

- The owner's own list of small things.
- 60 fps on a real phone. If the pose tick stutters there, the next step is to redraw fewer plant canvases per tick.
- Birch canopy loud yellow, bushes with an orange stem: both art, both a redo for later.

## 13 Nov 2026, session 2

The M1 forest now runs on real sprites. Grey stand-ins are gone.

Done:

- Sprite AI set up as the sprite tool. The claude.ai connector to its MCP server would not connect, so sprites come from its REST API through scripts the owner runs. The first script stayed silent while the server worked. The next ones print every stage and a live counter.
- Test 01: three oaks, 3 tokens. The owner approved oak 1 as the style anchor `oak-01`.
- Batch 02: pine, birch, bush and rock, two tries each, 8 tokens, all locked to a 33-colour shared palette built from the anchor. One of each kept.
- Pipeline: `strip_ground` removes small grass tufts at the roots, wood hues widened to the purple browns of our bark, pine needles limited to the canopy rows. Birch seed spacing set to 8.
- docs/art-guide.md rewritten for Sprite AI: route, tokens, API facts, palette, anchor log.

Seen running, in headless Chrome at 1920 x 1080 and as a 393 x 852 phone at 3x:

- The clearing with the real sprites at three moments of the gust schedule and on the phone. It reads as one forest: same light, same outline, same palette.
- 54 tests pass, the screenshot run passes, the console is clean. Over 20 s: 78 percent of clumps at rest, 14 percent one pixel away, 7 percent further, farthest 7 px.
- The frame-time check (under 12 ms of work, phone view, 4x slower processor) passed twice and then failed in about half the runs. On this 2-core machine the unchanged stand-in version failed it too: 12.9, 10.1 and 9.6 ms, against 12.2, 11.0 and 12.2 ms with the real art in alternating runs. The real art costs about 1 ms. Pushed anyway with these numbers, because the failure follows the machine, not the change. The check should take the median of several runs.
- Size: 115 KB transferred, 131 KB of code, 27 KB of art, 39 KB of fonts.

Open:

- The owner's eye: the forest next to the video, and on his phone.
- The birch canopy is the loudest thing on screen, flat yellow. A redo costs 1 or 2 tokens.
- Rocks keep a thin rim of moss at the base and bushes a small orange stem. Both read fine on grass.
- Tokens: 89 of 100 left this month, renewing on 13 Dec.
- The frame-time check is noisy here. 60 fps on a real phone is still not shown.

## 13 Nov 2026, session 1

M0 and M1 built and live. M1 runs on grey stand-ins until the sprites exist.

Done:

- Read the six knowledge files and the wind article. Stepped through the reference video in the owner's Chrome: scene at 0 to 3 s and 19 to 25 s, the four explainer parts between. Notes: three ground tones (bright grass, deep teal shade, brown earth), shadows fall down and to the right, leaves are 2 px gold dashes, most of the view is still at any moment.
- Docs copied into docs/ unchanged, with decisions.md and this file. GitHub Pages turned on for `main`, root folder.
- M0: page shell, integer scaled canvas, fixed step loop, camera, save with migration, event bus, input intents, asset loader with flat stand-ins, code-drawn ground baked per chunk, the clearing layout, title screen, one button with every state, interface sounds, tests, screenshot check, size report.
- M1: art pipeline (normalize, split, pack, contact sheets) with grey stand-in plants, atlas of 10 KB. Wind field, pose clock, clump loops, lean spring, bending pine, gust patches, falling leaves, pose shadows, grass that lights under a gust, wind overlay (G or `?wind=1`), wind bed and canopy rustle, sound switch.

Seen running, in headless Chrome at 1920 x 1080 and as a 393 x 852 phone at 3x:

- Title, hover, press, slide off and back, release, keyboard focus, Enter, disabled, touch, reduced motion.
- The forest at several moments of the gust schedule, with and without the overlay. Same seed and clock give the same picture, pixel for pixel.
- Over one 20 s schedule: 78 percent of clumps at rest, 14 percent one pixel away, 8 percent further, farthest 7 px. Every offset is a whole pixel.
- Console clean, no outside requests. 54 tests pass.
- Size: 101 KB transferred, 131 KB of code, 13 KB of art, 39 KB of fonts.

Measured, not felt:

- Sound cannot be heard in this session. Levels were measured before the limiter over a full schedule with button presses on top: peak 0.24, loudest second 0.05 RMS. No clipping. Whether it is pleasant needs the owner's ears.
- Frame cost: 6 ms of work per frame on a phone sized view with the processor slowed four times, in a headless browser without a graphics card. Not measured on a real phone.
- The pipeline's path for real sprites was tried on a coloured, 4x enlarged copy of the stand-in oak: brought back to size, 16 clumps, wood found by colour, bad sprites rejected with a reason. That test image is not in the repo.

Found and fixed on the way:

- Chrome sometimes sends `transitionend` early. The title vanished at once in about one run in five. Leaving things are now removed on a timer.
- On touch, sound and vibration were started on finger down, which browsers refuse with a console warning. Sound now starts on the first gesture the browser accepts.
- Fixed-clock frames were not repeatable at first: which way up a leaf was, and which grass was lit, depended on how long the page took to load. Both now depend only on the simulation clock, and the check compares two loads pixel for pixel.

Open:

- The style anchor: one oak, to be generated by the owner. The order is in the session report and the prompt is in art-guide.md.
- Outer oak clumps reach 5 px in the big gust, not the 6 the article mentions. Left at the article's values until it can be judged next to the video with real art.
- Code is at 131 KB of the 200 KB budget after two of six milestones. About a third is comments. Later milestones have to be written leaner, or the budget becomes a question for the owner.
- No licence for the repo yet, and the name is still the working title. Both are the owner's call.
