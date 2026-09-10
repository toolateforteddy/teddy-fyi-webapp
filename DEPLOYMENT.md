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

### What the workflow needs configured

Authentication is **Workload Identity Federation** — GitHub mints a short-lived
OIDC token, Google trades it for a service account token, and no credential is
stored here at all. That is why the two values below are repository
**variables** rather than secrets: a provider resource name and a service account
email are not credentials. The trust lives in an IAM binding that names this
repository.

| Repository variable | Value |
|---|---|
| `GCP_WIF_PROVIDER` | `projects/34718544535/locations/global/workloadIdentityPools/github-pool/providers/github` — 34718544535 is the project **number**; the path will not take the project ID (`melodic-sunbeam-164916`) |
| `GCP_DEPLOY_SA` | the deployer service account email, e.g. `grocery-deployer@melodic-sunbeam-164916.iam.gserviceaccount.com` |

The `preflight` job checks both are set and fails with a message naming the
missing one. That job exists because `google-github-actions/auth` reports an
empty value as *"the workflow must specify exactly one of
`workload_identity_provider` or `credentials_json`"* — which reads like the
workflow is malformed when it is fine and the interpolated value was blank. This
workflow's first run lost a debugging round to exactly that.

The service account needs:

- **`roles/artifactregistry.writer`** — or `roles/storage.admin` on the legacy
  GCS-backed `gcr.io` bucket, for `docker push`.
- **`roles/container.developer`** — for `get-gke-credentials`, `kubectl apply`
  and `rollout status` against the `prod` cluster in `us-central1-a`.

One-time setup. **The steps are ordered and the order matters** — a provider is
created *inside* a pool, and running step 2 first fails with a bare
`NOT_FOUND: Requested entity was not found`, which names neither the pool nor
what is missing:

```bash
# 0. The provider path needs the project NUMBER (34718544535), not the project
#    ID (melodic-sunbeam-164916). Re-derive it rather than trusting this comment:
PROJECT_NUMBER=$(gcloud projects describe melodic-sunbeam-164916 \
  --format='value(projectNumber)')

# 1. The pool. It already exists and is called `github-pool` -- NOT `github`.
#    Check rather than assume; the name is what the provider command below hangs
#    off, and getting it wrong is the NOT_FOUND described under the block.
#    (The other pool this lists, melodic-sunbeam-164916.svc.id.goog, is GKE's own
#    workload identity pool -- what api-rust-gsa and friends use for pods. Not
#    this. Leave it alone.)
gcloud iam workload-identity-pools list --location=global

# 2. The provider, inside that pool. Check for one first: if a provider already
#    exists, reuse it rather than adding a second -- but confirm its
#    attributeMapping includes attribute.repository, because step 3 keys on that
#    attribute. A provider mapping only google.subject authenticates fine and
#    then fails impersonation with a much less obvious permission error.
gcloud iam workload-identity-pools providers list \
  --location=global --workload-identity-pool=github-pool
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github-pool \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition="assertion.repository_owner=='toolateforteddy'"

# 3. Let this repository -- and only this repository -- impersonate the SA.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/toolateforteddy/teddy-fyi-webapp"
```

`NOT_FOUND` from step 2 means the **pool** could not be found, not the provider —
it names the parent it was looking for, which reads like it is describing the
thing you are creating. In practice that is a wrong pool name (`github` rather
than `github-pool` is the one that has actually happened here), or a soft-deleted
pool: they linger 30 days and keep the name reserved. `gcloud iam
workload-identity-pools list --location=global --show-deleted` distinguishes the
two, and `undelete github-pool --location=global` recovers the second.

If step 1 itself fails with `SERVICE_DISABLED` or a permission error, the project
is missing `gcloud services enable iamcredentials.googleapis.com
sts.googleapis.com`.

**The `--attribute-condition` is not optional.** Google refuses to create a
provider without one, and the reason is the failure it prevents: an
unconditioned pool trusts tokens from *any* repository on GitHub, so anyone could
mint one and impersonate this service account. The binding then narrows further
to this single repository via `attribute.repository`.

`teddy-fyi-api-rust` still uses a long-lived `GCP_SA_KEY`. Its own
`context/2026-09-05_pre_split_changes.md` item 5 rates that a 9 and says to move
to WIF **before** a second repository needs the same access. This repository is
that second one, and it is federated; migrating the API is the remaining half of
that item, and the pool and provider above are already shared infrastructure it
can use.

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
