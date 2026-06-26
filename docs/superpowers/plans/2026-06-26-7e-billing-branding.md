# Lot E — Billing (demo) + Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a key-optional demo billing page (`/billing`, admin-only) backed by a Stripe Checkout stub, plus per-org branding (the Sidebar shows the active org's name + logo).

**Architecture:** A key-optional Stripe lib (dynamic import, server-side only) + an admin-only `POST /api/billing/checkout` that 503s when unconfigured and creates a real Checkout session when configured. A static plan-tiers page renders the tiers with a stubbed Upgrade flow. The Sidebar reflects the active org and its admin nav gating is generalized via an `adminOnly` flag.

**Tech Stack:** Vercel functions, Clerk auth (`requireOrgAdmin`, `useOrganization`), Stripe SDK (dynamic, deferred install), React, Vitest + Testing Library.

## Global Constraints

- Billing is KEY-OPTIONAL: with NO `STRIPE_SECRET_KEY` the suite is green and the checkout endpoint returns `503`. The `stripe` package is NOT installed in this lot (dynamic import keeps module-load safe); installing it is a deferred live step.
- `api/_lib/stripe.js` is server-side only — never imported from `src/`.
- `POST /api/billing/checkout` is admin-only (`requireOrgAdmin`); body `{ plan }` with `plan ∈ {'pro','enterprise'}`; `405` non-POST; `400` bad/missing plan; `503` when `!isBillingConfigured()` OR when `priceIdForPlan(plan)` is undefined (message `'Billing is not configured'`); `200 { url }` on success; `502` on a Stripe error.
- Current plan is fixed `'free'` (no persistence). No webhook, no Billing DB model.
- Branding is org name + logo only (no accent color). Nav admin-gating generalized to an `adminOnly` flag; Billing + Admin items are `adminOnly: true`.
- Tests must stay green (currently 418). api half: `npx vitest run api/`; src half serial: `npx vitest run src/ --no-file-parallelism`. Match existing style (ESM, no semicolons, 2-space indent).
- Commit after each task with a `feat(7e-bill):` / `test(7e-bill):` prefix.

---

### Task 1: key-optional Stripe lib

**Files:**
- Create: `api/_lib/stripe.js`
- Test: `api/_lib/stripe.test.js`

**Interfaces:**
- Produces: `isBillingConfigured() => boolean`, `priceIdForPlan(plan) => string|undefined`, `async getStripe() => Stripe`. Consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/stripe.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest'
import { isBillingConfigured, priceIdForPlan } from './stripe.js'

const ENV = { ...process.env }
afterEach(() => {
  process.env = { ...ENV }
})

describe('stripe lib config helpers', () => {
  it('isBillingConfigured reflects STRIPE_SECRET_KEY', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(isBillingConfigured()).toBe(false)
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    expect(isBillingConfigured()).toBe(true)
  })

  it('priceIdForPlan maps pro/enterprise to their env price ids and others to undefined', () => {
    process.env.STRIPE_PRICE_PRO = 'price_pro'
    process.env.STRIPE_PRICE_ENTERPRISE = 'price_ent'
    expect(priceIdForPlan('pro')).toBe('price_pro')
    expect(priceIdForPlan('enterprise')).toBe('price_ent')
    expect(priceIdForPlan('free')).toBeUndefined()
    expect(priceIdForPlan('bogus')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/stripe.test.js`
Expected: FAIL — cannot resolve `./stripe.js`.

- [ ] **Step 3: Write the implementation**

Create `api/_lib/stripe.js`:

```js
let client = null

// True when a Stripe secret key is present. Endpoints check this before touching the
// SDK so the app degrades gracefully when billing isn't configured (no key yet).
export function isBillingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

// The configured Stripe price id for a plan, or undefined. Demo: only pro/enterprise
// are purchasable; free has no price.
export function priceIdForPlan(plan) {
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO
  if (plan === 'enterprise') return process.env.STRIPE_PRICE_ENTERPRISE
  return undefined
}

// Lazily imports + constructs a cached client. Never called without a key (guarded by
// isBillingConfigured at the call sites). The dynamic import keeps this module safe to
// import even when `stripe` isn't installed; the package is only needed on the live path.
export async function getStripe() {
  if (!isBillingConfigured()) throw new Error('STRIPE_SECRET_KEY is not configured')
  if (!client) {
    const Stripe = (await import('stripe')).default
    client = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return client
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/stripe.test.js`
Expected: PASS (2 tests). (Note: the test never calls `getStripe`, so `stripe` need not be installed.)

- [ ] **Step 5: Commit**

```bash
git add api/_lib/stripe.js api/_lib/stripe.test.js
git commit -m "feat(7e-bill): add key-optional Stripe lib (dynamic import)"
```

---

### Task 2: `POST /api/billing/checkout`

**Files:**
- Create: `api/billing/checkout.js`
- Test: `api/billing/checkout.test.js`

**Interfaces:**
- Consumes: `isBillingConfigured`, `priceIdForPlan`, `getStripe` (Task 1); `requireOrgAdmin`.
- Produces: `POST /api/billing/checkout` → `200 { url }` (configured) / `503` / `400` / `405` / `502`.

- [ ] **Step 1: Write the failing test**

Create `api/billing/checkout.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))
vi.mock('../_lib/stripe.js', () => ({
  isBillingConfigured: vi.fn(),
  priceIdForPlan: vi.fn(),
  getStripe: vi.fn(),
}))

import handler from './checkout.js'
import { isBillingConfigured, priceIdForPlan, getStripe } from '../_lib/stripe.js'

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
  body: { plan: 'pro' },
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/billing/checkout', () => {
  it('creates a checkout session and returns the url when configured', async () => {
    isBillingConfigured.mockReturnValue(true)
    priceIdForPlan.mockReturnValue('price_pro')
    const create = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/x' })
    getStripe.mockResolvedValue({ checkout: { sessions: { create } } })
    const res = mockRes()
    await handler(authReq(), res)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      line_items: [{ price: 'price_pro', quantity: 1 }],
      client_reference_id: 'org_test',
    }))
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.stripe.com/x' })
  })

  it('returns 503 when billing is not configured (before any SDK call)', async () => {
    isBillingConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(getStripe).not.toHaveBeenCalled()
  })

  it('returns 503 when the plan has no configured price id', async () => {
    isBillingConfigured.mockReturnValue(true)
    priceIdForPlan.mockReturnValue(undefined)
    const res = mockRes()
    await handler(authReq({ body: { plan: 'enterprise' } }), res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(getStripe).not.toHaveBeenCalled()
  })

  it('returns 400 for a missing or invalid plan', async () => {
    const res = mockRes()
    await handler(authReq({ body: { plan: 'free' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 502 when Stripe throws', async () => {
    isBillingConfigured.mockReturnValue(true)
    priceIdForPlan.mockReturnValue('price_pro')
    getStripe.mockResolvedValue({ checkout: { sessions: { create: vi.fn().mockRejectedValue(new Error('stripe down')) } } })
    const res = mockRes()
    await handler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/billing/checkout.test.js`
Expected: FAIL — cannot resolve `./checkout.js`.

- [ ] **Step 3: Write the implementation**

Create `api/billing/checkout.js`:

```js
import { requireOrgAdmin } from '../_lib/auth.js'
import { isBillingConfigured, priceIdForPlan, getStripe } from '../_lib/stripe.js'

const PLANS = ['pro', 'enterprise']

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { plan } = req.body ?? {}
  if (!PLANS.includes(plan)) return res.status(400).json({ error: 'plan must be pro or enterprise' })
  if (!isBillingConfigured()) return res.status(503).json({ error: 'Billing is not configured' })
  const priceId = priceIdForPlan(plan)
  if (!priceId) return res.status(503).json({ error: 'Billing is not configured' })

  try {
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const stripe = await getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?status=success`,
      cancel_url: `${appUrl}/billing?status=cancelled`,
      client_reference_id: req.auth.orgId,
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/billing/checkout.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the api half**

Run: `npx vitest run api/`
Expected: PASS. Report the count.

- [ ] **Step 6: Commit**

```bash
git add api/billing/checkout.js api/billing/checkout.test.js
git commit -m "feat(7e-bill): add admin-only POST /api/billing/checkout (key-optional)"
```

---

### Task 3: `billingPlans` static tiers

**Files:**
- Create: `src/lib/billingPlans.js`
- Test: `src/lib/billingPlans.test.js`

**Interfaces:**
- Produces: `BILLING_PLANS` (array of `{ id, name, price, features[] }`), `CURRENT_PLAN = 'free'`. Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/lib/billingPlans.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { BILLING_PLANS, CURRENT_PLAN } from './billingPlans'

describe('billingPlans', () => {
  it('defines the three tiers with non-empty name/price/features', () => {
    expect(BILLING_PLANS.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise'])
    for (const p of BILLING_PLANS) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.price.length).toBeGreaterThan(0)
      expect(p.features.length).toBeGreaterThan(0)
    }
  })

  it('the current demo plan is free', () => {
    expect(CURRENT_PLAN).toBe('free')
    expect(BILLING_PLANS.some((p) => p.id === CURRENT_PLAN)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/billingPlans.test.js`
Expected: FAIL — cannot resolve `./billingPlans`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/billingPlans.js`:

```js
export const CURRENT_PLAN = 'free'

export const BILLING_PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['Up to 10 suppliers', 'Core modules', 'Community support'] },
  { id: 'pro', name: 'Pro', price: '$49/mo', features: ['Unlimited suppliers', 'AI summaries', 'Email reminders', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['SSO & audit log', 'Dedicated success manager', 'Custom integrations', 'SLA'] },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/billingPlans.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billingPlans.js src/lib/billingPlans.test.js
git commit -m "feat(7e-bill): add static BILLING_PLANS tiers"
```

---

### Task 4: `Billing.jsx` page

**Files:**
- Create: `src/pages/Billing.jsx`
- Test: `src/pages/Billing.test.jsx`

**Interfaces:**
- Consumes: `BILLING_PLANS`/`CURRENT_PLAN` (Task 3); `POST /api/billing/checkout` (Task 2) via `api.post`; `useOrganization` for the admin gate.

- [ ] **Step 1: Write the failing test**

Create `src/pages/Billing.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Billing from './Billing'
import { authState } from '../test/authState'

describe('Billing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the three plan tiers with a Current badge on Free for an admin', () => {
    render(<Billing />)
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.getByText('Current plan')).toBeInTheDocument()
  })

  it('calls checkout when an upgrade button is clicked', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ url: 'https://x' }) }))
    vi.stubGlobal('fetch', fetchMock)
    // jsdom: assigning location.href throws; stub it
    delete window.location
    window.location = { href: '' }
    render(<Billing />)
    fireEvent.click(screen.getAllByRole('button', { name: /Upgrade/i })[0])
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('shows a graceful message when checkout is not configured (503)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: 'Billing is not configured' }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<Billing />)
    fireEvent.click(screen.getAllByRole('button', { name: /Upgrade/i })[0])
    expect(await screen.findByText(/Billing isn't set up yet/i)).toBeInTheDocument()
  })

  it('shows an access-required notice for a non-admin member', () => {
    authState.membership = { role: 'org:member' }
    render(<Billing />)
    expect(screen.getByText('Admin access required')).toBeInTheDocument()
    expect(screen.queryByText('Pro')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Billing.test.jsx`
Expected: FAIL — cannot resolve `./Billing`.

- [ ] **Step 3: Write the implementation**

Create `src/pages/Billing.jsx`:

```jsx
import { useState } from 'react'
import { Lock } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { useOrganization } from '../lib/auth'
import { api } from '../lib/apiClient'
import { BILLING_PLANS, CURRENT_PLAN } from '../lib/billingPlans'

export default function Billing() {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === 'org:admin'
  const [busyPlan, setBusyPlan] = useState(null)
  const [error, setError] = useState(null)

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Billing" />
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Lock size={28} className="text-text-secondary" />
          <p className="font-display text-lg font-semibold text-text-primary">Admin access required</p>
          <p className="max-w-md text-sm text-text-secondary">
            You need to be an organization admin to manage billing.
          </p>
        </Card>
      </div>
    )
  }

  async function handleUpgrade(plan) {
    setError(null)
    setBusyPlan(plan)
    try {
      const { url } = await api.post('/api/billing/checkout', { plan })
      window.location.href = url
    } catch {
      setError("Billing isn't set up yet.")
      setBusyPlan(null)
    }
  }

  return (
    <div>
      <PageHeader title="Billing" description="Manage your organization's plan" />
      {error && <p className="mb-4 text-sm text-accent-red">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {BILLING_PLANS.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-text-primary">{p.name}</h3>
              {p.id === CURRENT_PLAN && <Badge variant="green">Current plan</Badge>}
            </div>
            <p className="text-2xl font-bold text-text-primary">{p.price}</p>
            <ul className="flex-1 space-y-1 text-sm text-text-secondary">
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {p.id !== CURRENT_PLAN && (
              <Button variant="primary" onClick={() => handleUpgrade(p.id)} disabled={busyPlan === p.id}>
                {busyPlan === p.id ? 'Redirecting…' : 'Upgrade'}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Billing.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS. Report the count.

- [ ] **Step 6: Lint**

Run: `npx eslint src/pages/Billing.jsx src/lib/billingPlans.js`
Expected: no NEW errors beyond baseline.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Billing.jsx src/pages/Billing.test.jsx
git commit -m "feat(7e-bill): add admin-only Billing page with plan tiers"
```

---

### Task 5: nav item + `/billing` route + admin-gating generalization

**Files:**
- Modify: `src/utils/constants.js`
- Modify: `src/components/layout/Sidebar.jsx` (filter only)
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`, `src/components/layout/layout.test.jsx`

**Interfaces:**
- Consumes: `Billing` page (Task 4).

- [ ] **Step 1: Update the tests (TDD)**

In `src/components/layout/layout.test.jsx`, inside the `describe('Sidebar', ...)` block, add:

```js
  it('shows the Billing link for an admin and hides it for a member', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /Billing/ })).toBeInTheDocument()

    authState.membership = { role: 'org:member' }
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: /Billing/ })).not.toBeInTheDocument()
  })
```

In `src/App.test.jsx`, add a `/billing` route test (mirror the existing route tests' render/setup; default authState is admin):

```jsx
  it('renders the Billing page at /billing', async () => {
    window.history.pushState({}, '', '/billing')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument())
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/layout/layout.test.jsx src/App.test.jsx`
Expected: FAIL — no Billing link / route yet.

- [ ] **Step 3: Update `src/utils/constants.js`**

Add `CreditCard` to the lucide import, add the Billing nav item, and mark Admin + Billing `adminOnly`:

```js
import { LayoutDashboard, Building2, FileText, ShieldAlert, Leaf, Wallet, Bot, UserCog, Store, CreditCard } from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Suppliers', path: '/suppliers', icon: Building2 },
  { label: 'Contracts', path: '/contracts', icon: FileText },
  { label: 'Risk', path: '/risk', icon: ShieldAlert },
  { label: 'ESG', path: '/esg', icon: Leaf },
  { label: 'Spend', path: '/spend', icon: Wallet },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Bot },
  { label: 'Supplier Portal', path: '/portal', icon: Store },
  { label: 'Billing', path: '/billing', icon: CreditCard, adminOnly: true },
  { label: 'Admin', path: '/admin', icon: UserCog, adminOnly: true },
]
```

- [ ] **Step 4: Generalize the Sidebar filter**

In `src/components/layout/Sidebar.jsx`, replace the filter line:

```js
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
```

(Replaces `NAV_ITEMS.filter((item) => item.path !== '/admin' || isAdmin)`.)

- [ ] **Step 5: Wire the `/billing` route in `src/App.jsx`**

Add the import `import Billing from './pages/Billing'` and the route alongside the other protected routes:

```jsx
              <Route path="/billing" element={<Billing />} />
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components/layout/layout.test.jsx src/App.test.jsx`
Expected: PASS (existing + the new Billing nav + route tests; the existing "hides the Admin link" test still passes since Admin is now `adminOnly`).

- [ ] **Step 7: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS. Report the count.

- [ ] **Step 8: Commit**

```bash
git add src/utils/constants.js src/components/layout/Sidebar.jsx src/App.jsx src/App.test.jsx src/components/layout/layout.test.jsx
git commit -m "feat(7e-bill): add Billing nav item + route; generalize admin nav gating"
```

---

### Task 6: branding — Sidebar shows the active org's name + logo

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`
- Modify: `src/components/layout/layout.test.jsx`

**Interfaces:**
- Consumes: `useOrganization()` (`organization.name`, `organization.imageUrl`).

- [ ] **Step 1: Write the failing test**

In `src/components/layout/layout.test.jsx`, inside the `describe('Sidebar', ...)` block, add:

```js
  it('shows the active org name in the header, with a ProcureIQ fallback', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByText(authState.organization.name)).toBeInTheDocument()

    authState.organization = null
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByText('ProcureIQ')).toBeInTheDocument()
  })
```

(`authState.organization` defaults to `DEMO_ORG` with name `'Procure IQ Demo Org'`; `resetAuthState()` runs before each test via the global setup.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/layout/layout.test.jsx`
Expected: FAIL — the Sidebar header is the hardcoded "ProcureIQ", so `getByText('Procure IQ Demo Org')` fails.

- [ ] **Step 3: Update `src/components/layout/Sidebar.jsx`**

Read `organization` from `useOrganization()` and render the org name + optional logo instead of the hardcoded title. The component currently has `const { membership } = useOrganization()` — change it to also read `organization`:

```js
  const { membership, organization } = useOrganization()
  const isAdmin = membership?.role === 'org:admin'
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const orgName = organization?.name ?? 'ProcureIQ'
```

Replace the hardcoded header `<div>` (`ProcureIQ`) with:

```jsx
      <div className="flex items-center gap-2 px-2">
        {organization?.imageUrl && (
          <img src={organization.imageUrl} alt={orgName} className="h-6 w-6 rounded" />
        )}
        <span className="truncate font-display text-xl font-semibold text-text-primary">{orgName}</span>
      </div>
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/layout/layout.test.jsx`
Expected: PASS (the new branding test + all existing Sidebar tests).

- [ ] **Step 5: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS. Report the count.

- [ ] **Step 6: Lint**

Run: `npx eslint src/components/layout/Sidebar.jsx`
Expected: no NEW errors beyond baseline.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.jsx src/components/layout/layout.test.jsx
git commit -m "feat(7e-bill): brand the Sidebar with the active org name + logo"
```

---

### Task 7: full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the api half**

Run: `npx vitest run api/`
Expected: PASS (incl. the stripe lib + checkout endpoint).

- [ ] **Step 2: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS (incl. billingPlans, Billing page, the nav + branding layout tests, the App billing route).

- [ ] **Step 3: Lint**

Run: `npx eslint api/ src/`
Expected: no NEW errors beyond the known baseline.

---

## Self-Review

**Spec coverage:**
- key-optional Stripe lib (dynamic import) → Task 1. ✓
- `POST /api/billing/checkout` (admin-only, 503/400/405/502/200) → Task 2. ✓
- `BILLING_PLANS` + `CURRENT_PLAN` → Task 3. ✓
- `Billing.jsx` (admin-only, tiers, upgrade→checkout, 503 graceful, non-admin notice) → Task 4. ✓
- nav item + `/billing` route + `adminOnly` generalization → Task 5. ✓
- branding (Sidebar org name + logo, fallback) → Task 6. ✓
- Tests for all → each task + Task 7. ✓
- Non-goals respected: no plan persistence/DB model, no webhook, no accent color; `stripe` not installed (dynamic import). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The App.test/layout.test
additions instruct mirroring the file's existing render setup, with the exact new
assertions provided.

**Type consistency:** `isBillingConfigured`/`priceIdForPlan`/`getStripe` signatures match
between Task 1 (def), Task 2 (handler), and the Task 2 test mocks (`getStripe` is async →
`mockResolvedValue`). `BILLING_PLANS` shape (`{id,name,price,features}`) + `CURRENT_PLAN`
identical in Task 3 (def) and Task 4 (page). `adminOnly` flag introduced in Task 5
(constants + Sidebar filter) and unaffected by Task 6. The checkout response `{ url }` is
produced by Task 2 and consumed by Task 4's `handleUpgrade`.
