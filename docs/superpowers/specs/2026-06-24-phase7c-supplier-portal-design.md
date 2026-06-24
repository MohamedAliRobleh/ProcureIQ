# Phase 7c — Supplier Portal (internal buyer view) — Design

Date: 2026-06-24
Status: Approved (brainstorming)

## Summary

Replace the `/portal` placeholder with a real **Supplier Portal** module. The portal
is an **internal buyer-org view** (reuses the existing Clerk org-member auth — no
external supplier identity, no public links). A buyer-org member creates **requests**
addressed to a supplier (e.g. "Submit ESG questionnaire", "Upload insurance
certificate") and tracks each request through a status lifecycle. Because access is
internal-only, all status transitions are buyer-driven: the buyer records that the
supplier responded (offline) by moving the request to `submitted`, then `approved` or
`rejected`.

The central artifact is a new `PortalRequest` model. The module follows the exact
architecture of every other module in the app: **Prisma model → org-scoped Vercel
function API → React context provider → page**.

## Scope (and explicit non-goals)

In scope:
- New `PortalRequest` Prisma model + relation on `Supplier`.
- Org-scoped CRUD API endpoints + a Brevo notify endpoint.
- `PortalContext` provider wired into the org-scoped provider stack.
- `Portal.jsx` page: filterable request table, create modal, detail slide-over with
  status actions, supplier-email notification, delete.
- Per-request optional **due date**.
- **Brevo email** on demand (reuses Phase 6e infra), sent to `supplier.email`.
- Seed data for the new model + multi-org clear/reset wiring.

Explicit non-goals (YAGNI for this phase):
- No external/supplier-facing authentication or public token links.
- No KPI/aggregate cards on the page (deliberately omitted — keep the page focused).
- No AI/Anthropic draft-generation for request content.
- No overdue auto-status (due date is display-only; the 4-status lifecycle is fixed).
- No file upload inside the portal (document collection stays with Phase 6d contracts).

## Data model

New Prisma model in `prisma/schema.prisma`:

```prisma
model PortalRequest {
  id           String    @id
  orgId        String    @default("org_demo")
  supplierId   String
  supplier     Supplier  @relation(fields: [supplierId], references: [id])
  type         String    @default("general")
  title        String
  message      String?
  status       String    @default("pending")
  dueDate      DateTime?
  responseNote String?
  createdBy    String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

Add the back-relation to `Supplier`:

```prisma
  portalRequests PortalRequest[]
```

Field semantics:
- `type` — fixed set of 4 values: `esg_questionnaire` | `document` | `risk_review` |
  `general`. Validated on create/patch; invalid values rejected (400).
- `status` — fixed lifecycle: `pending` → `submitted` → `approved` | `rejected`.
  Default `pending`. (No `overdue`; `dueDate` is display-only.)
- `message` — request instructions/body (optional).
- `responseNote` — buyer records the supplier's offline response when moving to
  `submitted` (optional).
- `dueDate` — optional deadline, shown in the list.

This mirrors the existing models (`orgId @default("org_demo")`, string `id`, string
status fields, `updatedAt`) so it slots into the same Prisma/Neon + seed conventions.

## API (Vercel functions, org-scoped via `requireAuth`)

All endpoints use the existing `requireAuth` wrapper (sets `req.auth = { userId, orgId,
orgRole }`) and scope every query by `req.auth.orgId`. New files under `api/portal-requests/`.

- **`GET /api/portal-requests`** (`api/portal-requests/index.js`)
  Returns the org's requests ordered by `createdAt desc`, each including the related
  supplier's `id` + `name` (Prisma `include`/`select`) for table display.

- **`POST /api/portal-requests`** (`api/portal-requests/index.js`)
  Creates a request. Body: `{ supplierId, type, title, message?, dueDate?, status? }`.
  - Validates `supplierId` belongs to the caller's org (lookup scoped by orgId; **404**
    if not found). This closes the deferred 7a #2 referential-integrity gap for this
    new endpoint.
  - Validates `type` ∈ the 4 allowed values and `status` ∈ the 4 allowed values
    (defaults `general` / `pending`); **400** on invalid.
  - Sets `orgId = req.auth.orgId`, `createdBy = req.auth.userId`, generates `id`.

- **`PATCH /api/portal-requests/[id]`** (`api/portal-requests/[id].js`)
  Org-scoped update (status transitions, `responseNote`, editable fields). Strips `id`
  and `orgId` from the update body (immutability pattern from 7a — prevents cross-org
  writes). Validates `type`/`status` enums when present. **404** if the id isn't in the
  caller's org.

- **`DELETE /api/portal-requests/[id]`** (`api/portal-requests/[id].js`)
  Org-scoped delete. **404** if not in the caller's org.

- **`POST /api/portal-requests/notify`** (`api/portal-requests/notify.js`)
  Reuses the Phase 6e Brevo lib (`api/_lib/email.js`). Body: `{ id }`. Looks up the
  request (org-scoped, **404** if absent) + its supplier; sends the request
  (title/message/dueDate) by email to **`supplier.email`**. Returns **503** if Brevo is
  unconfigured (same guard as contracts/notify), **502** on send failure. Email HTML is
  built with escaped interpolation (avoid the unescaped-interpolation wart noted on
  `contracts/notify`).

Error/response conventions match the existing handlers (method guard → auth → validation
→ prisma → JSON). Tests follow the established convention: set `req.auth = { orgId:
'org_test', userId: 'user_test' }` and assert `where: { orgId: 'org_test' }`.

## Frontend

- **`src/context/PortalContext.jsx`** — mirrors `ContractContext.jsx`. Exposes:
  - `requests` (list), `loading`, `error`
  - `createRequest(data)` → POST, prepends to list
  - `updateRequest(id, patch)` → PATCH, merges into list (used for status actions:
    mark-submitted+responseNote, approve, reject)
  - `deleteRequest(id)` → DELETE, removes from list
  - `notifyRequest(id)` → POST notify (gated: surfaced only when the endpoint is usable,
    same pattern as `notifyContract`)
  Uses the shared `apiClient`. Added to the `OrgScopedProviders` provider stack so it
  remounts on org switch (keyed on org id like the rest).

- **`src/pages/Portal.jsx`** — uses `PageHeader` + `Card` + existing UI primitives
  (`Modal`, `Badge`, table styling, `ConfirmDialog`) to match the app.
  - A **filter** by status (all / pending / submitted / approved / rejected).
  - A request **table**: supplier name, type, title, status badge, due date.
  - **"New request"** button → `Modal` form: supplier (select from `SupplierContext`),
    type (4 options), title, message, optional due date. Submits via `createRequest`.
  - Row click → **slide-over** (same slide-over pattern as Contracts/SupplierDetail)
    showing full detail + status actions:
    - Mark **submitted** (with a `responseNote` field), **approve**, **reject** — each
      via `updateRequest`.
    - **"Notify supplier"** button (gated on `notifyRequest` availability).
    - **Delete** (via `ConfirmDialog`).
  - Empty state consistent with other modules.

- **`src/App.jsx`** — import and route `Portal` at `/portal`; remove `/portal` from
  `PLACEHOLDER_ROUTES`. Nav item in `constants.js` already exists (keep it).

## Seed & multi-org consistency

- **`src/context/mockData.js`** — add a small set of sample `portalRequests` (a few per
  a couple of suppliers, covering the different statuses/types) so the page isn't empty.
- **`api/_lib/seedData.js`** (`buildSeedData`) — re-key the new records per org (ids
  namespaced `${orgId}__<id>`, `supplierId` FK rewritten), same as the other models.
- **`api/org/seed.js`** — include `portalRequest.createMany` in FK order (after
  suppliers).
- **`api/org/clear.js`** — add `portalRequest.deleteMany` (child, before suppliers).
- **`api/org/reset.js`** — include the new model in both the clear and re-seed steps.

## Testing

Match the established conventions; the suite must stay green (currently 322 tests; run
src serial via `--no-file-parallelism`, api + src in two halves to avoid worker-timeout
flakes).

- `api/portal-requests/index.test.js` — GET (org-scoped list + supplier include), POST
  (happy path, supplier-not-in-org 404, invalid type/status 400, orgId/createdBy set).
- `api/portal-requests/[id].test.js` — PATCH (status transition, id/orgId stripped,
  cross-org 404, enum validation), DELETE (org-scoped, 404).
- `api/portal-requests/notify.test.js` — 503 unconfigured, 404 missing, happy-path send
  to supplier.email, 502 on send failure (mock the email lib like 6e tests).
- `api/_lib/seedData.test.js` — extend to assert portalRequests are re-keyed/FK-rewritten.
- `api/org/clear.test.js` / `reset.test.js` — assert portalRequest deleteMany/createMany
  included in the transaction in the right order.
- `src/context/PortalContext.test.jsx` — create/update/delete/notify against a mocked
  apiClient.
- `src/pages/Portal.test.jsx` — renders list, opens create modal, status actions call
  updateRequest, notify gated, delete confirm.
- `src/App.test.jsx` — `/portal` now renders the real page (update the placeholder
  assertion).

## Execution

Built via the established workflow: `superpowers:subagent-driven-development` from a
plan file in `docs/superpowers/plans/`, committed directly on `main` (the pattern since
Phase 3), then merged. Each task: implementer + spec reviewer + quality reviewer.
