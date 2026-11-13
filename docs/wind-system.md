# Wind system: traveling waves

The forest's signature effect, and the first thing the game has to get right. This file is the spec for our browser version.

## Credit and sources

The method comes from Kimo (@asynkimo). He shows it in a 25 second video and explains it in an article that includes his Godot code and his exact values. Ours is a new implementation in JavaScript with its own structure.

- Video: https://x.com/asynkimo/status/2121230694860890582
- Article: https://www.spritecook.ai/blog/pixel-art-trees-wind-animation
- Background he builds on: https://www.slynyrd.com/blog/2021/7/16/pixelblog-33-wind-effects

Read the article before building. It has comparison clips that show why each rule below matters. The numbers in this file are rounded starting points. Tune them by eye against the video.

## The look, in four rules

1. **Leaves are split into clumps.** A tree is a trunk, a dark inner layer, and roughly 10 to 20 leaf clumps stacked on the same canvas.
2. **A clump walks a tiny loop.** One pixel up, right, down, back. Whole pixels only.
3. **Clumps go in sequence, ordered along the wind.** Each one is delayed by its position on the wind axis, so the motion crosses the tree, and then the whole forest, as a wave.
4. **Gusts push everything further.** Gust patches travel through the forest. Where one passes, loops widen, trees lean and spring back, and leaves come loose.

What to avoid: the whole sprite swaying as one piece, clumps moving at random times, smooth sub-pixel motion, rotation, scaling. All of these look wrong on pixel art.

## The reference scene

What the video shows, as a target for scale and density, not a layout to copy:

- A forest clearing from above at a three quarter angle, roughly 480 x 270 art pixels.
- Big oaks around the edges, about half the height of the view, with gold on the clumps that face the light at the upper left.
- A tall pine in the foreground that spans most of the view's height. Slim birches with white trunks on one side.
- Round bushes, mossy boulders, a dirt trail winding through bright grass, small blue and red flowers, darker ground under the trees.
- Gold specks of falling leaves when a gust passes.
- Motion is small. At any moment most clumps are at rest or one pixel away. The eye reads it as a ripple, not as shaking.

## Data per plant

Produced by the art pipeline (art-guide.md) and read from the atlas JSON.

| Field | Meaning |
|---|---|
| `trunk` | Layer that never loops: wood, roots, leftovers |
| `inside` | Dark copy of the canopy, drawn under the clumps so gaps show shadow instead of ground |
| `clumps[]` | One layer per leaf clump, all on the plant's canvas |
| `clump.center` | Clump centre in sprite pixels |
| `clump.weight` | About 0.35 near the canopy centre, rising to 1 at the edge |
| `clump.height` | 0 at the canopy bottom, 1 at the top |
| `profile` | Tuning set: oak, birch, pine, bush |

## The wind field

One module of pure functions of world position `p` and time `t`. No state except the clock.

**Axis.** Wind blows to the right and slightly toward the camera:

    along(p) = p.x + 0.25 * p.y

**Wave phase.** Period T 1.54 s, wavelength L 69 px, so the wave travels at about 45 px per second:

    phase(p, t) = 2 * PI * (t / T - along(p) / L)

Phase depends on world position, not on the plant. That is what carries the wave from one tree to the next.

**Gusts.** A handful of patches on a repeating schedule of roughly 20 s. Each patch has an entry time, a speed, a length, a strength, and an optional horizontal band, so some gusts cross the whole view and others only part of it. Along the wind a patch fades with a Gaussian falloff:

    gust(p, t) = sum over patches of strength * exp(-(d / length)^2) * band(p.y)
    d = along(p) - patchPosition(t)

Our world is endless, so patch positions are measured relative to the camera. Gusts always cross the view.

As built: `d` is measured from the top left corner of the view, and every patch comes round again each schedule period, so `d` wraps every `20 s * speed`. A patch's entry time is the moment its centre crosses that corner. The band is a Gaussian falloff too, not a hard edge, and band positions are given for a view 270 px tall and stretch with the real view, so a tall phone screen gets the same mix of full and partial gusts. The field takes the view as an argument: `gust(x, y, t, view)`. It stays a pure function.

The schedule is Kimo's: a big one (strength 1.25) with a tail across the whole view, and four smaller ones (0.55 to 0.9) on bands. The values are in `src/tuning.js`.

**Breeze.** The same patches, wider and weaker, plus a small base level. It starts the loops before a gust arrives and lets them die out after it. In still air the loops shrink to nothing.

As built: patch length times 2.2, band height times 1.6, the sum times 1.6, capped at 1, plus a base of 0.06. The base is far too small to move a clump. It is there so the air never goes fully silent.

## Posing a plant

Poses update on a **pose clock, 10 times per second**, not every frame. The stepped motion is part of the look.

**1. Loop offset per clump**

    A  = loop size from the local wind: about 1 px in a breeze, 2 to 3 px in a gust, 0 in still air
    ph = phase(plantOrigin + clump.center, t)

    right(ph) = 0.5 + 0.7071 * sin(ph - 3 * PI / 4)
    up(ph)    = 0.5 + 0.7071 * sin(ph - PI / 4)

    a  = A * clump.weight
    dx =  clamp(round(a * right(ph)), 0, round(a))
    dy = -clamp(round(a * up(ph)),    0, round(a))

With a = 1 this steps through (0,0), (0,-1), (1,-1), (1,0): up, right, down, back. The clamp keeps bigger loops inside their size. Inner clumps stay still in a breeze and only join in during a gust, because their weight keeps `a` under half a pixel.

As built: the loop size has two values, as in the article. Sideways `A = 0.9 * breeze + 1.3 * gust`, upward `A = 0.75 * breeze + 0.5 * gust`. So a gust widens the loop to 2 or 3 px sideways while the lift stays at 1 px.

**2. Lean of the whole plant**

Each plant is a damped spring pushed by the gust at its base. It leans with the gust, overshoots a little on the way back, and settles.

    w          = 2 * PI / swing
    target     = push * gust(base, t)
    leanSpeed += (w * w * (target - lean) - 2 * damping * w * leanSpeed) * dt
    lean      += leanSpeed * dt

The spring runs every frame. Its result is applied on the pose clock:

    dx += round(lean * clump.weight * (0.5 + 0.5 * clump.height))

**3. Starting profiles**

| Profile | Behaviour | Trunk |
|---|---|---|
| oak, birch | Anchor values: push about 2 px, swing about 2 s, damping 0.35 | Static |
| pine | Stronger push, slower swing, less damping than the oak | Bends: each row shifts sideways by whole pixels, more toward the top |
| bush | About two thirds of the oak's push, swing about 1 s | None |

In the strongest gust the outer clumps of an oak should end up around 6 px from rest. For a pine, the branch tiers are the clumps: they bob a pixel or two on top of the bend.

As built, with the article's values: oak and birch push 2.2 px, swing 2.2 s, damping 0.35. Pine push 3.6 px, swing 2.8 s, damping 0.22. Bush push 1.4 px, swing 1.0 s, damping 0.35. On a pine a row at height `rise` (0 at the foot, 1 at the highest tier) shifts by `round(lean * rise^2)`, and each tier rides the trunk at its own height. The dark inside layer bends with the trunk.

Measured: a pine tip bends 5.5 px in the big gust, as in the article. An outer oak clump reaches 5 px, not 6, because the lean peaks a moment after the loop does. Raise the oak's push if that looks too tame next to the video.

## Around the trees

- **Falling leaves.** Shed only while a gust is on a tree. About 2 px each, carried along the wind, flipping between flat and edge-on as they fall, then resting on the ground and fading. As built: a gust is "on" a plant above 0.3 and off again below 0.18. Leaves take their colours from the brightest leaf colours of the plant's sprite.
- **Shadows.** Never baked into sprites. A shadow is the plant's current pose, flattened and darkened on the ground, so shadows move with the canopy. As built: light comes from the top left, so a point throws its shadow down and to the right, further the higher it is. Wood and rocks are projected upright. A clump lands as its own shape, squashed to half height, where its centre would land. All shadows go into one buffer first, so overlapping shadows do not darken twice.
- **Ground.** Grass tufts and flowers under a gust shift by one pixel or one shade as it passes. As built: short dashes of open grass go one shade lighter while a gust is over them. Tufts and flowers arrive with their sprites in M3.
- **Sound.** The audio engine reads `gust()` and `breeze()` at the listener and near trees, so what you hear is the wind you see (sound-and-feel.md).

## Rules for the code

- Offsets are integers. Never draw a sprite at a fractional position.
- The field is pure and deterministic: same `p` and `t`, same answer. Tests depend on it.
- Pose only what is on screen. Keep the last pose between clock ticks.
- All tuning values live in one file, grouped by profile.
- A debug overlay, off by default, draws gust patches and wind streaks like the explainer part of the video. As built: G toggles it, and so does `?wind=1` in the link. It also tints every clump that is away from rest.

## Done when

- Next to the video, the forest reads the same: ripples cross a canopy from the windward side, neighbours follow in sequence, gusts are visible as moving patches.
- Paused on any frame, every clump sits on a whole pixel.
- Tests pass: loop sequence at quarter phases, equal phase along lines of equal `along`, wave speed equals L / T, gust schedule repeats.
