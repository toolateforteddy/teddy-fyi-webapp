# The launcher icons

Everything in `../public` whose name starts with `icon-`, `favicon-` or
`apple-touch-` is generated. Change the artwork in `source/`, run

```bash
pip install Pillow
python3 apps/grocery/icons/build-icons.py
```

and commit what it writes. Editing one of those PNGs by hand means the next run
silently reverts it.

## Why there are two source files

An installed app is asked for its icon in more than one shape, and the shapes
want different drawings:

| `purpose` | What the platform does with it | Drawn from |
| --- | --- | --- |
| `any` | Uses the image as-is. The fallback everywhere the others are not understood. | `mark-colour.png` |
| `maskable` | Crops it to a shape the launcher picks — circle, squircle, rounded square, teardrop — and treats the image as edge-to-edge. | `mark-colour.png` |
| `monochrome` | Throws the colour away, keeps the alpha as a stencil, and repaints it in the user's theme colours. This is Android 13's "themed icons". | `mark-stencil.png` |

`monochrome` is the web spelling of the `<monochrome>` layer in an Android
adaptive icon, and it carries the same constraint: it is an **alpha mask**, so
the brown of the bag and the green of the tick both become one colour. That is
the format rather than a shortcut — there is no way to keep two colours in a
themed icon on either platform.

A manifest icon may name several purposes at once (`"purpose": "any maskable"`),
and this one deliberately does not. A user agent that does not recognise *any* of
the values listed on an entry must ignore that entry entirely, so one entry per
purpose is what degrades cleanly: an old browser drops the two it does not know
and still finds the `any` pair.

## The geometry, and why it is computed

`maskable` has a safe zone: the only region guaranteed to survive every mask a
launcher might apply is a centred circle of 80% of the canvas. Anything outside
it may be cropped, and *which* part is cropped depends on the launcher, so it
cannot be checked by looking at one device.

The script therefore does not scale the mark by its bounding box. It finds the
smallest circle containing every inked pixel and scales that circle to the safe
circle. For this mark the difference is about 20%: it is taller than it is wide
and its corners are empty, so fitting the bounding box would have left it
noticeably small inside every mask.

`any` and `apple-touch-icon` are never cropped, so they get the plain 80%
bounding-box fit instead, which fills the tile.

## The background

Opaque, and warm off-white — sampled from the tile in `mark-colour.png` rather
than chosen. The mark is brown ink with a white bag body; on a dark background
the outlines disappear, so it carries its own paper wherever it is drawn. That
also covers iOS, which renders a transparent home-screen icon composited on
black.

`monochrome` is the exception and must be transparent: the transparency is the
stencil.

## What iOS and the browsers actually do with these

- **Android / Chrome**: reads `maskable` for the launcher icon and falls back to
  `any`. Whether it also reads `monochrome` for a themed icon depends on the
  Chrome version; the entry is harmless where it is ignored.
- **iOS / Safari**: home-screen icons come from `<link rel="apple-touch-icon">`
  in `index.html`, not from the manifest. It has no themed-icon equivalent, so
  `apple-touch-icon.png` is the full-colour mark and there is nothing else to
  ship.
- **Desktop Chrome / Edge**: uses `any` for the window and taskbar icon.
