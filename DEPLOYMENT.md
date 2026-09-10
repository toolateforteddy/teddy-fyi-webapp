# How this app gets to teddy.fyi

**Short version: merging to `main` does not deploy anything.** CI builds the app
and throws the result away. A deploy is a manual step someone runs from a laptop,
in a *different* repo, against a checkout of this one.

If you have just merged a grocery change and are wondering why the phone still
shows the old app: nothing has shipped yet. Read on.

---

## The shape of it

```
teddy-fyi-webapp (this repo)          teddyfyi (the hosting repo)
─────────────────────────────         ─────────────────────────────────────────
src/ ──pnpm build──> dist/  ──rsync──> static/  ──docker build──> nginx image
                                                        │
                                                   docker push
                                                        │
                                              gcr.io/melodic-sunbeam-164916/
                                                   teddy-fyi:latest
                                                        │
                                      kubectl rollout restart deployment/site-dep
                                                        │
                                                GKE → GCLB → teddy.fyi
```

There is no artifact handed between the two repos. `dist/` is gitignored here,
so the hosting repo does not consume a build — it *runs* our build, from
whatever commit happens to be checked out in the sibling directory on the
deployer's disk.

## What actually deploys it

In the [`teddyfyi`](https://github.com/toolateforteddy/teddyfyi) repo, checked
out as a **sibling directory of this one** (`../teddyfyi` from here):

```bash
cd ../teddyfyi
. cmd     # a shell file you source, not run — it defines the functions
dn        # deploy_nginx: build && upload && rollout_nginx
```

`dn` does, in order:

1. `pnpm install --frozen-lockfile && pnpm build` **in this repo** (`../teddy-fyi-webapp`).
   It hard-fails rather than shipping if the build fails or `dist/index.html` is
   missing.
2. `rsync -a --delete` `dist/` into `teddyfyi/static/`, minus a hardcoded exclude
   list of hand-written pages that live there.
3. `docker build` the nginx image and `docker push` it to GCR as `:latest`.
4. `kubectl rollout restart deployment/site-dep` and wait for the rollout.

`teddyfyi/AGENTS.md` is the authoritative description of that side; this file
only covers what someone working in *this* repo needs to know.

## What you need on the machine doing it

The deploy is a laptop workflow and assumes all of:

| Requirement | Why |
|---|---|
| `../teddyfyi` checked out as a sibling of this repo | `cmd`'s `build` hardcodes the relative path and aborts without it |
| `pnpm` + Node | the build step runs here |
| Docker, running | image build and push. `dn` wraps everything in `with_docker`, which un-pauses **Docker Desktop on macOS** over its unix socket and re-pauses it after — that part is macOS-only |
| `gcloud` authenticated with push rights to `gcr.io/melodic-sunbeam-164916` | `docker push` |
| `kubectl` pointed at the GKE cluster | the rollout restart |

None of this exists in CI. There are no deploy credentials in this repo, and no
workflow that could use them.

## What CI here does and does not do

`.github/workflows/ci.yml` runs on PRs and pushes to `main`: `pnpm lint`,
`pnpm test:run`, `pnpm build`. It is a correctness gate only. **Green CI means
the code compiles and the tests pass. It does not mean anything reached
production.**

## The versioning and rollback story

The image is only ever tagged `:latest`. The Deployment sets
`imagePullPolicy: Always`, which is the entire reason a `rollout restart` picks
up new bytes at all — the tag never moves, the digest under it does.

The consequence: **there is no rollback.** Nothing records which commit of this
repo produced the running image, and no previous image is addressable by tag.
Reverting a bad deploy means checking out the older commit here and running `dn`
again, from a laptop. Nothing in the app is stamped with a version or commit
either, so "which build is this phone running?" has no answer you can read off
the device.

## How an already-installed app picks up a new build

This app is installed to home screens (`display: standalone`, iOS
`apple-mobile-web-app-capable`), so the update path matters more than it would
for a page people visit.

There is **no service worker.** The manifest's description says the list "keeps
working offline" — that is `localStorage` (see `src/config/storageKeys.ts`), not
a cached app shell. Nothing here precaches, and nothing here has an update
lifecycle of its own.

So updates are entirely HTTP caching, and it is `teddyfyi/static/nginx.conf`
that makes them work:

- `/assets/*` — content-hashed by Vite, served `immutable` with `expires max`.
- `/index.html` — served `Cache-Control: no-cache`, i.e. revalidate every time.
  This is load-bearing: it is the only file naming the current bundle, and
  `try_files … /index.html` is an internal redirect, so the header covers every
  SPA route rather than just a literal `/index.html`.

Practically: a launch of the installed app revalidates `index.html` (a 304 when
nothing shipped), and picks up a new bundle **on the next launch or reload** —
never mid-session. There is no in-app "an update is available" prompt, and no
way to force a client forward.

Two failure modes this design is scar tissue from, both worth not
re-introducing:

- `index.html` without `no-cache` got heuristic freshness (~10% of its age), so
  a browser that had loaded the site before a deploy served itself the old
  document for hours — and with `/assets/` immutable, the old bundle with it.
  Re-shipping could not fix it, because nothing was being re-fetched.
- A route that exists in the source but not in the deployed bundle used to be
  redirected to `/` by React Router's catch-all, which made a stale deploy look
  exactly like a broken nginx rule. `src/routes/index.tsx` now renders
  `NotFoundPage` for unmatched routes on purpose.

## Things in this repo the hosting side is coupled to

Change any of these and you are changing a deploy, not just an app:

- **`public/` filenames.** They land at the root of `dist/`, which becomes the
  root of the docroot. `manifest.webmanifest`, `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `favicon.svg` are
  all referenced by absolute path from `index.html` or the manifest.
- **Route paths.** Every SPA route is served by nginx's `try_files` fallback, but
  a path that collides with a real file in `teddyfyi/static/` (`/articles.html`,
  `/styles.css`) or with an nginx `location` (`/resume`, `/resume-devex`,
  `/pdf/...`, `/assets/`) loses to the server. `/articles` is fine; `/articles.html`
  would not reach React.
- **The manifest's `start_url` (`/grocery`)** is an authenticated route. It is
  behind `AuthenticatedRoute`, so a cold launch of the installed app on an
  unauthenticated device lands on the login redirect, not on the list.
- **`VITE_API_BASE_URL`** defaults to `https://api-rust.teddy.fyi`
  (`src/config/env.ts`). It is baked in at build time — the deploy above passes
  no env, so production always gets that default. The API itself lives in
  `../teddy-fyi-api-rust` and deploys itself from its own GitHub Actions
  workflow; `teddyfyi` only routes to it.
- **Build target** is pinned to Safari/iOS 16.4 in `vite.config.ts`, and
  `index.html` renders a plain-HTML notice below that. Tailwind v4's
  `oklch()`/`color-mix()` output is the constraint.

## Local development

```bash
pnpm install
pnpm dev        # http://localhost:5174
```

`vite.config.ts` proxies `/api` and `/auth` to `http://localhost:3000` for a
locally running API. In dev the axios base URL is `''` so those proxies are
used; in a production build it is `VITE_API_BASE_URL`. A base URL saved in
`localStorage` (the settings panel) overrides both.

To exercise the real container rather than the dev server, `teddyfyi`'s `cmd`
has `run` — the freshly built image on `localhost:80`.
