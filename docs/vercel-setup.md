# Vercel setup — ProcureIQ

ProcureIQ deploys to Vercel as a single project: a **Vite + React** static frontend plus
**serverless functions** under `api/`. This doc lists the deployment configuration the app
expects, with recommended values. (See also `.env.example` and `docs/clerk-setup.md`.)

## 1. Project shape (already configured)

| Piece | Value | Notes |
|---|---|---|
| Framework preset | **Vite** | Vercel auto-detects it. |
| Build command | `prisma generate && prisma migrate deploy && vite build` | from `package.json` — see the migration caveat in §4. |
| Output directory | `dist/` | Vite default. |
| Serverless functions | every file in `api/` (21 endpoints) | one file = one route; e.g. `api/contracts/[id].js` → `/api/contracts/:id`. |
| SPA routing | `vercel.json` rewrite | `/((?!api/).*) → /index.html` — sends every non-`/api/` path to the SPA so react-router handles client-side routes, while `/api/*` still hits the functions. **Don't remove this** or deep links (e.g. `/dashboard`) 404 on refresh. |

The repo is already linked (`.vercel/project.json`). New work just needs the env vars set.

## 2. Runtime

- **Node serverless functions** (the default Fluid Compute runtime — do NOT switch these to
  Edge; the handlers use `@clerk/backend`, `@prisma/client`, the Stripe SDK, etc. which need
  the Node runtime). No per-function config is required; the defaults are fine.
- `api/_lib/*` is shared server code (Prisma client, auth, integrations) — imported by the
  functions, never shipped to the browser.

## 3. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, for each environment
(**Production**, **Preview**, **Development**). Full reference + how-to-get-each in
`.env.example`.

**Build-time** (must exist when the build runs):

| Variable | Why build-time |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Vite **inlines** `VITE_*` vars into the client bundle at build. |
| `DATABASE_URL` | the build runs `prisma migrate deploy` (and `prisma generate`). |

**Runtime** (used by the serverless functions on each request):

`DATABASE_URL` (also runtime), `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`,
`CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`, `BREVO_API_KEY` / `_SENDER_EMAIL` /
`_SENDER_NAME`, `STRIPE_SECRET_KEY` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ENTERPRISE`,
`APP_URL`.

> All the integration keys are **key-optional**: missing keys make the related endpoint
> return 503 and the UI degrade gracefully — the app still builds and runs. Only
> `DATABASE_URL` + the two Clerk keys are strictly required.

**`APP_URL` per environment:** set it to that environment's own URL (e.g. the production
domain for Production, the preview URL pattern for Preview) so Stripe Checkout
success/cancel redirects land back on the right deployment. If unset it falls back to
`http://localhost:5173`.

## 4. Migration caveat (important)

The build command runs **`prisma migrate deploy`** on every deploy. Consequences:

- `DATABASE_URL` **must** be set (and the DB reachable) at build time, or the build fails.
- Every deploy applies any pending migrations to the live DB. `migrate deploy` is
  production-safe (it only applies pending migrations in order — it never resets/drops), so
  this is convenient and idempotent.
- Trade-off: it couples each deploy to DB availability and runs against the **same** DB for
  every environment that shares `DATABASE_URL`. If you later want Preview deploys to hit a
  separate branch database, give Preview its own `DATABASE_URL` (e.g. a Neon branch), or
  move the migrate step out of the build into a dedicated release step.

## 5. Deploy flow

- **Git-connected** (recommended): push to `main` → Production; open a PR → Preview
  deployment with its own URL. Each deploy reruns the build (incl. migrate deploy).
- **CLI**: `vercel` (preview) / `vercel --prod` (production) from the repo root.

## 6. Recommendations / checklist

- [ ] All env vars set for **Production** and **Preview** (at minimum `DATABASE_URL` + the
      two Clerk keys; add integration keys as you enable each).
- [ ] `APP_URL` set per environment (for Stripe redirects).
- [ ] Keep `vercel.json`'s SPA rewrite; keep `api/` functions on the Node runtime.
- [ ] Confirm the first deploy's build log shows `prisma migrate deploy` applied cleanly.
- [ ] (Optional) Give Preview its own `DATABASE_URL` (Neon branch) so previews don't write
      to the production database.
- [ ] (Optional, modernization) Vercel now recommends a typed **`vercel.ts`** over
      `vercel.json`. The current `vercel.json` works fine; migrate only if you want dynamic
      config. The single rewrite rule ports 1:1.
