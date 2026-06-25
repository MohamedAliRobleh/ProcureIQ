# Lot A — 7a Deferred Hardening — Design

Date: 2026-06-24
Status: Approved (brainstorming)

## Summary

Close the two hardening items deferred from Phase 7a:

- **#2 — Cross-org `supplierId` validation.** The `contracts` and `spend` POST/PATCH
  endpoints currently accept a client-supplied `supplierId` without checking it belongs
  to the caller's org. A member could attach a contract or spend record to a supplier in
  another org (or a non-existent supplier), creating a referential-integrity hole. This
  is not a read leak (they still can't read foreign data) but it lets a record point at a
  foreign/invalid FK. Validate `supplierId` against the caller's org on create, and on
  update when `supplierId` is present in the body.

- **#3 — Atomic seed.** `api/org/seed.js` runs six sequential `createMany` awaits; a
  mid-sequence failure leaves the org half-seeded. Wrap the inserts in a single
  `prisma.$transaction([...])` (array form, FK order preserved), like `clear`/`reset`
  already do.

The validation pattern already exists in the codebase: Phase 7c's
`api/portal-requests/index.js` POST validates the supplier is in-org. This lot extracts
that into a shared helper and applies it to contracts + spend.

## Scope (and non-goals)

In scope:
- New `api/_lib/validateSupplier.js` helper.
- Apply it to `contracts` POST + PATCH and `spend` POST + PATCH.
- Wrap `api/org/seed.js` inserts in `prisma.$transaction`.
- Tests for all of the above.

Non-goals (YAGNI):
- No change to the read paths (already org-scoped).
- No retrofit of `api/portal-requests/index.js` (it already does the equivalent inline,
  is tested, and works — leave it to avoid churning tested code; see Decisions).
- No schema/DB changes.

## Decisions

- **Status code for an invalid `supplierId` on contracts/spend: `400`** (`"supplierId
  does not belong to your organization"`). Rationale: on PATCH the record itself exists
  (we found it via the org-scoped lookup), so a `404` would wrongly imply the
  contract/spend record is missing. `400` correctly says "the supplierId you supplied is
  invalid."
- **Portal POST keeps its existing `404`** for the same situation. This is a minor,
  accepted inconsistency — Portal is already shipped and tested; aligning it would churn
  tested code for no functional gain. It can be unified in a later pass if desired.
- **Helper returns a boolean**, not throw — HTTP concerns (status code, message) stay in
  the handlers. Signature takes `prisma` as a parameter so it is unit-testable with a
  mocked client (mirrors how handlers already receive `prisma` via import; the param form
  keeps the helper pure).

## Component: `api/_lib/validateSupplier.js`

```js
// Returns true if a supplier with this id exists in the given org. Used by the
// contracts and spend endpoints to reject a client-supplied supplierId that
// belongs to another org (or does not exist) — a referential-integrity guard.
export async function isSupplierInOrg(prisma, supplierId, orgId) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, orgId } })
  return Boolean(supplier)
}
```

## Endpoint changes (#2)

All four follow the same shape. Use `isSupplierInOrg(prisma, supplierId, req.auth.orgId)`.

- **`api/contracts/index.js` (POST):** after the existing required-field check
  (`title`, `supplierId`, `value`), add: if `!(await isSupplierInOrg(...))` →
  `400 { error: 'supplierId does not belong to your organization' }` before `create`.

- **`api/contracts/[id].js` (PATCH):** after the org-scoped `findFirst` existence check
  and the `id`/`orgId` strip, if `rest.supplierId !== undefined` and
  `!(await isSupplierInOrg(prisma, rest.supplierId, req.auth.orgId))` → `400` before
  `update`.

- **`api/spend/index.js` (POST):** after the existing required-field check
  (`supplierId`, `amount`, `category`, `date`), same `400` guard before `create`.

- **`api/spend/[id].js` (PATCH):** same conditional guard as contracts PATCH (only when
  `rest.supplierId` is present), `400` before `update`.

Error/response conventions otherwise unchanged (method guard → auth → field validation →
supplier validation → prisma → JSON). The supplier check runs after cheap field checks
and before any write.

## Seed change (#3)

`api/org/seed.js`: keep the count-guard read (`prisma.supplier.count`) and the early
`{ seeded: false }` return outside any transaction. Replace the six sequential
`await prisma.*.createMany(...)` calls with a single:

```js
await prisma.$transaction([
  prisma.supplier.createMany({ data: data.suppliers }),
  prisma.contract.createMany({ data: data.contracts }),
  prisma.riskAssessment.createMany({ data: data.riskAssessments }),
  prisma.esgResponse.createMany({ data: data.esgResponses }),
  prisma.spendRecord.createMany({ data: data.spendRecords }),
  prisma.portalRequest.createMany({ data: data.portalRequests }),
])
```

FK order preserved (suppliers first; Postgres checks FKs at statement end, so order
within the transaction still matters). This matches the existing `reset.js` insert
ordering.

## Testing

Suite must stay green (currently 367; api half + src half serial).

- `api/_lib/validateSupplier.test.js`: `isSupplierInOrg` returns `true` when
  `findFirst` resolves a supplier, `false` when it resolves `null`; asserts the query is
  `{ where: { id, orgId } }`.
- `api/contracts/contracts.test.js` (extend): POST with an out-of-org `supplierId` →
  `400`, no `create`; POST happy path still `201` (mock `supplier.findFirst` to resolve);
  PATCH that includes an out-of-org `supplierId` → `400`, no `update`; PATCH without
  `supplierId` does NOT call `supplier.findFirst`.
- `api/spend/spend.test.js` (extend): same four cases for spend.
- `api/org/seed.test.js` (extend/adjust): assert the inserts go through
  `prisma.$transaction` as a single call with the createMany ops in FK order; the
  count-guard short-circuit (`{ seeded: false }`) still returns before any transaction.

Test convention unchanged: handlers receive `req.auth = { userId, orgId }`; mock
`prisma.supplier.findFirst` alongside the existing model mocks; assert `where` scoping.

## Execution

Built via `superpowers:subagent-driven-development` from a plan in
`docs/superpowers/plans/`, committed on a `7a-hardening` branch, merged `--no-ff` to main
(matching the phase pattern). This is Lot A of a sequenced hardening roadmap (A: 7a
hardening; B: export-before-clear; C: audit log; D: granular permissions; E:
billing/branding) — each lot gets its own spec → plan → build cycle.
