#!/usr/bin/env python3
"""Regenerate every launcher icon in apps/todo/public from the Android app's icon.

Run it when the artwork changes, never by hand-editing the PNGs:

    pip install Pillow
    python3 apps/todo/icons/build-icons.py

`source/launcher.png` is a verbatim copy of `app/src/main/ic_launcher-playstore.png` in
teddy-fyi-android, the icon of the whole app (the `full` flavour), so an installed todo
web app sits on the home screen looking like the app it came from. Copy a new export
over it and rerun this; nothing here pins coordinates.

There is no monochrome icon. The mark is a full-colour portrait in a circle, and a
themed launcher keeps only the alpha, which here is a plain disc.
"""

import pathlib
import sys

try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - a developer's local machine
    sys.exit("Pillow is not installed: pip install Pillow")

HERE = pathlib.Path(__file__).parent
SOURCE = HERE / "source" / "launcher.png"
OUT = HERE.parent / "public"

# The page the portrait's circle sits on in the Play Store export.
PAPER = (255, 255, 255)

# A maskable icon is cropped to whatever shape the launcher prefers. The spec's safe zone
# is a centred circle of 80% of the canvas, but when Chrome cannot mint a WebAPK and pins a
# plain shortcut instead, it hands this bitmap to Android unpadded as a whole 108dp adaptive
# layer and the launcher shows only the middle 72dp. So the mark is fitted to Android's own
# keyline, 66 of 108dp, which survives that crop and every mask shape inside it. The mark
# is itself a circle filling its canvas, so scaling it to that fraction puts it exactly there.
SAFE_CIRCLE = 66 / 108


def flat(image, size):
    """The mark at `size`, opaque, on its own paper."""
    canvas = Image.new("RGB", (size, size), PAPER)
    mark = image.resize((size, size), Image.LANCZOS)
    canvas.paste(mark, (0, 0), mark)
    return canvas


def maskable(image, size):
    canvas = Image.new("RGB", (size, size), PAPER)
    inner = round(size * SAFE_CIRCLE)
    mark = image.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(mark, (offset, offset), mark)
    return canvas


def main():
    image = Image.open(SOURCE).convert("RGBA")
    outputs = {
        "icon-192.png": flat(image, 192),
        "icon-512.png": flat(image, 512),
        "icon-maskable-192.png": maskable(image, 192),
        "icon-maskable-512.png": maskable(image, 512),
        # iOS composites a transparent home-screen icon onto black, and rounds the corners
        # itself, so this is the flat one.
        "apple-touch-icon.png": flat(image, 180),
        "favicon-16.png": flat(image, 16),
        "favicon-32.png": flat(image, 32),
        "favicon-48.png": flat(image, 48),
    }
    for name, icon in outputs.items():
        icon.save(OUT / name, optimize=True)
        print(f"wrote {name} {icon.size[0]}x{icon.size[1]}")


if __name__ == "__main__":
    main()
