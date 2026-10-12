# The launcher icons

Everything in `../public` whose name starts with `icon-`, `favicon-` or `apple-touch-` is
generated. Copy a new export of the Android app's icon over `source/launcher.png`, run

```bash
pip install Pillow
python3 apps/todo/icons/build-icons.py
```

and commit what it writes.

`source/launcher.png` is `app/src/main/ic_launcher-playstore.png` from `teddy-fyi-android`:
the icon of the whole app, so the installed web app looks like the app it came from.

| `purpose` | Drawn as |
| --- | --- |
| `any` | The mark edge to edge on white, opaque. Also the favicons and `apple-touch-icon.png`. |
| `maskable` | The mark at 66/108 (Android's adaptive-icon keyline) on white, so a launcher's crop to any shape keeps the whole circle, including the plain shortcut Chrome pins when it cannot mint a WebAPK. `../../grocery/icons/README.md` has why it is not the spec's 80%. |

There is no `monochrome` icon. A themed launcher keeps only the alpha, and this mark's alpha
is a plain disc.
