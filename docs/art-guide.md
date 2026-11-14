# Art guide

Where the game's art comes from, what every sprite must look like, and how a sprite gets from a generator into the game.

Owner decision: everything that stands in the world is an AI generated sprite, from day one. The reference look is the video in game-brief.md, which was made with SpriteCook.

Owner decision, 13 Nov 2026: our sprites are generated with Sprite AI (https://www.sprite-ai.art). It is not the tool behind the video, so the style anchor was also the test of whether Sprite AI can deliver the look. It passed (Anchor log).

## Who does what

- **Sprites** are generated with Sprite AI, or with any tool that meets the specs below.
  - Route: Sprite AI's REST API, called from the owner's machine. Claude writes each batch as a script (prompt, size, asset type, camera, palette). The owner runs one command. The script saves the exact PNG files and shows a live counter while the server works.
  - Why: a Claude session cannot reach sprite-ai.art from its shell (the workspace network policy refuses the host). The owner's terminal can, and a script records exactly what was asked for.
  - Tried and parked: Sprite AI's MCP server as a custom connector in claude.ai (`https://www.sprite-ai.art/api/mcp`, the key as an `authorization` request header). The connector shows "Couldn't connect to the server" while the same key gets a clean handshake from the owner's terminal, so the fault is between claude.ai and their server. Retry only if running scripts becomes a burden.
  - Fallback: the owner pastes Claude's prompt into the web studio (https://www.sprite-ai.art/studio) and downloads the PNG.
  - The API key never goes into a chat, a commit or a file in the repo. Scripts ask for it when they run.
- **Ground** is drawn by code in colours sampled from the sprites, because an endless world needs ground with no seams. Small ground details (tufts, flowers, mushrooms) are sprites.
- **Interface icons** are SVG, drawn by Claude.
- **Stand-ins.** Until a sprite exists, the game shows a flat grey silhouette of the right size. A stand-in is never styled to look final.
  - As built there are two. The art pipeline draws a grey stand-in for every sprite that has settings in `art/config/` but no PNG in `art/source/` (`tools/standins.py`). These are built from clumps in four flat greys, so the split and the wind can be judged before the art exists. They go through the same pipeline as real sprites and are marked `standin` in the atlas.
  - If the atlas itself is missing a sprite or fails to load, the game draws a one-colour silhouette from the size in the kind.

## Tokens and cost

From Sprite AI's pricing page, terms and API reference, checked on 13 Nov 2026:

- https://www.sprite-ai.art/pricing
- https://www.sprite-ai.art/terms
- https://www.sprite-ai.art/docs/api-reference

Plans:

- The owner is on Creator since 13 Nov 2026: 8 USD a month for 100 tokens, renewing on the 13th. Unused plan tokens are lost at the monthly reset.
- Free plan: 15 generations to try the tool, no commercial license, sprites not private.
- One-time packs: 100 tokens for 10 USD, and pack tokens never expire. The pages do not say that a pack alone carries the commercial license.
- The commercial license covers sprites generated while a paid plan is active, and it stays after cancelling.

Prices:

| Action | Tokens |
|---|---|
| One still sprite, any size | 1 |
| One animation | 14 for 4 to 8 frames, 16 for 10 or 12, 18 for 14, 20 for 16 |
| Eight direction rotation of a still | 12 |
| Restyle | 2 |
| Combine two sprites | 3 |
| Touch-up of a region | 1 |
| Background removal, palettes, import, listings, balance | 0 |

Failed and cancelled jobs are refunded. A prompt refused by the content filter costs nothing.

Rough need for the base, retries included:

| Milestone | Tokens | Where they go |
|---|---|---|
| M1 | 11, spent | 3 oaks, then 2 tries each of pine, birch, bush, rock |
| M2 | 70 to 100 | 3 facings of the wanderer, then 4 animations at 14 each, with room for 2 redos |
| M3 | 40 to 60 | 13 stills, and landmarks take more tries |

Total: about 130 to 170 tokens. That is two months of Creator, or one month plus a pack. Stills are cheap. The wanderer's animations are most of the bill.

Rules for spending:

- Paying is the owner's decision. Claude states the token cost before every batch. The owner running the script is the yes.
- Everything that ships in the game is generated while a paid plan is active.
- Plan tokens reset every month. Generate in bursts, and keep the wanderer's animation work inside one billing month.

## What Sprite AI gives us

From its API reference. Confirmed on 13 Nov 2026: a still costs 1 token, takes 20 to 45 seconds, and comes back as true pixel art at the exact canvas size with hard alpha. A locked palette is obeyed exactly: every colour of all eight batch 02 sprites is in it.

- **API:** base `https://www.sprite-ai.art/api`, header `Authorization: Bearer <key>`. `POST /api/sprites` is synchronous and answers with the sprite id and the PNG. `GET /api/sprites/{id}/download` returns the exact PNG and needs no key. `GET /api/balance` shows the tokens left. 60 requests a minute.
- **Fields for a still:** `prompt` (up to 1500 characters), `width` and `height` (32 to 400, set separately), `asset_type`, `direction`, `camera_perspective`, `palette_id`, `reference_asset_id`, `public`.
- **Asset types:** character, creature, prop, weapon, vehicle, tile, background, ui, effect. Plants, rocks and landmarks are props. The wanderer is a character.
- **Camera:** none, front, side, top_down, three_quarter, isometric. We use `three_quarter`. In test 01, `top_down` gave the same side-on tree, with a grass patch.
- **Palette:** a palette saved in the account (2 to 256 colours, free) is locked onto a sprite with `palette_id`.
- **Reference:** `reference_asset_id` redraws from a sprite we own and keeps its subject and camera angle. Not used across subjects. Use it later for variations such as `oak-02`.
- **Safe retries:** send an `Idempotency-Key` header, one per order. The same key and body within 24 hours returns the first answer and is not charged again. After a 504 `provider_timeout`, poll `GET /api/sprites/{id}` and do not resend.
- **Animation, rotation, restyle:** only from a source of 256 pixels or less per side. Animations are jobs to poll, one at a time per account.

## Look

- **View:** three quarter top-down, the same angle as the video. You see the front of a trunk and the top of a canopy. In practice Sprite AI draws trees mostly side-on with the canopy top showing, as `oak-01` does. Accepted: most top-down pixel games draw trees that way.
- **Light:** from the top left. Tops of clumps are bright, undersides and the right side are dark.
- **Outline:** dark and coloured (deep green, deep brown), not pure black.
- **Palette:** natural and slightly muted. Greens from deep moss to warm yellow green, with gold on the lit side. Browns for wood and earth. Small accents only: flower blue, red, white.
- **Mood:** an old greenwood with a little magic (game-brief.md). Trees look old and heavy. The magic lives in landmarks and small details, not in the trees.
- **Pixels:** true pixel art. One sprite pixel is one game pixel. No blur, no soft edges, no gradients.

## Rules every sprite must pass

1. Transparent background. Nothing behind or under the subject.
2. **No shadow on the ground.** The game draws shadows from the moving pose.
3. No patch of ground or grass. Roots may flare at the base, nothing more. A small tuft of grass at the roots may be removed by the pipeline (`strip_ground`, under Pipeline). A ground tile or a disc of grass means the sprite is generated again.
4. The whole subject is inside the canvas, with a margin of 2 pixels or more.
5. Trees: the canopy is made of clear clumps with bright tops and dark gaps between them. This is what makes the split work.
6. The base of the trunk sits near the bottom centre of the canvas.
7. Same view, light and palette as the style anchor.

## Sizes

In game pixels. The view is about 480 x 270.

| Sprite | Size of the subject | Canvas to ask for |
|---|---|---|
| Broad tree (oak) | about 120 tall, 110 wide | 128 x 128 |
| Tall tree (pine, birch) | about 200 tall, 90 wide | 144 x 256 |
| Bush, fern | about 40 | 64 x 64 |
| Rock, stump, log | 24 to 48 | 64 x 64 |
| Ground detail (tuft, flowers, mushrooms) | 8 to 24 | 32 x 32 |
| Wanderer | about 28 tall | 32 x 32 |
| Landmark | 100 to 200 | 128 x 128 or larger, 400 at most |

Never resize a sprite after generating it. If the size is wrong, generate it again. If the wanderer's face and bow turn to mush at 32, try a 64 canvas and accept a slightly bigger figure.

## Order of work

1. **Style anchor.** Done: `oak-01`, approved by the owner on 13 Nov 2026.
2. **Match everything to the anchor.** One shared palette, saved in the account as `forest-discovery-shared` and locked with `palette_id` on every later sprite, plus the same prompt frame and `three_quarter` camera. The palette is the 24 colours of `oak-01` plus 9 it lacks: two golds for the sunlit side (`#e0c25a`, `#c29a3c`), three bark whites for the birch (`#e9e4d6`, `#c8c2b2`, `#9d978a`), and four stone greys (`#b3b0a6`, `#8c8a84`, `#66666a`, `#474a52`). 33 colours, under the cap of 48.
3. **Small batches.** Three to eight sprites at a time, through the pipeline, looked at in the game, then the next batch.

## Anchor log

| Batch | Date | What | Result |
|---|---|---|---|
| Test 01 | 13 Nov 2026 | 3 oaks at 128 x 128: two with `three_quarter`, one with `top_down`. 3 tokens | Oak 1 approved by the owner as the anchor `oak-01` (Sprite AI id `8c26683d-c866-446f-a693-7ab25c029640`): hard alpha, no ground, 24 colours, coloured outline, light from the top left, 18 clumps in the pipeline. Weak points: pale yellow green where the gold should be, a mostly side-on view. Oaks 2 and 3 rejected: grass patch under the roots, and oak 3's greens too saturated |
| Batch 02 | 13 Nov 2026 | `pine-01`, `birch-01`, `bush-01`, `rock-01`, 2 tries each, shared palette, 8 tokens | Kept: pine try b, birch try a, bush try b, rock try b. Rejected: pine a (disc of grass, soft blobby tiers), birch b (isometric grass tile), bush a (glaring highlights, grass), rock a (pile of stones, lime moss). Kept pine and birch had a tuft of grass at the roots, removed by `strip_ground`. The birch's canopy reads loud yellow next to the oaks: first candidate for a redo |

## What to generate, by milestone

| Milestone | Sprites |
|---|---|
| M1 Living forest | `oak-01` (the anchor), `pine-01`, `birch-01`, `bush-01`, `rock-01`: all in |
| M2 The wanderer | `wanderer`: idle, walk down, walk up, walk right. Left is the mirror of right |
| M3 Endless forest | `oak-02`, `pine-02`, `fern-01`, `stump-01`, `log-01`, `tuft-01`, `flowers-01`, `mushrooms-01`, then landmarks: `stone-circle`, `ancient-oak`, `ruined-arch`, `spring`, `outlaw-camp` |

In Sprite AI an animation starts from a still. The wanderer needs three stills first (facing the camera, facing away, facing right), all on the shared palette, then the Idle and Walk presets at 8 frames.

## Prompt pattern

A starting point. Adjust the words, keep the constraints.

    Pixel art [SUBJECT] for a top-down forest game, three quarter view from above.
    Old growth, [DETAILS]. Lit from the top left.
    Leafy plants: canopy built from distinct rounded leaf clumps, bright on top, dark gaps between clumps.
    Pines instead: branches built from distinct drooping tiers, bright on top, dark gaps between tiers.
    Dark coloured outline. Natural, slightly muted palette.
    Transparent background, no ground, no grass, no cast shadow, whole subject in frame.

"No grass" was added after test 01. It helps but does not stop grass: four of eight batch 02 sprites still came with some.

| Sprite | SUBJECT | DETAILS |
|---|---|---|
| `oak-01` | ancient oak tree | thick twisted trunk, wide heavy canopy, a touch of gold on the sunlit side |
| `pine-01` | tall pine tree | straight trunk, about eight drooping tiers of dark needles |
| `birch-01` | tall birch tree | slim white trunk with dark marks, light airy yellow green canopy, a touch of gold on the sunlit side |
| `bush-01` | round forest bush | dense small leaves, no trunk visible |
| `rock-01` | mossy boulder | grey stone, moss on top |
| `wanderer` | small hooded outlaw | green hood and cloak, brown tunic, bow on the back, face in shadow |

Fields that go with every prompt: `asset_type` (prop or character), the exact `width` and `height` from the sizes table, `camera_perspective: three_quarter`, and the shared `palette_id`.

## Handing sprites over

The generation script saves PNGs on the owner's machine, straight from the API.

- Candidates to judge: attach the PNG files to the chat. Files, not screenshots. Claude checks that the byte sizes match the owner's listing.
- Accepted sprites: into `art/source/` under the names below, as generated.
- Names: `kind-number.png`, such as `oak-01.png`, `pine-01.png`. For animations, the sprite sheet: `wanderer-walk-down.png`.
- From the web studio instead: download as PNG at the original size. No JPEG, no resizing.

## Pipeline

Dev tools in `tools/`, written in Python (numpy, scipy, scikit-image, Pillow). They run in the Claude session or on the owner's machine. The game itself never needs Python.

1. **Normalize.** Check that the sprite is real pixel art. If it was exported enlarged, bring it back to one pixel per pixel. Make alpha fully on or fully off. Trim to the content plus a margin. Reject it if it breaks a rule above.
2. **Split** (plants only). Find the wood by colour. Every other opaque pixel above the root line is leaf. Smooth the brightness, take the bright peaks as clump seeds, and grow the clumps with a watershed that stops at the dark lines. Small fragments go back to the trunk layer. Dark outline pixels follow the nearest clump. Output: `trunk`, `inside` (the clump area, shrunk and darkened), one layer per clump, and for each clump its centre, weight and height.
3. **Pack.** Reduce to the shared palette, pack the layers into atlases, write the atlas JSON, report the sizes. The shared palette is taken from the accepted sprites and capped at about 48 colours.
4. **Contact sheet.** One preview image per plant: the original next to a copy with every clump in a different flat colour. Claude looks at every sheet before a sprite is accepted.

Per-sprite settings live in `art/config/`: minimum distance between clump seeds, minimum clump size, how much of the height counts as trunk, and the wind profile. Bushes have no trunk and use smaller clumps. Pines are split into branch tiers.

As built:

- Run it with `python3 tools/art_pipeline.py`. It rebuilds `assets/atlas.png`, `assets/atlas.json` and one contact sheet per plant in `art/sheets/`. A sprite that breaks a rule stops the run with the reason.
- One file per sprite in `art/config/`, named like the sprite: `oak-01.json`. Keys: `profile` (oak, birch, pine, bush), `split` (`clumps` or `tiers`), `min_dist`, `min_size`, `trunk_part`, `leaf_cut`, `tiers` for a pine, `strip_ground` and `despeck`. A file with no `split` is a thing the wind does not move, such as a rock.
- `strip_ground: N` removes the green pixels in the lowest N rows, counted up from the lowest root, and any loose fragment under 12 pixels left in that band. Only pixels are removed, nothing is drawn, and the PNG in `art/source/` stays as generated.
- `despeck: N` repaints groups of pale pixels (the pale bark test) no bigger than N with the commonest colour of their solid neighbours. Generated sprites sometimes carry stray white or grey pixels: on every copy of a tree they read as a glitch, and the split files them as bark, so they stay behind when the leaves move. Opt in per sprite, never on a birch. In use: `oak-01` (5 pixels at the trunk fork) and `pine-01` (13 pixels in the needles), with N = 6. The PNG in `art/source/` stays as generated.
- `leaf_cut` also works for a pine: below that share of the height there is only trunk, whatever its colour.
- To bring in a real sprite: put `oak-01.png` in `art/source/`, run the pipeline, look at `art/sheets/oak-01.png`. Nothing else changes. The stand-in for that sprite is gone from the atlas.
- Wood is found by colour: hue 335 to 360 and 0 to 40 degrees, saturation above 0.22, brightness under 125. The article's range starts at 5 degrees. Ours starts lower because our dark bark is a purple brown (`#5d3639`, `#492832`). Pale bark is saturation under 0.16 and brightness over 95.
- A pine's tiers are found from the rows where the needles are suddenly narrower. Each cut then follows the dark underside of the skirt above it, column by column, so a tier keeps its drooping edge.
- The atlas is saved with a colour table. The five M1 sprites take 23 KB.
- The shared palette is written into the atlas JSON. The game moves each ground colour to the nearest palette colour when it loads (`src/render/palette.js`).

A good split: 10 to 20 clumps on an oak, each one a shape a person would also circle, no clump made of trunk, no stray pixels. As split on 13 Nov 2026: oak 18 clumps, birch 22, bush 11, pine 8 tiers. A few leaf patches low on the birch's right side stay in the trunk layer and do not move. Tuning, not a blocker.

The split method is from Kimo's article (wind-system.md, "Credit and sources"). Read it before writing the tool.
