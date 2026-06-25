# Lot D — Granular Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `org:member` read-only and `org:admin` full-manage via a declarative `canManage(orgRole, resource)` map enforced on the backend (403 on member writes) and frontend (hidden write affordances), for the resources suppliers/contracts/spend/portal (+ seed = admin-only).

**Architecture:** One backend helper + one frontend helper/hook share the same `canManage` rule. Each data write endpoint adds a `403` guard at the top of its write branch; each data page hides its write controls via `usePermissions()`. risk/esg are read-only and untouched.

**Tech Stack:** Vercel functions, Prisma, Clerk auth (`requireAuth` sets `req.auth.orgRole`), React, Vitest + Testing Library.

## Global Constraints

- `MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal']`. `canManage(orgRole, resource)` returns `true` iff `resource ∈ MANAGE_RESOURCES && orgRole === 'org:admin'`.
- Backend write guard (top of each write branch, before any DB work): `if (!canManage(req.auth.orgRole, '<resource>')) return res.status(403).json({ error: 'You do not have permission to manage <resource>' })`.
- `req.auth.orgRole` is set by `requireAuth`. Existing handler tests pass `auth` WITHOUT `orgRole`; every existing write-path test MUST gain `orgRole: 'org:admin'` on its `auth` object or it will now 403. The tasks spell this out per file.
- seed is admin-only: `if (req.auth.orgRole !== 'org:admin') return res.status(403).json({ error: 'Admin access required' })`.
- Reads (GET) stay open. risk/esg endpoints + pages are untouched (read-only).
- Frontend: `usePermissions()` returns `{ role, canManage(resource) }`; pages render write controls only when `canManage('<resource>')`. Tests use the `authState` seam — default `membership.role = 'org:admin'` (existing tests stay green); member tests set `authState.membership = { role: 'org:member' }`.
- Tests must stay green (currently 386). api half: `npx vitest run api/`; src half serial: `npx vitest run src/ --no-file-parallelism`. Match existing style (ESM, no semicolons, 2-space indent).
- Commit after each task with a `feat(7d-perm):` / `test(7d-perm):` prefix.

---

### Task 1: backend permissions helper

**Files:**
- Create: `api/_lib/permissions.js`
- Test: `api/_lib/permissions.test.js`

**Interfaces:**
- Produces: `MANAGE_RESOURCES: string[]`, `canManage(orgRole, resource) => boolean`. Consumed by Tasks 3–7.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/permissions.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { canManage, MANAGE_RESOURCES } from './permissions.js'

describe('canManage', () => {
  it('lets an admin manage every known resource', () => {
    for (const r of MANAGE_RESOURCES) expect(canManage('org:admin', r)).toBe(true)
  })
  it('denies a member every resource', () => {
    for (const r of MANAGE_RESOURCES) expect(canManage('org:member', r)).toBe(false)
  })
  it('denies an unknown role and an unknown resource', () => {
    expect(canManage(null, 'suppliers')).toBe(false)
    expect(canManage('org:admin', 'unknown')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/permissions.test.js`
Expected: FAIL — cannot resolve `./permissions.js`.

- [ ] **Step 3: Write the implementation**

Create `api/_lib/permissions.js`:

```js
export const MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal']

// True if the given Clerk org role may create/edit/delete the resource. Reads are
// open to all members; only "manage" actions are gated. Admin manages everything.
export function canManage(orgRole, resource) {
  if (!MANAGE_RESOURCES.includes(resource)) return false
  return orgRole === 'org:admin'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/permissions.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/permissions.js api/_lib/permissions.test.js
git commit -m "feat(7d-perm): add backend canManage permission helper"
```

---

### Task 2: frontend permissions helper + hook

**Files:**
- Create: `src/lib/permissions.js`
- Test: `src/lib/permissions.test.jsx`

**Interfaces:**
- Produces: `MANAGE_RESOURCES`, `canManage(role, resource)`, and `usePermissions() => { role, canManage(resource) }`. Consumed by Tasks 8–12.

- [ ] **Step 1: Write the failing test**

Create `src/lib/permissions.test.jsx`:

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { canManage, usePermissions } from './permissions'
import { resetAuthState, authState } from '../test/authState'

describe('frontend permissions', () => {
  beforeEach(() => resetAuthState())

  it('canManage matches the backend rule', () => {
    expect(canManage('org:admin', 'contracts')).toBe(true)
    expect(canManage('org:member', 'contracts')).toBe(false)
    expect(canManage('org:admin', 'risk')).toBe(false)
  })

  it('usePermissions binds canManage to the current org role', () => {
    authState.membership = { role: 'org:member' }
    const { result } = renderHook(() => usePermissions())
    expect(result.current.role).toBe('org:member')
    expect(result.current.canManage('suppliers')).toBe(false)
  })

  it('usePermissions allows an admin', () => {
    authState.membership = { role: 'org:admin' }
    const { result } = renderHook(() => usePermissions())
    expect(result.current.canManage('suppliers')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/permissions.test.jsx`
Expected: FAIL — cannot resolve `./permissions`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/permissions.js`:

```js
import { useOrganization } from './auth'

export const MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal']

export function canManage(role, resource) {
  if (!MANAGE_RESOURCES.includes(resource)) return false
  return role === 'org:admin'
}

export function usePermissions() {
  const { membership } = useOrganization()
  const role = membership?.role ?? null
  return { role, canManage: (resource) => canManage(role, resource) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/permissions.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.js src/lib/permissions.test.jsx
git commit -m "feat(7d-perm): add frontend canManage + usePermissions hook"
```

---

### Task 3: gate suppliers write endpoints

**Files:**
- Modify: `api/suppliers/index.js` (POST), `api/suppliers/[id].js` (PATCH)
- Modify: `api/suppliers/suppliers.test.js`

**Interfaces:**
- Consumes: `canManage` (Task 1).

- [ ] **Step 1: Update the test (TDD)**

Open `api/suppliers/suppliers.test.js`. For EVERY existing test whose request is a POST or PATCH (the write paths), add `orgRole: 'org:admin'` to its `auth` object (so they stay 201/200). Then add two member-403 tests inside the describe block:

```js
  it('POST returns 403 for a member (read-only)', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { name: 'X', email: 'x@y.com' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.supplier.create).not.toHaveBeenCalled()
  })

  it('PATCH returns 403 for a member (read-only)', async () => {
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'sup_1' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { name: 'X' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.supplier.update).not.toHaveBeenCalled()
  })
```

(If the test file's import names for the two handlers differ from `listHandler`/`idHandler`, use the file's actual names.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run api/suppliers/suppliers.test.js`
Expected: FAIL — the two member tests still create/update (no guard yet).

- [ ] **Step 3: Gate `api/suppliers/index.js`**

Add `import { canManage } from '../_lib/permissions.js'`. At the TOP of the `POST` branch (before the required-field check):

```js
    if (req.method === 'POST') {
      if (!canManage(req.auth.orgRole, 'suppliers')) {
        return res.status(403).json({ error: 'You do not have permission to manage suppliers' })
      }
      const body = req.body ?? {}
```

- [ ] **Step 4: Gate `api/suppliers/[id].js`**

Add `import { canManage } from '../_lib/permissions.js'`. At the TOP of the `PATCH` branch (before the `findFirst`):

```js
    if (req.method === 'PATCH') {
      if (!canManage(req.auth.orgRole, 'suppliers')) {
        return res.status(403).json({ error: 'You do not have permission to manage suppliers' })
      }
      const existing = await prisma.supplier.findFirst({
```

- [ ] **Step 5: Run the suppliers test**

Run: `npx vitest run api/suppliers/suppliers.test.js`
Expected: PASS (all existing-with-orgRole + 2 new).

- [ ] **Step 6: Run the api half**

Run: `npx vitest run api/`
Expected: PASS. Report the count.

- [ ] **Step 7: Commit**

```bash
git add api/suppliers/index.js "api/suppliers/[id].js" api/suppliers/suppliers.test.js
git commit -m "feat(7d-perm): gate suppliers writes to admin (403 for members)"
```

---

### Task 4: gate contracts write + action endpoints

**Files:**
- Modify: `api/contracts/index.js` (POST), `api/contracts/[id].js` (PATCH), `api/contracts/summarize.js`, `api/contracts/upload-signature.js`, `api/contracts/notify.js`
- Modify: `api/contracts/contracts.test.js`, `api/contracts/summarize.test.js`, `api/contracts/upload-signature.test.js`, `api/contracts/notify.test.js`

**Interfaces:**
- Consumes: `canManage` (Task 1).

- [ ] **Step 1: Update the four tests (TDD)**

In each test file, add `orgRole: 'org:admin'` to the `auth` object of every existing write/action test (contracts.test.js POST+PATCH; the whole of summarize/upload-signature/notify which are POST-only actions). Then add one member-403 test per file:

contracts.test.js:
```js
  it('POST returns 403 for a member', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { title: 'X', supplierId: 'sup_1', value: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.contract.create).not.toHaveBeenCalled()
  })
```

summarize.test.js / upload-signature.test.js / notify.test.js — add (adapt the existing `mockRes`/`handler` names in each file):
```js
  it('returns 403 for a member', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { id: 'con_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
```

- [ ] **Step 2: Run to verify the member tests fail**

Run: `npx vitest run api/contracts/`
Expected: FAIL on the new member-403 tests.

- [ ] **Step 3: Gate the two CRUD branches**

`api/contracts/index.js`: add `import { canManage } from '../_lib/permissions.js'`; at the top of the POST branch (before the required-field check):
```js
    if (req.method === 'POST') {
      if (!canManage(req.auth.orgRole, 'contracts')) {
        return res.status(403).json({ error: 'You do not have permission to manage contracts' })
      }
```
`api/contracts/[id].js`: add the import; at the top of the PATCH branch (before `findFirst`):
```js
    if (req.method === 'PATCH') {
      if (!canManage(req.auth.orgRole, 'contracts')) {
        return res.status(403).json({ error: 'You do not have permission to manage contracts' })
      }
```

- [ ] **Step 4: Gate the three action endpoints**

For each of `summarize.js`, `upload-signature.js`, `notify.js`: add `import { canManage } from '../_lib/permissions.js'` and insert the guard immediately AFTER the method guard (`if (req.method !== 'POST') {...}`) and BEFORE the id/503 checks:

```js
  if (!canManage(req.auth.orgRole, 'contracts')) {
    return res.status(403).json({ error: 'You do not have permission to manage contracts' })
  }
```

- [ ] **Step 5: Run the contracts tests**

Run: `npx vitest run api/contracts/`
Expected: PASS (all existing-with-orgRole + the 4 new member tests).

- [ ] **Step 6: Run the api half**

Run: `npx vitest run api/`
Expected: PASS. Report the count.

- [ ] **Step 7: Commit**

```bash
git add api/contracts/
git commit -m "feat(7d-perm): gate contracts writes + actions to admin"
```

---

### Task 5: gate spend write endpoints

**Files:**
- Modify: `api/spend/index.js` (POST), `api/spend/[id].js` (PATCH)
- Modify: `api/spend/spend.test.js`

**Interfaces:** Consumes `canManage` (Task 1).

- [ ] **Step 1: Update the test (TDD)**

In `api/spend/spend.test.js`, add `orgRole: 'org:admin'` to the `auth` of every POST/PATCH test. Add:

```js
  it('POST returns 403 for a member', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', body: { supplierId: 'sup_1', amount: 1, category: 'Logistics', date: '2026-06-01' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.spendRecord.create).not.toHaveBeenCalled()
  })

  it('PATCH returns 403 for a member', async () => {
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'spend_1' }, body: { amount: 9 }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.spendRecord.update).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run api/spend/spend.test.js`
Expected: FAIL on the two member tests.

- [ ] **Step 3: Gate `api/spend/index.js`**

Add the import; top of POST branch (before required-field check):
```js
    if (req.method === 'POST') {
      if (!canManage(req.auth.orgRole, 'spend')) {
        return res.status(403).json({ error: 'You do not have permission to manage spend' })
      }
```

- [ ] **Step 4: Gate `api/spend/[id].js`**

Add the import; top of PATCH branch (before `findFirst`):
```js
    if (req.method === 'PATCH') {
      if (!canManage(req.auth.orgRole, 'spend')) {
        return res.status(403).json({ error: 'You do not have permission to manage spend' })
      }
```

- [ ] **Step 5: Run the spend test, then the api half**

Run: `npx vitest run api/spend/spend.test.js` → PASS.
Run: `npx vitest run api/` → PASS. Report the count.

- [ ] **Step 6: Commit**

```bash
git add api/spend/index.js "api/spend/[id].js" api/spend/spend.test.js
git commit -m "feat(7d-perm): gate spend writes to admin"
```

---

### Task 6: gate portal-requests write + action endpoints

**Files:**
- Modify: `api/portal-requests/index.js` (POST), `api/portal-requests/[id].js` (PATCH + DELETE), `api/portal-requests/notify.js`
- Modify: `api/portal-requests/index.test.js`, `api/portal-requests/[id].test.js`, `api/portal-requests/notify.test.js`

**Interfaces:** Consumes `canManage` (Task 1). Resource string is `'portal'`.

- [ ] **Step 1: Update the three tests (TDD)**

Add `orgRole: 'org:admin'` to the `auth` of every POST/PATCH/DELETE/notify test in the three files. (The GET test in index.test.js does not need it.) Then add member-403 tests:

index.test.js:
```js
  it('POST returns 403 for a member', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { supplierId: 'sup_1', title: 'x' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
```
[id].test.js:
```js
  it('PATCH returns 403 for a member', async () => {
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, query: { id: 'preq_1' }, body: { status: 'approved' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
  it('DELETE returns 403 for a member', async () => {
    const res = mockRes()
    await idHandler({ method: 'DELETE', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, query: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
```
notify.test.js:
```js
  it('returns 403 for a member', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
```

- [ ] **Step 2: Run to verify the member tests fail**

Run: `npx vitest run api/portal-requests/`
Expected: FAIL on the new member tests.

- [ ] **Step 3: Gate `api/portal-requests/index.js`**

Add `import { canManage } from '../_lib/permissions.js'`; top of POST branch (before the required-field check):
```js
    if (req.method === 'POST') {
      if (!canManage(req.auth.orgRole, 'portal')) {
        return res.status(403).json({ error: 'You do not have permission to manage portal' })
      }
```

- [ ] **Step 4: Gate `api/portal-requests/[id].js`**

Add the import; at the top of BOTH the PATCH and DELETE branches (before their `findFirst`):
```js
    if (req.method === 'PATCH') {
      if (!canManage(req.auth.orgRole, 'portal')) {
        return res.status(403).json({ error: 'You do not have permission to manage portal' })
      }
```
```js
    if (req.method === 'DELETE') {
      if (!canManage(req.auth.orgRole, 'portal')) {
        return res.status(403).json({ error: 'You do not have permission to manage portal' })
      }
```

- [ ] **Step 5: Gate `api/portal-requests/notify.js`**

Add the import; right after the method guard, before the id/503 checks:
```js
  if (!canManage(req.auth.orgRole, 'portal')) {
    return res.status(403).json({ error: 'You do not have permission to manage portal' })
  }
```

- [ ] **Step 6: Run the portal tests, then the api half**

Run: `npx vitest run api/portal-requests/` → PASS.
Run: `npx vitest run api/` → PASS. Report the count.

- [ ] **Step 7: Commit**

```bash
git add api/portal-requests/
git commit -m "feat(7d-perm): gate portal-requests writes + notify to admin"
```

---

### Task 7: gate org seed to admin

**Files:**
- Modify: `api/org/seed.js`
- Modify: `api/org/seed.test.js`

**Interfaces:** None new — adds an admin role check.

- [ ] **Step 1: Update the test (TDD)**

In `api/org/seed.test.js`, the existing happy-path tests already use `auth: { ..., orgRole: 'org:admin' }` (the `authReq` helper sets it). Add a member-403 test:

```js
  it('returns 403 for a non-admin member', async () => {
    prisma.supplier.count.mockResolvedValue(0)
    const res = mockRes()
    await handler(authReq({ auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' } }), res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
```

(If `authReq` does not allow overriding `auth`, build the req inline: `{ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' } }`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/org/seed.test.js`
Expected: FAIL — member still seeds.

- [ ] **Step 3: Gate `api/org/seed.js`**

After the method guard and before the count-guard read, add:

```js
  const { orgId } = req.auth
  if (req.auth.orgRole !== 'org:admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  try {
```

(Place the role check right after `const { orgId } = req.auth` and before the existing `try {`.)

- [ ] **Step 4: Run the seed test, then the api half**

Run: `npx vitest run api/org/seed.test.js` → PASS.
Run: `npx vitest run api/` → PASS. Report the count.

- [ ] **Step 5: Commit**

```bash
git add api/org/seed.js api/org/seed.test.js
git commit -m "feat(7d-perm): make org seed admin-only"
```

---

### Task 8: gate Suppliers + SupplierDetail UI

**Files:**
- Modify: `src/pages/Suppliers.jsx`, `src/pages/SupplierDetail.jsx`
- Modify: `src/pages/Suppliers.test.jsx` (and `SupplierDetail.test.jsx` if it exists)

**Interfaces:** Consumes `usePermissions` (Task 2).

- [ ] **Step 1: Write the failing test**

In `src/pages/Suppliers.test.jsx`, add a member test (mirror the file's existing render setup; set the member role via `authState`):

```js
  it('hides write controls for a read-only member', () => {
    authState.membership = { role: 'org:member' }
    render(/* the same way the other tests render Suppliers, e.g. <MemoryRouter><Suppliers/></MemoryRouter> with the providers the file already uses */)
    expect(screen.queryByRole('button', { name: /Add Supplier/i })).not.toBeInTheDocument()
  })
```

Open the file first to copy its exact render/import setup (`authState` import, providers, router). Ensure `resetAuthState()` runs in `beforeEach` (it likely already does globally via setup.js).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/Suppliers.test.jsx`
Expected: FAIL — the Add Supplier button still renders for a member.

- [ ] **Step 3: Gate `src/pages/Suppliers.jsx`**

Add `import { usePermissions } from '../lib/permissions'` and, in the component, `const { canManage } = usePermissions()`. Then:
- Wrap the "Add Supplier" button (in the `PageHeader` `actions` prop) so it only renders when `canManage('suppliers')`.
- In the actions column / row Edit control, render the Edit button only when `canManage('suppliers')`.

Pattern (apply to the actual button JSX in the file):
```jsx
{canManage('suppliers') && (
  <Button variant="primary" onClick={openAdd}>
    <PlusCircle size={16} />
    Add Supplier
  </Button>
)}
```

- [ ] **Step 4: Gate `src/pages/SupplierDetail.jsx`**

Add the same `usePermissions` import + `canManage`. Wrap any edit/manage affordance (e.g. an "Edit" button or supplier-edit modal trigger) so it renders only when `canManage('suppliers')`. (Open the file; gate only the write controls — leave all read content untouched.)

- [ ] **Step 5: Run the page tests**

Run: `npx vitest run src/pages/Suppliers.test.jsx`
Expected: PASS (existing admin tests + the new member test). If `SupplierDetail.test.jsx` exists, run it too and add an analogous member assertion if it renders an edit control.

- [ ] **Step 6: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS. Report the count.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Suppliers.jsx src/pages/SupplierDetail.jsx src/pages/Suppliers.test.jsx
git commit -m "feat(7d-perm): hide supplier write controls from members"
```

---

### Task 9: gate Contracts UI (+ slide-over actions)

**Files:**
- Modify: `src/pages/Contracts.jsx`
- Modify: `src/pages/Contracts.test.jsx`

**Interfaces:** Consumes `usePermissions` (Task 2). The `ContractSlideOver` already hides its Summarize/Upload/Notify sections when the matching `onSummarize`/`onUpload`/`onNotify` prop is undefined — so gating is achieved by passing those props (and the Edit handler) only when `canManage('contracts')`.

- [ ] **Step 1: Write the failing test**

In `src/pages/Contracts.test.jsx`, add a member test (mirror the file's render setup):

```js
  it('hides write controls for a read-only member', () => {
    authState.membership = { role: 'org:member' }
    render(/* same as the other Contracts tests */)
    expect(screen.queryByRole('button', { name: /Add Contract/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/Contracts.test.jsx`
Expected: FAIL — Add Contract still shows for a member.

- [ ] **Step 3: Gate `src/pages/Contracts.jsx`**

Add `import { usePermissions } from '../lib/permissions'` + `const { canManage } = usePermissions()`. Let `const canManageContracts = canManage('contracts')`. Then:
- Render the "Add Contract" header button only when `canManageContracts`.
- Render the row "Edit" button only when `canManageContracts`.
- On the `ContractSlideOver`, pass `onEdit`/`onSummarize`/`onUpload`/`onNotify` only when `canManageContracts` (e.g. `onSummarize={canManageContracts && liveSelected ? () => summarizeContract(liveSelected.id) : undefined}`), so a member sees the slide-over read-only without action buttons.

- [ ] **Step 4: Run the Contracts test, then the src half**

Run: `npx vitest run src/pages/Contracts.test.jsx` → PASS.
Run: `npx vitest run src/ --no-file-parallelism` → PASS. Report the count.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Contracts.jsx src/pages/Contracts.test.jsx
git commit -m "feat(7d-perm): hide contract write controls + slide-over actions from members"
```

---

### Task 10: gate Spend UI

**Files:**
- Modify: `src/pages/Spend.jsx`
- Modify: `src/pages/Spend.test.jsx`

**Interfaces:** Consumes `usePermissions` (Task 2).

- [ ] **Step 1: Write the failing test**

In `src/pages/Spend.test.jsx`, add (mirror the file's setup):

```js
  it('hides write controls for a read-only member', () => {
    authState.membership = { role: 'org:member' }
    render(/* same as other Spend tests */)
    expect(screen.queryByRole('button', { name: /Add (Spend|Record)/i })).not.toBeInTheDocument()
  })
```

(Open the file to confirm the exact add-button label and match it.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/Spend.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Gate `src/pages/Spend.jsx`**

Add `usePermissions` import + `const { canManage } = usePermissions()`. Render the Add button and the row Edit button only when `canManage('spend')`.

- [ ] **Step 4: Run the Spend test, then the src half**

Run: `npx vitest run src/pages/Spend.test.jsx` → PASS.
Run: `npx vitest run src/ --no-file-parallelism` → PASS. Report the count.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Spend.jsx src/pages/Spend.test.jsx
git commit -m "feat(7d-perm): hide spend write controls from members"
```

---

### Task 11: gate Portal UI (+ slide-over actions)

**Files:**
- Modify: `src/pages/Portal.jsx`
- Modify: `src/pages/Portal.test.jsx`

**Interfaces:** Consumes `usePermissions` (Task 2).

- [ ] **Step 1: Write the failing test**

In `src/pages/Portal.test.jsx`, add (mirror the file's setup, which renders with real providers):

```js
  it('hides write controls for a read-only member', () => {
    authState.membership = { role: 'org:member' }
    render(/* same as other Portal tests */)
    expect(screen.queryByRole('button', { name: /New request/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/Portal.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Gate `src/pages/Portal.jsx`**

Add `usePermissions` import + `const { canManage } = usePermissions()`; `const canManagePortal = canManage('portal')`. Then:
- Render the "New request" header button only when `canManagePortal`.
- On the `PortalRequestSlideOver`, pass `onUpdate`/`onNotify`/`onDelete` only when `canManagePortal` (the slide-over already conditions its status actions on `onUpdate`, notify on `onNotify`, and the delete button is inside the component — wrap the Delete button render on a new optional prop OR simply pass `onDelete={canManagePortal ? ... : undefined}` and have the component already guard the delete button on `onDelete`). NOTE: if `PortalRequestSlideOver` renders the Delete button unconditionally, add an `onDelete &&` guard around the Delete button + ConfirmDialog so a member with `onDelete === undefined` sees no delete control; cover this with the existing slide-over test if you change the component.

- [ ] **Step 4: Run the Portal test, then the src half**

Run: `npx vitest run src/pages/Portal.test.jsx` → PASS.
Run: `npx vitest run src/ --no-file-parallelism` → PASS. Report the count.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Portal.jsx src/pages/Portal.test.jsx src/components/ui/PortalRequestSlideOver.jsx src/components/ui/PortalRequestSlideOver.test.jsx
git commit -m "feat(7d-perm): hide portal write controls + slide-over actions from members"
```

(Only add the slide-over files if you changed them.)

---

### Task 12: gate Dashboard "Load sample data" (admin-only)

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/Dashboard.test.jsx`

**Interfaces:** Consumes `usePermissions` (Task 2). seed is admin-only (Task 7), so the panel must be admin-only too.

- [ ] **Step 1: Write the failing test**

In `src/pages/Dashboard.test.jsx`, add a test that, on an empty org as a member, the "Load sample data" button is absent and a member note is shown (mirror the file's empty-org test setup; set `authState.membership = { role: 'org:member' }` and the empty-suppliers condition the existing empty-state test uses):

```js
  it('shows a member note instead of the seed button on an empty org', async () => {
    authState.membership = { role: 'org:member' }
    /* render with the same empty-org data setup the existing empty-state test uses */
    expect(await screen.findByText(/Ask an organization admin to load data/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Load sample data/i })).not.toBeInTheDocument()
  })
```

(Open the file first; reuse however the existing empty-org test drives the empty state and the seed button label.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/Dashboard.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Gate the seed panel in `src/pages/Dashboard.jsx`**

Add `import { usePermissions } from '../lib/permissions'` + `const { canManage } = usePermissions()`. In the empty-org panel, render the "Load sample data" `Button` (the one calling `handleSeed`) only when `canManage('suppliers')` (admin); otherwise render a note:

```jsx
{canManage('suppliers') ? (
  <Button variant="primary" onClick={handleSeed} disabled={seeding}>
    {seeding ? 'Loading…' : 'Load sample data'}
  </Button>
) : (
  <p className="text-sm text-text-secondary">Ask an organization admin to load data.</p>
)}
```

(Match the existing button's exact props/label in the file. `canManage('suppliers')` is `true` only for admins, which is the intended gate.)

- [ ] **Step 4: Run the Dashboard test, then the src half**

Run: `npx vitest run src/pages/Dashboard.test.jsx` → PASS.
Run: `npx vitest run src/ --no-file-parallelism` → PASS. Report the count.

- [ ] **Step 5: Lint the changed src files**

Run: `npx eslint src/lib/permissions.js src/pages/Suppliers.jsx src/pages/SupplierDetail.jsx src/pages/Contracts.jsx src/pages/Spend.jsx src/pages/Portal.jsx src/pages/Dashboard.jsx`
Expected: no NEW errors beyond the known baseline.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.jsx src/pages/Dashboard.test.jsx
git commit -m "feat(7d-perm): make Dashboard seed panel admin-only"
```

---

### Task 13: full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the api half**

Run: `npx vitest run api/`
Expected: PASS (incl. both permission helpers + every gated endpoint's member-403 case).

- [ ] **Step 2: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS (incl. the member-hidden page tests).

- [ ] **Step 3: Lint**

Run: `npx eslint api/ src/lib/permissions.js src/pages/`
Expected: no NEW errors beyond the known baseline.

---

## Self-Review

**Spec coverage:**
- backend `canManage` helper → Task 1. ✓
- frontend `canManage` + `usePermissions` → Task 2. ✓
- backend gating: suppliers (T3), contracts+actions (T4), spend (T5), portal+notify (T6), seed-admin (T7). ✓
- frontend gating: Suppliers/SupplierDetail (T8), Contracts (T9), Spend (T10), Portal (T11), Dashboard seed panel (T12). ✓
- risk/esg excluded (read-only) — no task touches them. ✓
- Tests incl. the orgRole-on-existing-write-tests fix + member-403 per endpoint + member-hidden per page → each task + Task 13. ✓
- Non-goals respected: no Clerk-dashboard roles, no DB role model, no third tier, reads untouched. ✓

**Placeholder scan:** Backend steps have complete code. Frontend steps give the exact gating
snippet + the precise list of controls to wrap per page and the exact member test; the
implementer opens each page to apply the wrap to its real button JSX (the files are large
and pre-existing — surgical wraps, not rewrites). The cross-cutting "add `orgRole:
'org:admin'` to existing write-test auth objects" instruction is called out in every backend
task and the Global Constraints.

**Type consistency:** `canManage(orgRole, resource)` signature + `MANAGE_RESOURCES`
identical in Task 1 (backend) and Task 2 (frontend). Resource strings
(`suppliers`/`contracts`/`spend`/`portal`) identical across the gating tasks and the 403
messages. `usePermissions().canManage(resource)` used uniformly in Tasks 8–12.
