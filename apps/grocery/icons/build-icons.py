#!/usr/bin/env python3
"""Regenerate every launcher icon in apps/grocery/public from the two source marks.

Run it when the artwork changes, never by hand-editing the PNGs:

    pip install Pillow
    python3 apps/grocery/icons/build-icons.py

There are two sources because an installed app is asked for its icon in more than
one shape (icons/README.md has the whole story). `source/mark-colour.png` is the
full-colour bag; `source/mark-stencil.png` is the line-art version, which becomes
the single-colour alpha mask a themed launcher tints. Both are flat exports of the
artwork sitting on a page rather than vectors, so the first thing this script does
is find the drawing inside its page and crop it. Every measurement below is
computed from the pixels, never pinned to coordinates, so re-exporting either
source at a different size or position still works.
"""

import math
import pathlib
import sys

try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - a developer's local machine
    sys.exit("Pillow is not installed: pip install Pillow")

HERE = pathlib.Path(__file__).parent
SOURCE = HERE / "source"
OUT = HERE.parent / "public"

# The paper the mark sits on in every size that carries a background. Sampled from
# the tile in source/mark-colour.png rather than invented: the artwork is brown ink
# on a warm off-white and it stops reading the moment it is put on black.
PAPER = (248, 248, 246)

# A maskable icon is cropped to whatever shape the launcher prefers, and the only
# region guaranteed to survive every shape is a centred circle of 80% of the
# canvas. So the mark is scaled until the smallest circle containing all of its ink
# is exactly that circle -- which is what keeps the tip of the tick and the top of
# the leaves from being shaved off on a round mask, without wasting the space a
# bounding box would have wasted on this mark's empty corners.
SAFE_CIRCLE = 0.80

# Nothing crops an `any` icon, so it only needs the optical margin that stops the
# mark touching the edge of the tile.
FULL_BLEED = 0.80


def is_ink(r, g, b):
    """True for a stroke, false for the page.

    Every stroke in both marks is either saturated or dark; the page, the soft
    drop shadow under the tile and the light grey caption printed in the corner of
    one export are neither.
    """
    return max(r, g, b) - min(r, g, b) > 32 or (r + g + b) / 3 < 150


def crop_to_art(im):
    """Crop to the drawing, discarding the page around it.

    Rows and columns holding only a couple of ink pixels are thrown away, so a
    speck of compression noise on the page cannot widen the crop.
    """
    px = im.load()
    w, h = im.size
    cols = [0] * w
    rows = [0] * h
    for y in range(h):
        for x in range(w):
            if is_ink(*px[x, y]):
                cols[x] += 1
                rows[y] += 1
    xs = [x for x, n in enumerate(cols) if n > 3]
    ys = [y for y, n in enumerate(rows) if n > 3]
    if not xs or not ys:
        raise SystemExit("no artwork found in the source image")
    return im.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))


def ink_hull(im):
    """The convex hull of the drawing's ink, as (x, y) points.

    Only the first and last ink pixel of each row can be on the hull, which is
    what keeps this cheap enough to run over a full-size export.
    """
    px = im.convert("RGB").load()
    w, h = im.size
    points = []
    for y in range(h):
        row = [x for x in range(w) if is_ink(*px[x, y])]
        if row:
            points.append((row[0], y))
            points.append((row[-1], y))

    def chain(sorted_points):
        stack = []
        for p in sorted_points:
            while len(stack) >= 2:
                (ax, ay), (bx, by) = stack[-2], stack[-1]
                if (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) > 0:
                    break
                stack.pop()
            stack.append(p)
        return stack[:-1]

    points = sorted(set(points))
    return chain(points) + chain(points[::-1])


def enclosing_circle(points):
    """The smallest circle containing every point, near enough.

    Badoiu-Clarkson: step the centre towards whichever point is currently
    furthest away, by a step that shrinks each round. A couple of thousand rounds
    over a hull of a few dozen points is instant and lands well inside a pixel.
    """
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    for i in range(2000):
        fx, fy = max(points, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
        cx += (fx - cx) * 0.5 / (i + 1)
        cy += (fy - cy) * 0.5 / (i + 1)
    radius = max(math.hypot(p[0] - cx, p[1] - cy) for p in points)
    return cx, cy, radius


def to_alpha_mask(im):
    """Flatten the line art to one colour, keeping only its coverage as alpha.

    A monochrome icon *is* an alpha mask: the launcher throws the colour away and
    repaints the shape in whatever ink the user's theme calls for. So the brown of
    the bag and the green of the tick necessarily become the same colour here --
    that is the format, not a shortcut. Coverage is measured from the darkest
    channel, which reads a saturated green and a dark brown as equally solid;
    measuring luminance instead would have left the green half transparent.
    """
    px = im.convert("RGB").load()
    w, h = im.size
    mask = Image.new("L", (w, h))
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mp[x, y] = min(255, round((255 - min(r, g, b)) * 255 / 200))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    out.putalpha(mask)
    return out


def render(art, size, factor, offset, background):
    """Scale `art` by `factor` and paste it so `offset` lands at the centre."""
    ox, oy = offset
    scaled = art.resize(
        (max(1, round(art.width * factor)), max(1, round(art.height * factor))),
        Image.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), background)
    canvas.paste(
        scaled,
        (round(size / 2 - ox * factor), round(size / 2 - oy * factor)),
        scaled if scaled.mode == "RGBA" else None,
    )
    return canvas


def full_bleed(art, size, background):
    factor = (size * FULL_BLEED) / max(art.size)
    return render(art, size, factor, (art.width / 2, art.height / 2), background)


def in_safe_circle(art, circle, size, background):
    cx, cy, radius = circle
    factor = (size * SAFE_CIRCLE / 2) / radius
    return render(art, size, factor, (cx, cy), background)


def save(im, name, opaque):
    """Write the icon, in the smallest encoding that is still lossless enough.

    These are drawings with flat fills, not photographs, so a 256-colour palette
    is indistinguishable from the truecolour original and roughly halves the file
    -- which matters because the service worker precaches what it ships. The
    monochrome pair keeps its alpha and drops to greyscale instead, since a
    palette cannot carry a smooth alpha ramp.
    """
    if opaque:
        # iOS renders a transparent home-screen icon on black, so anything it might
        # pick up is flattened onto the paper here rather than left to chance.
        flat = Image.new("RGB", im.size, PAPER)
        flat.paste(im, (0, 0), im)
        # No dithering: it would scatter noise through the flat fills and cost more
        # bytes than the banding it prevents, which this artwork has none of.
        out = flat.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)
    else:
        grey, alpha = im.convert("L"), im.split()[3]
        out = Image.merge("LA", (grey, alpha))
    out.save(OUT / name, optimize=True)
    print(f"  {name:26} {im.size[0]}x{im.size[1]}  {(OUT / name).stat().st_size // 1024} KiB")


def main():
    colour = crop_to_art(Image.open(SOURCE / "mark-colour.png").convert("RGB"))
    stencil = crop_to_art(Image.open(SOURCE / "mark-stencil.png").convert("RGB"))
    colour_circle = enclosing_circle(ink_hull(colour))
    stencil_circle = enclosing_circle(ink_hull(stencil))
    mono = to_alpha_mask(stencil)
    print(f"colour {colour.size} r={colour_circle[2]:.0f}, stencil {stencil.size} r={stencil_circle[2]:.0f}")

    paper = PAPER + (255,)
    clear = (0, 0, 0, 0)

    # `any`: what a browser uses when it is not going to mask the icon, and the
    # fallback wherever the other two purposes are not understood.
    for size in (192, 512):
        save(full_bleed(colour, size, paper), f"icon-{size}.png", opaque=True)

    # `maskable`: full-bleed background, mark inside the safe circle.
    for size in (192, 512):
        save(
            in_safe_circle(colour, colour_circle, size, paper),
            f"icon-maskable-{size}.png",
            opaque=True,
        )

    # `monochrome`: transparent and one colour, on the same geometry as the
    # maskable icon because a themed launcher masks it the same way.
    for size in (192, 512):
        save(
            in_safe_circle(mono, stencil_circle, size, clear),
            f"icon-monochrome-{size}.png",
            opaque=False,
        )

    # iOS reads this rather than the manifest, and rounds it itself, so it gets the
    # full-bleed geometry.
    save(full_bleed(colour, 180, paper), "apple-touch-icon.png", opaque=True)

    # Browser tabs. Scaled from the colour mark rather than the stencil: below
    # about 32px the solid shapes survive and the hairlines do not.
    for size in (16, 32, 48):
        factor = (size * 0.94) / max(colour.size)
        save(
            render(colour, size, factor, (colour.width / 2, colour.height / 2), paper),
            f"favicon-{size}.png",
            opaque=True,
        )


if __name__ == "__main__":
    main()
