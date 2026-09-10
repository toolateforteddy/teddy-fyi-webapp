# How these apps get deployed

This repo is a pnpm workspace holding **two apps that deploy in completely
different ways**, on purpose:

| | `apps/personal` | `apps/grocery` |
|---|---|---|
| Serves | `teddy.fyi` | `grocery.teddy.fyi` |
| Pages | `/`, `/articles`, `/cracked` | the grocery app, at the root |
| Deployed by | a human, from a laptop | GitHub Actions, on merge |
| Trigger | `cd ../teddyfyi && . cmd && dn` | push to `main` touching `apps/grocery/**` |
| Image tag | `:latest` | the commit SHA |
| Rollback | rebuild an older checkout | `kubectl rollout undo`, or revert and merge |
| Changes | a few times a year | weekly |

That asymmetry is the point. The grocery app replaced an iOS app and needs to
ship often, so it got a pipeline. The personal site is three pages that change
when the resume does, and it shares a docroot with hand-written pages and the
resume PDFs in the `teddyfyi` repo — automating it would buy very little.

---

## `apps/grocery` → grocery.teddy.fyi

**Merging to `main` deploys it.** `.github/workflows/deploy-grocery.yml`:

1. Runs the whole of CI as a gate — lint, the 66 tests, both app builds.
2. In parallel, builds `apps/grocery`, then builds and pushes the nginx image to
   `gcr.io/melodic-sunbeam-164916/teddy-fyi-grocery:<commit-sha>`.
3. Once both are green, substitutes the SHA for `IMAGE_TAG_PLACEHOLDER` in
   `apps/grocery/k8s/grocery.yaml`, applies it, and waits on the rollout.

Building the image in parallel with the gate is only safe because the tag is a
SHA: an image built for a revision whose tests then fail is an unreferenced blob
nobody can pull. Never add a moving tag like `:latest` to that workflow.

There is no `kubectl rollout restart`. With the image pinned to the SHA, the spec
change *is* the new image, so `apply` starts the rollout on its own. The trade:
re-running the workflow on an unchanged commit is a no-op rather than a restart,
so a config changed outside git needs a deliberate
`kubectl rollout restart deployment/grocery-dep`.

**Rollback** is `kubectl rollout undo deployment/grocery-dep` for something
immediate, or revert the commit and let the workflow deploy — both work, because
every image is addressable by the commit that produced it.

### What this repo owns, and what it doesn't

`apps/grocery/k8s/grocery.yaml` holds `grocery-svc`, `grocery-dep`, its
`BackendConfig` and `grocery-teddy-fyi-cert` — the same shape
`teddy-fyi-api-rust` and the ScribbleRoute website already use.

**The Ingress is not ours.** `k8s/ingress.yaml` in `teddyfyi` is the shared front
door for every hostname on the load balancer, and it routes `grocery.teddy.fyi`
here. Two consequences:

- Renaming `grocery-svc` is a change in two repos.
- `grocery-teddy-fyi-cert` must be named in that Ingress's
  `networking.gke.io/managed-certificates` annotation or it is never issued. That
  annotation is a four-way contract across this repo, `teddyfyi`,
  `teddy-fyi-api-rust` and the website repo.

Never apply the Ingress from here. A resource applied from two repos flaps
between whatever each one last said.

## `apps/personal` → teddy.fyi

Unchanged from before the split, except which directory gets copied:

```bash
cd ../teddyfyi   # must be a sibling checkout
. cmd            # source it — it defines the functions
dn               # build && upload && rollout_nginx
```

`cmd`'s `build` runs `pnpm --filter personal build` here, rsyncs
`apps/personal/dist/` into `teddyfyi/static/` (with a `--delete` and a hardcoded
exclude list protecting the hand-written pages), bakes the nginx image, pushes it
as `:latest`, and restarts `site-dep`. It aborts if this checkout predates the
split, rather than shipping the old combined bundle.

It needs a laptop with: this repo as a sibling of `teddyfyi`, pnpm, a running
Docker (the un-pause dance in `with_docker` is macOS Docker Desktop specific),
`gcloud` push rights to the GCR project, and a `kubectl` context. None of that
exists in CI, and `:latest` means there is still no real rollback for this app —
undoing means checking out an older commit and running `dn` again.

`teddyfyi/AGENTS.md` is the authoritative description of that side.

---

## How an installed app picks up a new build

The grocery app is installed to home screens, so this matters more than it would
for a page people visit.

There is still **no service worker.** The manifest's description says the list
"keeps working offline" — that is `localStorage` (see
`apps/grocery/src/config/storageKeys.ts`), not a cached app shell. A cold launch
with no network still fails.

So updates are entirely HTTP caching, and `apps/grocery/nginx.conf` is what makes
them work:

- `/assets/*` — content-hashed by Vite, `immutable`, cached forever.
- `/index.html` — `no-cache`, i.e. revalidate every time. Load-bearing: it is the
  only file naming the current bundle, and `try_files … /index.html` is an
  internal redirect, so the header covers every SPA route.
- `/manifest.webmanifest` — `no-cache` too. It is neither content-hashed nor the
  entry document, so without this an installed app keeps an old name, icon or
  `start_url` after a deploy changes it.

Practically: a launch revalidates `index.html` (a 304 when nothing shipped) and
picks up a new bundle **on the next launch or reload**, never mid-session. There
is no in-app "update available" prompt and no way to force a client forward.
Adding one is Option B in [`docs/deployment-options.md`](./docs/deployment-options.md).

Two failure modes this design is scar tissue from, both worth not
re-introducing:

- `index.html` without `no-cache` got heuristic freshness (~10% of its age), so a
  browser that had loaded the site before a deploy served itself the old document
  for hours — and with `/assets/` immutable, the old bundle with it. Re-shipping
  could not fix it, because nothing was being re-fetched.
- A route that exists in source but not in the deployed bundle used to be
  redirected to `/` by React Router's catch-all, which made a stale deploy look
  exactly like a broken nginx rule. Both apps now render `NotFoundPage` for
  unmatched routes on purpose.

## Cross-origin coupling

The two apps are separate origins now, which has consequences neither of them can
paper over:

- **`localStorage` is per-origin.** Everything in
  `apps/grocery/src/config/storageKeys.ts` lives on `grocery.teddy.fyi` and is
  invisible from `teddy.fyi`. This is why the origin move signed everyone out
  once.
- **The API allowlist is compiled in.** `CORS_ALLOWED_ORIGINS` is unset in the
  API's `k8s/`, so `AppProfile::default_cors_origins` in
  `teddy-fyi-api-rust/src/profile.rs` is what browsers are actually checked
  against. `https://grocery.teddy.fyi` is listed there; a *new* origin would need
  adding, or every request fails its preflight.
- **The session cookie is fine.** `default_cookie_domain` is `.teddy.fyi`, a
  domain cookie, so it reaches any `*.teddy.fyi` subdomain without changes.
- **Google OAuth** needs each origin in its Authorized JavaScript Origins. That
  is a console setting, not code, and it fails at sign-in rather than at build.
- **Links between the apps must be `<a href>`, not `<Link>`.** react-router
  cannot route across origins. The landing page's CTA and the grocery app's two
  "Back" links are anchors for this reason.
- **`VITE_API_BASE_URL`** defaults to `https://api-rust.teddy.fyi`
  (`apps/grocery/src/config/env.ts`) and is baked in at build time. Neither deploy
  passes env, so production always gets that default.

## Things that still belong to teddy.fyi

Served by `teddyfyi`'s nginx, not by either app:

- `/resume` and `/resume-devex` — a user-agent sniff gives link unfurls an OG
  preview page and humans a 302 to the PDF. `LandingPage.tsx` links to `/resume`
  and matches no React route on purpose.
- `/pdf/*`, and hand-written pages like `/articles.html` and `/styles.css`. A
  personal-site route that collides with one of those loses to the server —
  `/articles` is fine, `/articles.html` would not reach React.
- 302s for `/grocery`, `/grocery/*`, `/login` and `/link` to the new origin.
  Deliberately 302 and not 301 while the move settles: browsers cache a permanent
  redirect essentially forever.

## Local development

```bash
pnpm install
pnpm dev:personal   # http://localhost:5173
pnpm dev:grocery    # http://localhost:5174
```

Both can run at once; the ports are `strictPort` so a collision fails loudly
instead of quietly serving the wrong app. Only the grocery app proxies `/api` and
`/auth` to `http://localhost:3000` for a locally running API.

Workspace-wide: `pnpm lint`, `pnpm test:run`, `pnpm build`.
