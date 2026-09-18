# The launcher icons

Everything in `../public` whose name starts with `icon-`, `favicon-` or
`apple-touch-` is generated, and so is `og-image.png`. Change the artwork in
`source/`, run

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
| `monochrome` | Throws the colour away, keeps the alpha as a stencil, and repaints it in one solid colour. | `mark-stencil.png` |

`monochrome` is an **alpha mask**: the spec says the user agent must not display
the red, green or blue component of a pixel, only its alpha. So the brown of the
bag and the green of the tick both become one colour, and the file is authored as
a black silhouette on transparent — which is what the spec recommends, and what
Chrome expects, since it refills the RGB with the manifest's `theme_color`.

**It is not a route to an Android themed launcher icon, despite being the obvious
analogue of one.** Chromium's WebAPK proto has the monochrome purpose reserved
and commented out (`components/webapk/webapk.proto`), and
[crbug.com/40277264](https://issues.chromium.org/issues/40277264), open since
2023, is the request to wire it up. What the entry does buy today: the home-tab
icon for a tabbed-display PWA on desktop Chrome, ChromeOS notification icons, and
Firefox-for-Android's site-controls notification. It is one 25 KiB file that is
already outside the precache, so it is worth having ready for the day Chrome
honours it — but nobody should expect a themed home screen from it.

A manifest icon may name several purposes at once (`"purpose": "any maskable"`),
and this one deliberately does not. A user agent that does not recognise *any* of
the values listed on an entry must ignore that entry entirely, so one entry per
purpose is what degrades cleanly: an old browser drops the two it does not know
and still finds the `any` pair. The cost of splitting them is Safari, which reads
manifest icons only when the purpose is `any` or absent — but that costs us
nothing here, because Safari also ignores the manifest list entirely whenever an
`apple-touch-icon` is present, and index.html has one.

## The geometry, and why it is computed

`maskable` has a safe zone, and the spec is exact about it: a centred circle of
radius 2/5 of the icon's smaller side, so 80% of the canvas across, leaving about
10% margin on each edge. A user agent must not make any pixel inside it
transparent and may crop anything outside. *Which* part gets cropped depends on
the launcher, so it cannot be checked by looking at one device. (Chrome does the
rest of the arithmetic itself: building a WebAPK it pads the icon by ~15.5% a
side, which lands the 80% circle on Android's own 66-of-108dp keyline.)

The script therefore does not scale the mark by its bounding box. It finds the
smallest circle containing every inked pixel and scales that circle to the safe
circle. For this mark the difference is about 20%: it is taller than it is wide
and its corners are empty, so fitting the bounding box would have left it
noticeably small inside every mask.

`any` and `apple-touch-icon` are never cropped, so they get the plain 80%
bounding-box fit instead, which fills the tile.

## The link-preview card

`og-image.png` is not a launcher icon, but it is the same mark on the same paper,
so it comes out of the same script rather than a second source. 1200x630 is the
size both Open Graph and Twitter's `summary_large_image` ask for, and the mark is
fitted to the *maskable safe circle measured against the short side* — because a
preview is cropped at least as hard as an icon is. A chat app showing a small
square thumbnail takes the centre 630x630; one that wants a tighter ratio takes a
band out of the middle. Both keep a centred circle of 80% of the height, so the
whole drawing survives every crop anyone applies.

There is deliberately no wordmark on it. Every unfurler renders `og:title` and
`og:description` as real text beside or beneath the picture, so type baked into the
image is a second and worse copy of a line already being drawn — and it would put a
font on the critical path of a script whose output is committed, which is the one
way to make these PNGs differ between the machine that generated them and the next
one. `../social-cards.ts` holds the copy that goes with it.

## The background

Opaque, and warm off-white — sampled from the tile in `mark-colour.png` rather
than chosen. The mark is brown ink with a white bag body; on a dark background
the outlines disappear, so it carries its own paper wherever it is drawn. That
also covers iOS, which renders a transparent home-screen icon composited on
black.

`monochrome` is the exception and must be transparent: the transparency is the
stencil.

## What each platform actually does with these

- **Android / Chrome**: uses `maskable` for the launcher icon (since Chrome 79)
  and falls back to `any`, which it shims onto a white background instead. It
  ignores `monochrome` — see above.
- **iOS / Safari**: home-screen icons come from `<link rel="apple-touch-icon">`
  in `index.html`, not from the manifest, and the manifest list is skipped
  entirely while that tag is present. WebKit parses `purpose` and then does
  nothing with it. There is no web equivalent of iOS's tinted or dark app icons —
  no manifest member, no `media` attribute — so the full-colour mark is all there
  is to ship.
- **Desktop Chrome / Edge**: `any` for the window and taskbar icon on Windows and
  Linux; macOS and ChromeOS prefer `maskable` instead, but only at 256px and
  above, which is why the 512 is there and not only the 192.
