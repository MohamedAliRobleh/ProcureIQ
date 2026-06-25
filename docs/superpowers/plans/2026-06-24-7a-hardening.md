# Lot A — 7a Deferred Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate that a client-supplied `supplierId` belongs to the caller's org on contracts/spend POST+PATCH (#2), and make the org seed atomic via `prisma.$transaction` (#3).

**Architecture:** Add one shared helper `api/_lib/validateSupplier.js` and call it from the four contract/spend write paths, returning `400` for a foreign/invalid `supplierId`. Wrap the six `createMany` inserts in `api/org/seed.js` in a single `$transaction([...])` keeping FK order. No schema changes.

**Tech Stack:** Vercel serverless functions, Prisma + Neon Postgres, Clerk auth (`requireAuth`), Vitest.

## Global Constraints

- Every endpoint stays wrapped in `requireAuth`; all queries scoped by `req.auth.orgId`.
- Invalid/foreign `supplierId` on contracts/spend returns **`400`** with message `"supplierId does not belong to your organization"`. (Portal POST keeps its existing `404` — do NOT touch `api/portal-requests/*`.)
- The supplier check runs AFTER the cheap required-field checks and BEFORE any write.
- On PATCH, validate `supplierId` ONLY when it is present in the request body.
- The helper is `isSupplierInOrg(prisma, supplierId, orgId) => Promise<boolean>` and takes `prisma` as a parameter.
- Seed: keep the `prisma.supplier.count` count-guard and the early `{ seeded: false }` return OUTSIDE the transaction; FK order = suppliers first.
- Tests must stay green (currently 367). Run api half: `npx vitest run api/`. Match existing file style (ESM, no semicolons, 2-space indent).
- Commit after each task with a `feat(7a-hard):` / `test(7a-hard):` prefix.

---

### Task 1: `isSupplierInOrg` helper

**Files:**
- Create: `api/_lib/validateSupplier.js`
- Test: `api/_lib/validateSupplier.test.js`

**Interfaces:**
- Produces: `isSupplierInOrg(prisma, supplierId, orgId) => Promise<boolean>` — `true` iff a supplier with that id exists in that org. Consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/validateSupplier.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isSupplierInOrg } from './validateSupplier.js'

function makePrisma(found) {
  return { supplier: { findFirst: vi.fn().mockResolvedValue(found) } }
}

beforeEach(() => vi.clearAllMocks())

describe('isSupplierInOrg', () => {
  it('returns true when a supplier exists in the org', async () => {
    const prisma = makePrisma({ id: 'sup_1', orgId: 'org_test' })
    const result = await isSupplierInOrg(prisma, 'sup_1', 'org_test')
    expect(result).toBe(true)
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_1', orgId: 'org_test' } })
  })

  it('returns false when no supplier matches the id+org', async () => {
    const prisma = makePrisma(null)
    const result = await isSupplierInOrg(prisma, 'sup_other', 'org_test')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/validateSupplier.test.js`
Expected: FAIL — cannot resolve `./validateSupplier.js`.

- [ ] **Step 3: Write the implementation**

Create `api/_lib/validateSupplier.js`:

```js
// Returns true if a supplier with this id exists in the given org. Used by the
// contracts and spend endpoints to reject a client-supplied supplierId that
// belongs to another org (or does not exist) — a referential-integrity guard.
export async function isSupplierInOrg(prisma, supplierId, orgId) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, orgId } })
  return Boolean(supplier)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/validateSupplier.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/validateSupplier.js api/_lib/validateSupplier.test.js
git commit -m "feat(7a-hard): add isSupplierInOrg referential-integrity helper"
```

---

### Task 2: contracts POST + PATCH supplier validation

**Files:**
- Modify: `api/contracts/index.js` (POST)
- Modify: `api/contracts/[id].js` (PATCH)
- Modify: `api/contracts/contracts.test.js`

**Interfaces:**
- Consumes: `isSupplierInOrg` from `api/_lib/validateSupplier.js` (Task 1).

- [ ] **Step 1: Update the test file (TDD)**

In `api/contracts/contracts.test.js`:

1a. Add `supplier` to the prisma mock. Change the mock block to:

```js
vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    contract: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    supplier: { findFirst: vi.fn() },
  },
}))
```

1b. The existing happy-path POST test ("POST coerces yyyy-mm-dd dates to Date objects") now hits supplier validation. Make it pass by mocking the supplier as in-org — add this line at the very start of that test body (before the handler call):

```js
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
```

1c. Add these new tests inside the `describe('contracts endpoints', ...)` block:

```js
  it('POST rejects a supplierId that is not in the org with 400', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await listHandler(
      { method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, body: { title: 'Deal', supplierId: 'sup_foreign', value: 1000 } },
      res
    )
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_foreign', orgId: 'org_test' } })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.contract.create).not.toHaveBeenCalled()
  })

  it('PATCH rejects reassigning to a supplierId not in the org with 400', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test' }, query: { id: 'con_1' }, body: { supplierId: 'sup_foreign' } },
      res
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('PATCH without a supplierId does not run the supplier check', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1' })
    prisma.contract.update.mockResolvedValue({ id: 'con_1' })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test' }, query: { id: 'con_1' }, body: { status: 'active' } },
      res
    )
    expect(prisma.supplier.findFirst).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run api/contracts/contracts.test.js`
Expected: FAIL — the two new 400 tests fail (handler still creates/updates), and possibly the happy-path POST now behaves differently. The "PATCH without supplierId" test passes already.

- [ ] **Step 3: Add validation to `api/contracts/index.js` (POST)**

Add the import at the top (after the existing imports):

```js
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
```

In the `POST` branch, insert the supplier check between the required-field check and the `create`:

```js
      if (!body.title || !body.supplierId || body.value == null) {
        return res.status(400).json({ error: 'title, supplierId, and value are required' })
      }
      if (!(await isSupplierInOrg(prisma, body.supplierId, req.auth.orgId))) {
        return res.status(400).json({ error: 'supplierId does not belong to your organization' })
      }
      const contract = await prisma.contract.create({
```

- [ ] **Step 4: Add validation to `api/contracts/[id].js` (PATCH)**

Add the import at the top:

```js
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
```

In the `PATCH` branch, after the `const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}` line and before the `update`:

```js
      const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}
      if (rest.supplierId !== undefined && !(await isSupplierInOrg(prisma, rest.supplierId, req.auth.orgId))) {
        return res.status(400).json({ error: 'supplierId does not belong to your organization' })
      }
      const updated = await prisma.contract.update({
```

- [ ] **Step 5: Run the contracts tests to verify they pass**

Run: `npx vitest run api/contracts/contracts.test.js`
Expected: PASS (all existing + 3 new tests).

- [ ] **Step 6: Run the full api half**

Run: `npx vitest run api/`
Expected: PASS (no regressions). Report the count.

- [ ] **Step 7: Commit**

```bash
git add api/contracts/index.js "api/contracts/[id].js" api/contracts/contracts.test.js
git commit -m "feat(7a-hard): validate supplierId belongs to org on contracts POST/PATCH"
```

---

### Task 3: spend POST + PATCH supplier validation

**Files:**
- Modify: `api/spend/index.js` (POST)
- Modify: `api/spend/[id].js` (PATCH)
- Modify: `api/spend/spend.test.js`

**Interfaces:**
- Consumes: `isSupplierInOrg` from `api/_lib/validateSupplier.js` (Task 1).

- [ ] **Step 1: Update the test file (TDD)**

In `api/spend/spend.test.js`:

1a. Add `supplier` to the prisma mock:

```js
vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    spendRecord: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    supplier: { findFirst: vi.fn() },
  },
}))
```

1b. The existing happy-path POST test ("POST creates a record with generated id and coerced date") now hits supplier validation. Add this line at the start of that test body (before the handler call):

```js
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
```

1c. Add these new tests inside the `describe('spend endpoints', ...)` block:

```js
  it('POST rejects a supplierId that is not in the org with 400', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await listHandler(
      { method: 'POST', body: { supplierId: 'sup_foreign', amount: 500, category: 'Logistics', date: '2026-06-01' }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_foreign', orgId: 'org_test' } })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.spendRecord.create).not.toHaveBeenCalled()
  })

  it('PATCH rejects reassigning to a supplierId not in the org with 400', async () => {
    prisma.spendRecord.findFirst.mockResolvedValue({ id: 'spend_1' })
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', query: { id: 'spend_1' }, body: { supplierId: 'sup_foreign' }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.spendRecord.update).not.toHaveBeenCalled()
  })

  it('PATCH without a supplierId does not run the supplier check', async () => {
    prisma.spendRecord.findFirst.mockResolvedValue({ id: 'spend_1' })
    prisma.spendRecord.update.mockResolvedValue({ id: 'spend_1', amount: 999 })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', query: { id: 'spend_1' }, body: { amount: 999 }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    expect(prisma.supplier.findFirst).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run api/spend/spend.test.js`
Expected: FAIL — the two new 400 tests fail.

- [ ] **Step 3: Add validation to `api/spend/index.js` (POST)**

Add the import:

```js
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
```

Insert between the required-field check and the `create`:

```js
      if (!body.supplierId || body.amount == null || !body.category || !body.date) {
        return res.status(400).json({ error: 'supplierId, amount, category, and date are required' })
      }
      if (!(await isSupplierInOrg(prisma, body.supplierId, req.auth.orgId))) {
        return res.status(400).json({ error: 'supplierId does not belong to your organization' })
      }
      const record = await prisma.spendRecord.create({
```

- [ ] **Step 4: Add validation to `api/spend/[id].js` (PATCH)**

Add the import:

```js
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
```

After the `const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}` line and before the `update`:

```js
      const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}
      if (rest.supplierId !== undefined && !(await isSupplierInOrg(prisma, rest.supplierId, req.auth.orgId))) {
        return res.status(400).json({ error: 'supplierId does not belong to your organization' })
      }
      const updated = await prisma.spendRecord.update({
```

- [ ] **Step 5: Run the spend tests**

Run: `npx vitest run api/spend/spend.test.js`
Expected: PASS (all existing + 3 new tests).

- [ ] **Step 6: Run the full api half**

Run: `npx vitest run api/`
Expected: PASS. Report the count.

- [ ] **Step 7: Commit**

```bash
git add api/spend/index.js "api/spend/[id].js" api/spend/spend.test.js
git commit -m "feat(7a-hard): validate supplierId belongs to org on spend POST/PATCH"
```

---

### Task 4: atomic seed via `$transaction`

**Files:**
- Modify: `api/org/seed.js`
- Modify: `api/org/seed.test.js`

**Interfaces:**
- None new. Behaviour change only: the six inserts run as one `prisma.$transaction([...])`.

- [ ] **Step 1: Update the test (TDD)**

In `api/org/seed.test.js`:

1a. Add `$transaction` to the prisma mock so the handler can call it. Change the mock block to:

```js
vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    supplier: { count: vi.fn(), createMany: vi.fn() },
    contract: { createMany: vi.fn() },
    riskAssessment: { createMany: vi.fn() },
    esgResponse: { createMany: vi.fn() },
    spendRecord: { createMany: vi.fn() },
    portalRequest: { createMany: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}))
```

1b. In the "seeds all six entities" test, add an assertion that the inserts go through a single `$transaction` call carrying six operations (the existing per-model `createMany` assertions stay valid — the handler still calls each `createMany` to build the array). Add at the end of that test, before the `res.status`/`res.json` assertions:

```js
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(6)
```

1c. In the "no-op for a non-empty org" test, add an assertion that no transaction runs:

```js
    expect(prisma.$transaction).not.toHaveBeenCalled()
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/org/seed.test.js`
Expected: FAIL — `prisma.$transaction` not called (handler still uses sequential awaits).

- [ ] **Step 3: Rewrite the inserts in `api/org/seed.js`**

Replace the six sequential `await prisma.*.createMany(...)` lines with a single transaction, keeping the count-guard and `buildSeedData` call exactly as they are:

```js
    const existing = await prisma.supplier.count({ where: { orgId } })
    if (existing > 0) return res.status(200).json({ seeded: false })

    const data = buildSeedData(orgId)
    // FK order: suppliers first, then everything that references them — all atomic.
    await prisma.$transaction([
      prisma.supplier.createMany({ data: data.suppliers }),
      prisma.contract.createMany({ data: data.contracts }),
      prisma.riskAssessment.createMany({ data: data.riskAssessments }),
      prisma.esgResponse.createMany({ data: data.esgResponses }),
      prisma.spendRecord.createMany({ data: data.spendRecords }),
      prisma.portalRequest.createMany({ data: data.portalRequests }),
    ])
    return res.status(200).json({ seeded: true })
```

- [ ] **Step 4: Run the seed test**

Run: `npx vitest run api/org/seed.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/org/seed.js api/org/seed.test.js
git commit -m "feat(7a-hard): wrap org seed inserts in a single prisma transaction"
```

---

### Task 5: full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the api half**

Run: `npx vitest run api/`
Expected: PASS (all api tests, including the new helper + the extended contracts/spend/seed tests).

- [ ] **Step 2: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS (unchanged — this lot touches no `src/` files).

- [ ] **Step 3: Lint the changed api files**

Run: `npx eslint api/_lib/validateSupplier.js api/contracts/ api/spend/ api/org/seed.js`
Expected: clean (api files have no baseline lint errors; the baseline errors are all in `src/`).

---

## Self-Review

**Spec coverage:**
- Helper `isSupplierInOrg` → Task 1. ✓
- contracts POST + PATCH validation (400, PATCH only when supplierId present) → Task 2. ✓
- spend POST + PATCH validation → Task 3. ✓
- seed `$transaction` (count-guard outside, FK order) → Task 4. ✓
- Portal untouched (404 kept) → no task touches `api/portal-requests/*`. ✓
- Tests for all → each task + Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The existing-test
edits (adding `supplier` to the mock + a `mockResolvedValue` line to the happy-path POST
tests) are spelled out verbatim so the previously-green tests stay green.

**Type consistency:** `isSupplierInOrg(prisma, supplierId, orgId)` signature identical in
Task 1 (definition), Task 2, and Task 3 (call sites). `400` + the exact message string
identical across both endpoints. `$transaction` array carries six ops in FK order in both
the Task 4 test assertion (`toHaveLength(6)`) and the handler.
