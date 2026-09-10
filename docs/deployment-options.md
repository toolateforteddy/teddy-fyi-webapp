# Three ways to ship this app more easily

Written after concluding the webapp is the replacement for the iOS grocery app.
That conclusion changes the requirements: a personal site can tolerate "deployed
when Teddy is at his laptop with Docker running." A grocery list that a household
depends on, installed on phones and a tablet, cannot.

**What's wrong today** (details in [`../DEPLOYMENT.md`](../DEPLOYMENT.md)):

1. Deploying needs a laptop with a `teddyfyi` sibling checkout, Docker Desktop,
   `gcloud` push rights and a `kubectl` context. Merging to `main` ships nothing.
2. The image is only ever `:latest`. No rollback, and nothing records which
   commit is live.
3. Two repos are coupled by a relative filesystem path. `teddyfyi`'s `build`
   compiles *whatever is checked out* next door, not what was merged.
4. There is no service worker despite the manifest promising offline. Updates
   depend on `index.html` being `no-cache`; a client can be a launch behind and
   there is no way to know or to push it forward.
5. The whole app is served by one nginx pod on GKE whose real job is being the
   front door for three unrelated products.

The three options below are ordered by cost. They are not mutually exclusive —
**A is worth doing regardless**, and is the prerequisite for the interesting half
of B and C.

---

## Option A — Ship on merge, from GitHub Actions

*Keep GKE and nginx exactly as they are. Move the human out of the loop.*

Add a deploy workflow to this repo that, on push to `main`, builds the SPA, builds
the nginx image and rolls out `site-dep` — the same four steps `dn` does, on a
runner instead of a laptop. The API and ScribbleRoute already deploy this way from
their own repos; this is the last thing on the cluster that doesn't.

The awkward part is that the docroot is assembled in `teddyfyi`, not here. Two
honest ways to resolve it:

- **A1 — deploy from `teddyfyi`,** triggered by a `repository_dispatch` from
  this repo on merge. The workflow checks out both repos side by side, so `cmd`'s
  build works unchanged. Smallest diff, keeps one owner of the docroot; costs a
  cross-repo trigger and a token.
- **A2 — move the docroot here.** The dozen hand-written pages in
  `teddyfyi/static/` become `public/` files (or real routes), and this repo owns
  its own `Dockerfile` and `k8s/site.yaml`. `teddyfyi` keeps `ingress.yaml`, the
  shared front door, and nothing else about the site. That is exactly the shape
  the API and ScribbleRoute already migrated to, and it deletes the rsync
  `--delete` exclude list — the mechanism that currently silently eats files.

Either way, do these alongside it, because they are what makes automation safe:

- **Tag images by commit SHA**, not just `:latest`. Set the Deployment's image to
  the SHA so a rollback is `kubectl rollout undo` or a one-line revert, and
  `kubectl get deploy site-dep -o …` finally answers "what's live?".
- **Stamp the build.** Inject the SHA at build time and render it in the settings
  panel. "Which build is this phone on?" becomes answerable without guessing.
- **Gate the deploy on the existing CI job**, so a red test can't ship.

**Cost:** a day, most of it in A2's docroot move. **Buys:** merge-to-live,
rollback, provenance, and no laptop. **Doesn't buy:** anything about clients that
are already installed and offline, or the fact that this is a household-critical
app on a single-replica pod behind a shared ingress.

---

## Option B — Make it a real installed app: service worker + update prompt

*A is about getting bytes to the server. B is about getting them to the phone —
and about the manifest's offline promise being true.*

The manifest says the list "keeps working offline." Today that means
`localStorage` survives, but a cold launch with no network fetches `index.html`,
gets nothing, and shows a browser error page. For an app that replaced a native
one and gets opened in a grocery store — exactly where signal is worst — that is
the gap that matters most.

Add `vite-plugin-pwa` (Workbox) and with it:

- **Precache the app shell.** Content-hashed assets are already `immutable`;
  precaching makes a cold, offline launch render the list instead of failing.
  This is the single biggest quality-of-life win in the whole document.
- **A real update lifecycle.** `registerSW` with `onNeedRefresh` gives an
  in-app "Update available — reload" prompt, and periodic update checks. Today a
  client picks up a new bundle on its next launch, silently, with no way to know
  or hurry it.
- **Background sync** for grocery mutations made offline, instead of hoping the
  app is foregrounded when signal returns.

Two things to get right, or a service worker makes shipping *harder*:

- **Scope.** The SW would sit at `/`, i.e. over the whole of teddy.fyi including
  the hand-written pages and the `/resume` redirects. Register it under
  `/grocery` scope, or be deliberate about what it's allowed to precache.
- **A kill switch.** A bad service worker is the one deploy that doesn't fix
  itself with a re-ship. Keep a tested "unregister and clear caches" path before
  the first one goes out.

**Cost:** a couple of days, most of it testing the update and offline paths on a
real phone. **Buys:** offline launch, deterministic updates, a push channel to
installed clients. **Depends on A** for the "ship a fix in minutes" half to be
real. **Doesn't buy:** anything about the server.

---

## Option C — Get off the cluster for the static half: Cloudflare Pages / Firebase Hosting

*The most leverage per unit of work, and the biggest departure.*

This app is static files. It needs a CDN, not a Kubernetes Deployment, an image
build, a container registry and a rollout. The GKE pod exists because in 2017 the
site was the cluster's reason to exist — but the API moved out, ScribbleRoute
moved out, and what's left is one nginx serving HTML behind a load balancer whose
real job is routing to two other products.

Point `teddy.fyi` at Cloudflare Pages (or Firebase Hosting, or Cloud Storage +
CDN) and deploy this repo directly:

- **Deploy = upload.** Seconds, from a GitHub Action, with no Docker, no GCR, no
  `kubectl`, no cluster credentials in a workflow.
- **Preview URLs per PR.** Every branch gets a real URL on a real phone before it
  merges. For an app whose whole surface is touch behaviour and safe-area
  padding, this is worth more than any test suite.
- **Instant rollback** to any previous deploy, from a UI, from a phone.
- **A CDN instead of one 50m-CPU pod**, which is also the honest answer to a
  household app being a single replica.

What has to be ported:

- The `nginx.conf` rules that are still doing real work: the SPA fallback
  (`try_files … /index.html`, native on both platforms), the `/index.html`
  `no-cache` + `/assets/` `immutable` split (Pages does this by default; assert it
  anyway), the `/resume` and `/resume-devex` user-agent sniff for link unfurls,
  and the `/pdf/` paths. **The UA sniff is the only piece with no direct
  equivalent** — it needs a Cloudflare Function / Firebase rewrite, or to be
  dropped in favour of always serving the OG preview page with a client-side
  redirect for humans.
- The PDFs and images currently baked into the image from `teddyfyi/pdf/` and
  `teddyfyi/images/`.
- **DNS.** `teddy.fyi` moves off the GCLB static IP; `api-rust.teddy.fyi` stays on
  it. Worth checking against `teddyfyi`'s certificate annotation, which is
  already a three-way cross-repo contract — `teddy-fyi-cert` comes out of it,
  and the other five must not.

`teddyfyi` keeps `ingress.yaml`, `k8s/site.yaml` and the Dockerfile retire, and
this repo becomes self-contained.

**Cost:** two or three days, and the DNS/cert cutover wants a quiet evening.
**Buys:** everything in A, plus PR previews, instant rollback and a CDN, while
deleting a container build, a registry, a Deployment and a whole repo's worth of
coupling. **Doesn't buy:** the offline story — that's B, and B stacks on top of
C as easily as on A.

---

## Recommendation

**A now, C next, B alongside.**

A1 is a day and stops the bleeding: merge-to-live with rollback and provenance.
But if the webapp is genuinely the product now, C is where it wants to end up —
it makes A's benefits permanent, adds PR previews on a real phone, and removes
more machinery than it adds. Do A1 as the stepping stone or skip straight to C;
either way B is the one your household will actually notice, and it's worth doing
as soon as shipping a fix is cheap enough that a bad service worker isn't
frightening.
