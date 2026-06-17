# ProcureIQ Phase 7a: Real Multi-Org (Clerk Organizations) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `orgId` real end-to-end — every API request is scoped to the active org from the Clerk session, the app is gated behind having an active org, users can switch/create orgs, and a brand-new org can be populated with sample data on demand.

**Architecture:** The backend reads the org from the verified session token (`payload.org_id`) in `requireAuth` and 403s when absent; all twelve existing handlers use `req.auth.orgId` instead of the `ORG_ID` constant (the new `/api/org/seed` is a thirteenth org-scoped endpoint). A new `/api/org/seed` endpoint re-keys the canonical demo dataset into the active org. The frontend replaces the static demo-org stub with Clerk's real `useOrganization`/`OrganizationSwitcher`, adds a `RequireOrg` gate inside `ProtectedRoute`, and relocates the data-provider stack out of the app root into an org-keyed wrapper so switching orgs remounts and refetches everything.

**Tech Stack:** Vercel serverless functions, Prisma + Neon, `@clerk/backend` (`verifyToken`), `@clerk/clerk-react`, React Router, Vitest + Testing Library.

**Test command:** `npx vitest run <path>` (single file) or `npx vitest run` (all). Lint: `npm run lint`.

---

## File Structure

**Backend — modified (swap `ORG_ID` constant → `req.auth.orgId`):**
- `api/_lib/auth.js` — read `payload.org_id`, 403 when absent, set `req.auth = { userId, orgId }`.
- `api/suppliers/index.js`, `api/suppliers/[id].js`
- `api/contracts/index.js`, `api/contracts/[id].js`, `api/contracts/summarize.js`, `api/contracts/upload-signature.js`, `api/contracts/notify.js`
- `api/spend/index.js`, `api/spend/[id].js`
- `api/risk/index.js`, `api/esg/index.js`
- `api/assistant.js`

**Backend — deleted:**
- `api/_lib/org.js` (the `ORG_ID = 'org_demo'` constant).

**Backend — new:**
- `api/_lib/seedData.js` — `buildSeedData(orgId)` re-keys `src/lib/mockData.js` into a target org.
- `api/org/seed.js` — `POST /api/org/seed` (count-guarded `createMany`).
- `api/_lib/seedData.test.js`, `api/org/seed.test.js`

**Frontend — modified:**
- `src/lib/auth.jsx` — export Clerk's real `useOrganization` + `OrganizationSwitcher`; remove the static `DEMO_ORG` stub.
- `src/components/layout/TopBar.jsx` — render `<OrganizationSwitcher/>` instead of static org text.
- `src/App.jsx` — wrap the AppShell route with `RequireOrg` + `OrgScopedProviders`; remove the root-level provider stack.
- `src/test/setup.js` — mock `useOrganization` from `authState`; stub `OrganizationSwitcher`.
- `src/test/authState.js` — add mutable `organization` + `orgLoaded`.
- `src/pages/Dashboard.jsx` — empty-org "Load sample data" panel.
- `src/components/layout/layout.test.jsx` — TopBar test asserts the switcher.

**Frontend — new:**
- `src/components/layout/RequireOrg.jsx` — org gate.
- `src/components/layout/OrgScopedProviders.jsx` — org-keyed provider stack.
- `src/components/layout/RequireOrg.test.jsx`

**Test edits (org_demo → org_test, add `req.auth`):**
- `api/_lib/auth.test.js`, `api/suppliers/suppliers.test.js`, `api/contracts/contracts.test.js`, `api/spend/spend.test.js`, `api/readonly.test.js`, `api/assistant.test.js`, `api/contracts/summarize.test.js`, `api/contracts/upload-signature.test.js`, `api/contracts/notify.test.js`, `src/pages/Dashboard.test.jsx`.

---

## Backend test convention (applies to Tasks 2–9)

Handler tests mock `requireAuth` as identity (`(handler) => handler`), so the handler reads `req.auth` directly. For every handler invocation in these tests:
1. Add `auth: { userId: 'user_test', orgId: 'org_test' }` to the request object.
2. Change every `orgId: 'org_demo'` assertion to `orgId: 'org_test'`, and every `created.orgId).toBe('org_demo')` to `'org_test'`.

For every endpoint source file: remove the `import { ORG_ID } from '.../_lib/org.js'` line and replace each `ORG_ID` reference with `req.auth.orgId`.

---

### Task 1: `requireAuth` enforces an active org

**Files:**
- Modify: `api/_lib/auth.js`
- Test: `api/_lib/auth.test.js`

- [ ] **Step 1: Update the success test and add the 403 test**

In `api/_lib/auth.test.js`, replace the final test (the `'attaches req.auth.userId and calls the handler on success'` block, lines 47–56) with these two tests:

```js
  it('attaches req.auth and calls the handler when the token has an active org', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(req.auth).toEqual({ userId: 'user_123', orgId: 'org_abc' })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when the verified token has no active organization', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123' })
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: { authorization: 'Bearer good' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/auth.test.js`
Expected: FAIL — the 403 test fails (handler currently still called) and/or `req.auth` lacks `orgId`.

- [ ] **Step 3: Implement the org enforcement**

Replace the entire body of `api/_lib/auth.js` with:

```js
import { verifyToken } from '@clerk/backend'

// Wraps a handler so it only runs with a valid Clerk session token that
// carries an active organization. Networkless verification: the JWT is
// checked against CLERK_SECRET_KEY. `org_id` is a default Clerk session-token
// claim, present only when an org is active.
export function requireAuth(handler) {
  return async (req, res) => {
    const header = req.headers?.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    let payload
    try {
      payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const orgId = payload.org_id ?? null
    if (!orgId) return res.status(403).json({ error: 'No active organization' })
    req.auth = { userId: payload.sub, orgId }
    return handler(req, res)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/_lib/auth.test.js`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/auth.js api/_lib/auth.test.js
git commit -m "feat(7a): requireAuth reads org_id from session and 403s when absent"
```

---

### Task 2: Suppliers endpoints use `req.auth.orgId`

**Files:**
- Modify: `api/suppliers/index.js`, `api/suppliers/[id].js`
- Test: `api/suppliers/suppliers.test.js`

- [ ] **Step 1: Update the test**

In `api/suppliers/suppliers.test.js` apply the Backend test convention. Concretely:

- GET test: `await listHandler({ method: 'GET' }, res)` → `await listHandler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)`; assertion `where: { orgId: 'org_demo' }` → `where: { orgId: 'org_test' }`.
- POST create test: add `auth: { userId: 'user_test', orgId: 'org_test' }` to the request object; `expect(created.orgId).toBe('org_demo')` → `expect(created.orgId).toBe('org_test')`.
- POST 400 test: add `auth: { userId: 'user_test', orgId: 'org_test' }` to the request object.
- PATCH update test: add `auth` to the request; assertion `where: { id: 'sup_1', orgId: 'org_demo' }` → `where: { id: 'sup_1', orgId: 'org_test' }`.
- PATCH 404 test and the 405 test: add `auth: { userId: 'user_test', orgId: 'org_test' }` to each request object.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/suppliers/suppliers.test.js`
Expected: FAIL — handler reads `ORG_ID` ('org_demo') so assertions on 'org_test' fail (and `req.auth` is unused by the handler yet).

- [ ] **Step 3: Implement — `api/suppliers/index.js`**

Remove line `import { ORG_ID } from '../_lib/org.js'`. Replace the two `orgId: ORG_ID` occurrences (the `where` filter and the create `data`) with `orgId: req.auth.orgId`. Result:

```js
import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const suppliers = await prisma.supplier.findMany({
        where: { orgId: req.auth.orgId },
        orderBy: { createdAt: 'asc' },
      })
      return res.status(200).json(suppliers)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!body.name || !body.email) {
        return res.status(400).json({ error: 'name and email are required' })
      }
      const supplier = await prisma.supplier.create({
        data: {
          ...body,
          id: `sup_${Date.now()}`,
          orgId: req.auth.orgId,
          riskScore: 0,
          esgScore: 0,
          logoUrl: null,
          onboardedAt: new Date(),
          createdAt: new Date(),
        },
      })
      return res.status(201).json(supplier)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Implement — `api/suppliers/[id].js`**

Remove `import { ORG_ID } from '../_lib/org.js'`; change `where: { id: req.query.id, orgId: ORG_ID }` to `where: { id: req.query.id, orgId: req.auth.orgId }`.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run api/suppliers/suppliers.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/suppliers/index.js api/suppliers/[id].js api/suppliers/suppliers.test.js
git commit -m "feat(7a): scope suppliers endpoints to req.auth.orgId"
```

---

### Task 3: Contracts collection + `[id]` endpoints use `req.auth.orgId`

**Files:**
- Modify: `api/contracts/index.js`, `api/contracts/[id].js`
- Test: `api/contracts/contracts.test.js`

- [ ] **Step 1: Update the test**

In `api/contracts/contracts.test.js`:
- GET test (line 31): add `auth: { userId: 'user_test', orgId: 'org_test' }`; assertion `where: { orgId: 'org_demo' }` → `'org_test'`.
- POST coerce-dates test (lines 42–48): add `auth` to the request object.
- POST 400 test (line 58): add `auth` to the request object.
- PATCH test (line 66): add `auth`; assertion `where: { id: 'con_1', orgId: 'org_demo' }` → `'org_test'`.
- 404 test (line 78): add `auth` to the request object.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/contracts/contracts.test.js`
Expected: FAIL on the 'org_test' assertions.

- [ ] **Step 3: Implement — `api/contracts/index.js`**

Remove `import { ORG_ID } from '../_lib/org.js'`. Replace `where: { orgId: ORG_ID }` with `where: { orgId: req.auth.orgId }` and `orgId: ORG_ID,` (in the create `data`) with `orgId: req.auth.orgId,`.

- [ ] **Step 4: Implement — `api/contracts/[id].js`**

Remove `import { ORG_ID } from '../_lib/org.js'`; change `where: { id: req.query.id, orgId: ORG_ID }` → `where: { id: req.query.id, orgId: req.auth.orgId }`.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run api/contracts/contracts.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/contracts/index.js api/contracts/[id].js api/contracts/contracts.test.js
git commit -m "feat(7a): scope contracts endpoints to req.auth.orgId"
```

---

### Task 4: Spend collection + `[id]` endpoints use `req.auth.orgId`

**Files:**
- Modify: `api/spend/index.js`, `api/spend/[id].js`
- Test: `api/spend/spend.test.js`

- [ ] **Step 1: Update the test**

In `api/spend/spend.test.js`:
- GET test (line 31): add `auth: { userId: 'user_test', orgId: 'org_test' }`; assertion `where: { orgId: 'org_demo' }` → `'org_test'`.
- POST create test (lines 42–45): add `auth` to the request object.
- POST 400 test (line 54): add `auth` to the request object.
- PATCH test (line 62): add `auth`; assertion `where: { id: 'spend_1', orgId: 'org_demo' }` → `'org_test'`.
- 404 test (line 76): add `auth` to the request object.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/spend/spend.test.js`
Expected: FAIL on the 'org_test' assertions.

- [ ] **Step 3: Implement — `api/spend/index.js`**

Remove `import { ORG_ID } from '../_lib/org.js'`. Replace `where: { orgId: ORG_ID }` with `where: { orgId: req.auth.orgId }` and `orgId: ORG_ID,` (create `data`) with `orgId: req.auth.orgId,`.

- [ ] **Step 4: Implement — `api/spend/[id].js`**

Remove `import { ORG_ID } from '../_lib/org.js'`; change `where: { id: req.query.id, orgId: ORG_ID }` → `where: { id: req.query.id, orgId: req.auth.orgId }`.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run api/spend/spend.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/spend/index.js api/spend/[id].js api/spend/spend.test.js
git commit -m "feat(7a): scope spend endpoints to req.auth.orgId"
```

---

### Task 5: Risk + ESG read-only endpoints use `req.auth.orgId`

**Files:**
- Modify: `api/risk/index.js`, `api/esg/index.js`
- Test: `api/readonly.test.js`

- [ ] **Step 1: Update the test**

In `api/readonly.test.js`:
- Risk GET test (line 32): `await riskHandler({ method: 'GET' }, res)` → `await riskHandler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)`; assertion `where: { orgId: 'org_demo' }` → `'org_test'`.
- ESG GET test (line 43): `await esgHandler({ method: 'GET' }, res)` → add `auth: { userId: 'user_test', orgId: 'org_test' }`.
- 405 test (line 49): `await riskHandler({ method: 'POST' }, res)` → add `auth: { userId: 'user_test', orgId: 'org_test' }`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/readonly.test.js`
Expected: FAIL on the risk 'org_test' assertion.

- [ ] **Step 3: Implement — `api/risk/index.js`**

Remove `import { ORG_ID } from '../_lib/org.js'`; change `where: { orgId: ORG_ID }` → `where: { orgId: req.auth.orgId }`.

- [ ] **Step 4: Implement — `api/esg/index.js`**

Remove `import { ORG_ID } from '../_lib/org.js'`; change `where: { orgId: ORG_ID }` → `where: { orgId: req.auth.orgId }`.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run api/readonly.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/risk/index.js api/esg/index.js api/readonly.test.js
git commit -m "feat(7a): scope risk and esg endpoints to req.auth.orgId"
```

---

### Task 6: Assistant endpoint uses `req.auth.orgId`

**Files:**
- Modify: `api/assistant.js`
- Test: `api/assistant.test.js`

- [ ] **Step 1: Update the test**

In `api/assistant.test.js`, add `auth: { userId: 'user_test', orgId: 'org_test' }` to every handler request object — the four `{ method: 'POST', body: { messages: [...] } }` calls (lines 53, 61, 74, 82) and the 405 call `{ method: 'GET' }` (line 88). (No `org_demo` assertions exist here; the change just prevents the handler from crashing on `req.auth.orgId`.) Also add one assertion to the first test confirming the org scope is used:

```js
    expect(prisma.supplier.findMany).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
```

(insert after the `res.json` assertion in the `'returns the Claude reply when AI is configured'` test).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/assistant.test.js`
Expected: FAIL — `findMany` is called with `orgId: 'org_demo'`, not `'org_test'`.

- [ ] **Step 3: Implement — `api/assistant.js`**

Remove `import { ORG_ID } from './_lib/org.js'`. Replace the five `{ where: { orgId: ORG_ID } }` filters in the `Promise.all` with `{ where: { orgId: req.auth.orgId } }`:

```js
    const [suppliers, contracts, riskAssessments, esgResponses, spendRecords] = await Promise.all([
      prisma.supplier.findMany({ where: { orgId: req.auth.orgId } }),
      prisma.contract.findMany({ where: { orgId: req.auth.orgId } }),
      prisma.riskAssessment.findMany({ where: { orgId: req.auth.orgId } }),
      prisma.esgResponse.findMany({ where: { orgId: req.auth.orgId } }),
      prisma.spendRecord.findMany({ where: { orgId: req.auth.orgId } }),
    ])
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run api/assistant.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/assistant.js api/assistant.test.js
git commit -m "feat(7a): scope assistant endpoint to req.auth.orgId"
```

---

### Task 7: Contract summarize endpoint uses `req.auth.orgId`

**Files:**
- Modify: `api/contracts/summarize.js`
- Test: `api/contracts/summarize.test.js`

- [ ] **Step 1: Update the test**

In `api/contracts/summarize.test.js`, add `auth: { userId: 'user_test', orgId: 'org_test' }` to every handler request object, and change the assertion `expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_demo' } })` to `... orgId: 'org_test' } })`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/contracts/summarize.test.js`
Expected: FAIL on the `org_test` assertion.

- [ ] **Step 3: Implement — `api/contracts/summarize.js`**

Remove `import { ORG_ID } from '../_lib/org.js'`; change `where: { id, orgId: ORG_ID }` → `where: { id, orgId: req.auth.orgId }`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run api/contracts/summarize.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/contracts/summarize.js api/contracts/summarize.test.js
git commit -m "feat(7a): scope contract summarize endpoint to req.auth.orgId"
```

---

### Task 8: Upload-signature endpoint uses `req.auth.orgId`

**Files:**
- Modify: `api/contracts/upload-signature.js`
- Test: `api/contracts/upload-signature.test.js`

- [ ] **Step 1: Update the test**

In `api/contracts/upload-signature.test.js`, add `auth: { userId: 'user_test', orgId: 'org_test' }` to every handler request object, and change the assertion `expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_demo' } })` to `... orgId: 'org_test' } })`. If a test asserts the `folder` string contains `procureiq/org_demo/contracts`, change it to `procureiq/org_test/contracts`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/contracts/upload-signature.test.js`
Expected: FAIL on the `org_test` assertion.

- [ ] **Step 3: Implement — `api/contracts/upload-signature.js`**

Remove `import { ORG_ID } from '../_lib/org.js'`. Change `where: { id, orgId: ORG_ID }` → `where: { id, orgId: req.auth.orgId }` and `` const folder = `procureiq/${ORG_ID}/contracts` `` → `` const folder = `procureiq/${req.auth.orgId}/contracts` ``.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run api/contracts/upload-signature.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/contracts/upload-signature.js api/contracts/upload-signature.test.js
git commit -m "feat(7a): scope upload-signature endpoint to req.auth.orgId"
```

---

### Task 9: Notify endpoint uses `req.auth.orgId`, delete `org.js`

**Files:**
- Modify: `api/contracts/notify.js`
- Delete: `api/_lib/org.js`
- Test: `api/contracts/notify.test.js`

- [ ] **Step 1: Update the test**

In `api/contracts/notify.test.js`, add `auth: { userId: 'user_test', orgId: 'org_test' }` to every handler request object, and change the assertion `expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_demo' } })` to `... orgId: 'org_test' } })`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/contracts/notify.test.js`
Expected: FAIL on the `org_test` assertion.

- [ ] **Step 3: Implement — `api/contracts/notify.js`**

Remove `import { ORG_ID } from '../_lib/org.js'`; change `where: { id, orgId: ORG_ID }` → `where: { id, orgId: req.auth.orgId }`.

- [ ] **Step 4: Delete the now-unused constant**

```bash
git rm api/_lib/org.js
```

- [ ] **Step 5: Verify no remaining references**

Run: `npx vitest run` (full backend + frontend suite)
Also confirm nothing imports `org.js`:
Run: `grep -rn "_lib/org" api/`
Expected: no matches; full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add api/contracts/notify.js api/contracts/notify.test.js
git commit -m "feat(7a): scope notify endpoint to req.auth.orgId; remove ORG_ID constant"
```

---

### Task 10: `buildSeedData(orgId)` re-keys the demo dataset

**Files:**
- Create: `api/_lib/seedData.js`
- Test: `api/_lib/seedData.test.js`

Note: importing `src/lib/mockData.js` from `api/` is an established pattern — `api/assistant.js` already imports `../src/lib/assistantEngine.js`. `mockData.js` is pure (no imports, only array exports).

- [ ] **Step 1: Write the failing test**

Create `api/_lib/seedData.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildSeedData } from './seedData.js'

describe('buildSeedData', () => {
  const data = buildSeedData('org_x')

  it('namespaces every id with the org prefix and stamps orgId', () => {
    for (const collection of Object.values(data)) {
      for (const row of collection) {
        expect(row.id.startsWith('org_x__')).toBe(true)
        expect(row.orgId).toBe('org_x')
      }
    }
  })

  it('rewrites every foreign key to a supplier id that exists in the dataset', () => {
    const supplierIds = new Set(data.suppliers.map((s) => s.id))
    for (const collection of [data.contracts, data.riskAssessments, data.esgResponses, data.spendRecords]) {
      for (const row of collection) {
        expect(supplierIds.has(row.supplierId)).toBe(true)
      }
    }
  })

  it('returns the full demo dataset (non-empty collections)', () => {
    expect(data.suppliers.length).toBeGreaterThan(0)
    expect(data.contracts.length).toBeGreaterThan(0)
    expect(data.spendRecords.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/_lib/seedData.test.js`
Expected: FAIL with "Cannot find module './seedData.js'".

- [ ] **Step 3: Implement `api/_lib/seedData.js`**

```js
import {
  suppliers,
  contracts,
  riskAssessments,
  esgResponses,
  spendRecords,
} from '../../src/lib/mockData.js'

// Re-keys the canonical demo dataset (src/lib/mockData.js) into a target org.
// Every id is namespaced `${orgId}__<originalId>` so multiple orgs never
// collide; foreign keys are rewritten to the namespaced supplier ids; and
// orgId is stamped on every record. mockData.js is pure (no React), so it is
// safe to import here.
export function buildSeedData(orgId) {
  const ns = (id) => `${orgId}__${id}`
  return {
    suppliers: suppliers.map((s) => ({ ...s, id: ns(s.id), orgId })),
    contracts: contracts.map((c) => ({ ...c, id: ns(c.id), orgId, supplierId: ns(c.supplierId) })),
    riskAssessments: riskAssessments.map((r) => ({ ...r, id: ns(r.id), orgId, supplierId: ns(r.supplierId) })),
    esgResponses: esgResponses.map((e) => ({ ...e, id: ns(e.id), orgId, supplierId: ns(e.supplierId) })),
    spendRecords: spendRecords.map((sp) => ({ ...sp, id: ns(sp.id), orgId, supplierId: ns(sp.supplierId) })),
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run api/_lib/seedData.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/seedData.js api/_lib/seedData.test.js
git commit -m "feat(7a): add buildSeedData to re-key demo dataset per org"
```

---

### Task 11: `POST /api/org/seed` endpoint

**Files:**
- Create: `api/org/seed.js`
- Test: `api/org/seed.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/org/seed.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    supplier: { count: vi.fn(), createMany: vi.fn() },
    contract: { createMany: vi.fn() },
    riskAssessment: { createMany: vi.fn() },
    esgResponse: { createMany: vi.fn() },
    spendRecord: { createMany: vi.fn() },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/seedData.js', () => ({
  buildSeedData: vi.fn(() => ({
    suppliers: [{ id: 'org_test__sup_1' }],
    contracts: [{ id: 'org_test__con_1' }],
    riskAssessments: [{ id: 'org_test__risk_1' }],
    esgResponses: [{ id: 'org_test__esg_1' }],
    spendRecords: [{ id: 'org_test__spend_1' }],
  })),
}))

import handler from './seed.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, ...over })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/org/seed', () => {
  it('seeds all five entities for an empty org and returns seeded: true', async () => {
    prisma.supplier.count.mockResolvedValue(0)
    const res = mockRes()
    await handler(authReq(), res)
    expect(prisma.supplier.count).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
    expect(prisma.supplier.createMany).toHaveBeenCalledWith({ data: [{ id: 'org_test__sup_1' }] })
    expect(prisma.contract.createMany).toHaveBeenCalled()
    expect(prisma.riskAssessment.createMany).toHaveBeenCalled()
    expect(prisma.esgResponse.createMany).toHaveBeenCalled()
    expect(prisma.spendRecord.createMany).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ seeded: true })
  })

  it('is a no-op for a non-empty org and returns seeded: false', async () => {
    prisma.supplier.count.mockResolvedValue(20)
    const res = mockRes()
    await handler(authReq(), res)
    expect(prisma.supplier.createMany).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ seeded: false })
  })

  it('rejects non-POST with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.supplier.count).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/org/seed.test.js`
Expected: FAIL with "Cannot find module './seed.js'".

- [ ] **Step 3: Implement `api/org/seed.js`**

```js
import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { buildSeedData } from '../_lib/seedData.js'

// Populates a brand-new org with the canonical demo dataset. Count-guarded so
// it never duplicates: if the org already has suppliers, it is a no-op.
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const existing = await prisma.supplier.count({ where: { orgId } })
    if (existing > 0) return res.status(200).json({ seeded: false })

    const data = buildSeedData(orgId)
    // FK order: suppliers first, then everything that references them.
    await prisma.supplier.createMany({ data: data.suppliers })
    await prisma.contract.createMany({ data: data.contracts })
    await prisma.riskAssessment.createMany({ data: data.riskAssessments })
    await prisma.esgResponse.createMany({ data: data.esgResponses })
    await prisma.spendRecord.createMany({ data: data.spendRecords })
    return res.status(200).json({ seeded: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run api/org/seed.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/org/seed.js api/org/seed.test.js
git commit -m "feat(7a): add POST /api/org/seed (count-guarded per-org seeding)"
```

---

### Task 12: Frontend auth seam — real Clerk org hooks + test infra

**Files:**
- Modify: `src/lib/auth.jsx`, `src/test/setup.js`, `src/test/authState.js`

This task wires Clerk's real `useOrganization`/`OrganizationSwitcher` and updates the global test mock so existing tests stay green (the mock keeps returning the demo org). Verification is the full suite staying green.

- [ ] **Step 1: Update `src/test/authState.js`**

Add mutable `organization` + `orgLoaded` to `authState` and reset them. Replace the `authState` export and `resetAuthState` function with:

```js
export const authState = {
  isLoaded: true,
  isSignedIn: true,
  user: DEFAULT_USER,
  orgLoaded: true,
  organization: DEMO_ORG,
}

export function resetAuthState() {
  authState.isLoaded = true
  authState.isSignedIn = true
  authState.user = DEFAULT_USER
  authState.orgLoaded = true
  authState.organization = DEMO_ORG
}
```

(Keep the existing `DEFAULT_USER` and `DEMO_ORG` definitions above.)

- [ ] **Step 2: Update `src/test/setup.js` mock**

Replace the `vi.mock('../lib/auth.jsx', ...)` factory with one that reads org state from `authState` and stubs `OrganizationSwitcher`:

```js
vi.mock('../lib/auth.jsx', async () => {
  const { createElement } = await import('react')
  const { authState } = await import('./authState')
  return {
    AuthProvider: ({ children }) => children,
    useUser: () => ({
      isLoaded: authState.isLoaded,
      isSignedIn: authState.isSignedIn,
      user: authState.isSignedIn ? authState.user : null,
    }),
    useOrganization: () => ({ isLoaded: authState.orgLoaded, organization: authState.organization }),
    UserButton: () => createElement('div', { 'data-testid': 'user-button' }),
    OrganizationSwitcher: () => createElement('div', { 'data-testid': 'org-switcher' }),
    SignIn: () => createElement('div', { 'data-testid': 'clerk-sign-in' }),
    SignUp: () => createElement('div', { 'data-testid': 'clerk-sign-up' }),
  }
})
```

- [ ] **Step 3: Update `src/lib/auth.jsx`**

Replace the whole file with the version that re-exports Clerk's real org hook + switcher and drops the static stub:

```jsx
import { useEffect } from 'react'
import {
  ClerkProvider,
  useAuth,
  useUser,
  useOrganization,
  UserButton,
  OrganizationSwitcher,
  SignIn,
  SignUp,
} from '@clerk/clerk-react'
import { setTokenGetter } from './apiClient'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const CLERK_APPEARANCE = {
  variables: {
    colorBackground: '#16181F',
    colorInputBackground: '#0A0B0F',
    colorText: '#F1F5F9',
    colorTextSecondary: '#94A3B8',
    colorPrimary: '#3B82F6',
    colorDanger: '#EF4444',
    borderRadius: '0.5rem',
  },
}

function TokenBridge({ children }) {
  const { getToken } = useAuth()
  useEffect(() => {
    setTokenGetter(getToken)
    return () => setTokenGetter(null)
  }, [getToken])
  return children
}

export function AuthProvider({ children }) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={CLERK_APPEARANCE}>
      <TokenBridge>{children}</TokenBridge>
    </ClerkProvider>
  )
}

export { useUser, useOrganization, UserButton, OrganizationSwitcher, SignIn, SignUp }
```

- [ ] **Step 4: Run the full suite to verify nothing regressed**

Run: `npx vitest run`
Expected: PASS — TopBar still reads `organization.name`/`membersCount` from the mocked demo org; the `OrganizationSwitcher` stub is available but not yet used.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.jsx src/test/setup.js src/test/authState.js
git commit -m "feat(7a): expose real Clerk useOrganization + OrganizationSwitcher; wire test mock"
```

---

### Task 13: `RequireOrg` gate component

**Files:**
- Create: `src/components/layout/RequireOrg.jsx`
- Test: `src/components/layout/RequireOrg.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/RequireOrg.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RequireOrg from './RequireOrg'
import { authState } from '../../test/authState'

describe('RequireOrg', () => {
  it('renders children when an organization is active', () => {
    render(<RequireOrg><p>org content</p></RequireOrg>)
    expect(screen.getByText('org content')).toBeInTheDocument()
  })

  it('shows a spinner while the organization is loading', () => {
    authState.orgLoaded = false
    render(<RequireOrg><p>org content</p></RequireOrg>)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('org content')).not.toBeInTheDocument()
  })

  it('shows the org selection screen when no organization is active', () => {
    authState.organization = null
    render(<RequireOrg><p>org content</p></RequireOrg>)
    expect(screen.getByText('Select or create an organization')).toBeInTheDocument()
    expect(screen.getByTestId('org-switcher')).toBeInTheDocument()
    expect(screen.queryByText('org content')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/layout/RequireOrg.test.jsx`
Expected: FAIL with "Cannot find module './RequireOrg'".

- [ ] **Step 3: Implement `src/components/layout/RequireOrg.jsx`**

```jsx
import LoadingSpinner from '../ui/LoadingSpinner'
import { useOrganization, OrganizationSwitcher } from '../../lib/auth'

// Gates the app behind having an active organization. Renders inside
// ProtectedRoute, so by this point the user is already signed in.
export default function RequireOrg({ children }) {
  const { isLoaded, organization } = useOrganization()
  if (!isLoaded) return <LoadingSpinner className="min-h-screen" />
  if (!organization) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Select or create an organization
          </h1>
          <p className="mt-2 max-w-md text-sm text-text-secondary">
            ProcureIQ workspaces are scoped to an organization. Choose one or create a new one to continue.
          </p>
        </div>
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
        />
      </div>
    )
  }
  return children
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/layout/RequireOrg.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/RequireOrg.jsx src/components/layout/RequireOrg.test.jsx
git commit -m "feat(7a): add RequireOrg gate with org selection screen"
```

---

### Task 14: TopBar renders the OrganizationSwitcher

**Files:**
- Modify: `src/components/layout/TopBar.jsx`
- Test: `src/components/layout/layout.test.jsx`

- [ ] **Step 1: Update the TopBar test**

In `src/components/layout/layout.test.jsx`, replace the `TopBar` describe block (lines 23–30) with:

```jsx
describe('TopBar', () => {
  it('renders the organization switcher, user info, and user menu', () => {
    render(<TopBar />)
    expect(screen.getByTestId('org-switcher')).toBeInTheDocument()
    expect(screen.getByText('Amara Chen')).toBeInTheDocument()
    expect(screen.getByTestId('user-button')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/layout/layout.test.jsx`
Expected: FAIL — `org-switcher` testid not found (TopBar still renders static org text).

- [ ] **Step 3: Implement `src/components/layout/TopBar.jsx`**

Replace the whole file with:

```jsx
import { useUser, UserButton, OrganizationSwitcher } from '../../lib/auth'

export default function TopBar() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role ?? 'member'

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <OrganizationSwitcher />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary">{user?.fullName ?? ''}</p>
          <p className="text-xs capitalize text-text-secondary">{role.replace('_', ' ')}</p>
        </div>
        <UserButton />
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/layout/layout.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/TopBar.jsx src/components/layout/layout.test.jsx
git commit -m "feat(7a): TopBar renders OrganizationSwitcher"
```

---

### Task 15: Org-keyed provider stack + App wiring

**Files:**
- Create: `src/components/layout/OrgScopedProviders.jsx`
- Modify: `src/App.jsx`

This relocates the data-provider stack out of the app root (where it currently wraps public routes and fetches org-less) into an org-keyed wrapper inside `RequireOrg`. Changing the active org id changes the `Fragment` key, remounting the stack so every context refetches for the new org. Verification is the existing `App.test.jsx` integration suite staying green.

- [ ] **Step 1: Create `src/components/layout/OrgScopedProviders.jsx`**

```jsx
import { Fragment } from 'react'
import { useOrganization } from '../../lib/auth'
import { SupplierProvider } from '../../context/SupplierContext'
import { ContractProvider } from '../../context/ContractContext'
import { SpendProvider } from '../../context/SpendContext'
import { ChatProvider } from '../../context/ChatContext'

// Remounts the entire data-provider stack when the active org changes, so each
// context refetches for the new org. apiClient's per-request getToken() already
// returns a token carrying the newly-active org. Rendered inside RequireOrg, so
// `organization` is always present here.
export default function OrgScopedProviders({ children }) {
  const { organization } = useOrganization()
  return (
    <Fragment key={organization?.id}>
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <ChatProvider>{children}</ChatProvider>
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
    </Fragment>
  )
}
```

- [ ] **Step 2: Rewrite `src/App.jsx`**

Replace the whole file with (removes the root provider imports/wrappers; adds `RequireOrg` + `OrgScopedProviders` around `AppShell`):

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import ProtectedRoute from './components/layout/ProtectedRoute'
import RequireOrg from './components/layout/RequireOrg'
import OrgScopedProviders from './components/layout/OrgScopedProviders'
import { AuthProvider } from './lib/auth'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Contracts from './pages/Contracts'
import Risk from './pages/Risk'
import ESG from './pages/ESG'
import Spend from './pages/Spend'
import AIAssistant from './pages/AIAssistant'
import PlaceholderPage from './pages/PlaceholderPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'

const PLACEHOLDER_ROUTES = [
  { path: '/portal', title: 'Supplier Portal', phase: 'Phase 7' },
  { path: '/admin', title: 'Admin', phase: 'Phase 7' },
]

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <RequireOrg>
                    <OrgScopedProviders>
                      <AppShell />
                    </OrgScopedProviders>
                  </RequireOrg>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/:id" element={<SupplierDetail />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/risk" element={<Risk />} />
              <Route path="/esg" element={<ESG />} />
              <Route path="/spend" element={<Spend />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                <Route key={path} path={path} element={<PlaceholderPage title={title} phase={phase} />} />
              ))}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: Run the App integration suite to verify it passes**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS — the global mock returns an active org, so `RequireOrg` passes and `OrgScopedProviders` mounts; app pages render with data; the signed-out test still redirects to sign-in.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/layout/OrgScopedProviders.jsx
git commit -m "feat(7a): relocate data providers into org-keyed stack inside RequireOrg"
```

---

### Task 16: Dashboard "Load sample data" empty state

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Test: `src/pages/Dashboard.test.jsx`

- [ ] **Step 1: Add the failing empty-state test**

In `src/pages/Dashboard.test.jsx`, change the imports at the top to:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
```

Then append this describe block after the existing `describe('Dashboard', ...)` block:

```jsx
describe('Dashboard — empty org', () => {
  it('shows the Load sample data panel and seeds on click', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })

    const fetchMock = vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET'
      if (method === 'POST' && url === '/api/org/seed') {
        return { ok: true, status: 200, json: async () => ({ seeded: true }) }
      }
      return { ok: true, status: 200, json: async () => [] }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <Dashboard />
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
    )

    const button = await screen.findByRole('button', { name: 'Load sample data' })
    expect(screen.getByText('Your organization is empty')).toBeInTheDocument()

    fireEvent.click(button)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/org/seed', expect.objectContaining({ method: 'POST' }))
    )
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/Dashboard.test.jsx`
Expected: FAIL — no "Load sample data" button (Dashboard renders charts even with empty data).

- [ ] **Step 3: Implement the empty state in `src/pages/Dashboard.jsx`**

Add these imports at the top of the file (alongside the existing imports):

```jsx
import { useState } from 'react'
import { api } from '../lib/apiClient'
import Button from '../components/ui/Button'
```

Inside the `Dashboard` component, immediately after the four `use*` hook destructures (after the `const { spendRecords, isLoading: loadingSpend } = useSpend()` line), add:

```jsx
  const [seeding, setSeeding] = useState(false)

  async function handleSeed() {
    setSeeding(true)
    try {
      await api.post('/api/org/seed', {})
      window.location.reload()
    } catch {
      setSeeding(false)
    }
  }
```

Then, immediately after the existing loading guard:

```jsx
  if (loadingSuppliers || loadingContracts || loadingRisk || loadingSpend) {
    return <LoadingSpinner className="py-24" />
  }
```

add the empty-state branch:

```jsx
  if (suppliers.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Your supplier portfolio at a glance" />
        <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-center">
          <h3 className="font-display text-lg font-semibold text-text-primary">Your organization is empty</h3>
          <p className="max-w-md text-sm text-text-secondary">
            Load a sample procurement dataset — suppliers, contracts, risk, ESG, and spend — to explore ProcureIQ with realistic data.
          </p>
          <Button onClick={handleSeed} disabled={seeding}>
            {seeding ? 'Loading…' : 'Load sample data'}
          </Button>
        </Card>
      </div>
    )
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/pages/Dashboard.test.jsx`
Expected: PASS (both the original test and the empty-org test).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx src/pages/Dashboard.test.jsx
git commit -m "feat(7a): Dashboard empty-org Load sample data panel"
```

---

### Task 17: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: ALL PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Confirm the org constant is fully gone**

Run: `grep -rn "ORG_ID\|_lib/org" api/ src/`
Expected: no matches.

- [ ] **Step 4: Final commit (if lint produced fixes)**

```bash
git add -A
git commit -m "chore(7a): lint and full-suite verification"
```

(Skip if there is nothing to commit.)

---

## Deployment / ops prerequisite (manual, outside this plan)

Enable **Organizations** in the Clerk dashboard before this ships to an environment with real auth. With Organizations off, `payload.org_id` is always absent and every API call 403s — which is the correct gated behavior, and the test suite stays green because tests mock Clerk. No code change is required to turn it on.

## Manual verification (deferred until Organizations enabled)

Turn on Organizations in Clerk → sign in; if no org, the gate shows the switcher → create an org → empty Dashboard → "Load sample data" → data appears → add/edit a supplier works → create a second org → it is empty and independent → **switch back to the first org and confirm its data is intact and the second org's rows did not leak**.

## Out of scope (deferred)

- Member/role management and invites (7b — Admin Panel)
- Per-org settings, branding, billing
- Migrating the stranded `org_demo` seed (becomes dev-only/legacy)
- Org deletion / data export
- Per-org rate limits or quotas
