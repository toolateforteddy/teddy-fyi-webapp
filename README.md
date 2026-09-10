# teddy-fyi-webapp

The React + TypeScript + Vite SPA behind [teddy.fyi](https://teddy.fyi) — a
personal site whose main tenant is **Grocery**, a shared, install-to-home-screen
grocery list. It replaces an iOS app; the phone experience is the product, not an
afterthought.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5174
```

| Command | |
|---|---|
| `pnpm dev` | dev server, proxying `/api` and `/auth` to `localhost:3000` |
| `pnpm build` | `tsc -b && vite build` → `dist/` |
| `pnpm lint` | ESLint |
| `pnpm test:run` | Vitest, one shot (CI's invocation) |

pnpm only — see `.agents/AGENTS.md`.

## Layout

```
src/
  features/       domain modules: auth, grocery, sync, dashboard
  routes/         React Router pages + AuthenticatedRoute
  components/     shared ui/ and layout/
  providers/      AppProvider (error boundary, router, contexts)
  lib/            axios instance: auth refresh queue, X-Client-UUID
  config/         env.ts, storageKeys.ts
  hooks/ utils/ store/ types/
public/           docroot-root assets: manifest, icons, favicon
```

State lives in `localStorage` (`src/config/storageKeys.ts`) and syncs against the
Rust API in `../teddy-fyi-api-rust` (`https://api-rust.teddy.fyi`).

## Deploying

**Merging to `main` does not deploy.** CI lints, tests and builds — it does not
ship. Deploys are run by hand from a laptop, out of the sibling
[`teddyfyi`](https://github.com/toolateforteddy/teddyfyi) repo:

```bash
cd ../teddyfyi && . cmd && dn
```

Read **[DEPLOYMENT.md](./DEPLOYMENT.md)** before you need it: what `dn` does, what
the machine running it needs, why there is no rollback, and how an
already-installed home-screen app picks up a new build.

## Browser support

Pinned to Safari/iOS 16.4+ (`vite.config.ts`) because Tailwind v4 emits
`oklch()`/`color-mix()`/`@property` with no fallbacks. Older browsers get the
static notice in `index.html` instead of an unreadably broken page.

## Other docs

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — how this reaches production today
- [`docs/deployment-options.md`](./docs/deployment-options.md) — three ways to make shipping easier
- [`BOOTSTRAP.md`](./BOOTSTRAP.md) — the prompt this repo was scaffolded from
- [`PRIOR_ART.md`](./PRIOR_ART.md) — what came before
- [`.agents/AGENTS.md`](./.agents/AGENTS.md) — rules for agents working here
