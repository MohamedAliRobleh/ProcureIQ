# Demo Sandbox + Guided Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give demo-org visitors a transparent local-first write sandbox and an animated guided tour, active ONLY in the demo org, with zero backend change and no new runtime dependency.

**Architecture:** A single `apiClient` seam routes CRUD to a localStorage store when a module-level sandbox flag is on; a Clerk-org bridge turns that flag on only in the demo org; `usePermissions` unlocks write buttons there; a `framer-motion` spotlight tour auto-starts once and is replayable.

**Tech Stack:** React 19, react-router 7, Clerk (`@clerk/clerk-react`), `framer-motion` (already a dependency), Vitest + Testing Library, localStorage.

## Global Constraints

- Both features activate ONLY when the active Clerk org slug equals `DEMO_ORG_SLUG` (`import.meta.env.VITE_DEMO_ORG_SLUG ?? 'procureiq-demo'`). Outside the demo org, behaviour is byte-identical to today.
- No new runtime dependency. Tour uses `framer-motion`; sandbox uses `localStorage`.
- No backend/API/DB change. The demo org's real data is read once to seed the sandbox.
- Sandbox-managed resources (path-based): `suppliers`, `contracts`, `spend`, `portal-requests`. Only bare `/api/<resource>` (GET list, POST create) and `/api/<resource>/<id>` (PATCH, DELETE) are intercepted; any named sub-route (`summarize`, `notify`, `seed`, …) or other path falls through to the real API.
- localStorage key namespace: `procureiq_sandbox_v1:<resource>`. Tour-done flag: `procureiq_tour_done_v1`.
- Badge copy: `🧪 Sandbox — changes are local`. Reset control label: `Reset`.
- Run tests serially: `npx vitest run src --no-file-parallelism` (the App route tests flake under parallel load).

---

### Task 1: Sandbox store

**Files:**
- Create: `src/lib/sandbox.js`
- Test: `src/lib/sandbox.test.js`

**Interfaces:**
- Produces: `setSandboxActive(bool)`, `isSandboxActive() → bool`, `SANDBOX_RESOURCES: string[]`, `parsePath(path) → {resource, id}|null`, `async sandboxGet(resource, seedFn) → rows`, `sandboxCreate(resource, data) → record`, `sandboxUpdate(resource, id, patch) → record`, `sandboxDelete(resource, id) → {deleted:true}`, `resetSandbox()`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sandbox.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  parsePath, setSandboxActive, isSandboxActive, SANDBOX_RESOURCES,
  sandboxGet, sandboxCreate, sandboxUpdate, sandboxDelete, resetSandbox,
} from './sandbox'

beforeEach(() => {
  localStorage.clear()
  setSandboxActive(false)
})

describe('parsePath', () => {
  it('parses list and id paths for managed resources', () => {
    expect(parsePath('/api/suppliers')).toEqual({ resource: 'suppliers', id: null })
    expect(parsePath('/api/suppliers/sup_1')).toEqual({ resource: 'suppliers', id: 'sup_1' })
    expect(parsePath('/api/portal-requests/preq_9?_=1')).toEqual({ resource: 'portal-requests', id: 'preq_9' })
  })
  it('returns null for non-managed resources and named sub-routes', () => {
    expect(parsePath('/api/esg')).toBeNull()
    expect(parsePath('/api/contracts/summarize')).toBeNull() // matches an id slot but summarize is a reserved sub-route → treat as id, still managed? see note
    expect(parsePath('/api/org/seed')).toBeNull()
    expect(parsePath('/api/assistant')).toBeNull()
  })
})

describe('sandbox flag', () => {
  it('toggles', () => {
    expect(isSandboxActive()).toBe(false)
    setSandboxActive(true)
    expect(isSandboxActive()).toBe(true)
  })
})

describe('sandbox CRUD', () => {
  it('seeds once from seedFn, then serves the snapshot', async () => {
    let calls = 0
    const seedFn = async () => { calls += 1; return [{ id: 'a', name: 'Seed' }] }
    expect(await sandboxGet('suppliers', seedFn)).toEqual([{ id: 'a', name: 'Seed' }])
    expect(await sandboxGet('suppliers', seedFn)).toEqual([{ id: 'a', name: 'Seed' }])
    expect(calls).toBe(1)
  })
  it('creates with a local id, updates by merge, deletes', async () => {
    await sandboxGet('suppliers', async () => [{ id: 'a', name: 'A' }])
    const created = sandboxCreate('suppliers', { name: 'B' })
    expect(created.id).toMatch(/^sbx_suppliers_/)
    expect((await sandboxGet('suppliers', async () => [])).length).toBe(2)

    const updated = sandboxUpdate('suppliers', 'a', { name: 'A2', id: 'hijack' })
    expect(updated).toMatchObject({ id: 'a', name: 'A2' })

    expect(sandboxDelete('suppliers', 'a')).toEqual({ deleted: true })
    expect((await sandboxGet('suppliers', async () => [])).map((r) => r.id)).toEqual([created.id])
  })
  it('resetSandbox clears snapshots so the next get re-seeds', async () => {
    await sandboxGet('suppliers', async () => [{ id: 'a' }])
    sandboxCreate('suppliers', { name: 'B' })
    resetSandbox()
    expect(await sandboxGet('suppliers', async () => [{ id: 'fresh' }])).toEqual([{ id: 'fresh' }])
  })
})

it('SANDBOX_RESOURCES lists the four managed resources', () => {
  expect(SANDBOX_RESOURCES).toEqual(['suppliers', 'contracts', 'spend', 'portal-requests'])
})
```

Note on `contracts/summarize`: `parsePath` returns `{resource:'contracts', id:'summarize'}` structurally, but the apiClient (Task 2) only diverts GET-list/POST-list and PATCH/DELETE-by-id; a POST to `/api/contracts/summarize` is a POST *with* an id segment, which the apiClient rules do NOT divert (POST is only diverted when `id === null`). So summarize/upload-signature/notify POSTs fall through to the real API. Update the test's second `parsePath` expectation to match reality:

```js
    expect(parsePath('/api/contracts/summarize')).toEqual({ resource: 'contracts', id: 'summarize' })
```

(Keep the `esg`, `org/seed`, `assistant` → null assertions.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sandbox.test.js`
Expected: FAIL — `Cannot find module './sandbox'`.

- [ ] **Step 3: Implement the store**

Create `src/lib/sandbox.js`:

```js
// Client-only demo sandbox: mirrors the demo org's data in localStorage so a
// read-only visitor can create/edit/delete without touching the API/DB. The
// active flag is set by the DemoBridge (src/lib/auth.jsx) only in the demo org.

const NS = 'procureiq_sandbox_v1'
const keyFor = (resource) => `${NS}:${resource}`

// CRUD-intercepted resources (path names, matching /api/<name>).
export const SANDBOX_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal-requests']

let sandboxActive = false
export function setSandboxActive(active) {
  sandboxActive = !!active
}
export function isSandboxActive() {
  return sandboxActive
}

// /api/<resource> -> {resource, id:null}; /api/<resource>/<id> -> {resource, id};
// null when the first segment is not a managed resource or the path is deeper.
export function parsePath(path) {
  const clean = path.split('?')[0].replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/')
  if (parts[0] !== 'api') return null
  const resource = parts[1]
  if (!SANDBOX_RESOURCES.includes(resource)) return null
  if (parts.length === 2) return { resource, id: null }
  if (parts.length === 3) return { resource, id: parts[2] }
  return null
}

function read(resource) {
  try {
    const raw = localStorage.getItem(keyFor(resource))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function write(resource, rows) {
  localStorage.setItem(keyFor(resource), JSON.stringify(rows))
}

let counter = 0
function localId(resource) {
  counter += 1
  return `sbx_${resource}_${Date.now()}_${counter}`
}

// Returns the snapshot; seeds it once from seedFn (the real API GET) if absent.
export async function sandboxGet(resource, seedFn) {
  const existing = read(resource)
  if (existing) return existing
  const seeded = await seedFn()
  write(resource, seeded)
  return seeded
}

export function sandboxCreate(resource, data) {
  const rows = read(resource) ?? []
  const record = { ...data, id: localId(resource) }
  write(resource, [...rows, record])
  return record
}

export function sandboxUpdate(resource, id, patch) {
  const rows = read(resource) ?? []
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) throw new Error('Not found')
  const { id: _ignored, ...rest } = patch ?? {}
  const updated = { ...rows[idx], ...rest }
  const next = [...rows]
  next[idx] = updated
  write(resource, next)
  return updated
}

export function sandboxDelete(resource, id) {
  const rows = read(resource) ?? []
  write(resource, rows.filter((r) => r.id !== id))
  return { deleted: true }
}

export function resetSandbox() {
  try {
    for (const resource of SANDBOX_RESOURCES) localStorage.removeItem(keyFor(resource))
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sandbox.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sandbox.js src/lib/sandbox.test.js
git commit -m "feat(demo): add client-side sandbox store"
```

---

### Task 2: apiClient sandbox branch

**Files:**
- Modify: `src/lib/apiClient.js`
- Test: `src/lib/apiClient.test.js` (extend)

**Interfaces:**
- Consumes: `isSandboxActive`, `parsePath`, `sandboxGet`, `sandboxCreate`, `sandboxUpdate`, `sandboxDelete` from `./sandbox`.
- Produces: unchanged `api` shape (`get/post/patch/del`) + `setTokenGetter`.

- [ ] **Step 1: Write the failing tests (append to `src/lib/apiClient.test.js`)**

Add these imports at the top (merge with the existing import line):

```js
import { api, setTokenGetter } from './apiClient'
import { setSandboxActive } from './sandbox'
```

Append inside the file:

```js
describe('apiClient sandbox mode', () => {
  afterEach(() => {
    setSandboxActive(false)
    localStorage.clear()
  })

  it('POST to a managed resource hits the store, not fetch, when sandbox is active', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setSandboxActive(true)
    const created = await api.post('/api/suppliers', { name: 'Local Co' })
    expect(created.id).toMatch(/^sbx_suppliers_/)
    expect(created.name).toBe('Local Co')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('GET seeds from a real fetch once, then serves the local snapshot', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ id: 'a' }] }))
    vi.stubGlobal('fetch', fetchMock)
    setSandboxActive(true)
    expect(await api.get('/api/suppliers')).toEqual([{ id: 'a' }])
    expect(await api.get('/api/suppliers')).toEqual([{ id: 'a' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT divert named sub-routes even when sandbox is active', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    vi.stubGlobal('fetch', fetchMock)
    setSandboxActive(true)
    await api.post('/api/contracts/summarize', { id: 'con_1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing special when sandbox is inactive', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 'x' }) }))
    vi.stubGlobal('fetch', fetchMock)
    await api.post('/api/suppliers', { name: 'A' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/apiClient.test.js`
Expected: FAIL (sandbox POST still calls fetch).

- [ ] **Step 3: Implement the branch**

Replace the whole `src/lib/apiClient.js` with:

```js
import {
  isSandboxActive, parsePath, sandboxGet, sandboxCreate, sandboxUpdate, sandboxDelete,
} from './sandbox'

let getToken = null

// Registered by the auth provider's TokenBridge; null in tests and when
// signed out, in which case requests go out without an Authorization header.
export function setTokenGetter(fn) {
  getToken = fn
}

async function realRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (getToken) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(path, { headers, ...options })
  let body
  try {
    body = await res.json()
  } catch {
    throw new Error(`Request failed: ${path} did not return JSON (status ${res.status})`)
  }
  if (!res.ok) throw new Error(body?.error ?? `Request failed: ${res.status}`)
  return body
}

async function request(path, options = {}) {
  const method = options.method ?? 'GET'
  if (isSandboxActive()) {
    const parsed = parsePath(path)
    if (parsed) {
      const body = options.body ? JSON.parse(options.body) : undefined
      if (method === 'GET' && parsed.id === null) {
        return sandboxGet(parsed.resource, () => realRequest(path, options))
      }
      if (method === 'POST' && parsed.id === null) {
        return sandboxCreate(parsed.resource, body)
      }
      if (method === 'PATCH' && parsed.id !== null) {
        return sandboxUpdate(parsed.resource, parsed.id, body)
      }
      if (method === 'DELETE' && parsed.id !== null) {
        return sandboxDelete(parsed.resource, parsed.id)
      }
      // POST/GET with an id segment (e.g. named sub-routes) → fall through
    }
  }
  return realRequest(path, options)
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  del: (path) => request(path, { method: 'DELETE' }),
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/apiClient.test.js`
Expected: PASS (all existing + new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiClient.js src/lib/apiClient.test.js
git commit -m "feat(demo): route CRUD to the sandbox store when demo sandbox is active"
```

---

### Task 3: Demo-org detection (config, bridge, fixture split)

**Files:**
- Create: `src/lib/demoConfig.js`
- Modify: `src/lib/auth.jsx` (add `useIsDemoOrg` + `DemoBridge`, export both)
- Modify: `src/test/setup.js` (add `useIsDemoOrg` to the auth mock)
- Modify: `src/test/authState.js` (split default org from demo org)
- Test: `src/lib/demoConfig.test.jsx`

**Interfaces:**
- Consumes: `useOrganization` (Clerk), `setSandboxActive` from `./sandbox`.
- Produces: `DEMO_ORG_SLUG` (from `./demoConfig`); `useIsDemoOrg() → bool` and `<DemoBridge>` (from `./auth`).

- [ ] **Step 1: Create the leaf config**

Create `src/lib/demoConfig.js`:

```js
// Slug of the shared demo org. Both the sandbox bridge and permission/UI gating
// key off this. Leaf module (no imports) to avoid an auth.jsx <-> consumer cycle.
export const DEMO_ORG_SLUG = import.meta.env.VITE_DEMO_ORG_SLUG ?? 'procureiq-demo'
```

- [ ] **Step 2: Split the test fixture so the default org is NOT the demo org**

The default signed-in fixture currently uses the demo slug, which would make every existing test run "in the demo org." Change `src/test/authState.js` so the default is a generic org and `DEMO_ORG` stays available for demo tests:

Replace the `DEMO_ORG` const and the `authState.organization` / `resetAuthState` references with:

```js
export const DEFAULT_ORG = {
  id: 'org_default',
  name: 'Northwind Trading',
  slug: 'northwind-trading',
  imageUrl: null,
  membersCount: 12,
}

export const DEMO_ORG = {
  id: 'org_demo',
  name: 'ProcureIQ Demo',
  slug: 'procureiq-demo',
  imageUrl: null,
  membersCount: 12,
}

export const authState = {
  isLoaded: true,
  isSignedIn: true,
  user: DEFAULT_USER,
  orgLoaded: true,
  organization: DEFAULT_ORG,
  membership: { role: 'org:admin' },
}

export function resetAuthState() {
  authState.isLoaded = true
  authState.isSignedIn = true
  authState.user = DEFAULT_USER
  authState.orgLoaded = true
  authState.organization = DEFAULT_ORG
  authState.membership = { role: 'org:admin' }
}
```

(Leave `DEFAULT_USER` as-is. `layout.test.jsx` reads `authState.organization.name` dynamically, so it now asserts "Northwind Trading" and still passes.)

- [ ] **Step 3: Add `useIsDemoOrg` to the auth mock**

In `src/test/setup.js`, inside the `vi.mock('../lib/auth.jsx', …)` factory, add a dynamic import of the slug and a `useIsDemoOrg` entry. Change the factory to:

```js
vi.mock('../lib/auth.jsx', async () => {
  const { createElement } = await import('react')
  const { authState } = await import('./authState')
  const { DEMO_ORG_SLUG } = await import('../lib/demoConfig')
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
    useIsDemoOrg: () => authState.organization?.slug === DEMO_ORG_SLUG,
    UserButton: () => createElement('div', { 'data-testid': 'user-button' }),
    OrganizationSwitcher: () => createElement('div', { 'data-testid': 'org-switcher' }),
    OrganizationProfile: () => createElement('div', { 'data-testid': 'org-profile' }),
    SignIn: () => createElement('div', { 'data-testid': 'clerk-sign-in' }),
    SignUp: () => createElement('div', { 'data-testid': 'clerk-sign-up' }),
  }
})
```

- [ ] **Step 4: Write the failing test**

Create `src/lib/demoConfig.test.jsx`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsDemoOrg } from './auth'
import { authState, resetAuthState, DEMO_ORG } from '../test/authState'

describe('useIsDemoOrg', () => {
  beforeEach(() => resetAuthState())

  it('is false in a normal org', () => {
    const { result } = renderHook(() => useIsDemoOrg())
    expect(result.current).toBe(false)
  })

  it('is true in the demo org', () => {
    authState.organization = DEMO_ORG
    const { result } = renderHook(() => useIsDemoOrg())
    expect(result.current).toBe(true)
  })
})
```

Run: `npx vitest run src/lib/demoConfig.test.jsx`
Expected: FAIL — the real `auth.jsx` has no `useIsDemoOrg` export yet (the mock provides it, but the real module must too for prod; the test uses the mock, so it fails only if the mock line was omitted — verify the mock edit from Step 3 is in place, then this drives the real export in Step 5).

- [ ] **Step 5: Add `useIsDemoOrg` + `DemoBridge` to the real `src/lib/auth.jsx`**

Add imports near the top (alongside the existing `import { setTokenGetter } from './apiClient'`):

```js
import { setSandboxActive } from './sandbox'
import { DEMO_ORG_SLUG } from './demoConfig'
```

Add the hook (near the other exported hooks) and the bridge (next to `TokenBridge`):

```js
export function useIsDemoOrg() {
  const { organization } = useOrganization()
  return organization?.slug === DEMO_ORG_SLUG
}

function DemoBridge({ children }) {
  const { organization } = useOrganization()
  useEffect(() => {
    setSandboxActive(organization?.slug === DEMO_ORG_SLUG)
    return () => setSandboxActive(false)
  }, [organization?.slug])
  return children
}
```

Mount `DemoBridge` inside `TokenBridge` in the provider tree. Change the provider return to:

```js
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={CLERK_APPEARANCE}>
      <TokenBridge>
        <DemoBridge>{children}</DemoBridge>
      </TokenBridge>
    </ClerkProvider>
```

Add `useIsDemoOrg` to the re-export list at the bottom:

```js
export { useUser, useOrganization, UserButton, OrganizationSwitcher, OrganizationProfile, SignIn, SignUp }
```

becomes (append `useIsDemoOrg` is already a top-level export via `export function`, so no change needed to that line — but ensure `useIsDemoOrg` is exported; it is, via `export function`).

Run: `npx vitest run src/lib/demoConfig.test.jsx`
Expected: PASS.

- [ ] **Step 6: Run the full src suite to confirm the fixture split broke nothing**

Run: `npx vitest run src --no-file-parallelism`
Expected: PASS (no behaviour change yet; the default org is now non-demo, which matches prior admin-only semantics).

- [ ] **Step 7: Commit**

```bash
git add src/lib/demoConfig.js src/lib/auth.jsx src/test/setup.js src/test/authState.js src/lib/demoConfig.test.jsx
git commit -m "feat(demo): demo-org detection (config, useIsDemoOrg, sandbox bridge) + test fixture split"
```

---

### Task 4: Permissions unlock in the demo org

**Files:**
- Modify: `src/lib/permissions.js`
- Test: `src/lib/permissions.test.jsx` (extend)

**Interfaces:**
- Consumes: `useIsDemoOrg` from `./auth`.
- Produces: `usePermissions().canManage(resource)` returns `true` in the demo org.

- [ ] **Step 1: Write the failing test (append to `src/lib/permissions.test.jsx`)**

Add `DEMO_ORG` to the authState import and append:

```js
import { resetAuthState, authState, DEMO_ORG } from '../test/authState'

// ...existing tests...

it('unlocks canManage for a member in the demo org (sandbox)', () => {
  authState.organization = DEMO_ORG
  authState.membership = { role: 'org:member' }
  const { result } = renderHook(() => usePermissions())
  expect(result.current.canManage('suppliers')).toBe(true)
  expect(result.current.canManage('contracts')).toBe(true)
})
```

Run: `npx vitest run src/lib/permissions.test.jsx`
Expected: FAIL — member in demo org still gets `false`.

- [ ] **Step 2: Implement the demo override**

Edit `src/lib/permissions.js` — import `useIsDemoOrg` and layer it into the hook (leave the pure `canManage`/`canSeed` functions unchanged):

```js
import { useOrganization, useIsDemoOrg } from './auth'

export const MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal']

export function canManage(role, resource) {
  if (!MANAGE_RESOURCES.includes(resource)) return false
  return role === 'org:admin'
}

export function canSeed(role) {
  return role === 'org:admin' || role === 'org:member'
}

export function usePermissions() {
  const { membership } = useOrganization()
  const role = membership?.role ?? null
  const isDemo = useIsDemoOrg()
  return {
    role,
    // In the demo org every visitor may manage resources — writes are captured
    // by the client-side sandbox, never the API.
    canManage: (resource) => (isDemo && MANAGE_RESOURCES.includes(resource)) || canManage(role, resource),
    canSeed: () => canSeed(role),
  }
}
```

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run src/lib/permissions.test.jsx`
Expected: PASS (existing member=false-in-normal-org still passes; new demo case passes).

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.js src/lib/permissions.test.jsx
git commit -m "feat(demo): unlock write controls for visitors in the demo org"
```

---

### Task 5: Sandbox badge + Reset in the TopBar

**Files:**
- Create: `src/components/demo/SandboxBadge.jsx`
- Modify: `src/components/layout/TopBar.jsx`
- Test: `src/components/demo/SandboxBadge.test.jsx`

**Interfaces:**
- Consumes: `useIsDemoOrg` from `../../lib/auth`; `resetSandbox` from `../../lib/sandbox`.
- Produces: `<SandboxBadge>` (renders nothing outside the demo org); carries `data-tour="sandbox-badge"`.

- [ ] **Step 1: Write the failing test**

Create `src/components/demo/SandboxBadge.test.jsx`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SandboxBadge from './SandboxBadge'
import { resetAuthState, authState, DEMO_ORG } from '../../test/authState'

beforeEach(() => resetAuthState())

describe('SandboxBadge', () => {
  it('renders nothing outside the demo org', () => {
    const { container } = render(<SandboxBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the sandbox pill and a Reset control in the demo org', () => {
    authState.organization = DEMO_ORG
    render(<SandboxBadge />)
    expect(screen.getByText(/Sandbox — changes are local/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument()
  })

  it('clears the sandbox and reloads on Reset', () => {
    authState.organization = DEMO_ORG
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })
    localStorage.setItem('procureiq_sandbox_v1:suppliers', '[]')
    render(<SandboxBadge />)
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }))
    expect(localStorage.getItem('procureiq_sandbox_v1:suppliers')).toBeNull()
    expect(reload).toHaveBeenCalled()
  })
})
```

Run: `npx vitest run src/components/demo/SandboxBadge.test.jsx`
Expected: FAIL — module missing.

- [ ] **Step 2: Implement the badge**

Create `src/components/demo/SandboxBadge.jsx`:

```js
import { FlaskConical } from 'lucide-react'
import { useIsDemoOrg } from '../../lib/auth'
import { resetSandbox } from '../../lib/sandbox'

export default function SandboxBadge() {
  const isDemo = useIsDemoOrg()
  if (!isDemo) return null

  function handleReset() {
    resetSandbox()
    window.location.reload()
  }

  return (
    <div
      data-tour="sandbox-badge"
      className="flex items-center gap-2 rounded-full border border-border-accent bg-bg-secondary px-3 py-1.5 text-xs"
    >
      <FlaskConical size={14} className="text-accent-blue-light" />
      <span className="text-text-secondary">Sandbox — changes are local</span>
      <button
        onClick={handleReset}
        className="rounded-md px-2 py-0.5 font-medium text-accent-blue-light hover:bg-bg-hover"
      >
        Reset
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Render it in the TopBar**

Edit `src/components/layout/TopBar.jsx` — import and render `SandboxBadge` between the org switcher and the user block:

```js
import { useUser, UserButton, OrganizationSwitcher } from '../../lib/auth'
import SandboxBadge from '../demo/SandboxBadge'

export default function TopBar() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role ?? 'member'

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <OrganizationSwitcher />
      <div className="flex items-center gap-3">
        <SandboxBadge />
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

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/demo/SandboxBadge.test.jsx src/components/layout/layout.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/demo/SandboxBadge.jsx src/components/demo/SandboxBadge.test.jsx src/components/layout/TopBar.jsx
git commit -m "feat(demo): sandbox badge with reset in the top bar"
```

---

### Task 6: Tour state + provider

**Files:**
- Create: `src/components/tour/tourState.js`
- Create: `src/components/tour/TourProvider.jsx`
- Test: `src/components/tour/tourState.test.jsx`

**Interfaces:**
- Consumes: `useIsDemoOrg` from `../../lib/auth`.
- Produces: `initialTourState`, `tourReducer(state, action)`; `TourProvider`, `useTour() → { isOpen, stepIndex, start, next, back, close }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/tour/tourState.test.jsx`:

```js
import { describe, it, expect } from 'vitest'
import { initialTourState, tourReducer } from './tourState'

describe('tourReducer', () => {
  it('START opens at step 0', () => {
    expect(tourReducer({ isOpen: false, stepIndex: 3 }, { type: 'START' })).toEqual({ isOpen: true, stepIndex: 0 })
  })
  it('NEXT and BACK move within bounds', () => {
    const s = tourReducer(initialTourState, { type: 'START' })
    expect(tourReducer(s, { type: 'NEXT' })).toEqual({ isOpen: true, stepIndex: 1 })
    expect(tourReducer({ isOpen: true, stepIndex: 0 }, { type: 'BACK' })).toEqual({ isOpen: true, stepIndex: 0 })
  })
  it('CLOSE resets', () => {
    expect(tourReducer({ isOpen: true, stepIndex: 4 }, { type: 'CLOSE' })).toEqual({ isOpen: false, stepIndex: 0 })
  })
})
```

Run: `npx vitest run src/components/tour/tourState.test.jsx`
Expected: FAIL — module missing.

- [ ] **Step 2: Implement the reducer**

Create `src/components/tour/tourState.js`:

```js
export const initialTourState = { isOpen: false, stepIndex: 0 }

export function tourReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { isOpen: true, stepIndex: 0 }
    case 'NEXT':
      return { ...state, stepIndex: state.stepIndex + 1 }
    case 'BACK':
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1) }
    case 'CLOSE':
      return { isOpen: false, stepIndex: 0 }
    default:
      return state
  }
}
```

- [ ] **Step 3: Implement the provider**

Create `src/components/tour/TourProvider.jsx`:

```js
import { createContext, useContext, useEffect, useReducer } from 'react'
import { useIsDemoOrg } from '../../lib/auth'
import { initialTourState, tourReducer } from './tourState'
import { TOUR_STEPS } from './tourSteps'

const TOUR_DONE_KEY = 'procureiq_tour_done_v1'
const TourContext = createContext(null)

export function TourProvider({ children }) {
  const isDemo = useIsDemoOrg()
  const [state, dispatch] = useReducer(tourReducer, initialTourState)

  // Auto-start once per browser, demo org only.
  useEffect(() => {
    if (isDemo && !localStorage.getItem(TOUR_DONE_KEY)) {
      dispatch({ type: 'START' })
    }
  }, [isDemo])

  function markDone() {
    try {
      localStorage.setItem(TOUR_DONE_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  function start() {
    dispatch({ type: 'START' })
  }
  function next() {
    if (state.stepIndex >= TOUR_STEPS.length - 1) {
      markDone()
      dispatch({ type: 'CLOSE' })
    } else {
      dispatch({ type: 'NEXT' })
    }
  }
  function back() {
    dispatch({ type: 'BACK' })
  }
  function close() {
    markDone()
    dispatch({ type: 'CLOSE' })
  }

  return (
    <TourContext.Provider value={{ ...state, start, next, back, close }}>{children}</TourContext.Provider>
  )
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside TourProvider')
  return ctx
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/tour/tourState.test.jsx`
Expected: PASS (the provider imports `./tourSteps`, created in Task 7; this reducer test does not import the provider, so it passes independently).

- [ ] **Step 5: Commit**

```bash
git add src/components/tour/tourState.js src/components/tour/TourProvider.jsx src/components/tour/tourState.test.jsx
git commit -m "feat(demo): tour state machine and provider"
```

---

### Task 7: Tour overlay + steps

**Files:**
- Create: `src/components/tour/tourSteps.js`
- Create: `src/components/tour/Tour.jsx`
- Test: `src/components/tour/Tour.test.jsx`

**Interfaces:**
- Consumes: `useTour` from `./TourProvider`; `framer-motion`.
- Produces: `TOUR_STEPS` array; `<Tour>` overlay (renders null when `!isOpen`).

- [ ] **Step 1: Create the steps config**

Create `src/components/tour/tourSteps.js`:

```js
// Each step: target CSS selector (null = centered, no spotlight), copy, and a
// preferred placement. Steps whose target is absent on the current route are
// skipped gracefully by <Tour>.
export const TOUR_STEPS = [
  {
    target: null,
    title: 'Welcome to the ProcureIQ demo',
    body: 'Take a 30-second tour. Everything here is a live sandbox — explore and edit freely.',
    placement: 'center',
  },
  {
    target: '[data-tour="nav"]',
    title: 'Every module, one click away',
    body: 'Suppliers, contracts, risk, ESG, and spend — navigate the whole procurement lifecycle here.',
    placement: 'right',
  },
  {
    target: '[data-tour="kpi"]',
    title: 'Live KPIs',
    body: 'Key metrics are computed from your data in real time.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-suppliers"]',
    title: "It's your sandbox — try it",
    body: 'Open Suppliers and add or edit one. Your changes stay in your browser and never affect anyone else.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-assistant"]',
    title: 'Ask the AI assistant',
    body: 'Ask plain-English questions about your suppliers, contracts, and spend.',
    placement: 'right',
  },
  {
    target: '[data-tour="sandbox-badge"]',
    title: 'Reset anytime',
    body: 'Everything you change is local. Hit Reset to restore the original demo data.',
    placement: 'bottom',
  },
]
```

- [ ] **Step 2: Write the failing test**

Create `src/components/tour/Tour.test.jsx`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TourProvider, useTour } from './TourProvider'
import Tour from './Tour'
import { resetAuthState, authState, DEMO_ORG } from '../../test/authState'

function StartButton() {
  const { start } = useTour()
  return <button onClick={start}>go</button>
}

beforeEach(() => {
  resetAuthState()
  authState.organization = DEMO_ORG
  localStorage.setItem('procureiq_tour_done_v1', '1') // prevent auto-start; we start manually
})

describe('Tour', () => {
  it('is not visible until started', () => {
    render(
      <TourProvider>
        <Tour />
      </TourProvider>
    )
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })

  it('shows the first step and advances on Next', () => {
    render(
      <TourProvider>
        <StartButton />
        <Tour />
      </TourProvider>
    )
    fireEvent.click(screen.getByText('go'))
    expect(screen.getByText(/Welcome to the ProcureIQ demo/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    expect(screen.getByText(/Every module, one click away/i)).toBeInTheDocument()
  })

  it('closes on Skip', () => {
    render(
      <TourProvider>
        <StartButton />
        <Tour />
      </TourProvider>
    )
    fireEvent.click(screen.getByText('go'))
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }))
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })
})
```

Run: `npx vitest run src/components/tour/Tour.test.jsx`
Expected: FAIL — `Tour` missing.

- [ ] **Step 3: Implement the overlay**

Create `src/components/tour/Tour.jsx`:

```js
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTour } from './TourProvider'
import { TOUR_STEPS } from './tourSteps'

// Measure a target element's viewport rect, or null for a centered step / a
// missing target. Recomputes on step change, resize, and scroll.
function useTargetRect(selector) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }
    function measure() {
      const el = document.querySelector(selector)
      if (!el) {
        setRect(null)
        return
      }
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [selector])
  return rect
}

function tooltipStyle(rect, placement) {
  if (!rect || placement === 'center') {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const gap = 12
  if (placement === 'right') return { top: rect.top, left: rect.left + rect.width + gap }
  if (placement === 'bottom') return { top: rect.top + rect.height + gap, left: rect.left }
  if (placement === 'top') return { top: Math.max(gap, rect.top - 180), left: rect.left }
  return { top: rect.top, left: rect.left }
}

export default function Tour() {
  const { isOpen, stepIndex, next, back, close } = useTour()
  const step = TOUR_STEPS[stepIndex]
  const rect = useTargetRect(step?.target ?? null)
  if (!isOpen || !step) return null

  const isLast = stepIndex === TOUR_STEPS.length - 1

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Spotlight: a box-shadow cutout around the target, or a plain dim for centered steps. */}
        {rect ? (
          <motion.div
            className="pointer-events-none absolute rounded-lg"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              outline: '2px solid rgba(96,165,250,0.9)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        ) : (
          <div className="absolute inset-0 bg-black/60" />
        )}

        {/* Tooltip card */}
        <motion.div
          className="absolute z-10 w-80 max-w-[90vw] rounded-2xl border border-border-accent bg-bg-card p-5 shadow-2xl"
          style={tooltipStyle(rect, step.placement)}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
        >
          <p className="text-xs font-medium text-accent-blue-light">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </p>
          <h3 className="mt-1 font-display text-base font-semibold text-text-primary">{step.title}</h3>
          <p className="mt-2 text-sm text-text-secondary">{step.body}</p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button onClick={close} className="text-xs text-text-muted hover:text-text-secondary">
              Skip
            </button>
            <div className="flex gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={back}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="rounded-lg bg-gradient-blue px-3 py-1.5 text-sm font-medium text-white hover:scale-[1.02]"
              >
                {isLast ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/tour/Tour.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tour/tourSteps.js src/components/tour/Tour.jsx src/components/tour/Tour.test.jsx
git commit -m "feat(demo): animated spotlight tour overlay and steps"
```

---

### Task 8: Wiring — data-tour anchors, mount, replay button

**Files:**
- Modify: `src/components/layout/Sidebar.jsx` (add `data-tour` on nav + Suppliers/AI links)
- Modify: `src/pages/Dashboard.jsx` (add `data-tour="kpi"` to the first stat card)
- Modify: `src/components/layout/AppShell.jsx` (wrap in `TourProvider`, render `<Tour/>`)
- Modify: `src/components/layout/TopBar.jsx` (add a "Take a tour" button, demo org only)
- Test: `src/components/layout/appshell-tour.test.jsx`

**Interfaces:**
- Consumes: `TourProvider`, `useTour` from `../tour/TourProvider`; `Tour` from `../tour/Tour`; `useIsDemoOrg` from `../../lib/auth`.

- [ ] **Step 1: Add `data-tour` anchors to the Sidebar**

Edit `src/components/layout/Sidebar.jsx`: add `data-tour="nav"` to the `<nav>` element, and a per-link `data-tour` for the Suppliers and AI Assistant items. Replace the `<nav>` block with:

```jsx
      <nav data-tour="nav" className="mt-8 flex flex-1 flex-col gap-1">
        {items.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            data-tour={path === '/suppliers' ? 'nav-suppliers' : path === '/ai-assistant' ? 'nav-assistant' : undefined}
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
```

(Confirm `NAV_ITEMS` uses paths `/suppliers` and `/ai-assistant` in `src/utils/constants.js`; if a path differs, match it.)

- [ ] **Step 2: Add `data-tour="kpi"` to the first Dashboard stat card**

Edit `src/pages/Dashboard.jsx`: on the FIRST stat card in the populated dashboard's stats grid (the "Total Suppliers" card wrapper element), add the attribute `data-tour="kpi"`. Only the first card needs it.

- [ ] **Step 3: Mount the tour in AppShell**

Replace `src/components/layout/AppShell.jsx` with:

```jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { TourProvider } from '../tour/TourProvider'
import Tour from '../tour/Tour'

export default function AppShell() {
  return (
    <TourProvider>
      <div className="min-h-screen bg-bg-primary">
        <Sidebar />
        <div className="lg:pl-64">
          <TopBar />
          <main className="px-6 py-8">
            <Outlet />
          </main>
        </div>
        <Tour />
      </div>
    </TourProvider>
  )
}
```

- [ ] **Step 4: Add a "Take a tour" button to the TopBar (demo org only)**

Edit `src/components/layout/TopBar.jsx` — add a small replay button that calls `useTour().start()`, shown only in the demo org. Since `TopBar` now needs tour + demo context (both provided by `AppShell`'s `TourProvider` and the auth mock), add:

```js
import { useUser, UserButton, OrganizationSwitcher, useIsDemoOrg } from '../../lib/auth'
import SandboxBadge from '../demo/SandboxBadge'
import { useTour } from '../tour/TourProvider'
import { Compass } from 'lucide-react'

export default function TopBar() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role ?? 'member'
  const isDemo = useIsDemoOrg()
  const { start } = useTour()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <OrganizationSwitcher />
      <div className="flex items-center gap-3">
        {isDemo && (
          <button
            onClick={start}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            <Compass size={15} />
            Take a tour
          </button>
        )}
        <SandboxBadge />
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

NOTE: `TopBar` now calls `useTour()`, so any test that renders `TopBar` in isolation must wrap it in `<TourProvider>`. Update `src/components/layout/layout.test.jsx`: wrap the `render(<TopBar />)` case in `<TourProvider>` (import it from `../tour/TourProvider`). Do the same for any other standalone `TopBar` render.

- [ ] **Step 5: Write the wiring test**

Create `src/components/layout/appshell-tour.test.jsx`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import AppShell from './AppShell'
import { resetAuthState, authState, DEMO_ORG } from '../../test/authState'

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<p>dash</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell tour wiring', () => {
  beforeEach(() => {
    resetAuthState()
    localStorage.clear()
  })

  it('auto-starts the tour on first demo visit', async () => {
    authState.organization = DEMO_ORG
    renderShell()
    expect(await screen.findByText(/Welcome to the ProcureIQ demo/i)).toBeInTheDocument()
  })

  it('does not start the tour outside the demo org', () => {
    renderShell() // default org is non-demo
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })

  it('does not auto-start again once done', () => {
    authState.organization = DEMO_ORG
    localStorage.setItem('procireiq_tour_done_v1', '1') // NOTE fix key below
    renderShell()
  })
})
```

Fix the done-key typo in the third test to `procureiq_tour_done_v1` and assert the welcome text is NOT present:

```js
  it('does not auto-start again once done', () => {
    authState.organization = DEMO_ORG
    localStorage.setItem('procureiq_tour_done_v1', '1')
    renderShell()
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })
```

Run: `npx vitest run src/components/layout/appshell-tour.test.jsx src/components/layout/layout.test.jsx`
Expected: FAIL first (before wiring), then PASS after Steps 1-4 are in place.

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/components/layout/appshell-tour.test.jsx src/components/layout/layout.test.jsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.jsx src/pages/Dashboard.jsx src/components/layout/AppShell.jsx src/components/layout/TopBar.jsx src/components/layout/layout.test.jsx src/components/layout/appshell-tour.test.jsx
git commit -m "feat(demo): wire tour anchors, mount tour, add Take-a-tour button"
```

---

### Task 9: Full verification

**Files:** none (verification + optional `.env.example` note).

- [ ] **Step 1: Document the env var**

Add to `.env.example`, under the Clerk section:

```bash
# Slug of the shared demo org that enables the read-only visitor sandbox + guided
# tour (client-side only). Defaults to procureiq-demo.
VITE_DEMO_ORG_SLUG="procureiq-demo"
```

- [ ] **Step 2: Run the api half**

Run: `npx vitest run api`
Expected: PASS (unchanged — no api files touched).

- [ ] **Step 3: Run the src half serially**

Run: `npx vitest run src --no-file-parallelism`
Expected: PASS. (The pre-existing App.test.jsx `/spend` lazy-load timing flake is environmental — if it is the ONLY failure and fails identically on `git stash`, it is not from this work. Every other test must pass.)

- [ ] **Step 4: Lint**

Run: `npx eslint src`
Expected: no NEW errors beyond the accepted baseline (the `react-refresh/only-export-components` set in context/auth files). Fix any new error this change introduced (e.g., an unused import).

- [ ] **Step 5: Commit (only if Step 1 or 4 changed a file)**

```bash
git add .env.example
git commit -m "docs(demo): document VITE_DEMO_ORG_SLUG"
```

---

## Self-Review

**Spec coverage:**
- Local-first sandbox store → Task 1. ✓
- Single apiClient seam → Task 2. ✓
- Demo-org-only activation via slug + bridge → Task 3 (config, `useIsDemoOrg`, `DemoBridge`). ✓
- Permissions unlock in demo org → Task 4. ✓
- Badge + reset → Task 5. ✓
- Tour (auto-start + replay), spotlight overlay, ~6 steps, graceful missing-target skip → Tasks 6-8. ✓
- No new dependency (framer-motion existing), no backend change → constraints honored throughout. ✓
- Non-demo behaviour identical → fixture split (Task 3 Step 2) keeps existing tests in a normal org; every gate checks `useIsDemoOrg`. ✓
- Tests for store, apiClient branch, demo detection, permissions, badge, tour reducer + provider + overlay + wiring → each task. ✓
- Env var documented → Task 9. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code; attribute-only edits (Task 8 Steps 1-2) name the exact element and attribute. ✓

**Type/name consistency:** `setSandboxActive/isSandboxActive/parsePath/sandboxGet/sandboxCreate/sandboxUpdate/sandboxDelete/resetSandbox/SANDBOX_RESOURCES` are defined in Task 1 and consumed with identical names in Tasks 2 and 5. `DEMO_ORG_SLUG` (demoConfig) and `useIsDemoOrg` (auth) are defined in Task 3 and consumed in Tasks 4, 5, 8. `TOUR_STEPS` (Task 7) is consumed by `TourProvider` (Task 6) and `Tour` (Task 7) — Task 6's provider imports it, so Task 7's `tourSteps.js` must exist before the provider is exercised by the Task 8 wiring test (the Task 6 reducer test does not import the provider, so Task 6 stands alone). `useTour()` returns `{ isOpen, stepIndex, start, next, back, close }`, consumed identically in `Tour.jsx` and `TopBar.jsx`. localStorage keys `procureiq_sandbox_v1:*` and `procureiq_tour_done_v1` are consistent across store, badge, provider, and tests.

**Ordering note:** `TourProvider` (Task 6) imports `./tourSteps` (Task 7). This is fine: Task 6's committed code references a module created in Task 7, but Task 6's *test* only exercises the pure reducer (no provider import), so Task 6 passes in isolation, and by the time the provider is rendered (Task 8) `tourSteps.js` exists. Implement Tasks 6 → 7 → 8 in order.
