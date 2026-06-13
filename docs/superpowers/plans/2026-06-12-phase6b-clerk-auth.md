# Phase 6b: Clerk Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock auth with Clerk — embedded sign-in/sign-up, a ProtectedRoute around the app shell, Bearer-token verification on every API endpoint, and the PATCH org-scoping fix.

**Architecture:** `src/lib/auth.jsx` is a local seam wrapping `@clerk/clerk-react` (ClerkProvider + dark appearance + a TokenBridge that registers `getToken` into the apiClient); the vitest setup globally mocks the seam via a mutable `authState` helper so all existing tests run Clerk-free. On the backend, `requireAuth(handler)` in `api/_lib/auth.js` verifies Bearer tokens networklessly with `@clerk/backend`'s `verifyToken`; all 8 endpoints wrap their handlers, and the three `[id].js` PATCH handlers gain org scoping (findFirst → 404 → update).

**Tech Stack:** @clerk/clerk-react, @clerk/backend, Vite + React 19, Vitest + RTL + jsdom, existing 6a API layer.

---

## Scene setting (read before starting)

- Spec: `docs/superpowers/specs/2026-06-12-phase6b-clerk-auth-design.md`.
- `.env` already contains real `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (plus `DATABASE_URL`). NEVER print or commit `.env`.
- Current state: `src/lib/mockAuth.jsx` provides `MockAuthProvider`/`useUser`/`useOrganization`; App.jsx wraps everything in `MockAuthProvider`; TopBar consumes the hooks and renders an initials circle; `src/components/layout/layout.test.jsx` has a TopBar test importing `MockAuthProvider`.
- Suite baseline: 38 files / 233 tests green. ESLint baseline: 11 errors (2 of them in mockAuth.jsx, which this phase deletes; `src/lib/auth.jsx` will add 1 back — expect ~10 after 6b, no new categories).
- Test runner: `npm test -- <file>`; full `npm test`.

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `package.json` | Modify | add @clerk/clerk-react, @clerk/backend |
| `.env.example` | Modify | document the two Clerk keys |
| `api/_lib/auth.js` (+ `auth.test.js`) | Create | requireAuth Bearer verification |
| `api/suppliers|contracts|spend/index.js` + `[id].js`, `api/risk|esg/index.js` | Modify | wrap with requireAuth; [id].js org-scoped |
| `api/**/**.test.js` (4 files) | Modify | mock requireAuth as identity; PATCH org-scope cases |
| `src/lib/apiClient.js` (+ test) | Modify | setTokenGetter + Bearer header |
| `src/lib/auth.jsx` | Create | Clerk seam (AuthProvider, useUser, useOrganization, UserButton, SignIn, SignUp) |
| `src/lib/mockAuth.jsx` | Delete | replaced by the seam + test mock |
| `src/test/authState.js` | Create | mutable auth state for the global mock |
| `src/test/setup.js` | Modify | global vi.mock of the seam |
| `src/components/layout/TopBar.jsx` | Modify | seam imports, UserButton, role fallback |
| `src/components/layout/layout.test.jsx` | Modify | drop MockAuthProvider, assert UserButton |
| `src/components/layout/ProtectedRoute.jsx` (+ test) | Create | loading/redirect/children gate |
| `src/pages/SignInPage.jsx`, `src/pages/SignUpPage.jsx` | Create | embedded Clerk components |
| `src/App.jsx` + `src/App.test.jsx` | Modify | AuthProvider, sign-in/up routes, ProtectedRoute |

---

### Task 1: Dependencies, env docs, and requireAuth

**Files:**
- Modify: `package.json` (via npm install), `.env.example`
- Create: `api/_lib/auth.js`, `api/_lib/auth.test.js`

- [ ] **Step 1: Install dependencies**

```bash
npm install @clerk/clerk-react @clerk/backend
```

- [ ] **Step 2: Document the env keys**

Append to `.env.example`:

```
# Clerk (get yours at dashboard.clerk.com)
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

- [ ] **Step 3: Write the failing requireAuth tests**

Create `api/_lib/auth.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }))

import { requireAuth } from './auth.js'
import { verifyToken } from '@clerk/backend'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAuth', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
    expect(verifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 when the header is not a Bearer token', async () => {
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: { authorization: 'Token abc' } }, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 when verification fails', async () => {
    verifyToken.mockRejectedValue(new Error('invalid'))
    const handler = vi.fn()
    const res = mockRes()
    await requireAuth(handler)({ headers: { authorization: 'Bearer bad' } }, res)
    expect(verifyToken).toHaveBeenCalledWith('bad', { secretKey: process.env.CLERK_SECRET_KEY })
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('attaches req.auth.userId and calls the handler on success', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123' })
    const handler = vi.fn()
    const res = mockRes()
    const req = { headers: { authorization: 'Bearer good' } }
    await requireAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledWith(req, res)
    expect(req.auth).toEqual({ userId: 'user_123' })
    expect(res.status).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test -- api/_lib/auth.test.js`
Expected: FAIL — cannot find module `./auth.js`

- [ ] **Step 5: Implement requireAuth**

Create `api/_lib/auth.js`:

```js
import { verifyToken } from '@clerk/backend'

// Wraps a handler so it only runs with a valid Clerk session token.
// Networkless verification: the JWT is checked against CLERK_SECRET_KEY.
export function requireAuth(handler) {
  return async (req, res) => {
    const header = req.headers?.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
      req.auth = { userId: payload.sub }
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    return handler(req, res)
  }
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- api/_lib/auth.test.js`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example api/_lib/auth.js api/_lib/auth.test.js
git commit -m "feat: add Clerk deps and requireAuth bearer verification"
```

---

### Task 2: Wrap all endpoints + PATCH org scoping

**Files:**
- Modify: `api/suppliers/index.js`, `api/suppliers/[id].js`, `api/contracts/index.js`, `api/contracts/[id].js`, `api/spend/index.js`, `api/spend/[id].js`, `api/risk/index.js`, `api/esg/index.js`
- Modify: `api/suppliers/suppliers.test.js`, `api/contracts/contracts.test.js`, `api/spend/spend.test.js`, `api/readonly.test.js`

- [ ] **Step 1: Add the identity mock to the four handler test files, plus failing org-scope tests**

At the top of `api/suppliers/suppliers.test.js`, `api/contracts/contracts.test.js`, and `api/spend/spend.test.js` (next to the existing prisma vi.mock):

```js
vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
```

In `api/readonly.test.js` (it sits at api/ root):

```js
vi.mock('./_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
```

The three prisma mocks for suppliers/contracts/spend each gain `findFirst: vi.fn()` in their model object, e.g. for suppliers:

```js
    supplier: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
```

Update the existing PATCH success test in each of the three files to mock and assert the org-scope lookup — suppliers version:

```js
  it('updates the supplier and returns the updated record', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
    prisma.supplier.update.mockResolvedValue({ id: 'sup_1', status: 'suspended' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'sup_1' }, body: { status: 'suspended' } }, res)
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: 'sup_1', orgId: 'org_demo' },
    })
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 'sup_1' },
      data: { status: 'suspended' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })
```

And add a new not-found test in each of the three files — suppliers version:

```js
  it('returns 404 when the id does not exist in the org', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'sup_other_org' }, body: { status: 'suspended' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.supplier.update).not.toHaveBeenCalled()
  })
```

(Contracts and spend versions are identical in shape: `prisma.contract.findFirst` / `prisma.spendRecord.findFirst`, ids `con_1` / `spend_1`, and the contracts PATCH test keeps its existing date-coercion assertion alongside the new findFirst assertion.)

- [ ] **Step 2: Run to verify the new/updated tests fail**

Run: `npm test -- api/suppliers/suppliers.test.js api/contracts/contracts.test.js api/spend/spend.test.js api/readonly.test.js`
Expected: FAIL — `findFirst` is never called by the current handlers (and the 404 tests fail with 200/500)

- [ ] **Step 3: Wrap the five index handlers**

In each of `api/suppliers/index.js`, `api/contracts/index.js`, `api/spend/index.js`, `api/risk/index.js`, `api/esg/index.js`:
- Add import: `import { requireAuth } from '../_lib/auth.js'`
- Change `export default async function handler(req, res) {` to `async function handler(req, res) {`
- Add as the last line of the file: `export default requireAuth(handler)`

- [ ] **Step 4: Rewrite the three [id].js handlers with org scoping**

Replace `api/suppliers/[id].js` with:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { requireAuth } from '../_lib/auth.js'

async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
      const existing = await prisma.supplier.findFirst({
        where: { id: req.query.id, orgId: ORG_ID },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const updated = await prisma.supplier.update({
        where: { id: req.query.id },
        data: req.body ?? {},
      })
      return res.status(200).json(updated)
    }
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

Replace `api/contracts/[id].js` with:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'

async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
      const existing = await prisma.contract.findFirst({
        where: { id: req.query.id, orgId: ORG_ID },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const updated = await prisma.contract.update({
        where: { id: req.query.id },
        data: coerceDates(req.body ?? {}, ['startDate', 'endDate']),
      })
      return res.status(200).json(updated)
    }
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

Replace `api/spend/[id].js` with:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'

async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
      const existing = await prisma.spendRecord.findFirst({
        where: { id: req.query.id, orgId: ORG_ID },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const updated = await prisma.spendRecord.update({
        where: { id: req.query.id },
        data: coerceDates(req.body ?? {}, ['date']),
      })
      return res.status(200).json(updated)
    }
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

Also update the org comment in `api/_lib/org.js`:

```js
// Shared demo org: every authenticated user works in this org (Phase 6b
// tenancy decision). Phase 7 replaces this with the org id from the
// authenticated session's claims.
export const ORG_ID = 'org_demo'
```

- [ ] **Step 5: Run the API tests, then the full suite**

Run: `npm test -- api/suppliers/suppliers.test.js api/contracts/contracts.test.js api/spend/spend.test.js api/readonly.test.js api/_lib/auth.test.js`
Expected: PASS (suppliers 6, contracts 5, spend 5, readonly 3, auth 4 — the three handler files each gained one 404 test)

Run: `npm test`
Expected: PASS — frontend tests are untouched (the fetch stub bypasses the real handlers entirely)

- [ ] **Step 6: Commit**

```bash
git add api
git commit -m "feat: require auth on all endpoints, org-scope PATCH handlers"
```

---

### Task 3: apiClient token plumbing

**Files:**
- Modify: `src/lib/apiClient.js`, `src/lib/apiClient.test.js`

- [ ] **Step 1: Write the failing tests**

In `src/lib/apiClient.test.js`, update the import line to include the new export:

```js
import { api, setTokenGetter } from './apiClient'
```

Add `afterEach` to the vitest import and a reset hook after the imports:

```js
import { describe, it, expect, vi, afterEach } from 'vitest'
```

```js
afterEach(() => {
  setTokenGetter(null)
})
```

Add two tests at the end of the describe block:

```js
  it('attaches a Bearer token when a token getter is registered', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
    vi.stubGlobal('fetch', fetchMock)
    setTokenGetter(async () => 'tok_123')
    await api.get('/api/suppliers')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok_123')
  })

  it('sends no Authorization header when no getter is registered', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
    vi.stubGlobal('fetch', fetchMock)
    await api.get('/api/suppliers')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/apiClient.test.js`
Expected: FAIL — `setTokenGetter` is not exported

- [ ] **Step 3: Implement**

Replace `src/lib/apiClient.js` with:

```js
let getToken = null

// Registered by the auth provider's TokenBridge; null in tests and when
// signed out, in which case requests go out without an Authorization header.
export function setTokenGetter(fn) {
  getToken = fn
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (getToken) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(path, {
    headers,
    ...options,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed: ${res.status}`)
  return body
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
}
```

- [ ] **Step 4: Run to verify pass, then the full suite**

Run: `npm test -- src/lib/apiClient.test.js`
Expected: PASS (5 tests)

Run: `npm test`
Expected: PASS (no production code registers a getter yet)

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiClient.js src/lib/apiClient.test.js
git commit -m "feat: apiClient attaches Clerk bearer token when registered"
```

---

### Task 4: The auth seam, global test mock, and TopBar

**Files:**
- Create: `src/lib/auth.jsx`, `src/test/authState.js`
- Modify: `src/test/setup.js`, `src/components/layout/TopBar.jsx`, `src/components/layout/layout.test.jsx`
- Delete: `src/lib/mockAuth.jsx`

- [ ] **Step 1: Create the mutable test auth state**

Create `src/test/authState.js`:

```js
// Mutable state read by the global mock of src/lib/auth.jsx (see setup.js).
// Tests that need loading/signed-out states mutate this, and beforeEach
// resets it to the signed-in demo user.

const DEFAULT_USER = {
  id: 'user_demo_admin',
  firstName: 'Amara',
  lastName: 'Chen',
  fullName: 'Amara Chen',
  emailAddresses: [{ emailAddress: 'amara.chen@procureiq-demo.com' }],
  imageUrl: null,
  publicMetadata: { role: 'org_admin' },
}

export const DEMO_ORG = {
  id: 'org_demo',
  name: 'Procure IQ Demo Org',
  slug: 'procureiq-demo',
  imageUrl: null,
  membersCount: 12,
}

export const authState = {
  isLoaded: true,
  isSignedIn: true,
  user: DEFAULT_USER,
}

export function resetAuthState() {
  authState.isLoaded = true
  authState.isSignedIn = true
  authState.user = DEFAULT_USER
}
```

- [ ] **Step 2: Create the auth seam**

Create `src/lib/auth.jsx`:

```jsx
import { useEffect } from 'react'
import { ClerkProvider, useAuth, useUser, UserButton, SignIn, SignUp } from '@clerk/clerk-react'
import { setTokenGetter } from './apiClient'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Shared demo org (6b tenancy decision): every signed-in user works in
// org_demo. Phase 7 swaps this for Clerk Organizations.
const DEMO_ORG = {
  id: 'org_demo',
  name: 'Procure IQ Demo Org',
  slug: 'procureiq-demo',
  imageUrl: null,
  membersCount: 12,
}

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

export function useOrganization() {
  return { isLoaded: true, organization: DEMO_ORG }
}

export { useUser, UserButton, SignIn, SignUp }
```

- [ ] **Step 3: Register the global mock in the vitest setup**

Replace `src/test/setup.js` with:

```js
import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'
import { createMockFetch } from './mockApi'
import { authState, resetAuthState, DEMO_ORG } from './authState'

// Global Clerk-free mock of the auth seam. Tests simulate loading/signed-out
// by mutating authState (reset before every test).
vi.mock('../lib/auth.jsx', async () => {
  const { createElement } = await import('react')
  const { authState, DEMO_ORG } = await import('./authState')
  return {
    AuthProvider: ({ children }) => children,
    useUser: () => ({
      isLoaded: authState.isLoaded,
      isSignedIn: authState.isSignedIn,
      user: authState.isSignedIn ? authState.user : null,
    }),
    useOrganization: () => ({ isLoaded: true, organization: DEMO_ORG }),
    UserButton: () => createElement('div', { 'data-testid': 'user-button' }),
    SignIn: () => createElement('div', { 'data-testid': 'clerk-sign-in' }),
    SignUp: () => createElement('div', { 'data-testid': 'clerk-sign-up' }),
  }
})

beforeEach(() => {
  vi.stubGlobal('fetch', createMockFetch())
  resetAuthState()
})
```

Note: the `vi.mock` path `'../lib/auth.jsx'` is relative to this setup file; vitest resolves and applies it to every importer of `src/lib/auth.jsx`. Keep the unused top-level `authState`/`DEMO_ORG` import — it guarantees the module is in the graph; the factory re-imports it for hoisting safety.

- [ ] **Step 4: Update TopBar**

Replace `src/components/layout/TopBar.jsx` with:

```jsx
import { useOrganization, useUser, UserButton } from '../../lib/auth'

export default function TopBar() {
  const { user } = useUser()
  const { organization } = useOrganization()
  const role = user?.publicMetadata?.role ?? 'member'

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <div>
        <p className="text-sm font-medium text-text-primary">{organization.name}</p>
        <p className="text-xs text-text-secondary">{organization.membersCount} members</p>
      </div>
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

- [ ] **Step 5: Update layout.test.jsx and delete mockAuth**

In `src/components/layout/layout.test.jsx`:
- Delete the line `import { MockAuthProvider } from '../../lib/mockAuth'`
- Replace the TopBar test with:

```jsx
describe('TopBar', () => {
  it('renders the demo organization, user info, and user menu', () => {
    render(<TopBar />)
    expect(screen.getByText('Procure IQ Demo Org')).toBeInTheDocument()
    expect(screen.getByText('Amara Chen')).toBeInTheDocument()
    expect(screen.getByTestId('user-button')).toBeInTheDocument()
  })
})
```

Then delete the mock auth module:

```bash
git rm src/lib/mockAuth.jsx
```

(App.jsx still imports `MockAuthProvider` at this point — that's fixed in Task 5. To keep this commit green, ALSO apply the App.jsx provider swap now: in `src/App.jsx`, replace `import { MockAuthProvider } from './lib/mockAuth'` with `import { AuthProvider } from './lib/auth'` and replace the `<MockAuthProvider>`/`</MockAuthProvider>` tags with `<AuthProvider>`/`</AuthProvider>`. Routes/gating still come in Task 5.)

- [ ] **Step 6: Run the touched files, then the full suite**

Run: `npm test -- src/components/layout/layout.test.jsx src/App.test.jsx`
Expected: PASS (the global mock makes AuthProvider a pass-through)

Run: `npm test`
Expected: PASS (38 files / 234 tests — layout file count unchanged, apiClient gained 2 in Task 3... report actual counts; everything green is the requirement)

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.jsx src/test/authState.js src/test/setup.js src/components/layout/TopBar.jsx src/components/layout/layout.test.jsx src/App.jsx
git rm --cached src/lib/mockAuth.jsx 2>$null; git add -u
git commit -m "feat: Clerk auth seam with global test mock; TopBar uses UserButton"
```

(The `git rm` in Step 5 already staged the deletion; the commit includes it.)

---

### Task 5: ProtectedRoute, sign-in/up pages, and route gating

**Files:**
- Create: `src/components/layout/ProtectedRoute.jsx`, `src/components/layout/ProtectedRoute.test.jsx`
- Create: `src/pages/SignInPage.jsx`, `src/pages/SignUpPage.jsx`
- Modify: `src/App.jsx`, `src/App.test.jsx`

- [ ] **Step 1: Write the failing ProtectedRoute tests**

Create `src/components/layout/ProtectedRoute.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { authState } from '../../test/authState'

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <p>secret content</p>
            </ProtectedRoute>
          }
        />
        <Route path="/sign-in" element={<p>sign in page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('renders children when signed in', () => {
    renderProtected()
    expect(screen.getByText('secret content')).toBeInTheDocument()
  })

  it('shows a spinner while auth is loading', () => {
    authState.isLoaded = false
    renderProtected()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('redirects to /sign-in when signed out', () => {
    authState.isSignedIn = false
    renderProtected()
    expect(screen.getByText('sign in page')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/layout/ProtectedRoute.test.jsx`
Expected: FAIL — cannot find module `./ProtectedRoute`

- [ ] **Step 3: Implement ProtectedRoute**

Create `src/components/layout/ProtectedRoute.jsx`:

```jsx
import { Navigate } from 'react-router-dom'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useUser } from '../../lib/auth'

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser()
  if (!isLoaded) return <LoadingSpinner className="min-h-screen" />
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return children
}
```

Run: `npm test -- src/components/layout/ProtectedRoute.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 4: Create the sign-in/up pages**

Create `src/pages/SignInPage.jsx`:

```jsx
import { SignIn } from '../lib/auth'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary py-12">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  )
}
```

Create `src/pages/SignUpPage.jsx`:

```jsx
import { SignUp } from '../lib/auth'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary py-12">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
    </div>
  )
}
```

- [ ] **Step 5: Write the failing App route tests**

In `src/App.test.jsx`, add the import:

```jsx
import { authState } from './test/authState'
```

Add these three tests at the end of the describe block:

```jsx
  it('renders the embedded sign-in at /sign-in', async () => {
    window.history.pushState({}, '', '/sign-in')
    render(<App />)
    expect(await screen.findByTestId('clerk-sign-in')).toBeInTheDocument()
  })

  it('renders the embedded sign-up at /sign-up', async () => {
    window.history.pushState({}, '', '/sign-up')
    render(<App />)
    expect(await screen.findByTestId('clerk-sign-up')).toBeInTheDocument()
  })

  it('redirects app routes to sign-in when signed out', async () => {
    authState.isSignedIn = false
    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    expect(await screen.findByTestId('clerk-sign-in')).toBeInTheDocument()
  })
```

Run: `npm test -- src/App.test.jsx`
Expected: the three new tests FAIL (routes don't exist, nothing redirects)

- [ ] **Step 6: Wire App.jsx**

In `src/App.jsx` (AuthProvider swap already done in Task 4):
- Add imports:

```jsx
import ProtectedRoute from './components/layout/ProtectedRoute'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
```

- In the routes, add the two public auth routes as siblings of the Landing route (before the AppShell route):

```jsx
                    <Route path="/sign-in/*" element={<SignInPage />} />
                    <Route path="/sign-up/*" element={<SignUpPage />} />
```

- Change the shell route opening tag from:

```jsx
                    <Route element={<AppShell />}>
```

to:

```jsx
                    <Route
                      element={
                        <ProtectedRoute>
                          <AppShell />
                        </ProtectedRoute>
                      }
                    >
```

- [ ] **Step 7: Run App tests, then the FULL suite**

Run: `npm test -- src/App.test.jsx`
Expected: PASS (11 tests)

Run: `npm test`
Expected: ALL green — report exact counts.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/ProtectedRoute.jsx src/components/layout/ProtectedRoute.test.jsx src/pages/SignInPage.jsx src/pages/SignUpPage.jsx src/App.jsx src/App.test.jsx
git commit -m "feat: gate app behind Clerk sign-in with embedded auth pages"
```

---

### Task 6: Final gate — suite, lint, live auth verification

**Files:** none (verification only; commit stragglers if real fixes surface).

- [x] **Step 1: Full suite** — `npm test`, run twice; report exact counts (expect ~38-39 files / ~241 tests, all green).

- [x] **Step 2: Lint** — `npx eslint src api`; expect ~10 errors, all pre-existing categories (mockAuth's 2 errors are gone; auth.jsx adds 1 `react-refresh/only-export-components`, same accepted category as the contexts).

- [x] **Step 3: Live 401 check (no network needed)** — temporary script (delete after, do not commit): import the wrapped default export of `api/suppliers/index.js`, invoke with `{ method: 'GET', headers: {} }` and a mock res; expect 401 without touching the DB. Then with `headers: { authorization: 'Bearer not-a-real-token' }` — expect 401 (verifyToken rejects against the real CLERK_SECRET_KEY).

- [x] **Step 4: Manual checklist (report for the user; execute what's possible)** — `vercel dev`: visit `/`, click Open App → bounced to /sign-in (dark-themed Clerk form) → sign up → land on /dashboard with live data → add a supplier (network tab shows Authorization header) → UserButton → sign out → bounced to sign-in. `curl http://localhost:3000/api/suppliers` without a token → 401.

- [x] **Step 5: Report** — counts, lint, 401 results, anything flagged.

---

## Self-Review Notes

- **Spec coverage:** seam/AuthProvider/appearance (Task 4), useOrganization static demo org (Task 4), UserButton + role fallback in TopBar (Task 4), sign-in/up embedded routes + ProtectedRoute gating (Task 5), setTokenGetter plumbing (Task 3), requireAuth on all 8 endpoints (Tasks 1-2), PATCH org-scope IDOR fix (Task 2), env documentation (Task 1), global test mock with authState + per-test mutation (Tasks 4-5), manual verification (Task 6). Spec's "mockAuth.jsx is deleted" → Task 4 Step 5.
- **Sequencing note:** mockAuth deletion forces the App.jsx provider swap into Task 4 (so each commit stays green); Task 5 only adds routes/gating. The plan states this explicitly in Task 4 Step 5.
- **Type consistency:** `requireAuth(handler)` (Task 1) used in Tasks 2 and 6; `setTokenGetter` (Task 3) called by TokenBridge (Task 4); `authState`/`resetAuthState`/`DEMO_ORG` (Task 4) consumed by setup.js (Task 4), ProtectedRoute.test (Task 5), App.test (Task 5); mock testids `user-button`/`clerk-sign-in`/`clerk-sign-up` (Task 4) asserted in Tasks 4-5. LoadingSpinner renders `role="status"` (existing component) — matched by ProtectedRoute.test's `getByRole('status')`.
- **Known judgment point:** `vi.mock` inside a setup file applies suite-wide in vitest; the factory re-imports `authState` to avoid hoisting pitfalls. If a vitest version quirk surfaces (mock not applying), the fallback is an `alias` in vite.config test options mapping `src/lib/auth.jsx` to a test double module — implementer should report before resorting to it.
- **No placeholders:** all code complete; existing-file edits give exact anchors.
