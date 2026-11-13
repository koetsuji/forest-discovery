"""Grey stand-in sprites.

Until a real sprite exists in art/source/, the art pipeline uses one of these
instead. They are built from clear clumps with bright tops and dark gaps, so
the split and the wind can be judged on them, and they are grey and flat so
nobody mistakes them for final art.

Each function returns (image, wood): an RGBA uint8 array and the list of
colours that count as wood, because a grey sprite has no brown to detect.
"""

import math

import numpy as np

# Wood greys are never used for leaves, so the split can tell them apart.
WOOD = (0x6C, 0x6C, 0x6C)
WOOD_SHADE = (0x57, 0x57, 0x57)
WOOD_LINE = (0x3A, 0x3A, 0x3A)
PALE = (0xDE, 0xDE, 0xDE)
PALE_SHADE = (0xB2, 0xB2, 0xB2)
PALE_MARK = (0x4C, 0x4C, 0x4C)

LEAF_SETS = {
    # gap, outline, shade, body, light, cap
    "oak": [(0x52, 0x52, 0x52), (0x46, 0x46, 0x46), (0x7A, 0x7A, 0x7A), (0x96, 0x96, 0x96), (0xB6, 0xB6, 0xB6), (0xD0, 0xD0, 0xD0)],
    "birch": [(0x5A, 0x5A, 0x5A), (0x4E, 0x4E, 0x4E), (0x86, 0x86, 0x86), (0xA2, 0xA2, 0xA2), (0xC0, 0xC0, 0xC0), (0xD6, 0xD6, 0xD6)],
    "pine": [(0x48, 0x48, 0x48), (0x3E, 0x3E, 0x3E), (0x5E, 0x5E, 0x5E), (0x7C, 0x7C, 0x7C), (0x9E, 0x9E, 0x9E), (0xB8, 0xB8, 0xB8)],
    "bush": [(0x50, 0x50, 0x50), (0x44, 0x44, 0x44), (0x72, 0x72, 0x72), (0x8C, 0x8C, 0x8C), (0xAC, 0xAC, 0xAC), (0xC6, 0xC6, 0xC6)],
}
ROCK = {"line": (0x3A, 0x3A, 0x3A), "shade": (0x66, 0x66, 0x66), "body": (0x8A, 0x8A, 0x8A), "top": (0xB0, 0xB0, 0xB0), "cap": (0xC8, 0xC8, 0xC8)}


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.rgba = np.zeros((h, w, 4), np.uint8)
        self.yy, self.xx = np.mgrid[0:h, 0:w]

    def paint(self, mask, colour):
        self.rgba[mask] = (*colour, 255)

    @property
    def solid(self):
        return self.rgba[..., 3] > 0

    def blob(self, cx, cy, rx, ry, phase=0.0, wobble=1.0):
        """An ellipse with a slightly uneven edge, so clumps do not look stamped."""
        dx = (self.xx - cx) / rx
        dy = (self.yy - cy) / ry
        angle = np.arctan2(dy, dx)
        edge = 1 + wobble * (0.09 * np.sin(3 * angle + phase) + 0.06 * np.sin(5 * angle + 2.1 * phase) + 0.04 * np.sin(8 * angle + 0.7 * phase))
        return dx * dx + dy * dy <= edge * edge

    def outline(self, mask, colour):
        """Paints the pixels just outside a mask."""
        grown = np.zeros_like(mask)
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        self.paint(grown & ~mask, colour)


def clump(canvas, tones, cx, cy, rx, ry, phase):
    """One leaf clump: lit from the top left, darker underneath, a dark line around it."""
    _gap, line, shade, body, light, cap = tones
    mask = canvas.blob(cx, cy, rx, ry, phase)
    canvas.outline(mask, line)
    canvas.paint(mask, body)
    # The underside and the right are in shade.
    canvas.paint(mask & ~canvas.blob(cx - 0.22 * rx, cy - 0.3 * ry, rx, ry, phase), shade)
    canvas.paint(mask & canvas.blob(cx - 0.2 * rx, cy - 0.28 * ry, rx * 0.62, ry * 0.58, phase + 1.0), light)
    canvas.paint(mask & canvas.blob(cx - 0.3 * rx, cy - 0.42 * ry, rx * 0.3, ry * 0.26, phase + 2.0, 0.5), cap)


def trunk(canvas, foot_x, foot_y, top_y, half_foot, half_top, flare, sway=0.0, pale=False):
    fill, shade, line = (PALE, PALE_SHADE, WOOD_LINE) if pale else (WOOD, WOOD_SHADE, WOOD_LINE)
    mask = np.zeros((canvas.h, canvas.w), bool)
    dark = np.zeros_like(mask)
    for y in range(top_y, foot_y + 1):
        t = (foot_y - y) / max(1, foot_y - top_y)
        near_foot = max(0.0, 1 - (foot_y - y) / 6)
        half = half_foot + (half_top - half_foot) * t + flare * near_foot * near_foot
        mid = foot_x + sway * math.sin(t * math.pi)
        x0, x1 = int(round(mid - half)), int(round(mid + half))
        mask[y, x0 : x1 + 1] = True
        dark[y, int(round(mid + half * 0.25)) : x1 + 1] = True
    canvas.outline(mask, line)
    canvas.paint(mask, fill)
    canvas.paint(mask & dark, shade)
    return mask


def branch(canvas, x0, y0, x1, y1, thick, pale=False):
    fill = PALE_SHADE if pale else WOOD
    steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    mask = np.zeros((canvas.h, canvas.w), bool)
    for i in range(steps + 1):
        t = i / steps
        r = thick * (1 - 0.6 * t) / 2
        cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        mask |= (canvas.xx - cx) ** 2 + (canvas.yy - cy) ** 2 <= max(0.6, r) ** 2
    canvas.outline(mask & ~canvas.solid, WOOD_LINE)
    canvas.paint(mask, fill)


def oak():
    c = Canvas(128, 128)
    tones = LEAF_SETS["oak"]
    trunk(c, 64, 123, 62, 8.5, 5, 5, sway=2.5)
    branch(c, 62, 80, 40, 58, 6)
    branch(c, 67, 78, 90, 56, 6)
    # Dark canopy interior, so gaps between clumps show shade and not sky.
    c.paint(c.blob(64, 46, 47, 31, 0.4), tones[0])
    rows = [
        [(46, 26, 15, 12), (66, 20, 16, 13), (87, 27, 15, 12)],
        [(27, 42, 14, 12), (50, 40, 16, 13), (73, 38, 16, 13), (97, 42, 15, 12)],
        [(19, 58, 13, 11), (40, 58, 15, 12), (62, 56, 16, 13), (85, 57, 15, 12), (107, 58, 13, 11)],
        [(30, 72, 13, 10), (52, 73, 14, 10), (76, 72, 14, 10), (98, 71, 13, 10)],
    ]
    n = 0
    for row in rows:
        for cx, cy, rx, ry in row:
            clump(c, tones, cx, cy, rx, ry, phase=1.7 * n)
            n += 1
    return c.rgba, [WOOD, WOOD_SHADE, WOOD_LINE]


def birch():
    c = Canvas(96, 224)
    tones = LEAF_SETS["birch"]
    body = trunk(c, 48, 219, 30, 3.2, 1.6, 2.5, sway=-2.0, pale=True)
    # The dark marks of birch bark, alternating sides.
    for i, y in enumerate(range(206, 110, -13)):
        row = np.zeros_like(body)
        xs = np.where(body[y])[0]
        if len(xs) >= 4:
            if i % 2:
                row[y, xs[0] : xs[0] + 3] = True
            else:
                row[y, xs[-1] - 2 : xs[-1] + 1] = True
            c.paint(row, PALE_MARK)
    branch(c, 47, 96, 30, 74, 3, pale=True)
    branch(c, 49, 84, 66, 62, 3, pale=True)
    spots = [
        (48, 16, 11, 9), (34, 27, 11, 9), (61, 28, 11, 9),
        (24, 41, 10, 9), (46, 41, 12, 9), (68, 43, 11, 9),
        (18, 57, 10, 8), (38, 57, 11, 9), (58, 59, 11, 9), (77, 59, 10, 8),
        (28, 73, 11, 9), (50, 75, 11, 9), (70, 75, 11, 9),
        (36, 91, 11, 9), (60, 91, 11, 9), (47, 105, 11, 8),
    ]
    for n, (cx, cy, rx, ry) in enumerate(spots):
        clump(c, tones, cx, cy, rx, ry, phase=2.3 * n)
    return c.rgba, [PALE, PALE_SHADE, PALE_MARK, WOOD_LINE]


def pine():
    c = Canvas(112, 224)
    _gap, line, shade, body, light, cap = LEAF_SETS["pine"]
    trunk(c, 56, 219, 22, 4, 1.5, 3)
    skirts = [184, 160, 138, 117, 97, 78, 60, 43]
    tops = [148, 127, 108, 90, 72, 56, 40, 20]
    reach = [46, 42, 37, 32, 27, 22, 17, 12]
    for skirt, top, half in zip(skirts, tops, reach):
        dx = np.abs(c.xx - 56)
        f = np.clip((c.yy - top) / (skirt - top), 0, 1)
        width = half * (0.2 + 0.8 * f**0.85)
        # The skirt hangs lower at its tips and ends in teeth.
        droop = skirt - 5 + 7 * (dx / half) ** 1.6 + np.where((c.xx // 3) % 2 == 0, 2, 0)
        tier = (c.yy >= top) & (c.yy <= droop) & (dx <= width)
        c.outline(tier, line)
        c.paint(tier, body)
        c.paint(tier & (c.yy > droop - 5), shade)
        lit = tier & (c.xx < 56 + half * 0.15) & (dx > width - 7) & (c.yy < droop - 5)
        c.paint(lit, light)
        c.paint(lit & (dx > width - 3), cap)
    return c.rgba, [WOOD, WOOD_SHADE, WOOD_LINE]


def bush():
    c = Canvas(64, 64)
    tones = LEAF_SETS["bush"]
    c.paint(c.blob(32, 40, 19, 11, 0.9) & (c.yy <= 51), tones[0])
    spots = [(21, 37, 11, 9), (33, 30, 12, 10), (45, 37, 11, 9), (26, 44, 10, 7), (40, 45, 10, 7)]
    for n, (cx, cy, rx, ry) in enumerate(spots):
        clump(c, tones, cx, cy, rx, ry, phase=1.3 * n)
    # A bush sits flat on the ground.
    c.rgba[52:, :, :] = 0
    return c.rgba, []


def rock():
    c = Canvas(64, 64)
    mask = c.blob(32, 39, 19, 13, 0.8, 0.8) & (c.yy <= 50)
    c.outline(mask, ROCK["line"])
    c.paint(mask, ROCK["body"])
    c.paint(mask & ~c.blob(29, 36, 19, 13, 0.8, 0.8), ROCK["shade"])
    # The lighter top is where moss will be on the real boulder.
    top = mask & c.blob(29, 33, 14, 7, 2.0)
    c.paint(top, ROCK["top"])
    c.paint(top & c.blob(26, 31, 7, 3, 1.0, 0.5), ROCK["cap"])
    return c.rgba, []


STAND_INS = {"oak": oak, "birch": birch, "pine": pine, "bush": bush, "rock": rock}


def draw(profile):
    """The stand-in for a wind profile, or for "rock"."""
    return STAND_INS[profile]()
