# ProcureIQ Phase 6a: Backend Foundation + Database — Design Spec

## Context

Phases 1-5 delivered the full UI running on an in-memory mock layer. Phase 6 replaces the mocks with real services. It is decomposed into sub-projects, each with its own spec → plan → implementation cycle:

- **6a. Backend foundation + database** (this spec) — Vercel functions API + Neon/Prisma, contexts swap to real fetches
- 6b. Auth (Clerk) — replaces MockAuthProvider, gates the API, real multi-tenant `orgId`
- 6c. AI (Anthropic) — real assistant behind `getAssistantReply`, contract `aiSummary` / risk `aiAnalysis`
- 6d. Files (Cloudinary) — contract upload/viewer
- 6e. Email (EmailJS) — notifications

Phase 7 (Admin + Supplier Portal) follows.

**Decisions made during brainstorming:** backend = Vercel serverless functions beside the existing Vite SPA (no Next.js migration, no separate server); all five entities migrate in 6a; user has Neon and Vercel accounts ready and supplies `DATABASE_URL` at implementation time.

## Goal

Stand up the API layer and Neon Postgres database, seed it with the same deterministic data the mock layer generates today, and swap the data internals of the contexts/hooks to real fetches — with zero change to their consumer-facing interfaces (beyond a new `isLoading` flag) and the whole test suite still green.

## Architecture

### Database (Prisma + Neon)

`prisma/schema.prisma` defines five models mirroring the mockData shapes exactly:

- **Supplier** — `id String @id`, `orgId String @default("org_demo")`, name, email, phone, country, category, status, riskScore Int, esgScore Int, website, description, `logoUrl String?`, onboardedAt DateTime, createdAt DateTime
- **Contract** — id, orgId, `supplierId` (FK → Supplier), title, status, value Int, currency, startDate/endDate DateTime, autoRenew Boolean, `fileUrl String?` (6d), `aiSummary String?` (6c), terms, createdBy, createdAt, updatedAt
- **RiskAssessment** — id, orgId, supplierId (FK), score Int, level, financialRisk/complianceRisk/operationalRisk/geopoliticalRisk Int, `aiAnalysis String?` (6c), assessedAt DateTime, assessedBy
- **EsgResponse** — id, orgId, supplierId (FK), score Int, environmental/social/governance Int, `answers Json`, `aiSuggestions String?`, submittedAt DateTime
- **SpendRecord** — id, orgId, supplierId (FK), amount Int, currency, category, description, date DateTime, invoiceRef, createdAt DateTime

`prisma/seed.js` ports the current mockData generator logic verbatim (same names, same arithmetic-derived scores, dates relative to seed-run time), so the seeded DB is indistinguishable from today's mock data. Migrations via `prisma migrate dev` locally and `prisma migrate deploy` for Vercel. `DATABASE_URL` in `.env` (gitignored); `.env.example` committed.

### API layer (Vercel serverless functions)

Repo-root `api/` folder:

- `api/_lib/prisma.js` — PrismaClient singleton (cached on `globalThis` so dev hot-reload doesn't exhaust connections)
- `api/_lib/org.js` — `export const ORG_ID = 'org_demo'` — the single line Clerk replaces in 6b
- `api/suppliers/index.js` — GET (list, org-scoped) / POST (create)
- `api/suppliers/[id].js` — PATCH (update)
- `api/contracts/index.js` + `api/contracts/[id].js` — same pattern
- `api/spend/index.js` + `api/spend/[id].js` — same pattern
- `api/risk/index.js` — GET only
- `api/esg/index.js` — GET only

Error contract: 405 for unsupported methods, 400 with `{ error }` for missing required fields (same required fields the modals validate), 500 with `{ error }` on unexpected failure. All responses JSON; Prisma `DateTime` serializes to ISO strings.

`vercel.json` adds the SPA rewrite (all non-`/api` paths → `/index.html`) so client-side routing works in production. Local dev: `vercel dev` serves the Vite app and functions together.

### Frontend swap

- `src/lib/apiClient.js` — thin fetch wrapper: `api.get(path)`, `api.post(path, body)`, `api.patch(path, body)`; JSON in/out; throws `Error` with the server's message on non-OK.
- **SupplierContext / ContractContext / SpendContext** — external interfaces unchanged (`{ suppliers, addSupplier, updateSupplier, setSupplierStatus }` etc.) plus a new `isLoading` flag. Internals: fetch the list on mount; `add*` POSTs and appends the returned record; `update*`/`setStatus` PATCH and merge the returned record. State starts `[]` with `isLoading: true`.
- **Pages reading context directly** gain a loading guard: SupplierDetail renders `LoadingSpinner` while `isLoading` (so "Supplier not found" cannot flash during load); list pages already tolerate empty arrays.
- **useRisk / useEsg** — internals swap from mockData + 150ms timeout to `apiClient` fetches; return shapes unchanged.
- **ChatProvider** — stops importing `riskAssessments`/`esgResponses` from mockData; consumes `useRisk()`/`useEsg()` and passes `riskAssessments ?? []` / `esgResponses ?? []` to the engine (the engine already tolerates empty arrays during load).
- **Dashboard `recentActivity`** stays on mockData (UI garnish, not an entity — out of 6a scope).
- `src/lib/mockData.js` remains in the repo: the seed script and the test fetch-stub derive from it. It stops being imported by production data paths except `recentActivity`.

## Data Flow (after 6a)

```
Neon Postgres ◀── prisma/seed.js (one-time, deterministic)
      ▲
      │ Prisma
api/* functions (org-scoped, REST)
      ▲
      │ fetch (src/lib/apiClient.js)
contexts (Supplier/Contract/Spend) + hooks (useRisk/useEsg)
      ▲
pages/components — unchanged interfaces
```

## Testing

- **API handlers** — plain `(req, res)` functions; unit-tested in vitest with a mocked `_lib/prisma` module (no live DB in tests). Cover: list, create with generated id + orgId, update merge, 405/400 paths.
- **Frontend** — a shared test helper (`src/test/mockApi.js`) stubs global `fetch` and routes `/api/*` to mockData-derived JSON with dates serialized to ISO strings (matching real serialization). Registered in the vitest setup file so all existing context/page tests keep passing **through** the fetch boundary rather than around it. Tests asserting `Date` equality against mockData are updated for ISO-string shapes.
- **Manual verification** — seed Neon, `vercel dev`, round-trip: add a supplier, edit a contract, add a spend record, confirm dashboard aggregates update and survive refresh.

## Deployment

- Vercel project linked to the repo; `DATABASE_URL` set in Vercel env vars
- Build runs `prisma generate` (postinstall) and `prisma migrate deploy`
- Seed run manually once against the Neon database

## Out of Scope (deferred)

- Clerk auth and real multi-org scoping (6b — `ORG_ID` constant marks the spot)
- Anthropic, Cloudinary, EmailJS (6c-6e — nullable columns already in the schema)
- Persisting `recentActivity` / audit log
- Pagination, search-on-server (client-side filtering stays; datasets are small)
- DELETE endpoints (the UI has no delete affordances today)
- Optimistic updates / caching layers (plain fetch-and-set is enough at this scale)
