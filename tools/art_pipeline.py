#!/usr/bin/env python3
"""The art pipeline: from art/source/ and art/config/ to assets/.

  1. Normalize  check that a sprite is real pixel art and trim it
  2. Split      cut a plant into trunk, inside and leaf clumps
  3. Pack       put every layer into one atlas and write its JSON
  4. Sheets     one contact sheet per plant in art/sheets/, to be looked at

A sprite listed in art/config/ with no PNG in art/source/ gets a grey
stand-in from tools/standins.py, and is marked as one in the atlas.

The split is the method from Kimo's article (docs/wind-system.md, "Credit and
sources"), written again here: wood by colour, clump seeds on the bright
peaks of the smoothed brightness, a watershed that stops at the dark lines.

Usage: python3 tools/art_pipeline.py
Needs: numpy, scipy, scikit-image, Pillow.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.color import rgb2hsv
from skimage.feature import peak_local_max
from skimage.segmentation import watershed

sys.path.insert(0, str(Path(__file__).parent))
import standins  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "art" / "source"
CONFIG = ROOT / "art" / "config"
SHEETS = ROOT / "art" / "sheets"
ASSETS = ROOT / "assets"

MARGIN = 2
PALETTE_CAP = 48
INSIDE_ERODE = 2
INSIDE_BRIGHTNESS = 0.55
INNER_WEIGHT = 0.35


class Rejected(Exception):
    """A sprite that breaks a rule in docs/art-guide.md."""


def luminance(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


# ---------------------------------------------------------------- 1. normalize


def undo_enlargement(rgba):
    """If the sprite was exported enlarged, bring it back to one pixel per pixel."""
    h, w = rgba.shape[:2]
    for k in range(8, 1, -1):
        if h % k or w % k:
            continue
        blocks = rgba.reshape(h // k, k, w // k, k, 4)
        if (blocks == blocks[:, :1, :, :1, :]).all():
            return rgba[::k, ::k].copy(), k
    return rgba, 1


def strip_ground(rgba, rows, notes):
    """Erase grass under a sprite: green pixels in its lowest rows.

    Rule 3 in docs/art-guide.md allows no ground patch. Some generated trees
    come with a tuft of grass at the roots. Only pixels are removed, nothing is
    drawn, and the source PNG stays exactly as generated.
    """
    solid = rgba[..., 3] >= 128
    rgb = rgba[..., :3].astype(int)
    green = solid & (rgb[..., 1] > rgb[..., 0]) & (rgb[..., 1] > rgb[..., 2])
    # Count the rows up from the lowest root, not from grass hanging below it.
    bottom = np.where(solid & ~green)[0].max()
    band = np.arange(rgba.shape[0])[:, None] > bottom - rows
    cut = green & band
    # Petals and blades left loose in the band once the grass is gone.
    rest = solid & ~cut
    labels, count = ndimage.label(rest, structure=np.ones((3, 3)))
    if count > 1:
        sizes = ndimage.sum(rest, labels, index=range(1, count + 1))
        main = 1 + int(np.argmax(sizes))
        loose = rest & (labels != main) & band & (sizes[labels - 1] < 12)
        cut |= loose
    if cut.any():
        rgba = rgba.copy()
        rgba[cut] = 0
        notes.append(f"{int(cut.sum())} grass pixels removed from the lowest {rows} rows")
    return rgba


def despeck(rgba, max_size, notes):
    """Repaint tiny pale specks with the colour around them.

    Some generated sprites carry a few stray white pixels, a glint in a dark
    fork or on a needle. In the game they read as a glitch on every copy of
    the tree, and the split files them as pale bark, so they stay behind when
    the leaves move. A speck is a group of pale pixels (the pale bark test)
    no bigger than max_size. Each one takes the commonest colour of its solid
    neighbours. Opt in per sprite: a birch is made of pale pixels.
    """
    solid = rgba[..., 3] >= 128
    rgb = rgba[..., :3].astype(float)
    hsv = rgb2hsv(rgb / 255)
    pale = solid & (hsv[..., 1] < 0.16) & (luminance(rgb) > 95)
    labels, count = ndimage.label(pale, structure=np.ones((3, 3)))
    if count == 0:
        return rgba
    sizes = np.concatenate([[0], ndimage.sum(pale, labels, index=range(1, count + 1))])
    specks = (labels > 0) & (sizes[labels] <= max_size)
    if not specks.any():
        return rgba
    out = rgba.copy()
    h, w = solid.shape
    for y, x in zip(*np.where(specks)):
        for reach in (1, 2, 3):
            y0, y1, x0, x1 = max(0, y - reach), min(h, y + reach + 1), max(0, x - reach), min(w, x + reach + 1)
            around = (solid & ~specks)[y0:y1, x0:x1]
            if around.any():
                colours, counts = np.unique(rgba[y0:y1, x0:x1][around], axis=0, return_counts=True)
                out[y, x] = colours[np.argmax(counts)]
                break
    notes.append(f"{int(specks.sum())} pixels of pale specks repainted")
    return out


def normalize(name, rgba, notes, cfg=None):
    rgba, factor = undo_enlargement(rgba)
    if cfg and cfg.get("strip_ground"):
        rgba = strip_ground(rgba, cfg["strip_ground"], notes)
    if cfg and cfg.get("despeck"):
        rgba = despeck(rgba, cfg["despeck"], notes)
    if factor > 1:
        notes.append(f"was enlarged {factor}x, brought back to {rgba.shape[1]} x {rgba.shape[0]}")
    alpha = rgba[..., 3]
    soft = ((alpha > 8) & (alpha < 247)).sum()
    solid = alpha >= 128
    if solid.mean() > 0.95:
        raise Rejected(f"{name}: no transparent background")
    if not solid.any():
        raise Rejected(f"{name}: empty")
    if soft > 0.02 * solid.sum():
        notes.append(f"{soft} soft edge pixels were made hard. Real pixel art has none")
    rgba = rgba.copy()
    rgba[..., 3] = np.where(solid, 255, 0)
    rgba[~solid, :3] = 0
    colours = len(np.unique(rgba[solid][:, :3], axis=0))
    if colours > 256:
        raise Rejected(f"{name}: {colours} colours. That is a painting, not pixel art")
    if colours > 64:
        notes.append(f"{colours} colours. Pixel art of this size usually has under 40")
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    h, w = solid.shape
    if min(y0, x0, h - 1 - y1, w - 1 - x1) < MARGIN:
        raise Rejected(f"{name}: the subject touches the edge of the canvas. It needs a margin of {MARGIN} px")
    # Trim to the content plus the margin.
    out = np.zeros((y1 - y0 + 1 + 2 * MARGIN, x1 - x0 + 1 + 2 * MARGIN, 4), np.uint8)
    out[MARGIN:-MARGIN, MARGIN:-MARGIN] = rgba[y0 : y1 + 1, x0 : x1 + 1]
    return out


def find_foot(solid):
    """Where the thing stands: the middle of its lowest rows."""
    ys, xs = np.where(solid)
    bottom = ys.max()
    low = xs[ys >= bottom - 2]
    return int(round((low.min() + low.max()) / 2)), int(bottom)


# -------------------------------------------------------------------- 2. split


def wood_masks(rgba, wood_colours):
    solid = rgba[..., 3] > 0
    rgb = rgba[..., :3].astype(float)
    if wood_colours is not None:
        wood = np.zeros(solid.shape, bool)
        for colour in wood_colours:
            wood |= (rgba[..., :3] == np.array(colour, np.uint8)).all(axis=-1)
        return solid & wood, np.zeros(solid.shape, bool)
    hsv = rgb2hsv(rgb / 255)
    hue = hsv[..., 0] * 360
    lum = luminance(rgb)
    # Browns from red to orange, and the purple browns of dark bark (hue 335 and up).
    wood = solid & ((hue >= 335) | (hue <= 40)) & (hsv[..., 1] > 0.22) & (lum < 125)
    bark = solid & (hsv[..., 1] < 0.16) & (lum > 95)
    return wood, bark


def smooth_brightness(rgba, mask, sigma=1.6):
    """Brightness blurred inside a mask, without the outside darkening the edge."""
    lum = luminance(rgba[..., :3].astype(float)) * mask
    weight = ndimage.gaussian_filter(mask.astype(float), sigma)
    return np.where(mask, ndimage.gaussian_filter(lum, sigma) / np.maximum(weight, 1e-6), 0)


def split_clumps(rgba, cfg, wood_colours, foot):
    solid = rgba[..., 3] > 0
    ys = np.where(solid)[0]
    top, bottom = ys.min(), ys.max()
    height = bottom - top + 1
    wood, bark = wood_masks(rgba, wood_colours)
    # Leaves are everything that is not wood, above the root line.
    leaf_line = top + cfg.get("leaf_cut", 0.78) * height
    rows = np.arange(solid.shape[0])[:, None]
    leaf = solid & ~wood & ~bark & (rows < leaf_line)

    smooth = smooth_brightness(rgba, leaf)
    peaks = peak_local_max(smooth, min_distance=cfg.get("min_dist", 5), labels=leaf.astype(int), exclude_border=False)
    markers = np.zeros(solid.shape, int)
    for i, (y, x) in enumerate(peaks, start=1):
        markers[y, x] = i
    labels = watershed(-smooth, markers, mask=leaf)

    # Small fragments, and anything centred down on the trunk, go back to the trunk layer.
    trunk_line = foot[1] - cfg.get("trunk_part", 0.4) * height
    min_size = cfg.get("min_size", 25)
    for i in range(1, labels.max() + 1):
        area = labels == i
        size = area.sum()
        if size == 0:
            continue
        if size < min_size or np.where(area)[0].mean() > trunk_line:
            labels[area] = 0

    # Dark outline pixels that the wood test caught follow the nearest clump,
    # or the outline would stay behind when the clump moves.
    if labels.any():
        to_edge = ndimage.distance_transform_edt(solid)
        to_clump, nearest = ndimage.distance_transform_edt(labels == 0, return_indices=True)
        core = (wood | bark) & (to_edge > 2)
        near_core = ndimage.binary_dilation(core, iterations=1)
        stray = wood & (labels == 0) & (to_edge <= 2) & (to_clump <= 2) & ~near_core
        labels[stray] = labels[nearest[0][stray], nearest[1][stray]]
    return labels


def split_tiers(rgba, cfg, wood_colours):
    """A pine is cut into branch tiers: the rows where it is narrowest are the gaps."""
    solid = rgba[..., 3] > 0
    wood, bark = wood_masks(rgba, wood_colours)
    needles = solid & ~wood & ~bark
    # Below the lowest skirt there is only trunk, whatever its colour.
    ys = np.where(solid)[0]
    leaf_line = ys.min() + cfg.get("leaf_cut", 1) * (ys.max() - ys.min() + 1)
    needles &= np.arange(solid.shape[0])[:, None] < leaf_line
    widths = needles.sum(axis=1).astype(float)
    rows = np.where(widths > 0)[0]
    top, bottom = rows.min(), rows.max()
    want = cfg.get("tiers", 8)
    # A tier ends where the next row down is suddenly much narrower.
    drops = [(widths[y - 1] - widths[y], y) for y in range(top + 4, bottom - 3) if widths[y] < widths[y - 1]]
    drops.sort(reverse=True)
    cuts = []
    for drop, y in drops:
        if len(cuts) == want - 1 or drop < 0.15 * widths.max():
            break
        if all(abs(y - c) >= 8 for c in cuts):
            cuts.append(y)
    cuts.sort()
    if len(cuts) < want - 1:
        # No clear gaps: fall back to even slices.
        cuts = [int(round(top + (bottom - top) * i / want)) for i in range(1, want)]
    # A straight cut would slice through the tier below. In every column the
    # real edge is the dark underside of the skirt just above the cut.
    lum = np.where(needles, luminance(rgba[..., :3].astype(float)), 999.0)
    labels = np.where(needles, 1, 0)
    above = top
    for cut in cuts:
        # Look up from the cut, but never past the middle of this tier.
        start = cut - min(14, int(0.55 * (cut - above)))
        above = cut
        edge = np.full(solid.shape[1], cut)
        for x in range(solid.shape[1]):
            window = lum[start : cut + 3, x]
            if window.min() < 999:
                darkest = np.where(window == window.min())[0].max()
                edge[x] = start + darkest + 1
        edge = ndimage.median_filter(edge, size=5, mode="nearest")
        labels += (needles & (np.arange(solid.shape[0])[:, None] >= edge[None, :])).astype(int)
    return labels


def clump_data(labels, foot, order):
    """Centre, weight and height for every clump, in drawing order."""
    ids = [i for i in range(1, labels.max() + 1) if (labels == i).any()]
    centres = {}
    for i in ids:
        ys, xs = np.where(labels == i)
        centres[i] = (float(xs.mean()), float(ys.mean()))
    if not ids:
        return []
    cx = np.array([centres[i][0] for i in ids])
    cy = np.array([centres[i][1] for i in ids])
    mid_x, mid_y = (cx.min() + cx.max()) / 2, (cy.min() + cy.max()) / 2
    half_x, half_y = max(1.0, (cx.max() - cx.min()) / 2), max(1.0, (cy.max() - cy.min()) / 2)
    span_y = max(1.0, cy.max() - cy.min())
    out = []
    for i in ids:
        x, y = centres[i]
        # 0.35 at the middle of the canopy, 1 at its edge: outer clumps move most.
        far = min(1.0, float(np.hypot((x - mid_x) / half_x, (y - mid_y) / half_y)))
        out.append(
            {
                "id": i,
                "centre": (round(x, 1), round(y, 1)),
                "weight": round(INNER_WEIGHT + (1 - INNER_WEIGHT) * far, 2),
                "height": round(float((cy.max() - y) / span_y), 2),
            }
        )
    # Clumps lower on the canopy are in front. Pine tiers overlap from below.
    out.sort(key=lambda c: c["centre"][1], reverse=(order == "bottom-first"))
    return out


def make_inside(rgba, labels):
    """The clump area, shrunk and darkened. Drawn under the clumps so gaps show shade."""
    area = ndimage.binary_erosion(labels > 0, iterations=INSIDE_ERODE)
    inside = np.zeros_like(rgba)
    inside[area, :3] = (rgba[area, :3] * INSIDE_BRIGHTNESS).astype(np.uint8)
    inside[area, 3] = 255
    return inside


def leaf_colours(rgba, labels):
    """The brightest common leaf colours. Falling leaves are drawn in these."""
    pixels = rgba[labels > 0][:, :3]
    if len(pixels) == 0:
        return []
    colours, counts = np.unique(pixels, axis=0, return_counts=True)
    common = colours[counts >= 0.03 * len(pixels)]
    ranked = sorted(common.tolist(), key=lambda c: -luminance(np.array(c, float)))
    return ["#%02x%02x%02x" % tuple(c) for c in ranked[:3]]


# --------------------------------------------------------------------- 3. pack


def trimmed(layer):
    """Cuts a layer down to its pixels. Returns (image, offset) or None if empty."""
    ys, xs = np.where(layer[..., 3] > 0)
    if len(ys) == 0:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    return layer[y0 : y1 + 1, x0 : x1 + 1], (int(x0), int(y0))


def pack(pieces):
    """Shelf packing. pieces: list of dicts with an "image". Adds "rect" to each."""
    order = sorted(range(len(pieces)), key=lambda i: -pieces[i]["image"].shape[0])
    area = sum((p["image"].shape[0] + 1) * (p["image"].shape[1] + 1) for p in pieces)
    width = 64
    while width * width < area * 1.2 or width < max(p["image"].shape[1] for p in pieces) + 1:
        width *= 2
    while True:
        x = y = shelf = 0
        ok = True
        for i in order:
            h, w = pieces[i]["image"].shape[:2]
            if x + w > width:
                x, y, shelf = 0, y + shelf + 1, 0
            if y + h > width:
                ok = False
                break
            pieces[i]["rect"] = (x, y, w, h)
            x += w + 1
            shelf = max(shelf, h)
        if ok:
            break
        width *= 2
    height = max(p["rect"][1] + p["rect"][3] for p in pieces)
    atlas = np.zeros((height, width, 4), np.uint8)
    for p in pieces:
        x, y, w, h = p["rect"]
        atlas[y : y + h, x : x + w] = p["image"]
    return atlas


def shared_palette(accepted):
    """Up to 48 colours taken from the accepted sprites, the anchor first."""
    if not accepted:
        return None
    pixels = np.concatenate([rgba[rgba[..., 3] > 0][:, :3] for rgba in accepted])
    colours = np.unique(pixels, axis=0)
    if len(colours) <= PALETTE_CAP:
        return colours
    strip = Image.fromarray(pixels.reshape(1, -1, 3), "RGB")
    reduced = strip.quantize(PALETTE_CAP, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return np.array(reduced.getpalette()[: PALETTE_CAP * 3], np.uint8).reshape(-1, 3)


def to_palette(rgba, palette):
    if palette is None:
        return rgba
    solid = rgba[..., 3] > 0
    pixels = rgba[solid][:, :3].astype(int)
    nearest = ((pixels[:, None, :] - palette[None, :, :].astype(int)) ** 2).sum(axis=2).argmin(axis=1)
    out = rgba.copy()
    out[solid, :3] = palette[nearest]
    return out


def save_indexed(atlas, path):
    """PNG with a colour table: far smaller than full colour for pixel art."""
    colours = np.unique(atlas[atlas[..., 3] > 0][:, :3], axis=0)
    if len(colours) > 255:
        Image.fromarray(atlas, "RGBA").save(path, optimize=True)
        return
    table = {tuple(c): i + 1 for i, c in enumerate(colours.tolist())}
    index = np.zeros(atlas.shape[:2], np.uint8)
    solid = atlas[..., 3] > 0
    index[solid] = [table[tuple(c)] for c in atlas[solid][:, :3].tolist()]
    image = Image.fromarray(index, "P")
    image.putpalette([0, 0, 0] + [v for c in colours.tolist() for v in c])
    image.save(path, optimize=True, transparency=0)


# ------------------------------------------------------------------- 4. sheets

SHEET_COLOURS = [
    (230, 25, 75), (60, 180, 75), (255, 225, 25), (0, 130, 200), (245, 130, 48), (145, 30, 180),
    (70, 240, 240), (240, 50, 230), (210, 245, 60), (250, 190, 212), (0, 128, 128), (220, 190, 255),
    (170, 110, 40), (255, 250, 200), (128, 0, 0), (170, 255, 195), (128, 128, 0), (255, 215, 180),
    (0, 0, 128), (128, 128, 128),
]


def contact_sheet(name, rgba, labels, clumps, path):
    """The original next to a copy with every clump in its own flat colour."""
    scale = 3
    h, w = rgba.shape[:2]
    left = Image.new("RGBA", (w, h), (38, 44, 40, 255))
    left.alpha_composite(Image.fromarray(rgba, "RGBA"))
    right = np.zeros((h, w, 3), np.uint8) + np.array((38, 44, 40), np.uint8)
    right[(rgba[..., 3] > 0) & (labels == 0)] = (88, 88, 88)
    for n, c in enumerate(clumps):
        right[labels == c["id"]] = SHEET_COLOURS[n % len(SHEET_COLOURS)]
    sheet = Image.new("RGB", (w * 2 + 4, h), (20, 20, 20))
    sheet.paste(left.convert("RGB"), (0, 0))
    sheet.paste(Image.fromarray(right, "RGB"), (w + 4, 0))
    sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    draw = ImageDraw.Draw(sheet)
    for c in clumps:
        x, y = (w + 4 + c["centre"][0]) * scale, c["centre"][1] * scale
        draw.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(0, 0, 0))
    draw.text((4, 2), f"{name}: {len(clumps)} clumps", fill=(255, 255, 255))
    sheet.save(path)


# ------------------------------------------------------------------------ main


def build():
    SHEETS.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    configs = {p.stem: json.loads(p.read_text()) for p in sorted(CONFIG.glob("*.json"))}
    if not configs:
        raise SystemExit("art/config/ has no sprite settings")

    sprites = {}
    for name, cfg in configs.items():
        notes = []
        source = SOURCE / f"{name}.png"
        wood_colours = None
        stand_in = not source.exists()
        if stand_in:
            raw, wood_colours = standins.draw(cfg.get("profile") or cfg["stand_in"])
        else:
            raw = np.array(Image.open(source).convert("RGBA"))
        rgba = normalize(name, raw, notes, None if stand_in else cfg)
        sprites[name] = {"cfg": cfg, "rgba": rgba, "stand_in": stand_in, "wood": wood_colours, "notes": notes}

    # The shared palette comes from real sprites only. Stand-ins keep their greys.
    palette = shared_palette([s["rgba"] for s in sprites.values() if not s["stand_in"]])

    pieces = []
    entries = {}
    for name, s in sprites.items():
        cfg = s["cfg"]
        rgba = s["rgba"] if s["stand_in"] else to_palette(s["rgba"], palette)
        solid = rgba[..., 3] > 0
        foot = find_foot(solid)
        entry = {"w": int(rgba.shape[1]), "h": int(rgba.shape[0]), "foot": list(foot)}
        if s["stand_in"]:
            entry["standin"] = True

        def add(layer, key, extra=None):
            cut = trimmed(layer)
            if cut is None:
                return
            image, offset = cut
            pieces.append({"image": image, "sprite": name, "key": key, "offset": offset, "extra": extra or []})

        if cfg.get("split"):
            if cfg["split"] == "tiers":
                labels = split_tiers(rgba, cfg, s["wood"])
                clumps = clump_data(labels, foot, "bottom-first")
                for c in clumps:
                    c["weight"] = 1.0
            else:
                labels = split_clumps(rgba, cfg, s["wood"], foot)
                clumps = clump_data(labels, foot, "top-first")
            entry["profile"] = cfg["profile"]
            entry["leaf"] = leaf_colours(rgba, labels)
            trunk = rgba.copy()
            trunk[labels > 0] = 0
            add(trunk, "trunk")
            add(make_inside(rgba, labels), "inside")
            for c in clumps:
                layer = np.zeros_like(rgba)
                layer[labels == c["id"]] = rgba[labels == c["id"]]
                add(layer, "clump", [c["centre"][0], c["centre"][1], c["weight"], c["height"]])
            contact_sheet(name, rgba, labels, clumps, SHEETS / f"{name}.png")
            s["notes"].append(f"{len(clumps)} clumps")
        else:
            add(rgba, "frame")
        entries[name] = entry

    atlas = pack(pieces)
    for p in pieces:
        entry = entries[p["sprite"]]
        record = [*p["rect"], *p["offset"], *p["extra"]]
        if p["key"] == "clump":
            entry.setdefault("clumps", []).append(record)
        else:
            entry[p["key"]] = record

    save_indexed(atlas, ASSETS / "atlas.png")
    data = {
        "v": 1,
        "image": "atlas.png",
        "w": int(atlas.shape[1]),
        "h": int(atlas.shape[0]),
        # Layers are [x, y, w, h, offsetX, offsetY]. Clumps add [centreX, centreY, weight, height].
        "palette": [] if palette is None else ["#%02x%02x%02x" % tuple(c) for c in palette.tolist()],
        "sprites": entries,
    }
    (ASSETS / "atlas.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")

    print(f"atlas {atlas.shape[1]} x {atlas.shape[0]}, {(ASSETS / 'atlas.png').stat().st_size} bytes, json {(ASSETS / 'atlas.json').stat().st_size} bytes")
    for name, s in sprites.items():
        kind = "stand-in" if s["stand_in"] else "sprite"
        print(f"  {name:10} {kind:9} {entries[name]['w']} x {entries[name]['h']}  " + "; ".join(s["notes"]))


if __name__ == "__main__":
    try:
        build()
    except Rejected as problem:
        raise SystemExit(f"Rejected. {problem}")
