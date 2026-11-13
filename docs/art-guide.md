# Art guide

Where the game's art comes from, what every sprite must look like, and how a sprite gets from a generator into the game.

Owner decision: everything that stands in the world is an AI generated sprite, from day one. The reference look is the video in game-brief.md, which was made with SpriteCook.

## Who does what

- **Sprites** are generated with SpriteCook, or with any tool that meets the specs below.
  - If SpriteCook tools are available in the session, Claude generates the sprites itself, following this guide, and asks before spending credits.
  - If not, Claude writes the exact order (which sprite, size, prompt) and the owner generates and uploads.
- **Ground** is drawn by code in colours sampled from the sprites, because an endless world needs ground with no seams. Small ground details (tufts, flowers, mushrooms) are sprites.
- **Interface icons** are SVG, drawn by Claude.
- **Stand-ins.** Until a sprite exists, the game shows a flat grey silhouette of the right size. A stand-in is never styled to look final.

## Credits and cost

From SpriteCook's pricing page, checked on 13 Nov 2026 (https://www.spritecook.ai/pricing):

- Free plan: 40 credits every 30 days.
- One image costs 8 to 12 credits. One animation costs 20 to 26.
- Starter plan: 12 USD a month for 1,000 credits.
- Commercial use is included on every plan.

Rough need for the whole base, retries included: 400 to 700 credits. The free plan is enough for the style anchor and a first look. Paying is the owner's decision. Claude states the credit cost before every batch and waits for a yes.

## Look

- **View:** three quarter top-down, the same angle as the video. You see the front of a trunk and the top of a canopy.
- **Light:** from the top left. Tops of clumps are bright, undersides and the right side are dark.
- **Outline:** dark and coloured (deep green, deep brown), not pure black.
- **Palette:** natural and slightly muted. Greens from deep moss to warm yellow green, with gold on the lit side. Browns for wood and earth. Small accents only: flower blue, red, white.
- **Mood:** an old greenwood with a little magic (game-brief.md). Trees look old and heavy. The magic lives in landmarks and small details, not in the trees.
- **Pixels:** true pixel art. One sprite pixel is one game pixel. No blur, no soft edges, no gradients.

## Rules every sprite must pass

1. Transparent background. Nothing behind or under the subject.
2. **No shadow on the ground.** The game draws shadows from the moving pose.
3. No patch of ground. Roots may flare at the base, nothing more.
4. The whole subject is inside the canvas, with a margin of 2 pixels or more.
5. Trees: the canopy is made of clear clumps with bright tops and dark gaps between them. This is what makes the split work.
6. The base of the trunk sits near the bottom centre of the canvas.
7. Same view, light and palette as the style anchor.

## Sizes

In game pixels. The view is about 480 x 270.

| Sprite | Size of the subject | Canvas to ask for |
|---|---|---|
| Broad tree (oak) | about 120 tall, 110 wide | 128, square |
| Tall tree (pine, birch) | about 200 tall, 90 wide | tall 9:16 shape, 200 to 260 high |
| Bush, fern | about 40 | 64, square |
| Rock, stump, log | 24 to 48 | 64, square |
| Ground detail (tuft, flowers, mushrooms) | 8 to 24 | 32, square |
| Wanderer | about 28 tall | 32, square |
| Landmark | 100 to 200 | 128 or larger |

Never resize a sprite after generating it. If the size is wrong, generate it again. If the wanderer's face and bow turn to mush at 32, try a 64 canvas and accept a slightly bigger figure.

## Order of work

1. **Style anchor.** Generate one oak. Iterate until it is right. The owner approves it. Nothing else is generated before that.
2. **Match everything to the anchor.** Every later sprite uses the anchor as its style reference. In SpriteCook that is a reference image or a saved preset.
3. **Small batches.** Three to six sprites at a time, through the pipeline, looked at in the game, then the next batch.

## What to generate, by milestone

| Milestone | Sprites |
|---|---|
| M1 Living forest | `oak-01` (the anchor), `pine-01`, `birch-01`, `bush-01`, `rock-01` |
| M2 The wanderer | `wanderer`: idle, walk down, walk up, walk right. Left is the mirror of right |
| M3 Endless forest | `oak-02`, `pine-02`, `fern-01`, `stump-01`, `log-01`, `tuft-01`, `flowers-01`, `mushrooms-01`, then landmarks: `stone-circle`, `ancient-oak`, `ruined-arch`, `spring`, `outlaw-camp` |

## Prompt pattern

A starting point. Adjust the words, keep the constraints.

    Pixel art [SUBJECT] for a top-down forest game, three quarter view from above.
    Old growth, [DETAILS]. Lit from the top left.
    Trees only: canopy built from distinct rounded leaf clumps, bright on top, dark gaps between clumps.
    Dark coloured outline. Natural, slightly muted palette.
    Transparent background, no ground, no cast shadow, whole subject in frame.

| Sprite | SUBJECT | DETAILS |
|---|---|---|
| `oak-01` | ancient oak tree | thick twisted trunk, wide heavy canopy, a touch of gold on the sunlit side |
| `pine-01` | tall pine tree | straight trunk, about eight drooping tiers of dark needles |
| `birch-01` | tall birch tree | slim white trunk with dark marks, light airy yellow green canopy |
| `bush-01` | round forest bush | dense small leaves, no trunk visible |
| `rock-01` | mossy boulder | grey stone, moss on top |
| `wanderer` | small hooded outlaw | green hood and cloak, brown tunic, bow on the back, face in shadow |

## Handing sprites over

When the owner generates them:

- Download as PNG at the original size. No screenshots, no JPEG, no resizing.
- Name them `kind-number.png`: `oak-01.png`, `pine-01.png`. For animations, the sprite sheet: `wanderer-walk-down.png`.
- Upload to `art/source/` in the repo (on GitHub: Add file, then Upload files), or attach them to the chat as a .zip so the pixels arrive untouched.

## Pipeline

Dev tools in `tools/`, written in Python (numpy, scipy, scikit-image, Pillow). They run in the Claude session or on the owner's machine. The game itself never needs Python.

1. **Normalize.** Check that the sprite is real pixel art. If it was exported enlarged, bring it back to one pixel per pixel. Make alpha fully on or fully off. Trim to the content plus a margin. Reject it if it breaks a rule above.
2. **Split** (plants only). Find the wood by colour. Every other opaque pixel above the root line is leaf. Smooth the brightness, take the bright peaks as clump seeds, and grow the clumps with a watershed that stops at the dark lines. Small fragments go back to the trunk layer. Dark outline pixels follow the nearest clump. Output: `trunk`, `inside` (the clump area, shrunk and darkened), one layer per clump, and for each clump its centre, weight and height.
3. **Pack.** Reduce to the shared palette, pack the layers into atlases, write the atlas JSON, report the sizes. The shared palette is taken from the accepted sprites, starting with the anchor, and capped at about 48 colours.
4. **Contact sheet.** One preview image per plant: the original next to a copy with every clump in a different flat colour. Claude looks at every sheet before a sprite is accepted.

Per-sprite settings live in `art/config/`: minimum distance between clump seeds, minimum clump size, how much of the height counts as trunk, and the wind profile. Bushes have no trunk and use smaller clumps. Pines are split into branch tiers.

A good split: 10 to 20 clumps on an oak, each one a shape a person would also circle, no clump made of trunk, no stray pixels.

The split method is from Kimo's article (wind-system.md, "Credit and sources"). Read it before writing the tool.
