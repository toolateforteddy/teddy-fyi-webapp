# teddy-fyi-webapp

A pnpm workspace holding the two React + TypeScript + Vite apps behind
[teddy.fyi](https://teddy.fyi):

- **`apps/personal`** → `teddy.fyi`. A personal site: about, articles, and
  [`/cracked`](https://teddy.fyi/cracked).
- **`apps/grocery`** → `grocery.teddy.fyi`. **Grocery**, a shared,
  install-to-home-screen grocery list that replaces an iOS app. The phone
  experience is the product, not an afterthought.
- **`packages/shared`** — what both genuinely use: the theme tokens and an error
  boundary. Deliberately thin.

They used to be one bundle. They were split because they have nothing in common
but a colour palette and a very different idea of how often they ship — see
[DEPLOYMENT.md](./DEPLOYMENT.md).

## Quick start

```bash
pnpm install
pnpm dev:personal   # http://localhost:5173
pnpm dev:grocery    # http://localhost:5174
```

Both can run at once. Only the grocery app proxies `/api` and `/auth` to
`localhost:3000` for a locally running API.

| Command | |
|---|---|
| `pnpm build` | build both apps |
| `pnpm lint` | ESLint across the workspace |
| `pnpm test:run` | Vitest, one shot (CI's invocation) |
| `pnpm --filter grocery <script>` | scope any of the above to one app |

pnpm only — see `.agents/AGENTS.md`.

## Layout

```
apps/
  personal/         teddy.fyi — three public pages
    src/routes/     LandingPage, ArticlesPage, CrackedPage, NotFoundPage
  grocery/          grocery.teddy.fyi — the app
    src/
      features/     domain modules: auth, grocery, sync, dashboard
      routes/       the shell at /, plus /login and /link
      lib/          axios instance: auth refresh queue, X-Client-UUID
      config/       env.ts, storageKeys.ts
      hooks/ utils/ types/
    nginx.conf      its own front end
    Dockerfile
    k8s/            its own Service, Deployment and certificate
packages/
  shared/           ErrorBoundary, theme.css
```

Grocery state lives in `localStorage` (`apps/grocery/src/config/storageKeys.ts`)
and syncs against the Rust API in `../teddy-fyi-api-rust`
(`https://api-rust.teddy.fyi`).

## Deploying

**The two apps deploy differently, on purpose.**

- **Grocery ships on merge.** Push to `main` touching `apps/grocery/**` and
  `.github/workflows/deploy-grocery.yml` builds it, pushes a SHA-tagged image and
  rolls out `grocery-dep`. Rollback is `kubectl rollout undo`.
- **The personal site is deployed by hand**, from the sibling
  [`teddyfyi`](https://github.com/toolateforteddy/teddyfyi) repo:
  `cd ../teddyfyi && . cmd && dn`. It changes a few times a year and shares a
  docroot with hand-written pages over there.

Read **[DEPLOYMENT.md](./DEPLOYMENT.md)** before you need it: what each pipeline
does, what the Ingress in `teddyfyi` owns that this repo must not, how an
installed home-screen app picks up a new build, and the cross-origin coupling
(CORS, cookies, OAuth origins) that the two-origin split introduced.

## Browser support

Pinned to Safari/iOS 16.4+ in both apps' `vite.config.ts`, because Tailwind v4
emits `oklch()`/`color-mix()`/`@property` with no fallbacks. Older browsers get
the static notice in `index.html` instead of an unreadably broken page.

## Other docs

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — how both apps reach production
- [`docs/deployment-options.md`](./docs/deployment-options.md) — what is built and what is still on the table
- [`BOOTSTRAP.md`](./BOOTSTRAP.md) — the prompt this repo was scaffolded from
- [`PRIOR_ART.md`](./PRIOR_ART.md) — what came before
- [`.agents/AGENTS.md`](./.agents/AGENTS.md) — rules for agents working here
