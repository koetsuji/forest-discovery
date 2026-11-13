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

**Wave phase.** Period T about 1.5 s, wavelength L about 70 px, so the wave travels at about 47 px per second:

    phase(p, t) = 2 * PI * (t / T - along(p) / L)

Phase depends on world position, not on the plant. That is what carries the wave from one tree to the next.

**Gusts.** A handful of patches on a repeating schedule of roughly 20 s. Each patch has an entry time, a speed, a length, a strength, and an optional horizontal band, so some gusts cross the whole view and others only part of it. Along the wind a patch fades with a Gaussian falloff:

    gust(p, t) = sum over patches of strength * exp(-(d / length)^2) * band(p.y)
    d = along(p) - patchPosition(t)

Our world is endless, so patch positions are measured relative to the camera. Gusts always cross the view.

**Breeze.** The same patches, wider and weaker, plus a small base level. It starts the loops before a gust arrives and lets them die out after it. In still air the loops shrink to nothing.

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

## Around the trees

- **Falling leaves.** Shed only while a gust is on a tree. About 2 px each, carried along the wind, flipping between flat and edge-on as they fall, then resting on the ground and fading.
- **Shadows.** Never baked into sprites. A shadow is the plant's current pose, flattened and darkened on the ground, so shadows move with the canopy.
- **Ground.** Grass tufts and flowers under a gust shift by one pixel or one shade as it passes.
- **Sound.** The audio engine reads `gust()` and `breeze()` at the listener and near trees, so what you hear is the wind you see (sound-and-feel.md).

## Rules for the code

- Offsets are integers. Never draw a sprite at a fractional position.
- The field is pure and deterministic: same `p` and `t`, same answer. Tests depend on it.
- Pose only what is on screen. Keep the last pose between clock ticks.
- All tuning values live in one file, grouped by profile.
- A debug overlay, off by default, draws gust patches and wind streaks like the explainer part of the video.

## Done when

- Next to the video, the forest reads the same: ripples cross a canopy from the windward side, neighbours follow in sequence, gusts are visible as moving patches.
- Paused on any frame, every clump sits on a whole pixel.
- Tests pass: loop sequence at quarter phases, equal phase along lines of equal `along`, wave speed equals L / T, gust schedule repeats.
