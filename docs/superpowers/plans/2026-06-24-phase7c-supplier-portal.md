# Phase 7c — Supplier Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/portal` placeholder with a real internal **Supplier Portal** module where buyer-org members create and track requests addressed to suppliers (pending → submitted → approved/rejected), with optional due dates and a Brevo email notification.

**Architecture:** Mirror every other module in the app — a new `PortalRequest` Prisma model, org-scoped Vercel-function API endpoints (`api/portal-requests/*`), a React `PortalContext` provider wired into the org-scoped provider stack, and a `Portal.jsx` page built from existing UI primitives. Status transitions are buyer-driven (internal-only view; no external supplier auth).

**Tech Stack:** React + react-router, Vercel serverless functions, Prisma + Neon Postgres, Clerk auth (`requireAuth`), Brevo email (`api/_lib/email.js`), Vitest + Testing Library, framer-motion, lucide-react, Tailwind.

## Global Constraints

- All API endpoints are wrapped in `requireAuth` and scope EVERY query by `req.auth.orgId`. Never trust a client-supplied `orgId`/`id`.
- `req.auth = { userId, orgId, orgRole }` is set by `requireAuth`.
- Request `type` ∈ `['esg_questionnaire', 'document', 'risk_review', 'general']` (default `general`).
- Request `status` ∈ `['pending', 'submitted', 'approved', 'rejected']` (default `pending`).
- Secrets (`BREVO_*`) are read server-side only in `api/_lib/*`; never import those libs from `src/`.
- Tests must stay green. Run API and src halves separately; run src serial: `npx vitest run --no-file-parallelism` (the parallel run flakes on worker timeouts under load — NOT real failures).
- Handler test convention: pass `req.auth = { userId: 'user_test', orgId: 'org_test' }` and assert `where: { orgId: 'org_test' }`.
- Follow existing file style exactly (ESM `import`, no semicolons-optional → match surrounding files which omit semicolons; 2-space indent).
- Commit after each task with a `feat(7c):` / `test(7c):` / `docs(7c):` prefix.

---

### Task 1: PortalRequest Prisma model

**Files:**
- Modify: `prisma/schema.prisma` (add model + back-relation on `Supplier`)

**Interfaces:**
- Produces: a `PortalRequest` table consumed by all API tasks via `prisma.portalRequest`.

- [ ] **Step 1: Add the model and back-relation**

In `prisma/schema.prisma`, add this back-relation line inside the existing `Supplier` model (next to `spendRecords SpendRecord[]`):

```prisma
  portalRequests  PortalRequest[]
```

Then append a new model at the end of the file:

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

- [ ] **Step 2: Validate and (re)generate the client**

Run: `npx prisma format && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Then run: `npx prisma generate`
Expected: `Generated Prisma Client` (so `prisma.portalRequest` exists at runtime).

> NOTE — applying the migration to Neon (`npx prisma migrate dev --name add_portal_request` or `npx prisma db push`) needs `DATABASE_URL` and is a DEFERRED live step, like the other integration steps in this repo. Unit tests mock Prisma entirely, so the suite is green without a live DB.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(7c): add PortalRequest Prisma model and Supplier relation"
```

---

### Task 2: portalSelectors util (constants + filtering)

**Files:**
- Create: `src/utils/portalSelectors.js`
- Test: `src/utils/portalSelectors.test.js`

**Interfaces:**
- Produces:
  - `PORTAL_REQUEST_TYPES: string[]` and `PORTAL_STATUSES: string[]`
  - `PORTAL_STATUS_BADGE: Record<string,string>` (status → Badge variant)
  - `PORTAL_TYPE_LABEL: Record<string,string>` (type → human label)
  - `filterRequests(requests, { status, supplierId }) => requests[]`
- Consumed by Task 9 (modal), Task 10 (slide-over), Task 11 (page).

- [ ] **Step 1: Write the failing test**

Create `src/utils/portalSelectors.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  PORTAL_REQUEST_TYPES,
  PORTAL_STATUSES,
  PORTAL_STATUS_BADGE,
  PORTAL_TYPE_LABEL,
  filterRequests,
} from './portalSelectors'

const rows = [
  { id: 'a', status: 'pending', supplierId: 's1' },
  { id: 'b', status: 'approved', supplierId: 's2' },
  { id: 'c', status: 'pending', supplierId: 's2' },
]

describe('portalSelectors', () => {
  it('exposes the fixed type and status vocabularies', () => {
    expect(PORTAL_REQUEST_TYPES).toEqual(['esg_questionnaire', 'document', 'risk_review', 'general'])
    expect(PORTAL_STATUSES).toEqual(['pending', 'submitted', 'approved', 'rejected'])
  })

  it('maps every status to a badge variant and every type to a label', () => {
    PORTAL_STATUSES.forEach((s) => expect(PORTAL_STATUS_BADGE[s]).toBeTruthy())
    PORTAL_REQUEST_TYPES.forEach((t) => expect(PORTAL_TYPE_LABEL[t]).toBeTruthy())
  })

  it('filters by status', () => {
    expect(filterRequests(rows, { status: 'pending' }).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('filters by supplierId', () => {
    expect(filterRequests(rows, { supplierId: 's2' }).map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('returns all rows with no filters', () => {
    expect(filterRequests(rows)).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/portalSelectors.test.js`
Expected: FAIL — cannot resolve `./portalSelectors`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/portalSelectors.js`:

```js
export const PORTAL_REQUEST_TYPES = ['esg_questionnaire', 'document', 'risk_review', 'general']
export const PORTAL_STATUSES = ['pending', 'submitted', 'approved', 'rejected']

export const PORTAL_STATUS_BADGE = {
  pending: 'amber',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
}

export const PORTAL_TYPE_LABEL = {
  esg_questionnaire: 'ESG Questionnaire',
  document: 'Document Request',
  risk_review: 'Risk Review',
  general: 'General',
}

export function filterRequests(requests, { status = '', supplierId = '' } = {}) {
  return requests.filter((r) => {
    const matchesStatus = !status || r.status === status
    const matchesSupplier = !supplierId || r.supplierId === supplierId
    return matchesStatus && matchesSupplier
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/portalSelectors.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/portalSelectors.js src/utils/portalSelectors.test.js
git commit -m "test(7c): add portalSelectors constants and filter helper"
```

---

### Task 3: GET + POST `/api/portal-requests`

**Files:**
- Create: `api/portal-requests/index.js`
- Test: `api/portal-requests/index.test.js`

**Interfaces:**
- Consumes: `prisma.portalRequest`, `prisma.supplier` (Task 1); `coerceDates` from `api/_lib/dates.js`; `requireAuth` from `api/_lib/auth.js`.
- Produces:
  - `GET /api/portal-requests` → `200` array of requests (each with `supplier: { id, name }`).
  - `POST /api/portal-requests` → `201` created request. Body `{ supplierId, type?, title, message?, dueDate?, status? }`. `400` missing title/supplierId or invalid type/status; `404` supplier not in org.

- [ ] **Step 1: Write the failing test**

Create `api/portal-requests/index.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    portalRequest: { findMany: vi.fn(), create: vi.fn() },
    supplier: { findFirst: vi.fn() },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))

import listHandler from './index.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const auth = { userId: 'user_test', orgId: 'org_test' }

beforeEach(() => vi.clearAllMocks())

describe('portal-requests index', () => {
  it('GET returns the org-scoped list including supplier id+name', async () => {
    prisma.portalRequest.findMany.mockResolvedValue([])
    const res = mockRes()
    await listHandler({ method: 'GET', auth }, res)
    expect(prisma.portalRequest.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_test' },
      orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { id: true, name: true } } },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST creates a request, stamping orgId/createdBy and coercing dueDate', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
    prisma.portalRequest.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      { method: 'POST', auth, body: { supplierId: 'sup_1', title: 'Submit ESG', type: 'esg_questionnaire', dueDate: '2026-07-01' } },
      res
    )
    const created = prisma.portalRequest.create.mock.calls[0][0].data
    expect(created.orgId).toBe('org_test')
    expect(created.createdBy).toBe('user_test')
    expect(created.status).toBe('pending')
    expect(created.type).toBe('esg_questionnaire')
    expect(created.dueDate).toBeInstanceOf(Date)
    expect(created.id).toMatch(/^preq_/)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing title/supplierId with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth, body: { title: 'no supplier' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.portalRequest.create).not.toHaveBeenCalled()
  })

  it('POST rejects an invalid type with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', auth, body: { supplierId: 'sup_1', title: 'x', type: 'bogus' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('POST returns 404 when the supplier is not in the org', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await listHandler({ method: 'POST', auth, body: { supplierId: 'sup_other', title: 'x' } }, res)
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_other', orgId: 'org_test' } })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.portalRequest.create).not.toHaveBeenCalled()
  })

  it('returns 405 for unsupported methods', async () => {
    const res = mockRes()
    await listHandler({ method: 'DELETE', auth }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/portal-requests/index.test.js`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Write the implementation**

Create `api/portal-requests/index.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'

const TYPES = ['esg_questionnaire', 'document', 'risk_review', 'general']
const STATUSES = ['pending', 'submitted', 'approved', 'rejected']

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const requests = await prisma.portalRequest.findMany({
        where: { orgId: req.auth.orgId },
        orderBy: { createdAt: 'desc' },
        include: { supplier: { select: { id: true, name: true } } },
      })
      return res.status(200).json(requests)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!body.title || !body.supplierId) {
        return res.status(400).json({ error: 'title and supplierId are required' })
      }
      const type = body.type ?? 'general'
      const status = body.status ?? 'pending'
      if (!TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' })
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })

      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplierId, orgId: req.auth.orgId },
      })
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' })

      const created = await prisma.portalRequest.create({
        data: {
          ...coerceDates(body, ['dueDate']),
          id: `preq_${Date.now()}`,
          orgId: req.auth.orgId,
          type,
          status,
          createdBy: req.auth.userId,
        },
      })
      return res.status(201).json(created)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/portal-requests/index.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/portal-requests/index.js api/portal-requests/index.test.js
git commit -m "feat(7c): add GET/POST /api/portal-requests (org-scoped, supplier-validated)"
```

---

### Task 4: PATCH + DELETE `/api/portal-requests/[id]`

**Files:**
- Create: `api/portal-requests/[id].js`
- Test: `api/portal-requests/[id].test.js`

**Interfaces:**
- Consumes: `prisma.portalRequest`, `coerceDates`, `requireAuth`.
- Produces:
  - `PATCH /api/portal-requests/:id` → `200` updated; strips `id`/`orgId`; validates `type`/`status` when present; `404` if not in org.
  - `DELETE /api/portal-requests/:id` → `200 { deleted: true }`; `404` if not in org.

- [ ] **Step 1: Write the failing test**

Create `api/portal-requests/[id].test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: { portalRequest: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}))
vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))

import idHandler from './[id].js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const auth = { userId: 'user_test', orgId: 'org_test' }

beforeEach(() => vi.clearAllMocks())

describe('portal-requests [id]', () => {
  it('PATCH updates status by id within the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    prisma.portalRequest.update.mockResolvedValue({ id: 'preq_1', status: 'approved' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth, query: { id: 'preq_1' }, body: { status: 'approved' } }, res)
    expect(prisma.portalRequest.findFirst).toHaveBeenCalledWith({ where: { id: 'preq_1', orgId: 'org_test' } })
    expect(prisma.portalRequest.update.mock.calls[0][0].data.status).toBe('approved')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('PATCH coerces dueDate and ignores client id/orgId', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    prisma.portalRequest.update.mockResolvedValue({ id: 'preq_1' })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', auth, query: { id: 'preq_1' }, body: { orgId: 'evil', id: 'hijack', dueDate: '2026-08-01' } },
      res
    )
    const data = prisma.portalRequest.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('orgId')
    expect(data).not.toHaveProperty('id')
    expect(data.dueDate).toBeInstanceOf(Date)
  })

  it('PATCH rejects an invalid status with 400', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth, query: { id: 'preq_1' }, body: { status: 'bogus' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.portalRequest.update).not.toHaveBeenCalled()
  })

  it('PATCH returns 404 when the id is not in the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'PATCH', auth, query: { id: 'preq_other' }, body: { status: 'approved' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.portalRequest.update).not.toHaveBeenCalled()
  })

  it('DELETE removes the request within the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue({ id: 'preq_1' })
    prisma.portalRequest.delete.mockResolvedValue({ id: 'preq_1' })
    const res = mockRes()
    await idHandler({ method: 'DELETE', auth, query: { id: 'preq_1' } }, res)
    expect(prisma.portalRequest.delete).toHaveBeenCalledWith({ where: { id: 'preq_1' } })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ deleted: true })
  })

  it('DELETE returns 404 when not in the org', async () => {
    prisma.portalRequest.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'DELETE', auth, query: { id: 'preq_other' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.portalRequest.delete).not.toHaveBeenCalled()
  })

  it('returns 405 for unsupported methods', async () => {
    const res = mockRes()
    await idHandler({ method: 'GET', auth, query: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "api/portal-requests/[id].test.js"`
Expected: FAIL — cannot resolve `./[id].js`.

- [ ] **Step 3: Write the implementation**

Create `api/portal-requests/[id].js`:

```js
import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'

const TYPES = ['esg_questionnaire', 'document', 'risk_review', 'general']
const STATUSES = ['pending', 'submitted', 'approved', 'rejected']

async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
      const existing = await prisma.portalRequest.findFirst({
        where: { id: req.query.id, orgId: req.auth.orgId },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}
      if (rest.type !== undefined && !TYPES.includes(rest.type)) {
        return res.status(400).json({ error: 'invalid type' })
      }
      if (rest.status !== undefined && !STATUSES.includes(rest.status)) {
        return res.status(400).json({ error: 'invalid status' })
      }
      const updated = await prisma.portalRequest.update({
        where: { id: req.query.id },
        data: coerceDates(rest, ['dueDate']),
      })
      return res.status(200).json(updated)
    }
    if (req.method === 'DELETE') {
      const existing = await prisma.portalRequest.findFirst({
        where: { id: req.query.id, orgId: req.auth.orgId },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      await prisma.portalRequest.delete({ where: { id: req.query.id } })
      return res.status(200).json({ deleted: true })
    }
    res.setHeader('Allow', 'PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "api/portal-requests/[id].test.js"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add "api/portal-requests/[id].js" "api/portal-requests/[id].test.js"
git commit -m "feat(7c): add PATCH/DELETE /api/portal-requests/[id] (org-scoped, immutable id/orgId)"
```

---

### Task 5: POST `/api/portal-requests/notify` (Brevo)

**Files:**
- Create: `api/portal-requests/notify.js`
- Test: `api/portal-requests/notify.test.js`

**Interfaces:**
- Consumes: `prisma.portalRequest`, `requireAuth`, `isEmailConfigured`/`sendEmail` from `api/_lib/email.js`.
- Produces: `POST /api/portal-requests/notify` body `{ id }`. `400` missing id; `503` email unconfigured; `404` request/supplier missing; `200 { ok: true }`; `502` send failure. Recipient = `request.supplier.email`. HTML is escaped.

- [ ] **Step 1: Write the failing test**

Create `api/portal-requests/notify.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({ prisma: { portalRequest: { findFirst: vi.fn() } } }))
vi.mock('../_lib/email.js', () => ({ isEmailConfigured: vi.fn(), sendEmail: vi.fn() }))

import handler from './notify.js'
import { prisma } from '../_lib/prisma.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const auth = { userId: 'user_test', orgId: 'org_test' }

beforeEach(() => vi.clearAllMocks())

describe('POST /api/portal-requests/notify', () => {
  it('emails the supplier and returns { ok: true }', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.portalRequest.findFirst.mockResolvedValue({
      id: 'preq_1',
      title: 'Submit ESG questionnaire',
      message: 'Please complete it.',
      dueDate: '2026-07-01',
      supplier: { name: 'Atlas Steelworks', email: 'contact@atlas.com' },
    })
    sendEmail.mockResolvedValue(true)
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_1' } }, res)
    expect(prisma.portalRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'preq_1', orgId: 'org_test' },
      include: { supplier: { select: { name: true, email: true } } },
    })
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('contact@atlas.com')
    expect(arg.subject).toContain('Submit ESG questionnaire')
    expect(arg.html).toContain('Atlas Steelworks')
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 503 when email is not configured (before any DB call)', async () => {
    isEmailConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.portalRequest.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the request is not in the org', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.portalRequest.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_other' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 502 when the send fails', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.portalRequest.findFirst.mockResolvedValue({
      id: 'preq_1', title: 'X', message: null, dueDate: null,
      supplier: { name: 'S', email: 's@x.com' },
    })
    sendEmail.mockRejectedValue(new Error('Brevo send failed: 400'))
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', auth }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/portal-requests/notify.test.js`
Expected: FAIL — cannot resolve `./notify.js`.

- [ ] **Step 3: Write the implementation**

Create `api/portal-requests/notify.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { id } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email notifications are not configured' })

  try {
    const request = await prisma.portalRequest.findFirst({
      where: { id, orgId: req.auth.orgId },
      include: { supplier: { select: { name: true, email: true } } },
    })
    if (!request || !request.supplier) return res.status(404).json({ error: 'Not found' })

    const due = request.dueDate ? new Date(request.dueDate).toISOString().slice(0, 10) : 'n/a'
    const html = [
      `<h2>${escapeHtml(request.title)}</h2>`,
      `<p>Hello ${escapeHtml(request.supplier.name)},</p>`,
      `<p>ProcureIQ has a request for you:</p>`,
      request.message ? `<p>${escapeHtml(request.message)}</p>` : '',
      `<ul>`,
      `<li>Due date: ${escapeHtml(due)}</li>`,
      `</ul>`,
      `<p>— ProcureIQ</p>`,
    ].join('')

    await sendEmail({ to: request.supplier.email, subject: `Request: ${request.title}`, html })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/portal-requests/notify.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/portal-requests/notify.js api/portal-requests/notify.test.js
git commit -m "feat(7c): add POST /api/portal-requests/notify (Brevo, escaped HTML)"
```

---

### Task 6: Seed data — mockData + buildSeedData

**Files:**
- Modify: `src/lib/mockData.js` (add `portalRequests` export)
- Modify: `api/_lib/seedData.js` (re-key `portalRequests`)
- Modify: `api/_lib/seedData.test.js` (assert re-keying)

**Interfaces:**
- Consumes: `suppliers`, `daysFromNow`, `daysAgo` (already in `mockData.js`).
- Produces: `portalRequests` array export; `buildSeedData(orgId).portalRequests` re-keyed (namespaced id, rewritten `supplierId`, stamped `orgId`).

- [ ] **Step 1: Add the mockData export**

In `src/lib/mockData.js`, after the `spendRecords` block (before `recentActivity`), add:

```js
export const portalRequests = [
  {
    id: 'preq_1',
    orgId: 'org_demo',
    supplierId: suppliers[0].id,
    type: 'esg_questionnaire',
    title: 'Submit 2026 ESG questionnaire',
    message: 'Please complete the annual ESG questionnaire by the due date.',
    status: 'pending',
    dueDate: daysFromNow(14),
    responseNote: null,
    createdBy: 'user_demo_admin',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: 'preq_2',
    orgId: 'org_demo',
    supplierId: suppliers[1].id,
    type: 'document',
    title: 'Upload current insurance certificate',
    message: 'We need your current liability insurance certificate on file.',
    status: 'submitted',
    dueDate: daysFromNow(5),
    responseNote: 'Certificate emailed on 06-20; pending review.',
    createdBy: 'user_demo_admin',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
  },
  {
    id: 'preq_3',
    orgId: 'org_demo',
    supplierId: suppliers[2].id,
    type: 'risk_review',
    title: 'Q2 risk review attestation',
    message: null,
    status: 'approved',
    dueDate: daysAgo(3),
    responseNote: 'Reviewed and approved.',
    createdBy: 'user_demo_admin',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(4),
  },
  {
    id: 'preq_4',
    orgId: 'org_demo',
    supplierId: suppliers[3].id,
    type: 'general',
    title: 'Confirm updated banking details',
    message: 'Please confirm your updated remittance details.',
    status: 'rejected',
    dueDate: null,
    responseNote: 'Details could not be verified; resubmission required.',
    createdBy: 'user_demo_admin',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(8),
  },
]
```

- [ ] **Step 2: Write the failing seedData test**

In `api/_lib/seedData.test.js`, add a test asserting portalRequests are re-keyed (match the style of the existing assertions in that file — open it first to mirror the structure). Add:

```js
it('re-keys portalRequests: namespaced id, rewritten supplierId, stamped orgId', () => {
  const data = buildSeedData('org_xyz')
  expect(data.portalRequests.length).toBeGreaterThan(0)
  for (const p of data.portalRequests) {
    expect(p.id.startsWith('org_xyz__')).toBe(true)
    expect(p.supplierId.startsWith('org_xyz__')).toBe(true)
    expect(p.orgId).toBe('org_xyz')
  }
})
```

(If `buildSeedData` is not already imported at the top of the test file, mirror the existing import.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run api/_lib/seedData.test.js`
Expected: FAIL — `data.portalRequests` is undefined.

- [ ] **Step 4: Update buildSeedData**

In `api/_lib/seedData.js`, add `portalRequests` to the import list from `../../src/lib/mockData.js`:

```js
import {
  suppliers,
  contracts,
  riskAssessments,
  esgResponses,
  spendRecords,
  portalRequests,
} from '../../src/lib/mockData.js'
```

And add this line to the returned object (after `spendRecords`):

```js
    portalRequests: portalRequests.map((p) => ({ ...p, id: ns(p.id), orgId, supplierId: ns(p.supplierId) })),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run api/_lib/seedData.test.js`
Expected: PASS (existing tests + the new one).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mockData.js api/_lib/seedData.js api/_lib/seedData.test.js
git commit -m "feat(7c): seed sample portal requests and re-key them per org"
```

---

### Task 7: Wire portalRequests into seed / clear / reset

**Files:**
- Modify: `api/org/seed.js`
- Modify: `api/org/clear.js`
- Modify: `api/org/reset.js`
- Modify: `api/org/seed.test.js`, `api/org/clear.test.js`, `api/org/reset.test.js`

**Interfaces:**
- Consumes: `buildSeedData(orgId).portalRequests` (Task 6); `prisma.portalRequest`.
- Produces: seed inserts portalRequests (after suppliers); clear/reset delete portalRequests (child group, before suppliers); reset re-inserts them.

- [ ] **Step 1: Update the failing tests first**

Open `api/org/seed.test.js`, `clear.test.js`, `reset.test.js` to mirror their exact mock/assert style, then:

- In `clear.test.js`: add `portalRequest: { deleteMany: vi.fn() }` to the prisma mock and assert `prisma.portalRequest.deleteMany` is called with `{ where: { orgId } }` inside the `$transaction`.
- In `reset.test.js`: add `portalRequest: { deleteMany: vi.fn(), createMany: vi.fn() }` to the mock and assert both are called.
- In `seed.test.js`: add `portalRequest: { createMany: vi.fn() }` to the mock and assert `createMany` is called.

Example assertion to add in `clear.test.js` (adapt to the file's existing pattern — they assert on the `$transaction` argument array):

```js
expect(prisma.portalRequest.deleteMany).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run api/org/seed.test.js api/org/clear.test.js api/org/reset.test.js`
Expected: FAIL — `prisma.portalRequest` undefined / not called.

- [ ] **Step 3: Update seed.js**

In `api/org/seed.js`, after `await prisma.supplier.createMany({ data: data.suppliers })` and the other child inserts, add:

```js
    await prisma.portalRequest.createMany({ data: data.portalRequests })
```

(Place it after `prisma.supplier.createMany`, alongside the other children — order among children does not matter; only suppliers must come first.)

- [ ] **Step 4: Update clear.js**

In `api/org/clear.js`, add a portalRequest delete to the `$transaction` array, before the supplier delete (it is a child of supplier):

```js
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.portalRequest.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
    ])
```

- [ ] **Step 5: Update reset.js**

In `api/org/reset.js`, add the portalRequest delete to the delete group (before supplier delete) and the createMany to the insert group (after supplier createMany):

```js
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.portalRequest.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
      prisma.supplier.createMany({ data: data.suppliers }),
      prisma.contract.createMany({ data: data.contracts }),
      prisma.riskAssessment.createMany({ data: data.riskAssessments }),
      prisma.esgResponse.createMany({ data: data.esgResponses }),
      prisma.spendRecord.createMany({ data: data.spendRecords }),
      prisma.portalRequest.createMany({ data: data.portalRequests }),
    ])
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run api/org/seed.test.js api/org/clear.test.js api/org/reset.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/org/seed.js api/org/clear.js api/org/reset.js api/org/seed.test.js api/org/clear.test.js api/org/reset.test.js
git commit -m "feat(7c): include portalRequests in org seed/clear/reset transactions"
```

---

### Task 8: apiClient `del` + PortalContext

**Files:**
- Modify: `src/lib/apiClient.js` (add `del`)
- Modify: `src/lib/apiClient.test.js` (test `del`)
- Create: `src/context/PortalContext.jsx`
- Test: `src/context/PortalContext.test.jsx`
- Modify: `src/components/layout/OrgScopedProviders.jsx` (add provider)

**Interfaces:**
- Produces:
  - `api.del(path)` → DELETE request.
  - `usePortalContext()` → `{ requests, isLoading, error, createRequest, updateRequest, deleteRequest, notifyRequest }`
    - `createRequest(data) => Promise<request>` (prepends to list)
    - `updateRequest(id, patch) => Promise<request>` (merges into list)
    - `deleteRequest(id) => Promise<void>` (removes from list)
    - `notifyRequest(id) => Promise` (POST notify)
  - `PortalProvider` mounted in `OrgScopedProviders`.

- [ ] **Step 1: Write the failing apiClient test**

In `src/lib/apiClient.test.js`, mirror the existing style and add a test for `del` (open the file first). Add:

```js
it('del issues a DELETE request', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deleted: true }) })
  const { api } = await import('./apiClient')
  const result = await api.del('/api/portal-requests/preq_1')
  expect(global.fetch).toHaveBeenCalledWith('/api/portal-requests/preq_1', expect.objectContaining({ method: 'DELETE' }))
  expect(result).toEqual({ deleted: true })
})
```

(Adapt the fetch-mock setup to whatever the existing tests in that file use.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/apiClient.test.js`
Expected: FAIL — `api.del is not a function`.

- [ ] **Step 3: Add `del` to apiClient**

In `src/lib/apiClient.js`, add to the exported `api` object:

```js
export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  del: (path) => request(path, { method: 'DELETE' }),
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/apiClient.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing PortalContext test**

Create `src/context/PortalContext.test.jsx` (mirror `ContractContext.test.jsx` — open it first for the exact mocking + render-hook style):

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { PortalProvider, usePortalContext } from './PortalContext'
import { api } from '../lib/apiClient'

vi.mock('../lib/apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}))

function Probe() {
  const { requests, createRequest, updateRequest, deleteRequest } = usePortalContext()
  return (
    <div>
      <span data-testid="count">{requests.length}</span>
      <button onClick={() => createRequest({ title: 'New', supplierId: 's1' })}>create</button>
      <button onClick={() => updateRequest('preq_1', { status: 'approved' })}>update</button>
      <button onClick={() => deleteRequest('preq_1')}>delete</button>
    </div>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PortalContext', () => {
  it('loads requests on mount', async () => {
    api.get.mockResolvedValue([{ id: 'preq_1', status: 'pending', supplierId: 's1' }])
    render(<PortalProvider><Probe /></PortalProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(api.get).toHaveBeenCalledWith('/api/portal-requests')
  })

  it('prepends a created request', async () => {
    api.get.mockResolvedValue([])
    api.post.mockResolvedValue({ id: 'preq_new', status: 'pending', supplierId: 's1' })
    render(<PortalProvider><Probe /></PortalProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    await act(async () => screen.getByText('create').click())
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(api.post).toHaveBeenCalledWith('/api/portal-requests', { title: 'New', supplierId: 's1' })
  })

  it('merges an updated request', async () => {
    api.get.mockResolvedValue([{ id: 'preq_1', status: 'pending', supplierId: 's1' }])
    api.patch.mockResolvedValue({ id: 'preq_1', status: 'approved' })
    render(<PortalProvider><Probe /></PortalProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await act(async () => screen.getByText('update').click())
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/portal-requests/preq_1', { status: 'approved' }))
  })

  it('removes a deleted request', async () => {
    api.get.mockResolvedValue([{ id: 'preq_1', status: 'pending', supplierId: 's1' }])
    api.del.mockResolvedValue({ deleted: true })
    render(<PortalProvider><Probe /></PortalProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await act(async () => screen.getByText('delete').click())
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    expect(api.del).toHaveBeenCalledWith('/api/portal-requests/preq_1')
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/context/PortalContext.test.jsx`
Expected: FAIL — cannot resolve `./PortalContext`.

- [ ] **Step 7: Write PortalContext**

Create `src/context/PortalContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const PortalContext = createContext(null)

export function PortalProvider({ children }) {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/portal-requests')
      .then((data) => {
        if (!cancelled) setRequests(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function createRequest(data) {
    return api
      .post('/api/portal-requests', data)
      .then((created) => {
        setRequests((prev) => [created, ...prev])
        return created
      })
      .catch((e) => {
        setError(e)
        throw e
      })
  }

  function updateRequest(id, patch) {
    return api
      .patch(`/api/portal-requests/${id}`, patch)
      .then((updated) => {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)))
        return updated
      })
      .catch((e) => {
        setError(e)
        throw e
      })
  }

  function deleteRequest(id) {
    return api
      .del(`/api/portal-requests/${id}`)
      .then(() => setRequests((prev) => prev.filter((r) => r.id !== id)))
      .catch((e) => {
        setError(e)
        throw e
      })
  }

  function notifyRequest(id) {
    return api.post('/api/portal-requests/notify', { id }).catch((e) => {
      setError(e)
      throw e
    })
  }

  return (
    <PortalContext.Provider
      value={{ requests, isLoading, error, createRequest, updateRequest, deleteRequest, notifyRequest }}
    >
      {children}
    </PortalContext.Provider>
  )
}

export function usePortalContext() {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortalContext must be used inside PortalProvider')
  return ctx
}
```

- [ ] **Step 8: Wire the provider into the org-scoped stack**

In `src/components/layout/OrgScopedProviders.jsx`, import and nest `PortalProvider` (innermost, inside `ChatProvider` is fine — order does not matter):

```jsx
import { PortalProvider } from '../../context/PortalContext'
```

```jsx
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <ChatProvider>
              <PortalProvider>{children}</PortalProvider>
            </ChatProvider>
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
```

- [ ] **Step 9: Run the context test to verify it passes**

Run: `npx vitest run src/context/PortalContext.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/apiClient.js src/lib/apiClient.test.js src/context/PortalContext.jsx src/context/PortalContext.test.jsx src/components/layout/OrgScopedProviders.jsx
git commit -m "feat(7c): add api.del + PortalContext wired into org-scoped providers"
```

---

### Task 9: PortalRequestModal (create form)

**Files:**
- Create: `src/components/ui/PortalRequestModal.jsx`
- Test: `src/components/ui/PortalRequestModal.test.jsx`

**Interfaces:**
- Consumes: `Modal`, `Button`, `PORTAL_REQUEST_TYPES`, `PORTAL_TYPE_LABEL`.
- Produces: `<PortalRequestModal isOpen onClose suppliers onSubmit />`. `onSubmit(data)` receives `{ supplierId, type, title, message, dueDate }`; the modal closes after submit. The submit button is disabled until `supplierId` and `title` are filled.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/PortalRequestModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PortalRequestModal from './PortalRequestModal'

const suppliers = [
  { id: 's1', name: 'Atlas Steelworks' },
  { id: 's2', name: 'Nordic Freight' },
]

describe('PortalRequestModal', () => {
  it('submits the entered request and closes', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<PortalRequestModal isOpen onClose={onClose} suppliers={suppliers} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/Supplier/i), { target: { value: 's2' } })
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: 'document' } })
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Upload W-9' } })
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'Please upload your W-9.' } })

    fireEvent.click(screen.getByRole('button', { name: /Create request/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      supplierId: 's2',
      type: 'document',
      title: 'Upload W-9',
      message: 'Please upload your W-9.',
      dueDate: '',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('disables submit until supplier and title are set', () => {
    render(<PortalRequestModal isOpen onClose={() => {}} suppliers={suppliers} onSubmit={() => {}} />)
    expect(screen.getByRole('button', { name: /Create request/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/ui/PortalRequestModal.test.jsx`
Expected: FAIL — cannot resolve `./PortalRequestModal`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/PortalRequestModal.jsx`:

```jsx
import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { PORTAL_REQUEST_TYPES, PORTAL_TYPE_LABEL } from '../../utils/portalSelectors'

const EMPTY = { supplierId: '', type: 'general', title: '', message: '', dueDate: '' }

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-border-accent'

export default function PortalRequestModal({ isOpen, onClose, suppliers, onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const canSubmit = form.supplierId && form.title.trim()

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit({ ...form, title: form.title.trim(), message: form.message.trim() })
    setForm(EMPTY)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New supplier request">
      <div className="space-y-3">
        <label className="block text-sm text-text-secondary">
          Supplier
          <select className={inputClass} value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
            <option value="">Select a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          Type
          <select className={inputClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {PORTAL_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>{PORTAL_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          Title
          <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>

        <label className="block text-sm text-text-secondary">
          Message
          <textarea className={inputClass} rows={3} value={form.message} onChange={(e) => set('message', e.target.value)} />
        </label>

        <label className="block text-sm text-text-secondary">
          Due date
          <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>Create request</Button>
      </div>
    </Modal>
  )
}
```

> NOTE: the test asserts `message: 'Please upload your W-9.'` (no trailing change) and `dueDate: ''`. `handleSubmit` trims title/message; the sample message has no surrounding whitespace, so the assertion holds.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/ui/PortalRequestModal.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PortalRequestModal.jsx src/components/ui/PortalRequestModal.test.jsx
git commit -m "feat(7c): add PortalRequestModal create form"
```

---

### Task 10: PortalRequestSlideOver (detail + status actions + notify + delete)

**Files:**
- Create: `src/components/ui/PortalRequestSlideOver.jsx`
- Test: `src/components/ui/PortalRequestSlideOver.test.jsx`

**Interfaces:**
- Consumes: `Badge`, `Button`, `ConfirmDialog`, `PORTAL_STATUS_BADGE`, `PORTAL_TYPE_LABEL`, `formatDate` from `../../utils/formatters`.
- Produces: `<PortalRequestSlideOver isOpen onClose request supplier onUpdate onNotify onDelete />`
  - `onUpdate(patch)` is called for status transitions:
    - pending → `onUpdate({ status: 'submitted', responseNote })`
    - submitted → `onUpdate({ status: 'approved' })` or `onUpdate({ status: 'rejected' })`
  - `onNotify()` sends the email (button shows sent/error state).
  - `onDelete()` is called after the ConfirmDialog (confirm word `delete`).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/PortalRequestSlideOver.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PortalRequestSlideOver from './PortalRequestSlideOver'

const supplier = { id: 's1', name: 'Atlas Steelworks' }

function setup(request, props = {}) {
  return render(
    <MemoryRouter>
      <PortalRequestSlideOver
        isOpen
        onClose={() => {}}
        request={request}
        supplier={supplier}
        onUpdate={props.onUpdate ?? vi.fn()}
        onNotify={props.onNotify ?? vi.fn().mockResolvedValue({})}
        onDelete={props.onDelete ?? vi.fn()}
      />
    </MemoryRouter>
  )
}

describe('PortalRequestSlideOver', () => {
  it('marks a pending request submitted with a response note', () => {
    const onUpdate = vi.fn()
    setup({ id: 'preq_1', title: 'Submit ESG', type: 'esg_questionnaire', status: 'pending', message: 'do it', dueDate: null }, { onUpdate })
    fireEvent.change(screen.getByLabelText(/Response note/i), { target: { value: 'Got it via email' } })
    fireEvent.click(screen.getByRole('button', { name: /Mark submitted/i }))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'submitted', responseNote: 'Got it via email' })
  })

  it('approves a submitted request', () => {
    const onUpdate = vi.fn()
    setup({ id: 'preq_1', title: 'x', type: 'document', status: 'submitted', message: null, dueDate: null }, { onUpdate })
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'approved' })
  })

  it('rejects a submitted request', () => {
    const onUpdate = vi.fn()
    setup({ id: 'preq_1', title: 'x', type: 'document', status: 'submitted', message: null, dueDate: null }, { onUpdate })
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'rejected' })
  })

  it('deletes after typing the confirm word', () => {
    const onDelete = vi.fn()
    setup({ id: 'preq_1', title: 'x', type: 'general', status: 'approved', message: null, dueDate: null }, { onDelete })
    fireEvent.click(screen.getByRole('button', { name: /^Delete request$/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delete' } })
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('renders nothing when no request is given', () => {
    const { container } = setup(null)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/ui/PortalRequestSlideOver.test.jsx`
Expected: FAIL — cannot resolve `./PortalRequestSlideOver`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/PortalRequestSlideOver.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import Badge from './Badge'
import Button from './Button'
import ConfirmDialog from './ConfirmDialog'
import { PORTAL_STATUS_BADGE, PORTAL_TYPE_LABEL } from '../../utils/portalSelectors'
import { formatDate } from '../../utils/formatters'

export default function PortalRequestSlideOver({ isOpen, onClose, request, supplier, onUpdate, onNotify, onDelete }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const [responseNote, setResponseNote] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [notifySent, setNotifySent] = useState(false)
  const [notifyError, setNotifyError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setResponseNote(request?.responseNote ?? '')
    setNotifySent(false)
    setNotifyError(null)
  }, [request?.id])

  async function handleNotify() {
    setNotifyError(null)
    setIsSending(true)
    try {
      await onNotify()
      setNotifySent(true)
    } catch {
      setNotifyError('Could not send the email. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  if (!request) return null

  const due = request.dueDate ? formatDate(request.dueDate) : '—'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="portal-slide-overlay"
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-bg-card shadow-2xl"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-text-primary">{request.title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="flex items-center gap-3">
                <Badge variant={PORTAL_STATUS_BADGE[request.status] ?? 'muted'}>{request.status}</Badge>
                <span className="text-sm text-text-secondary">{PORTAL_TYPE_LABEL[request.type] ?? request.type}</span>
              </div>

              {supplier && (
                <Link to={`/suppliers/${supplier.id}`} className="text-sm text-accent-blue-light hover:underline">
                  {supplier.name}
                </Link>
              )}

              <div className="rounded-lg border border-border bg-bg-secondary p-3">
                <p className="text-xs text-text-secondary">Due date</p>
                <p className="mt-1 text-base font-semibold text-text-primary">{due}</p>
              </div>

              {request.message && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Message</p>
                  <p className="text-sm text-text-primary">{request.message}</p>
                </div>
              )}

              {request.status === 'pending' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Response note
                    <textarea
                      rows={2}
                      value={responseNote}
                      onChange={(e) => setResponseNote(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-border-accent"
                    />
                  </label>
                  <Button variant="primary" onClick={() => onUpdate({ status: 'submitted', responseNote })}>
                    Mark submitted
                  </Button>
                </div>
              )}

              {request.status === 'submitted' && (
                <div className="flex gap-3">
                  <Button variant="primary" onClick={() => onUpdate({ status: 'approved' })}>Approve</Button>
                  <Button variant="danger" onClick={() => onUpdate({ status: 'rejected' })}>Reject</Button>
                </div>
              )}

              {(request.status === 'approved' || request.status === 'rejected') && request.responseNote && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Response note</p>
                  <p className="text-sm text-text-primary">{request.responseNote}</p>
                </div>
              )}

              {onNotify && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Notify supplier</p>
                  <Button variant="secondary" onClick={handleNotify} disabled={isSending}>
                    {isSending ? 'Sending…' : 'Email request'}
                  </Button>
                  {notifySent && <p className="mt-1 text-xs text-accent-green">Email sent ✓</p>}
                  {notifyError && <p className="mt-1 text-xs text-accent-red">{notifyError}</p>}
                </div>
              )}
            </div>

            <div className="border-t border-border px-6 py-4">
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete request</Button>
            </div>
          </motion.div>

          <ConfirmDialog
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false)
              onDelete()
            }}
            title="Delete request"
            description="This permanently deletes this supplier request."
            confirmWord="delete"
            confirmLabel="Delete"
          />
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/ui/PortalRequestSlideOver.test.jsx`
Expected: PASS (5 tests).

> If the ConfirmDialog confirm button name collides with the slide-over's "Delete request" button in the delete test, the `^Delete$` anchor in the test already disambiguates. Verify both buttons are reachable.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PortalRequestSlideOver.jsx src/components/ui/PortalRequestSlideOver.test.jsx
git commit -m "feat(7c): add PortalRequestSlideOver with status actions, notify, delete"
```

---

### Task 11: Portal page

**Files:**
- Create: `src/pages/Portal.jsx`
- Test: `src/pages/Portal.test.jsx`

**Interfaces:**
- Consumes: `usePortalContext`, `useSupplierContext`, `PageHeader`, `DataTable`, `Badge`, `Button`, `PortalRequestModal`, `PortalRequestSlideOver`, `filterRequests`, `PORTAL_STATUS_BADGE`, `PORTAL_TYPE_LABEL`, `PORTAL_STATUSES`, `formatDate`.
- Produces: the `/portal` page (default export `Portal`).

- [ ] **Step 1: Write the failing test**

Create `src/pages/Portal.test.jsx` (mirror the mocking style of an existing page test such as `Contracts.test.jsx` — open it first):

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Portal from './Portal'

const createRequest = vi.fn()
const updateRequest = vi.fn()
const deleteRequest = vi.fn()
const notifyRequest = vi.fn().mockResolvedValue({})

vi.mock('../context/PortalContext', () => ({
  usePortalContext: () => ({
    requests: [
      { id: 'preq_1', supplierId: 's1', type: 'esg_questionnaire', title: 'Submit ESG', status: 'pending', message: 'm', dueDate: null },
    ],
    isLoading: false,
    createRequest,
    updateRequest,
    deleteRequest,
    notifyRequest,
  }),
}))

vi.mock('../context/SupplierContext', () => ({
  useSupplierContext: () => ({ suppliers: [{ id: 's1', name: 'Atlas Steelworks' }] }),
}))

function renderPortal() {
  return render(<MemoryRouter><Portal /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('Portal page', () => {
  it('lists requests with supplier name and status', () => {
    renderPortal()
    expect(screen.getByRole('heading', { name: 'Supplier Portal' })).toBeInTheDocument()
    expect(screen.getByText('Submit ESG')).toBeInTheDocument()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
  })

  it('opens the create modal from the New request button', () => {
    renderPortal()
    fireEvent.click(screen.getByRole('button', { name: /New request/i }))
    expect(screen.getByText('New supplier request')).toBeInTheDocument()
  })

  it('opens the slide-over when a request row is clicked', () => {
    renderPortal()
    fireEvent.click(screen.getByRole('button', { name: 'Submit ESG' }))
    expect(screen.getByRole('button', { name: /Mark submitted/i })).toBeInTheDocument()
  })

  it('filters by status', () => {
    renderPortal()
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'approved' } })
    expect(screen.queryByText('Submit ESG')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/Portal.test.jsx`
Expected: FAIL — cannot resolve `./Portal`.

- [ ] **Step 3: Write the page**

Create `src/pages/Portal.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import PortalRequestModal from '../components/ui/PortalRequestModal'
import PortalRequestSlideOver from '../components/ui/PortalRequestSlideOver'
import { usePortalContext } from '../context/PortalContext'
import { useSupplierContext } from '../context/SupplierContext'
import { filterRequests, PORTAL_STATUS_BADGE, PORTAL_TYPE_LABEL, PORTAL_STATUSES } from '../utils/portalSelectors'
import { formatDate } from '../utils/formatters'

export default function Portal() {
  const { requests, isLoading, createRequest, updateRequest, deleteRequest, notifyRequest } = usePortalContext()
  const { suppliers } = useSupplierContext()
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const displayed = filterRequests(requests, { status })
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? '—'

  function openSlideOver(request) {
    setSelectedId(request.id)
    setSlideOverOpen(true)
  }

  const liveSelected = selectedId ? requests.find((r) => r.id === selectedId) ?? null : null
  const liveSupplier = liveSelected ? suppliers.find((s) => s.id === liveSelected.supplierId) ?? null : null

  const columns = [
    {
      key: 'title',
      header: 'Request',
      render: (row) => (
        <button onClick={() => openSlideOver(row)} className="text-left font-medium text-accent-blue-light hover:underline">
          {row.title}
        </button>
      ),
    },
    {
      key: 'supplierId',
      header: 'Supplier',
      render: (row) => {
        const s = suppliers.find((s) => s.id === row.supplierId)
        return s ? (
          <Link to={`/suppliers/${s.id}`} className="text-accent-blue-light hover:underline">{s.name}</Link>
        ) : (
          '—'
        )
      },
    },
    { key: 'type', header: 'Type', render: (row) => PORTAL_TYPE_LABEL[row.type] ?? row.type },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={PORTAL_STATUS_BADGE[row.status] ?? 'muted'}>{row.status}</Badge>,
    },
    {
      key: 'dueDate',
      header: 'Due',
      render: (row) => (row.dueDate ? formatDate(row.dueDate) : <span className="text-text-muted">—</span>),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Supplier Portal"
        description="Create and track requests to your suppliers"
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <PlusCircle size={16} />
            New request
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm text-text-secondary">
          <span className="sr-only">Status</span>
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
          >
            <option value="">All Statuses</option>
            {PORTAL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        data={displayed}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        emptyMessage="No requests match your filters"
      />

      <PortalRequestSlideOver
        isOpen={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        request={liveSelected}
        supplier={liveSupplier}
        onUpdate={liveSelected ? (patch) => updateRequest(liveSelected.id, patch) : undefined}
        onNotify={liveSelected ? () => notifyRequest(liveSelected.id) : undefined}
        onDelete={
          liveSelected
            ? () => {
                deleteRequest(liveSelected.id)
                setSlideOverOpen(false)
              }
            : undefined
        }
      />

      <PortalRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        suppliers={suppliers}
        onSubmit={createRequest}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/pages/Portal.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Portal.jsx src/pages/Portal.test.jsx
git commit -m "feat(7c): add Portal page (filterable request table + modal + slide-over)"
```

---

### Task 12: Route the page and remove the placeholder

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx` (update the `/portal` assertion)

**Interfaces:**
- Consumes: `Portal` page (Task 11), `PortalProvider` (already wired via OrgScopedProviders).
- Produces: `/portal` renders the real `Portal` page.

- [ ] **Step 1: Update the App test for /portal**

In `src/App.test.jsx`, the existing block (around line 56-59) navigates to `/portal` and asserts the "Supplier Portal" heading. Keep the heading assertion (the real page also uses that title) and add an assertion for real page content. Replace the body of that test with:

```jsx
    window.history.pushState({}, '', '/portal')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Supplier Portal' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /New request/i })).toBeInTheDocument()
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — no "New request" button (still the placeholder).

- [ ] **Step 3: Wire the real route**

In `src/App.jsx`:
1. Add the import: `import Portal from './pages/Portal'`
2. Remove the `import PlaceholderPage from './pages/PlaceholderPage'` line.
3. Remove the `PLACEHOLDER_ROUTES` const block.
4. Remove the `{PLACEHOLDER_ROUTES.map(...)}` block.
5. Add the route alongside the other protected routes:

```jsx
              <Route path="/portal" element={<Portal />} />
```

The protected `<Route>` group should now read (excerpt):

```jsx
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="/portal" element={<Portal />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
```

> `PlaceholderPage.jsx` and its test stay in the repo (no longer routed). This keeps the component available and its standalone test green.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npx eslint src/App.jsx`
Expected: no NEW errors (no unused `PlaceholderPage` import). The repo's 9 accepted baseline lint errors are unrelated.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat(7c): route /portal to the real Portal page; drop the placeholder route"
```

---

### Task 13: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the API half**

Run: `npx vitest run api/`
Expected: PASS (all api tests, including the new portal-requests + updated org tests).

- [ ] **Step 2: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS (all src tests, including PortalContext, the components, Portal page, App).

- [ ] **Step 3: Lint the whole project**

Run: `npx eslint .`
Expected: only the 9 pre-existing accepted baseline errors (react-refresh / react-hooks). No new errors from Phase 7c files.

- [ ] **Step 4: Final commit (if any incidental fixes were needed)**

```bash
git add -A
git commit -m "test(7c): verify full suite green for Supplier Portal"
```

(Skip if nothing changed.)

---

## Self-Review

**Spec coverage:**
- Data model (PortalRequest + relation) → Task 1. ✓
- GET/POST + supplier-in-org validation (closes 7a #2 for this endpoint) → Task 3. ✓
- PATCH/DELETE + immutable id/orgId → Task 4. ✓
- Brevo notify to supplier.email + escaped HTML + 503/404/502 → Task 5. ✓
- Seed sample data + per-org re-key → Task 6. ✓
- seed/clear/reset wiring (child-first delete, parent-first insert) → Task 7. ✓
- PortalContext + provider stack + api.del → Task 8. ✓
- Create modal → Task 9; slide-over with status actions + notify + delete → Task 10; page (filter, table, no KPI cards, no AI) → Task 11. ✓
- Route swap + remove placeholder → Task 12. ✓
- Tests throughout + full-suite gate → every task + Task 13. ✓
- Non-goals respected: no external auth, no KPI cards, no AI draft, no overdue status, no file upload. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. The only deferred item is the live Neon migration (Task 1 note), consistent with the repo's other deferred live steps.

**Type consistency:** `type`/`status` vocabularies identical across Task 2 (selectors), Task 3/4 (API `TYPES`/`STATUSES`), and Task 6 seed data. `createRequest`/`updateRequest`/`deleteRequest`/`notifyRequest` signatures match between Task 8 (context), Task 10 (slide-over props via page), and Task 11 (page wiring). `api.del` defined in Task 8 before use. `PortalRequestModal.onSubmit` shape `{ supplierId, type, title, message, dueDate }` matches `createRequest` → POST body, and the POST handler coerces `dueDate` + defaults `type`/`status`.
