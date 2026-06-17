# ProcureIQ Phase 7b: Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin` into a real admin-only page where an org admin manages members/roles via Clerk's `<OrganizationProfile/>` and runs two transactional, admin-gated data operations — "Reload demo data" (reset) and "Clear all data" (clear).

**Architecture:** `requireAuth` surfaces the Clerk org role as `req.auth.orgRole`; a new `requireOrgAdmin` wrapper 403s non-admins and guards two new endpoints (`/api/org/clear`, `/api/org/reset`) that run child-first `deleteMany` (+ parent-first `createMany` for reset) in one `prisma.$transaction`. The frontend adds an `Admin` page (gated on `useOrganization().membership.role`) embedding Clerk's themed `<OrganizationProfile/>` plus a Danger zone using a reusable typed-confirmation `ConfirmDialog`; the Admin sidebar item is hidden from non-admins.

**Tech Stack:** Vercel serverless functions, Prisma + Neon, `@clerk/backend` (`verifyToken`), `@clerk/clerk-react` (`OrganizationProfile`), React Router, Vitest + Testing Library, framer-motion (existing `Modal`).

**Test command:** `npx vitest run <path>` (single file) or `npx vitest run` (all). Lint: `npm run lint`.

---

## File Structure

**Backend — modified:**
- `api/_lib/auth.js` — `requireAuth` adds `orgRole` to `req.auth`; new `requireOrgAdmin(handler)` wrapper.

**Backend — new:**
- `api/org/clear.js` — `POST /api/org/clear` (admin-only, transactional wipe).
- `api/org/reset.js` — `POST /api/org/reset` (admin-only wipe + re-seed).
- `api/org/clear.test.js`, `api/org/reset.test.js`

**Frontend — modified:**
- `src/lib/auth.jsx` — export Clerk's `OrganizationProfile`.
- `src/test/setup.js` — stub `OrganizationProfile`; mock `useOrganization` returns `membership` from `authState`.
- `src/test/authState.js` — add mutable `membership`.
- `src/App.jsx` — remove `/admin` placeholder; add real `/admin/*` route.
- `src/components/layout/Sidebar.jsx` — hide the Admin nav item from non-admins.
- `src/components/layout/layout.test.jsx` — Sidebar test for the hidden Admin item.

**Frontend — new:**
- `src/components/ui/ConfirmDialog.jsx` — typed-confirmation dialog (on the existing `Modal`).
- `src/components/ui/ConfirmDialog.test.jsx`
- `src/pages/Admin.jsx` — the Admin page.
- `src/pages/Admin.test.jsx`

---

### Task 1: `requireAuth` exposes `orgRole` + `requireOrgAdmin`

**Files:**
- Modify: `api/_lib/auth.js`
- Test: `api/_lib/auth.test.js`

- [ ] **Step 1: Update the existing success test and add role tests**

In `api/_lib/auth.test.js`, change the import line:

```js
import { requireAuth, requireOrgAdmin } from './auth.js'
```

Replace the `'attaches req.auth and calls the handler when the token has an active org'` test (the block that mocks `{ sub: 'user_123', org_id: 'org_abc' }` and asserts `req.auth` `toEqual({ userId: 'user_123', orgId: 'org_abc' })`) with these two tests:

```js
  it('attaches req.auth (incl. orgRole) and calls the handler when the token has an active org', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc', org_role: 'org:admin' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(req.auth).toEqual({ userId: 'user_123', orgId: 'org_abc', orgRole: 'org:admin' })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('sets orgRole to null when the token has an org but no role claim', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(req.auth.orgRole).toBeNull()
  })
```

Then add a new `describe` block after the `describe('requireAuth', ...)` block:

```js
describe('requireOrgAdmin', () => {
  it('calls the handler for an org admin', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc', org_role: 'org:admin' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireOrgAdmin(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin member', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc', org_role: 'org:member' })
    const handler = vi.fn()
    const res = mockRes()
    await requireOrgAdmin(handler)({ headers: { authorization: 'Bearer good' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 403 when the org role is missing', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', org_id: 'org_abc' })
    const handler = vi.fn()
    const res = mockRes()
    await requireOrgAdmin(handler)({ headers: { authorization: 'Bearer good' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/auth.test.js`
Expected: FAIL — `requireOrgAdmin` is not exported, and `req.auth` lacks `orgRole`.

- [ ] **Step 3: Implement in `api/_lib/auth.js`**

Change the `req.auth` assignment line (currently `req.auth = { userId: payload.sub, orgId }`) to include the role, and append the `requireOrgAdmin` wrapper. The full file becomes:

```js
import { verifyToken } from '@clerk/backend'

// Wraps a handler so it only runs with a valid Clerk session token that
// carries an active organization. Networkless verification: the JWT is
// checked against CLERK_SECRET_KEY. `org_id` and `org_role` are default Clerk
// session-token claims, present only when an org is active.
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
    req.auth = { userId: payload.sub, orgId, orgRole: payload.org_role ?? null }
    return handler(req, res)
  }
}

// Wraps a handler so it only runs for an organization admin (Clerk role
// `org:admin`). Composes requireAuth, so 401/403-no-org still apply first.
export function requireOrgAdmin(handler) {
  return requireAuth((req, res) => {
    if (req.auth.orgRole !== 'org:admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    return handler(req, res)
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/_lib/auth.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/auth.js api/_lib/auth.test.js
git commit -m "feat(7b): requireAuth exposes orgRole + add requireOrgAdmin wrapper"
```
(End the commit message body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)

---

### Task 2: `POST /api/org/clear`

**Files:**
- Create: `api/org/clear.js`
- Test: `api/org/clear.test.js`

- [ ] **Step 1: Write the failing test `api/org/clear.test.js`**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Each deleteMany returns a tagged token so the test can assert the exact
// order of operations passed to $transaction.
vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    contract: { deleteMany: vi.fn((a) => ({ op: 'contract', ...a })) },
    riskAssessment: { deleteMany: vi.fn((a) => ({ op: 'riskAssessment', ...a })) },
    esgResponse: { deleteMany: vi.fn((a) => ({ op: 'esgResponse', ...a })) },
    spendRecord: { deleteMany: vi.fn((a) => ({ op: 'spendRecord', ...a })) },
    supplier: { deleteMany: vi.fn((a) => ({ op: 'supplier', ...a })) },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))

import handler from './clear.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({
  method: 'POST',
  auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/org/clear', () => {
  it('deletes all five entities child-first in one transaction', async () => {
    const res = mockRes()
    await handler(authReq(), res)
    for (const model of ['contract', 'riskAssessment', 'esgResponse', 'spendRecord', 'supplier']) {
      expect(prisma[model].deleteMany).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const ops = prisma.$transaction.mock.calls[0][0].map((o) => o.op)
    expect(ops).toEqual(['contract', 'riskAssessment', 'esgResponse', 'spendRecord', 'supplier'])
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ cleared: true })
  })

  it('rejects non-POST with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/org/clear.test.js`
Expected: FAIL with "Cannot find module './clear.js'".

- [ ] **Step 3: Implement `api/org/clear.js`**

```js
import { prisma } from '../_lib/prisma.js'
import { requireOrgAdmin } from '../_lib/auth.js'

// Admin-only: permanently delete every record in the active org. Children are
// deleted before suppliers (no onDelete cascade in the schema), all in one
// transaction.
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
    ])
    return res.status(200).json({ cleared: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/org/clear.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/org/clear.js api/org/clear.test.js
git commit -m "feat(7b): add POST /api/org/clear (admin-only, transactional wipe)"
```
End commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 3: `POST /api/org/reset`

**Files:**
- Create: `api/org/reset.js`
- Test: `api/org/reset.test.js`

- [ ] **Step 1: Write the failing test `api/org/reset.test.js`**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    contract: { deleteMany: vi.fn((a) => ({ op: 'del:contract', ...a })), createMany: vi.fn((a) => ({ op: 'new:contract', ...a })) },
    riskAssessment: { deleteMany: vi.fn((a) => ({ op: 'del:risk', ...a })), createMany: vi.fn((a) => ({ op: 'new:risk', ...a })) },
    esgResponse: { deleteMany: vi.fn((a) => ({ op: 'del:esg', ...a })), createMany: vi.fn((a) => ({ op: 'new:esg', ...a })) },
    spendRecord: { deleteMany: vi.fn((a) => ({ op: 'del:spend', ...a })), createMany: vi.fn((a) => ({ op: 'new:spend', ...a })) },
    supplier: { deleteMany: vi.fn((a) => ({ op: 'del:supplier', ...a })), createMany: vi.fn((a) => ({ op: 'new:supplier', ...a })) },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))
vi.mock('../_lib/seedData.js', () => ({
  buildSeedData: vi.fn(() => ({
    suppliers: [{ id: 'org_test__sup_1' }],
    contracts: [{ id: 'org_test__con_1' }],
    riskAssessments: [{ id: 'org_test__risk_1' }],
    esgResponses: [{ id: 'org_test__esg_1' }],
    spendRecords: [{ id: 'org_test__spend_1' }],
  })),
}))

import handler from './reset.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({
  method: 'POST',
  auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/org/reset', () => {
  it('clears child-first then re-seeds parent-first in one transaction', async () => {
    const res = mockRes()
    await handler(authReq(), res)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const ops = prisma.$transaction.mock.calls[0][0].map((o) => o.op)
    expect(ops).toEqual([
      'del:contract', 'del:risk', 'del:esg', 'del:spend', 'del:supplier',
      'new:supplier', 'new:contract', 'new:risk', 'new:esg', 'new:spend',
    ])
    expect(prisma.supplier.createMany).toHaveBeenCalledWith({ data: [{ id: 'org_test__sup_1' }] })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ reset: true })
  })

  it('rejects non-POST with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/org/reset.test.js`
Expected: FAIL with "Cannot find module './reset.js'".

- [ ] **Step 3: Implement `api/org/reset.js`**

```js
import { prisma } from '../_lib/prisma.js'
import { requireOrgAdmin } from '../_lib/auth.js'
import { buildSeedData } from '../_lib/seedData.js'

// Admin-only: wipe the org then re-seed the canonical demo dataset, all in one
// transaction. Deletes child-first, inserts parent-first.
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const data = buildSeedData(orgId)
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
      prisma.supplier.createMany({ data: data.suppliers }),
      prisma.contract.createMany({ data: data.contracts }),
      prisma.riskAssessment.createMany({ data: data.riskAssessments }),
      prisma.esgResponse.createMany({ data: data.esgResponses }),
      prisma.spendRecord.createMany({ data: data.spendRecords }),
    ])
    return res.status(200).json({ reset: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/org/reset.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/org/reset.js api/org/reset.test.js
git commit -m "feat(7b): add POST /api/org/reset (admin-only clear + re-seed)"
```
End commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 4: Frontend auth seam — `OrganizationProfile` + `membership` in tests

**Files:**
- Modify: `src/lib/auth.jsx`, `src/test/setup.js`, `src/test/authState.js`

This is wiring: expose Clerk's `OrganizationProfile` and make the test mock carry `membership`. Verification is the full suite staying green (existing tests keep the default admin membership).

- [ ] **Step 1: Update `src/test/authState.js`**

Add a mutable `membership` to `authState` and reset it. The `authState` export and `resetAuthState` become (keep the existing `DEFAULT_USER` and `DEMO_ORG` above):

```js
export const authState = {
  isLoaded: true,
  isSignedIn: true,
  user: DEFAULT_USER,
  orgLoaded: true,
  organization: DEMO_ORG,
  membership: { role: 'org:admin' },
}

export function resetAuthState() {
  authState.isLoaded = true
  authState.isSignedIn = true
  authState.user = DEFAULT_USER
  authState.orgLoaded = true
  authState.organization = DEMO_ORG
  authState.membership = { role: 'org:admin' }
}
```

- [ ] **Step 2: Update `src/test/setup.js` mock**

In the `vi.mock('../lib/auth.jsx', ...)` factory, (a) make `useOrganization` return `membership` from `authState`, and (b) add an `OrganizationProfile` stub. The returned object becomes:

```js
  return {
    AuthProvider: ({ children }) => children,
    useUser: () => ({
      isLoaded: authState.isLoaded,
      isSignedIn: authState.isSignedIn,
      user: authState.isSignedIn ? authState.user : null,
    }),
    useOrganization: () => ({
      isLoaded: authState.orgLoaded,
      organization: authState.organization,
      membership: authState.membership,
    }),
    UserButton: () => createElement('div', { 'data-testid': 'user-button' }),
    OrganizationSwitcher: () => createElement('div', { 'data-testid': 'org-switcher' }),
    OrganizationProfile: () => createElement('div', { 'data-testid': 'org-profile' }),
    SignIn: () => createElement('div', { 'data-testid': 'clerk-sign-in' }),
    SignUp: () => createElement('div', { 'data-testid': 'clerk-sign-up' }),
  }
```

- [ ] **Step 3: Update `src/lib/auth.jsx`**

Add `OrganizationProfile` to the Clerk import and to the re-export line. The import block and final export become:

```jsx
import {
  ClerkProvider,
  useAuth,
  useUser,
  useOrganization,
  UserButton,
  OrganizationSwitcher,
  OrganizationProfile,
  SignIn,
  SignUp,
} from '@clerk/clerk-react'
```

```jsx
export { useUser, useOrganization, UserButton, OrganizationSwitcher, OrganizationProfile, SignIn, SignUp }
```

(Leave `AuthProvider`, `TokenBridge`, `CLERK_APPEARANCE`, etc. unchanged.)

- [ ] **Step 4: Run the full suite to verify nothing regressed**

Run: `npx vitest run`
Expected: PASS — existing tests are unaffected (default membership is admin; the new exports are unused so far).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.jsx src/test/setup.js src/test/authState.js
git commit -m "feat(7b): export OrganizationProfile + wire membership into test mock"
```
End commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 5: `ConfirmDialog` typed-confirmation component

**Files:**
- Create: `src/components/ui/ConfirmDialog.jsx`
- Test: `src/components/ui/ConfirmDialog.test.jsx`

- [ ] **Step 1: Write the failing test `src/components/ui/ConfirmDialog.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog'

function setup(props = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <ConfirmDialog
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      title="Clear all data?"
      description="This cannot be undone."
      confirmWord="clear"
      confirmLabel="Delete everything"
      {...props}
    />
  )
  return { onConfirm, onClose }
}

describe('ConfirmDialog', () => {
  it('keeps confirm disabled until the exact word is typed', () => {
    const { onConfirm } = setup()
    const confirm = screen.getByRole('button', { name: 'Delete everything' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'clea' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'clear' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onClose from the Cancel button', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ui/ConfirmDialog.test.jsx`
Expected: FAIL with "Cannot find module './ConfirmDialog'".

- [ ] **Step 3: Implement `src/components/ui/ConfirmDialog.jsx`**

```jsx
import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'

// A destructive-action confirmation: the confirm button stays disabled until
// the user types `confirmWord` exactly. Clears its input on close.
export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, description, confirmWord, confirmLabel, busy }) {
  const [text, setText] = useState('')
  const matches = text.trim() === confirmWord

  function handleClose() {
    setText('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <p className="text-sm text-text-secondary">{description}</p>
      <label className="mt-4 block text-sm text-text-secondary">
        Type <span className="font-mono font-semibold text-text-primary">{confirmWord}</span> to confirm:
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-border-accent"
        />
      </label>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        <Button variant="danger" disabled={!matches || busy} onClick={onConfirm}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ui/ConfirmDialog.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ConfirmDialog.jsx src/components/ui/ConfirmDialog.test.jsx
git commit -m "feat(7b): add ConfirmDialog typed-confirmation component"
```
End commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 6: `Admin` page + route

**Files:**
- Create: `src/pages/Admin.jsx`
- Modify: `src/App.jsx`
- Test: `src/pages/Admin.test.jsx`

- [ ] **Step 1: Write the failing test `src/pages/Admin.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Admin from './Admin'
import { authState } from '../test/authState'

describe('Admin', () => {
  it('shows the org profile and danger zone for an admin, and clears data on confirm', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ cleared: true }) }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Admin />)
    expect(screen.getByTestId('org-profile')).toBeInTheDocument()
    expect(screen.getByText('Danger zone')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'clear' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/org/clear', expect.objectContaining({ method: 'POST' }))
    )
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('shows an access-required notice for a non-admin member', () => {
    authState.membership = { role: 'org:member' }
    render(<Admin />)
    expect(screen.getByText('Admin access required')).toBeInTheDocument()
    expect(screen.queryByTestId('org-profile')).not.toBeInTheDocument()
    expect(screen.queryByText('Danger zone')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/Admin.test.jsx`
Expected: FAIL with "Cannot find module './Admin'".

- [ ] **Step 3: Implement `src/pages/Admin.jsx`**

```jsx
import { useState } from 'react'
import { Lock, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useOrganization, OrganizationProfile } from '../lib/auth'
import { api } from '../lib/apiClient'

export default function Admin() {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === 'org:admin'
  const [dialog, setDialog] = useState(null) // 'reset' | 'clear' | null
  const [busy, setBusy] = useState(false)

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Admin" />
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Lock size={28} className="text-text-secondary" />
          <p className="font-display text-lg font-semibold text-text-primary">Admin access required</p>
          <p className="max-w-md text-sm text-text-secondary">
            You need to be an organization admin to view this page. Ask an admin of your organization for access.
          </p>
        </Card>
      </div>
    )
  }

  async function runAction(path) {
    setBusy(true)
    try {
      await api.post(path, {})
      window.location.reload()
    } catch {
      setBusy(false)
      setDialog(null)
    }
  }

  return (
    <div>
      <PageHeader title="Admin" description="Manage your organization, members, and data." />

      <Card className="p-2">
        <OrganizationProfile routing="path" path="/admin" />
      </Card>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-accent-red" />
          <h3 className="font-display text-sm font-semibold text-text-primary">Danger zone</h3>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Reload demo data</p>
              <p className="text-sm text-text-secondary">Wipe this organization and re-seed the sample dataset.</p>
            </div>
            <Button variant="secondary" onClick={() => setDialog('reset')}>Reload demo data</Button>
          </div>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Clear all data</p>
              <p className="text-sm text-text-secondary">
                Permanently delete every supplier, contract, risk, ESG and spend record.
              </p>
            </div>
            <Button variant="danger" onClick={() => setDialog('clear')}>Clear all data</Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={dialog === 'reset'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('/api/org/reset')}
        title="Reload demo data?"
        description="This deletes all current data in this organization and replaces it with a fresh sample dataset. This cannot be undone."
        confirmWord="reset"
        confirmLabel="Reload sample data"
        busy={busy}
      />
      <ConfirmDialog
        isOpen={dialog === 'clear'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('/api/org/clear')}
        title="Clear all data?"
        description="This permanently deletes all suppliers, contracts, risk, ESG and spend records in this organization. This cannot be undone."
        confirmWord="clear"
        confirmLabel="Delete everything"
        busy={busy}
      />
    </div>
  )
}
```

- [ ] **Step 4: Wire the route in `src/App.jsx`**

Add the import near the other page imports:

```jsx
import Admin from './pages/Admin'
```

Remove the `/admin` entry from `PLACEHOLDER_ROUTES` so only `/portal` remains:

```jsx
const PLACEHOLDER_ROUTES = [
  { path: '/portal', title: 'Supplier Portal', phase: 'Phase 7' },
]
```

Add the Admin route inside the protected route group, immediately after the `/ai-assistant` route line (`<Route path="/ai-assistant" element={<AIAssistant />} />`):

```jsx
              <Route path="/admin/*" element={<Admin />} />
```

(The `path="/admin/*"` splat is required because Clerk's `<OrganizationProfile routing="path" path="/admin" />` owns internal sub-navigation.)

- [ ] **Step 5: Run the test + full suite to verify they pass**

Run: `npx vitest run src/pages/Admin.test.jsx src/App.test.jsx`
Expected: PASS (Admin tests pass; App integration tests unaffected — the `/portal` placeholder test still works, and no test navigates to `/admin`).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Admin.jsx src/pages/Admin.test.jsx src/App.jsx
git commit -m "feat(7b): add Admin page (org profile + danger zone) and /admin route"
```
End commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 7: Hide the Admin nav item from non-admins

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`
- Test: `src/components/layout/layout.test.jsx`

- [ ] **Step 1: Add the failing Sidebar test**

In `src/components/layout/layout.test.jsx`, add the authState import near the top (after the existing imports):

```jsx
import { authState } from '../../test/authState'
```

Then add a second test inside the existing `describe('Sidebar', ...)` block (after the `'renders a nav link for every module'` test):

```jsx
  it('hides the Admin link for non-admin members', () => {
    authState.membership = { role: 'org:member' }
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/layout/layout.test.jsx`
Expected: FAIL — the Admin link is still rendered for a member.

- [ ] **Step 3: Implement in `src/components/layout/Sidebar.jsx`**

Add the `useOrganization` import, read the role, and filter the Admin item. The full file becomes:

```jsx
import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { NAV_ITEMS } from '../../utils/constants'
import { useOrganization } from '../../lib/auth'

export default function Sidebar() {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === 'org:admin'
  const items = NAV_ITEMS.filter((item) => item.path !== '/admin' || isAdmin)

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-bg-secondary px-4 py-6 lg:flex">
      <div className="px-2 font-display text-xl font-semibold text-text-primary">
        ProcureIQ
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {items.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary',
                isActive && 'border border-border-accent bg-bg-hover text-text-primary'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/layout/layout.test.jsx`
Expected: PASS (the existing "every module" test still passes because the default membership is admin).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.jsx src/components/layout/layout.test.jsx
git commit -m "feat(7b): hide Admin nav item from non-admins"
```
End commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 8: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite (in two halves to avoid worker-timeout flakiness under load)**

Run: `npx vitest run api/`
Expected: ALL PASS.
Run: `npx vitest run src/`
Expected: ALL PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no NEW errors. (The repo has a known pre-existing baseline of `react-refresh`/`react-hooks` errors in the context files + `auth.jsx`; confirm none of the Phase 7b files — `Admin.jsx`, `ConfirmDialog.jsx`, `Sidebar.jsx`, the `api/org/*` files — appear in the lint output.)

- [ ] **Step 3: Confirm `/admin` is no longer a placeholder**

Run: `grep -rn "admin" src/App.jsx`
Expected: a `path="/admin/*"` route to `<Admin />`, and `PLACEHOLDER_ROUTES` containing only `/portal`.

- [ ] **Step 4: Final commit (only if lint produced fixes)**

```bash
git add -A
git commit -m "chore(7b): lint and full-suite verification"
```
(Skip if there is nothing to commit.)

---

## Manual verification (deferred until Organizations enabled in Clerk)

Sign in as an org **admin** → the Admin nav item appears → `/admin` shows Clerk's `<OrganizationProfile/>` (members, invitations, roles, org name/logo) → invite a teammate by email → they accept → promote/demote/remove them. In the Danger zone: "Reload demo data" → type `reset` → data is wiped and re-seeded; "Clear all data" → type `clear` → the org is emptied. Then sign in as a **member**: no Admin nav item, `/admin` shows the "Admin access required" screen, and a direct `POST /api/org/clear` returns **403**.

## Out of Scope (deferred)

- Granular per-feature permissions across the app (e.g. "only admins may delete a supplier")
- Billing, plans, org branding beyond Clerk's `<OrganizationProfile/>`
- An audit log / history of admin actions
- Bulk member import, SCIM, SSO configuration
- Soft-delete / export-before-clear (clear is a hard delete)
