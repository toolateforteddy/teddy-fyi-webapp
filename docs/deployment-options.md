# Shipping this app: what got built, and what is still on the table

The original version of this document proposed three ways to make the grocery app
easier to ship, back when it was one route inside a single bundle that deployed
from a laptop. **Option A has since been built, in a form the split made
possible.** This is the reconciled version: what is true now, and what remains.

## What was actually done

The bundle was split into two apps on two origins (`apps/personal` → `teddy.fyi`,
`apps/grocery` → `grocery.teddy.fyi`), which unblocked the rest — the grocery app
could not be routed off a path while the SPA owned `/` on teddy.fyi, because a
GCE Ingress matches host and path only.

From the original **Option A**, everything that mattered:

- **Ship on merge.** `.github/workflows/deploy-grocery.yml` builds, pushes and
  rolls out on a push to `main` touching `apps/grocery/**`. No laptop, no Docker
  Desktop, no `kubectl` context.
- **SHA-tagged images**, never `:latest`, so there is a rollback and a record of
  what is running.
- **Gated on the existing CI job**, so a red test cannot ship.
- **The app owns its serving stack** — nginx config, Dockerfile, Service,
  Deployment, certificate — the shape `teddy-fyi-api-rust` and the ScribbleRoute
  website already use.

It stayed on GKE rather than moving to a CDN, which was the original A-vs-C
choice. See Option C below: that trade is still available and the split made it
cheaper, not more expensive.

**Not done, deliberately:** the personal site still deploys by hand via `dn` in
the `teddyfyi` repo. Every problem with that workflow is a problem about shipping
*often*, and it now ships a site that changes a few times a year. Automating it
would mean untangling a docroot it shares with hand-written pages and the resume
PDFs, to save a handful of deploys annually.

## Option B — a real installed app: service worker + update prompt

**Still open, and now the highest-value thing left.**

The manifest says the list "keeps working offline." Today that means
`localStorage` survives, but a cold launch with no network fetches `index.html`,
gets nothing, and shows a browser error page. For an app that replaced a native
one and gets opened in a grocery store — exactly where signal is worst — that is
the gap that matters most.

Add `vite-plugin-pwa` (Workbox) and with it:

- **Precache the app shell.** Content-hashed assets are already `immutable`;
  precaching makes a cold, offline launch render the list instead of failing.
  This is the single biggest quality-of-life win left.
- **A real update lifecycle.** `registerSW` with `onNeedRefresh` gives an in-app
  "Update available — reload" prompt, plus periodic update checks. Today a client
  picks up a new bundle on its next launch, silently, with no way to know or
  hurry it.
- **Background sync** for mutations made offline, instead of hoping the app is
  foregrounded when signal returns.

Two things to get right, or a service worker makes shipping *harder*:

- **Scope is no longer a problem** — this was a real caveat when the app lived at
  `teddy.fyi/grocery` and a root-scoped SW would have sat over the resume
  redirects and article pages. On its own origin it owns everything and there is
  nothing else to break. **This is the concrete payoff of having done the move
  first.**
- **A kill switch is still needed.** A bad service worker is the one deploy that
  does not fix itself with a re-ship. Keep a tested "unregister and clear caches"
  path before the first one goes out.

Doing this after the origin move rather than before was deliberate: a SW
installed at `teddy.fyi` would have kept serving the old app from cache on every
device after deploys stopped going there, and clearing it would have meant
shipping a self-unregistering SW to the old origin.

**Cost:** a couple of days, most of it testing the update and offline paths on a
real phone.

## Option C — move the static half to a CDN

**Still available, and cheaper than it was.** The grocery app is static files
behind a Kubernetes Deployment, an image build, a container registry and a
rollout, when what it needs is a CDN.

What the split already bought toward this: the app has its own origin, its own
docroot with nothing hand-written in it, and an nginx config that is now just an
SPA fallback plus three cache rules. Nothing about `/resume`'s user-agent sniff,
`/pdf/`, or the legacy pages is entangled with it any more — those all stayed on
`teddy.fyi`. Porting the config is close to trivial now, where before it meant
disentangling a shared docroot.

What it would add:

- **Deploy = upload.** Seconds, no Docker, no GCR, no `kubectl`, no cluster
  credentials in a workflow.
- **Preview URLs per PR.** Every branch gets a real URL on a real phone before it
  merges. For an app whose whole surface is touch behaviour and safe-area
  padding, this is worth more than any test suite.
- **A CDN instead of one 50m-CPU pod**, which is also the honest answer to a
  household app running a single replica.

What it costs: `grocery.teddy.fyi` moves off the GCLB static IP, so the host rule
and `grocery-teddy-fyi-cert` come out of `teddyfyi`'s ingress — which is a
four-way certificate contract, so that edit needs care. And it is a second DNS
cutover on a hostname people have already installed to their home screens, though
this one does not change the origin, so nobody signs out.

## Recommendation

**B next, C when the Deployment starts feeling like overhead.**

B is the one the household actually notices — an app that opens in a shop with no
signal — and the origin move already removed its worst caveat. C is a real
simplification but the pipeline it would replace now works; do it when the
maintenance of a GKE Deployment for a bag of static files stops being worth it,
not before.
