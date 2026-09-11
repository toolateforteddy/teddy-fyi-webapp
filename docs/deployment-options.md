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

**Built, apart from background sync.**

The problem it was written for: the manifest says the list "keeps working
offline", and that meant `localStorage` survived, but a cold launch with no
network fetched `index.html`, got nothing, and showed a browser error page. For an
app that replaced a native one and gets opened in a grocery store — exactly where
signal is worst — that was the gap that mattered most.

`vite-plugin-pwa` (Workbox) is configured in `apps/grocery/vite.config.ts`. Of the
three things listed here:

- **Precache the app shell — done.** The whole build precaches (there are no
  dynamic imports to miss), plus the Google Fonts stylesheet and font files via
  runtime caching. A cold, offline launch renders the list. The manifest's
  screenshots are deliberately excluded: the browser's install dialog reads them,
  the app never does, and they are larger than everything else put together.
- **A real update lifecycle — done.** The worker still installs and waits rather
  than seizing a running session, but the session is now told: `UpdateBanner`
  offers "A new version is ready" with a Reload button, which posts `SKIP_WAITING`
  and reloads once the new worker controls the page. Dismissing it is free — the
  worker stays waiting and takes over at the next cold launch either way.
  `registration.update()` runs hourly and on every return to the foreground, which
  is what makes a deploy reachable at all on a device that is launched rather than
  loaded. The mechanics, and the two things worth not re-deriving, are in
  [`DEPLOYMENT.md`](../DEPLOYMENT.md).
- **Background sync — not done.** Offline mutations still queue in `localStorage`
  (every row carries a `sync_state`) and flush when the app is foregrounded and
  the `online` event fires. That is "hoping the app is open when signal returns",
  which is usually true for this app and not always.

The two caveats, resolved:

- **Scope was no longer a problem** — a real caveat when the app lived at
  `teddy.fyi/grocery` and a root-scoped SW would have sat over the resume
  redirects and article pages. On its own origin it owns everything and there was
  nothing else to break. **This was the concrete payoff of having done the move
  first.**
- **The kill switch shipped with it**, at two scopes: `?sw=off` for one device,
  and a `VITE_DISABLE_SW` repository variable plus a manual deploy for the fleet,
  which ships a self-unregistering worker. Both are described in
  [`DEPLOYMENT.md`](../DEPLOYMENT.md); the per-device path has unit tests in
  `apps/grocery/src/__tests__/pwa.test.ts`.

Doing this after the origin move rather than before was deliberate: a SW
installed at `teddy.fyi` would have kept serving the old app from cache on every
device after deploys stopped going there, and clearing it would have meant
shipping a self-unregistering SW to the old origin.

### The rest of the installed-app surface

Added after the above, and worth knowing about because each one is invisible until
you go looking for it:

- **Installing it is offered, once.** `beforeinstallprompt` is captured in
  `apps/grocery/src/features/pwa/install.ts` — from `main.tsx`, before React
  mounts, because Chrome fires it early and an uncaptured event is an offer nobody
  sees. `InstallBanner` makes the offer and `InstallCard` keeps it in Settings for
  anyone who dismissed it; the dismissal persists, so the banner is not a nag. The
  banner is withheld on anything with a mouse (`(pointer: coarse)`) — Chrome fires
  the event on a laptop too, and the pitch for installing is a home-screen icon that
  opens with no signal. Settings still offers it everywhere, worded for the device.
  iOS has no such event and no API, so there the banner shows the Share → Add to
  Home Screen steps instead.
- **The manifest carries shortcuts, screenshots and a share target.** Long-pressing
  the icon offers Need, Shopping and Add an item; the install dialog shows two real
  screenshots of the app; and Grocery appears in the OS share sheet, landing on
  `/share`, which parks the shared text and opens the add sheet prefilled. The
  screenshots and the shortcut icons are generated from the built app rather than
  drawn, and `apps/grocery/tests/manifest.test.ts` asserts that every file the
  manifest names exists and is the size it claims — a manifest that names a missing
  or mis-sized asset fails silently.
- **The sync indicator knows why it is not synced.** It distinguishes offline from
  stale from "online and still holding N changes", which is the one of the three
  worth investigating. Previously a shop with no signal and an idle tab looked
  identical.

**Remaining cost:** none for what is described above. Background sync is its own
piece of work and is worth doing only if the foreground flush proves insufficient.

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

**C when the Deployment starts feeling like overhead. B is done bar background
sync, which is not worth starting speculatively.**

B's headline — an app that opens in a shop with no signal — is shipped, along with
the update prompt that tells a running session a deploy happened. What remains of it
is background sync, and the honest case for that is thin: offline mutations already
flush when the app is foregrounded, which for an app people open is nearly always.
Wait for a real instance of changes sitting unsent before building it. C is a real
simplification but the pipeline it would replace now works; do it when the
maintenance of a GKE Deployment for a bag of static files stops being worth it, not
before.
