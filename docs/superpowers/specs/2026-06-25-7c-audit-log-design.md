# Lot C — Admin Audit Log — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Summary

Record sensitive org-level actions in an append-only audit log and surface the recent
entries in the admin page. Scope (user decision): log `clear`, `reset`, `seed`
(destructive/data mutations) and `export` (sensitive read — who downloaded a backup).
Member/role changes are out of scope — they flow through Clerk's prebuilt
`OrganizationProfile`, not our API, and would require Clerk webhooks (a separate lot).

## Scope (and non-goals)

In scope:
- New `AuditLog` Prisma model.
- `api/_lib/audit.js` `buildAuditData` helper.
- Log entries from `clear`, `reset`, `seed` (inside their existing `$transaction`, so the
  entry is written iff the action commits) and `export` (best-effort, after the read).
- New admin-only `GET /api/org/audit` (recent 50, newest first).
- `src/utils/auditLabels.js` + an "Activity log" card in `src/pages/Admin.jsx`.
- Tests for all of the above.

Non-goals (YAGNI):
- No member/role-change auditing (needs Clerk webhooks).
- No CRUD-level auditing (suppliers/contracts/etc.).
- No `details`/metadata column, no filtering/pagination UI (just the latest 50).
- No actor name resolution — the actor is the Clerk `userId`, displayed as-is.

## Data model

New Prisma model (`prisma/schema.prisma`), no relation (org-level, append-only):

```prisma
model AuditLog {
  id        String   @id
  orgId     String
  actorId   String
  action    String
  createdAt DateTime @default(now())
}
```

- `action` ∈ `'org.clear' | 'org.reset' | 'org.seed' | 'org.export'`.
- `actorId` = `req.auth.userId` (Clerk user id).
- Migration to Neon is a DEFERRED live step (unit tests mock Prisma), like the other
  schema additions in this repo.

## Helper: `api/_lib/audit.js`

```js
// Builds the `data` object for an audit-log row. Returned (not awaited) so it can be
// used both inside a prisma.$transaction([...]) array and as a standalone create.
export function buildAuditData({ orgId, actorId, action }) {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orgId,
    actorId,
    action,
  }
}
```

The random suffix avoids id collisions when multiple entries land in the same
millisecond.

## Endpoint wiring

**Transactional endpoints — append one `auditLog.create` to the existing
`$transaction([...])` array (so the log commits atomically with the action):**

- `api/org/clear.js`: append `prisma.auditLog.create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.clear' }) })` AFTER the supplier delete (last op).
- `api/org/reset.js`: append the same with `action: 'org.reset'` as the LAST op (after `new:portal`).
- `api/org/seed.js`: append with `action: 'org.seed'` as the LAST op in the transaction.
  The count-guard early-return (`{ seeded: false }`) stays before the transaction, so a
  no-op seed writes no audit entry.

**Read endpoint — best-effort (a log failure must not break the export):**

- `api/org/export.js`: after the successful `Promise.all` read and before building the
  response, `await prisma.auditLog.create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.export' }) }).catch(() => {})`.

`req.auth.userId` is already set by `requireAuth`/`requireOrgAdmin` on all these handlers.

## Endpoint: `GET /api/org/audit`

New `api/org/audit.js`, wrapped in `requireOrgAdmin`:

- Non-GET → `405` with `Allow: GET`.
- `200` with `prisma.auditLog.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 50 })`.
- `500` on error (codebase convention).

## Frontend

- `src/utils/auditLabels.js`:

```js
export const AUDIT_ACTION_LABEL = {
  'org.clear': 'Cleared all data',
  'org.reset': 'Reloaded demo data',
  'org.seed': 'Seeded sample data',
  'org.export': 'Exported backup',
}
```

- `src/pages/Admin.jsx`: add an "Activity log" `Card` (admin-only). A `useEffect` that
  **guards on `isAdmin`** (hooks run unconditionally, so the guard is inside the effect;
  members never call the admin-only endpoint) fetches `api.get('/api/org/audit')` and, if
  the response `Array.isArray`, stores it in `auditEntries` state (initialised `[]`, so a
  non-array/failed response leaves it empty — keeps the existing fetch-mocked Admin tests
  working). Render: a loading state, an empty state ("No activity yet."), else a list of
  rows — `AUDIT_ACTION_LABEL[e.action] ?? e.action`, the `actorId`, and `formatDate(e.createdAt)`.
  Place the card below the Danger zone.

## Testing

Suite must stay green (currently 379).

- `prisma validate` after the model is added.
- `api/_lib/audit.test.js`: `buildAuditData` returns `{ id: /^audit_/, orgId, actorId, action }` for given inputs.
- `api/org/clear.test.js`, `reset.test.js`, `seed.test.js` (extend): add
  `auditLog: { create: vi.fn((a) => ({ op: 'audit', ...a })) }` to the prisma mock; assert
  the audit op is the LAST element of the `$transaction` array and that
  `prisma.auditLog.create` was called with `data: expect.objectContaining({ action: '<the action>', orgId: 'org_test', actorId: 'user_test' })`. Update the existing op-order /
  length assertions (clear: 7 ops; reset: 13 ops; seed: 7 ops). The no-op seed test asserts
  `auditLog.create` NOT called.
- `api/org/export.test.js` (extend): add `auditLog: { create: vi.fn() }` to the mock; assert
  `auditLog.create` called with `action: 'org.export'` on success; add a test where
  `auditLog.create` rejects and the handler still returns `200` with the payload (best-effort).
- `api/org/audit.test.js`: GET returns the org-scoped list (`findMany` with
  `{ where: { orgId: 'org_test' }, orderBy: { createdAt: 'desc' }, take: 50 }`); 405 on non-GET.
- `src/utils/auditLabels.test.js`: every action key maps to a non-empty label.
- `src/pages/Admin.test.jsx` (extend): a test that mocks `fetch` to return an audit array
  and asserts the entries render (action label + actor); existing tests stay green because
  the audit fetch is `isAdmin`-guarded and the component ignores non-array responses.

## Execution

Lot C of the deferred-hardening roadmap. Built via
`superpowers:subagent-driven-development` from a plan in `docs/superpowers/plans/`,
committed on a `7c-audit` branch, merged `--no-ff` to main (established lot pattern).
