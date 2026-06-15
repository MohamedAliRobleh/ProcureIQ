# ProcureIQ Phase 7a: Real Multi-Org (Clerk Organizations) — Design Spec

## Context

Phase 6 replaced the mock layer with real services (Neon/Prisma, Clerk auth, Anthropic, Cloudinary, Brevo). Throughout, tenancy was a deliberate placeholder: `ORG_ID = 'org_demo'`, a constant used in all 13 API endpoints (the 6b "shared demo org" decision). Phase 7 builds the Admin Panel and Supplier Portal — both of which are only meaningful on top of real per-org tenancy. **7a is that foundation.**

**Phase 7 decomposition** (each its own spec → plan → build): **7a real multi-org (this spec)** → 7b Admin Panel (`/admin`) → 7c Supplier Portal (`/portal`).

**Decisions made during brainstorming:**
- **New orgs start empty**, with a "Load sample data" action that seeds the demo dataset into that org.
- **An active org is required** — no-org sessions are gated behind org selection; the API returns 403.
- **Clerk Organizations** will be enabled in the dashboard (the recommended path). Key-optional: the suite stays green with Organizations off (tests mock Clerk).

## Goal

`orgId` becomes real end-to-end: every API request is scoped to the org from the authenticated Clerk session, users can switch/create orgs, the app is gated behind having an active org, and a brand-new org can be populated with sample data on demand.

## Architecture

### Backend — org from the session

`api/_lib/auth.js` `requireAuth` reads the active org from the verified token and enforces it:

```js
const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
const orgId = payload.org_id ?? null
if (!orgId) return res.status(403).json({ error: 'No active organization' })
req.auth = { userId: payload.sub, orgId }
```

(`org_id` is a default Clerk session-token claim, present when an org is active.) The `ORG_ID` constant and `api/_lib/org.js` are **removed**. All **13 endpoints** swap `ORG_ID` for `req.auth.orgId` — in every `where: { orgId }` filter and on every created record (`suppliers`, `contracts`, `spend` create/patch; `risk`/`esg`/`assistant`/`summarize`/`upload-signature`/`notify` reads). Org-scoping is unchanged; the value is now per-request.

### Backend — per-org seeding

`api/_lib/seedData.js` exports `buildSeedData(orgId)`: it re-keys the existing `src/lib/mockData.js` arrays into a target org. Every id is namespaced (`${orgId}__<originalId>`), foreign keys (`contract.supplierId`, etc.) are rewritten to the namespaced supplier ids, and `orgId` is set on every record. This reuses the canonical demo dataset (DRY), stays FK-consistent, and is collision-free across orgs. `mockData.js` is pure (no React) — safe to import from `api/`.

`POST /api/contracts`-style endpoint `POST /api/org/seed`:
1. `requireAuth` → `req.auth.orgId`.
2. POST-only (405).
3. `prisma.supplier.count({ where: { orgId } })` — if `> 0`, return `{ seeded: false }` (no-op; never duplicates).
4. Else `createMany` the `buildSeedData(orgId)` dataset in FK order (suppliers → contracts → riskAssessments → esgResponses → spendRecords), return `{ seeded: true }`.

### Frontend — org as a first-class concept

- `src/lib/auth.jsx` — `useOrganization` becomes Clerk's real hook (replacing the static demo-org stub); add `OrganizationSwitcher` to the exports. The `TopBar` renders `<OrganizationSwitcher/>` (the org name/switcher replaces the static org text).
- `RequireOrg` (new, in `src/components/layout/`, mirroring `ProtectedRoute`): `useOrganization()` → not loaded → `LoadingSpinner`; no `organization` → a centered "Select or create an organization" screen with `<OrganizationSwitcher/>`; org present → `children`. It wraps the AppShell route element **inside** `ProtectedRoute` (so: signed-in AND has an org).
- **Org-keyed providers:** the data-provider stack (Supplier/Contract/Spend/Chat) is keyed on the active org id, so switching orgs remounts the stack and refetches everything for the new org. The apiClient's per-request `getToken()` already returns a token carrying the newly-active org. (Implementation: a thin component reads `useOrganization().organization?.id` and renders the provider stack with `key={orgId}`.)
- **Dashboard empty state:** when the org has zero suppliers (`useSuppliers()` resolves empty), the Dashboard shows a "Load sample data" panel whose button calls `/api/org/seed` then `window.location.reload()` (a one-shot action; reload is simplest and refetches everything).

## Data Flow (after 7a)

```
Clerk session (active org) ──getToken()──▶ apiClient (Bearer)
                                              │
                                              ▼
                          requireAuth → verifyToken → payload.org_id  (403 if none)
                                              │  req.auth = { userId, orgId }
                                              ▼
                              13 endpoints (where: { orgId: req.auth.orgId }) → Prisma → Neon

Empty org → Dashboard "Load sample data" → POST /api/org/seed → buildSeedData(orgId) → createMany → reload
Switch org → provider stack key changes → remount → refetch new org's data
```

## Testing

- **`api/_lib/auth.test.js`** — extend: a token with `org_id` sets `req.auth = { userId, orgId }`; a verified token with **no** `org_id` → 403 (handler not called).
- **All 13 endpoint handler tests** — currently assert `orgId: 'org_demo'`. Each now sets `req.auth = { userId, orgId: 'org_test' }` on the request and asserts the Prisma calls use `org_test` (and created records carry it). Mechanical, but touches every endpoint test. (`requireAuth` stays mocked as identity in these, so the handler reads `req.auth` directly.)
- **`api/_lib/seedData.test.js`** — `buildSeedData('org_x')`: all ids namespaced with `org_x__`, every `orgId === 'org_x'`, and every `contract.supplierId` (and risk/esg/spend `supplierId`) points to a supplier id that exists in the returned `suppliers`.
- **`api/org/seed.test.js`** — mocks auth/prisma/seedData: empty org (`supplier.count` → 0) calls `createMany` for all 5 entities and returns `{ seeded: true }`; non-empty (`count` → >0) returns `{ seeded: false }` without `createMany`; 405 non-POST.
- **Frontend** — the global auth mock keeps `useOrganization` returning a mock org and stubs `OrganizationSwitcher`, so existing page tests are unaffected. New: `RequireOrg` (no-loaded → spinner; no-org → selection screen; org → children, driven by the mutable `authState`); TopBar renders the org switcher; Dashboard shows "Load sample data" when suppliers is empty and the button POSTs `/api/org/seed` (stub returns `{ seeded: true }`; assert the call). `src/test/authState.js` gains a mutable `organization` so `RequireOrg` tests can simulate no-org.
- **Manual (deferred until Organizations enabled):** turn on Organizations in Clerk; sign in → if no org, the gate shows the switcher → create an org → empty Dashboard → "Load sample data" → data appears → add/edit works → create a second org → it's empty and independent → switch back → first org's data intact.

## Out of Scope (deferred)

- Member / role management and invites (7b — Admin Panel)
- Per-org settings, branding, billing
- Migrating the stranded `org_demo` seed (it becomes dev-only/legacy; real orgs use the per-org seed via `/api/org/seed`)
- Org deletion / data export
- Per-org rate limits or quotas
