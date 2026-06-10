# Phase 6a: Backend Foundation + Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Neon Postgres + Prisma + a Vercel-functions REST API, seed it with the existing mock data, and swap the contexts/hooks to real fetches with unchanged consumer interfaces.

**Architecture:** Five Prisma models mirror the mockData shapes; `prisma/seed.js` ports the mock generators. A repo-root `api/` folder holds plain `(req, res)` Vercel functions using a Prisma singleton, all scoped to `ORG_ID = 'org_demo'`. The frontend gets a thin `apiClient`; the three CRUD contexts fetch on mount and POST/PATCH on mutate (same interfaces + `isLoading`); `useRisk`/`useEsg` fetch read-only; a global test fetch-stub routes `/api/*` to mockData-shaped JSON so the suite passes through the new boundary.

**Tech Stack:** Vite + React 19, Prisma 6 + @prisma/client, Neon Postgres, Vercel serverless functions (Node), Vitest + RTL + jsdom.

---

## Scene setting (read before starting)

- `DATABASE_URL` is already in `.env` (gitignored — NEVER commit it). Prisma CLI reads `.env` automatically.
- The spec is `docs/superpowers/specs/2026-06-10-phase6a-backend-database-design.md`.
- Key current files: `src/lib/mockData.js` (shapes + generators), `src/context/{Supplier,Contract,Spend,Chat}Context.jsx`, `src/hooks/{useSuppliers,useContracts,useSpend,useRisk,useEsg}.js`, `src/lib/apiClient.js` (doesn't exist yet), `src/test/setup.js` (currently just jest-dom), `vite.config.js` (vitest config with `setupFiles: './src/test/setup.js'`).
- mockData counts after seeding: **20 suppliers, 15 contracts, 20 risk assessments, 20 ESG responses, 42 spend records** (6 months × 7 suppliers).
- JSON serialization turns `Date` into ISO strings. UI code already tolerates both (`new Date(x)` everywhere; ISO strings sort lexicographically = chronologically). Tests that `toEqual` mockData with `Date` fields must change.
- Tasks 6–8 each bundle a swap WITH its dependent test updates so the suite is green at every commit.

Test runner: `npm test -- <file>` (vitest run). Full suite: `npm test` (currently 33 files / 214 tests, all green).

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `prisma/schema.prisma` | Create | 5 models mirroring mock shapes |
| `prisma/seed.js` | Create | Seeds Neon from mockData arrays |
| `.env.example` | Create | Documents DATABASE_URL |
| `package.json` | Modify | deps, prisma seed config, build script |
| `api/_lib/prisma.js` | Create | PrismaClient singleton |
| `api/_lib/org.js` | Create | `ORG_ID` constant (Clerk swap point) |
| `api/_lib/dates.js` | Create | `coerceDates` body helper |
| `api/suppliers/index.js` + `[id].js` | Create | GET/POST + PATCH |
| `api/contracts/index.js` + `[id].js` | Create | GET/POST + PATCH |
| `api/spend/index.js` + `[id].js` | Create | GET/POST + PATCH |
| `api/risk/index.js`, `api/esg/index.js` | Create | GET only |
| `api/**/**.test.js` | Create | Handler tests w/ mocked prisma |
| `vercel.json` | Create | SPA rewrite |
| `src/lib/apiClient.js` (+ test) | Create | fetch wrapper |
| `src/test/mockApi.js` | Create | global fetch stub for tests |
| `src/test/setup.js` | Modify | install stub per-test |
| `src/context/SupplierContext.jsx` (+ test) | Modify | fetch-backed |
| `src/hooks/useSuppliers.js` | Modify | wraps context |
| `src/context/ContractContext.jsx`, `SpendContext.jsx` (+ tests) | Modify | fetch-backed |
| `src/hooks/useRisk.js`, `useEsg.js` | Modify | fetch-backed |
| `src/context/ChatContext.jsx` (+ test) | Modify | hooks + dataRef, no mockData |
| `src/pages/SupplierDetail.jsx` (+ test) | Modify | loading guard, hooks for risk/esg tabs |
| `src/pages/Risk.jsx` (+ test) | Modify | suppliers from context |
| `src/hooks/dataHooks.test.jsx`, page/modal tests | Modify | async-aware assertions |

---

### Task 1: Prisma schema, migration, and seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.js`, `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install @prisma/client
npm install -D prisma
```

- [ ] **Step 2: Write the schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Supplier {
  id          String   @id
  orgId       String   @default("org_demo")
  name        String
  email       String
  phone       String?
  country     String?
  category    String?
  status      String   @default("active")
  riskScore   Int      @default(0)
  esgScore    Int      @default(0)
  website     String?
  description String?
  logoUrl     String?
  onboardedAt DateTime @default(now())
  createdAt   DateTime @default(now())

  contracts       Contract[]
  riskAssessments RiskAssessment[]
  esgResponses    EsgResponse[]
  spendRecords    SpendRecord[]
}

model Contract {
  id         String    @id
  orgId      String    @default("org_demo")
  supplierId String
  supplier   Supplier  @relation(fields: [supplierId], references: [id])
  title      String
  status     String    @default("draft")
  value      Int
  currency   String    @default("USD")
  startDate  DateTime?
  endDate    DateTime?
  autoRenew  Boolean   @default(false)
  fileUrl    String?
  aiSummary  String?
  terms      String?
  createdBy  String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model RiskAssessment {
  id               String   @id
  orgId            String   @default("org_demo")
  supplierId       String
  supplier         Supplier @relation(fields: [supplierId], references: [id])
  score            Int
  level            String
  financialRisk    Int
  complianceRisk   Int
  operationalRisk  Int
  geopoliticalRisk Int
  aiAnalysis       String?
  assessedAt       DateTime @default(now())
  assessedBy       String?
}

model EsgResponse {
  id            String   @id
  orgId         String   @default("org_demo")
  supplierId    String
  supplier      Supplier @relation(fields: [supplierId], references: [id])
  score         Int
  environmental Int
  social        Int
  governance    Int
  answers       Json     @default("{}")
  aiSuggestions String?
  submittedAt   DateTime @default(now())
}

model SpendRecord {
  id          String   @id
  orgId       String   @default("org_demo")
  supplierId  String
  supplier    Supplier @relation(fields: [supplierId], references: [id])
  amount      Int
  currency    String   @default("USD")
  category    String
  description String?
  date        DateTime
  invoiceRef  String?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 3: Create `.env.example`**

```
# Neon Postgres connection string (get yours at console.neon.tech)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

- [ ] **Step 4: Update package.json**

Add to the root object (sibling of "scripts"):

```json
  "prisma": {
    "seed": "node prisma/seed.js"
  },
```

and change the build script from `"build": "vite build"` to:

```json
    "build": "prisma generate && prisma migrate deploy && vite build",
```

- [ ] **Step 5: Run the initial migration against Neon**

Run: `npx prisma migrate dev --name init`
Expected: creates `prisma/migrations/<timestamp>_init/` and prints "Your database is now in sync with your schema". (This hits the real Neon database via `.env` — that's intended.)

- [ ] **Step 6: Write the seed script**

Create `prisma/seed.js`:

```js
import { PrismaClient } from '@prisma/client'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords } from '../src/lib/mockData.js'

const prisma = new PrismaClient()

async function main() {
  // FK order: children first
  await prisma.spendRecord.deleteMany()
  await prisma.esgResponse.deleteMany()
  await prisma.riskAssessment.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.supplier.deleteMany()

  await prisma.supplier.createMany({ data: suppliers })
  await prisma.contract.createMany({ data: contracts })
  await prisma.riskAssessment.createMany({ data: riskAssessments })
  await prisma.esgResponse.createMany({ data: esgResponses })
  await prisma.spendRecord.createMany({ data: spendRecords })

  console.log(
    `Seeded ${suppliers.length} suppliers, ${contracts.length} contracts, ` +
      `${riskAssessments.length} risk assessments, ${esgResponses.length} ESG responses, ` +
      `${spendRecords.length} spend records`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 7: Run the seed**

Run: `npx prisma db seed`
Expected output: `Seeded 20 suppliers, 15 contracts, 20 risk assessments, 20 ESG responses, 42 spend records`

- [ ] **Step 8: Run the full test suite (nothing should be affected yet)**

Run: `npm test`
Expected: 33 files / 214 tests PASS

- [ ] **Step 9: Commit (verify `.env` is NOT staged — `git status` must not list it)**

```bash
git add prisma .env.example package.json package-lock.json
git commit -m "feat: add Prisma schema, Neon migration, and mock-data seed"
```

---

### Task 2: API _lib helpers + suppliers endpoints

**Files:**
- Create: `api/_lib/prisma.js`, `api/_lib/org.js`, `api/_lib/dates.js`
- Create: `api/suppliers/index.js`, `api/suppliers/[id].js`
- Create: `api/suppliers/suppliers.test.js`

- [ ] **Step 1: Write the failing handler tests**

Create `api/suppliers/suppliers.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    supplier: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import listHandler from './index.js'
import idHandler from './[id].js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/suppliers', () => {
  it('returns the org-scoped supplier list', async () => {
    const rows = [{ id: 'sup_1', name: 'Atlas Steelworks' }]
    prisma.supplier.findMany.mockResolvedValue(rows)
    const res = mockRes()
    await listHandler({ method: 'GET' }, res)
    expect(prisma.supplier.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_demo' },
      orderBy: { createdAt: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(rows)
  })
})

describe('POST /api/suppliers', () => {
  it('creates a supplier with generated id, orgId, and defaults', async () => {
    prisma.supplier.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      { method: 'POST', body: { name: 'New Co', email: 'a@b.com', country: 'France', category: 'Logistics', status: 'active' } },
      res
    )
    expect(res.status).toHaveBeenCalledWith(201)
    const created = prisma.supplier.create.mock.calls[0][0].data
    expect(created.id).toMatch(/^sup_/)
    expect(created.orgId).toBe('org_demo')
    expect(created.riskScore).toBe(0)
    expect(created.name).toBe('New Co')
  })

  it('rejects a body missing name or email with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', body: { name: 'No Email' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.supplier.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/suppliers/:id', () => {
  it('updates the supplier and returns the updated record', async () => {
    prisma.supplier.update.mockResolvedValue({ id: 'sup_1', status: 'suspended' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'sup_1' }, body: { status: 'suspended' } }, res)
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 'sup_1' },
      data: { status: 'suspended' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 405 for unsupported methods', async () => {
    const res = mockRes()
    await idHandler({ method: 'DELETE', query: { id: 'sup_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api/suppliers/suppliers.test.js`
Expected: FAIL — cannot find module `./index.js`

- [ ] **Step 3: Implement the _lib helpers**

Create `api/_lib/prisma.js`:

```js
import { PrismaClient } from '@prisma/client'

// Cache on globalThis so dev hot-reload doesn't exhaust DB connections.
export const prisma = globalThis.__prisma ?? new PrismaClient()
if (!globalThis.__prisma) globalThis.__prisma = prisma
```

Create `api/_lib/org.js`:

```js
// Single-org demo scoping. Phase 6b (Clerk) replaces this with the
// authenticated organization id.
export const ORG_ID = 'org_demo'
```

Create `api/_lib/dates.js`:

```js
// JSON bodies carry dates as strings (often yyyy-mm-dd from <input type="date">).
// Prisma DateTime columns need Date objects; empty strings mean "not set".
export function coerceDates(body, keys) {
  const out = { ...body }
  for (const key of keys) {
    if (out[key] === '' || out[key] == null) {
      delete out[key]
      continue
    }
    out[key] = new Date(out[key])
  }
  return out
}
```

- [ ] **Step 4: Implement the suppliers handlers**

Create `api/suppliers/index.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const suppliers = await prisma.supplier.findMany({
        where: { orgId: ORG_ID },
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
          orgId: ORG_ID,
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
```

Create `api/suppliers/[id].js`:

```js
import { prisma } from '../_lib/prisma.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- api/suppliers/suppliers.test.js`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add api
git commit -m "feat: add API lib helpers and suppliers endpoints"
```

---

### Task 3: Contracts + spend endpoints

**Files:**
- Create: `api/contracts/index.js`, `api/contracts/[id].js`, `api/contracts/contracts.test.js`
- Create: `api/spend/index.js`, `api/spend/[id].js`, `api/spend/spend.test.js`

- [ ] **Step 1: Write the failing tests**

Create `api/contracts/contracts.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    contract: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import listHandler from './index.js'
import idHandler from './[id].js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('contracts endpoints', () => {
  it('GET returns the org-scoped contract list', async () => {
    prisma.contract.findMany.mockResolvedValue([])
    const res = mockRes()
    await listHandler({ method: 'GET' }, res)
    expect(prisma.contract.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_demo' },
      orderBy: { createdAt: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST coerces yyyy-mm-dd dates to Date objects', async () => {
    prisma.contract.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      {
        method: 'POST',
        body: { title: 'Deal', supplierId: 'sup_1', value: 1000, startDate: '2026-01-12', endDate: '' },
      },
      res
    )
    const created = prisma.contract.create.mock.calls[0][0].data
    expect(created.startDate).toBeInstanceOf(Date)
    expect('endDate' in created).toBe(false)
    expect(created.id).toMatch(/^con_/)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing title/supplierId/value with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', body: { title: 'No supplier' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('PATCH coerces dates and updates by id', async () => {
    prisma.contract.update.mockResolvedValue({ id: 'con_1' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'con_1' }, body: { endDate: '2026-07-22' } }, res)
    const data = prisma.contract.update.mock.calls[0][0].data
    expect(data.endDate).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
```

Create `api/spend/spend.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    spendRecord: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import listHandler from './index.js'
import idHandler from './[id].js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('spend endpoints', () => {
  it('GET returns the org-scoped spend list', async () => {
    prisma.spendRecord.findMany.mockResolvedValue([])
    const res = mockRes()
    await listHandler({ method: 'GET' }, res)
    expect(prisma.spendRecord.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_demo' },
      orderBy: { date: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST creates a record with generated id and coerced date', async () => {
    prisma.spendRecord.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      { method: 'POST', body: { supplierId: 'sup_1', amount: 500, category: 'Logistics', date: '2026-06-01' } },
      res
    )
    const created = prisma.spendRecord.create.mock.calls[0][0].data
    expect(created.id).toMatch(/^spend_/)
    expect(created.date).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing supplierId/amount/category/date with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', body: { amount: 500 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('PATCH updates by id', async () => {
    prisma.spendRecord.update.mockResolvedValue({ id: 'spend_1', amount: 999 })
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'spend_1' }, body: { amount: 999 } }, res)
    expect(prisma.spendRecord.update).toHaveBeenCalledWith({
      where: { id: 'spend_1' },
      data: { amount: 999 },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api/contracts/contracts.test.js api/spend/spend.test.js`
Expected: FAIL — cannot find modules

- [ ] **Step 3: Implement contracts handlers**

Create `api/contracts/index.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { coerceDates } from '../_lib/dates.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const contracts = await prisma.contract.findMany({
        where: { orgId: ORG_ID },
        orderBy: { createdAt: 'asc' },
      })
      return res.status(200).json(contracts)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!body.title || !body.supplierId || body.value == null) {
        return res.status(400).json({ error: 'title, supplierId, and value are required' })
      }
      const contract = await prisma.contract.create({
        data: {
          ...coerceDates(body, ['startDate', 'endDate']),
          id: `con_${Date.now()}`,
          orgId: ORG_ID,
          createdBy: 'user_demo_admin',
        },
      })
      return res.status(201).json(contract)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

Create `api/contracts/[id].js`:

```js
import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
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
```

- [ ] **Step 4: Implement spend handlers**

Create `api/spend/index.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { coerceDates } from '../_lib/dates.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const records = await prisma.spendRecord.findMany({
        where: { orgId: ORG_ID },
        orderBy: { date: 'asc' },
      })
      return res.status(200).json(records)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!body.supplierId || body.amount == null || !body.category || !body.date) {
        return res.status(400).json({ error: 'supplierId, amount, category, and date are required' })
      }
      const record = await prisma.spendRecord.create({
        data: {
          ...coerceDates(body, ['date']),
          id: `spend_${Date.now()}`,
          orgId: ORG_ID,
          createdAt: new Date(),
        },
      })
      return res.status(201).json(record)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

Create `api/spend/[id].js`:

```js
import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- api/contracts/contracts.test.js api/spend/spend.test.js`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add api/contracts api/spend
git commit -m "feat: add contracts and spend API endpoints"
```

---

### Task 4: Risk + ESG endpoints and vercel.json

**Files:**
- Create: `api/risk/index.js`, `api/esg/index.js`, `api/readonly.test.js`
- Create: `vercel.json`

- [ ] **Step 1: Write the failing tests**

Create `api/readonly.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./_lib/prisma.js', () => ({
  prisma: {
    riskAssessment: { findMany: vi.fn() },
    esgResponse: { findMany: vi.fn() },
  },
}))

import riskHandler from './risk/index.js'
import esgHandler from './esg/index.js'
import { prisma } from './_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('read-only endpoints', () => {
  it('GET /api/risk returns org-scoped assessments', async () => {
    prisma.riskAssessment.findMany.mockResolvedValue([{ id: 'risk_1' }])
    const res = mockRes()
    await riskHandler({ method: 'GET' }, res)
    expect(prisma.riskAssessment.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_demo' },
      orderBy: { assessedAt: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('GET /api/esg returns org-scoped responses', async () => {
    prisma.esgResponse.findMany.mockResolvedValue([{ id: 'esg_1' }])
    const res = mockRes()
    await esgHandler({ method: 'GET' }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('rejects non-GET with 405', async () => {
    const res = mockRes()
    await riskHandler({ method: 'POST' }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api/readonly.test.js`
Expected: FAIL — cannot find modules

- [ ] **Step 3: Implement the handlers**

Create `api/risk/index.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const assessments = await prisma.riskAssessment.findMany({
        where: { orgId: ORG_ID },
        orderBy: { assessedAt: 'asc' },
      })
      return res.status(200).json(assessments)
    }
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

Create `api/esg/index.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const responses = await prisma.esgResponse.findMany({
        where: { orgId: ORG_ID },
        orderBy: { submittedAt: 'asc' },
      })
      return res.status(200).json(responses)
    }
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

- [ ] **Step 4: Create vercel.json**

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- api/readonly.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add api/risk api/esg api/readonly.test.js vercel.json
git commit -m "feat: add read-only risk/esg endpoints and SPA rewrite config"
```

---

### Task 5: apiClient + test fetch stub

**Files:**
- Create: `src/lib/apiClient.js`, `src/lib/apiClient.test.js`, `src/test/mockApi.js`
- Modify: `src/test/setup.js`

- [ ] **Step 1: Write the failing apiClient tests**

Create `src/lib/apiClient.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { api } from './apiClient'

describe('apiClient', () => {
  it('GET parses JSON from the response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ id: 1 }] })))
    expect(await api.get('/api/suppliers')).toEqual([{ id: 1 }])
  })

  it('POST sends a JSON body with content-type header', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 'x' }) }))
    vi.stubGlobal('fetch', fetchMock)
    await api.post('/api/suppliers', { name: 'A' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/suppliers')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ name: 'A' })
  })

  it('throws the server error message on non-OK responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'name is required' }) })))
    await expect(api.post('/api/suppliers', {})).rejects.toThrow('name is required')
  })
})
```

- [ ] **Step 2: Run to verify failure, then implement**

Run: `npm test -- src/lib/apiClient.test.js` → FAIL (cannot find module)

Create `src/lib/apiClient.js`:

```js
async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
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

Run: `npm test -- src/lib/apiClient.test.js` → PASS (3 tests)

- [ ] **Step 3: Create the global test fetch stub**

Create `src/test/mockApi.js`:

```js
import { vi } from 'vitest'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords } from '../lib/mockData'

// Serializes Date fields to ISO strings — the same shape the real API returns.
const toJson = (data) => JSON.parse(JSON.stringify(data))

let counter = 0

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

const COLLECTIONS = {
  '/api/suppliers': { data: suppliers, prefix: 'sup' },
  '/api/contracts': { data: contracts, prefix: 'con' },
  '/api/spend': { data: spendRecords, prefix: 'spend' },
}

export function createMockFetch() {
  return vi.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = options.body ? JSON.parse(options.body) : null

    if (method === 'GET') {
      if (url === '/api/risk') return jsonResponse(toJson(riskAssessments))
      if (url === '/api/esg') return jsonResponse(toJson(esgResponses))
      if (COLLECTIONS[url]) return jsonResponse(toJson(COLLECTIONS[url].data))
    }
    if (method === 'POST' && COLLECTIONS[url]) {
      counter += 1
      return jsonResponse(
        {
          orgId: 'org_demo',
          riskScore: 0,
          esgScore: 0,
          createdAt: new Date().toISOString(),
          ...body,
          id: `${COLLECTIONS[url].prefix}_test_${counter}`,
        },
        201
      )
    }
    if (method === 'PATCH') {
      const match = url.match(/^\/api\/(?:suppliers|contracts|spend)\/(.+)$/)
      if (match) return jsonResponse({ ...body, id: match[1] })
    }
    return jsonResponse({ error: `mockApi: unhandled ${method} ${url}` }, 500)
  })
}
```

- [ ] **Step 4: Register the stub in the vitest setup**

Replace `src/test/setup.js` with:

```js
import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'
import { createMockFetch } from './mockApi'

beforeEach(() => {
  vi.stubGlobal('fetch', createMockFetch())
})
```

(Tests that need custom fetch behavior — like apiClient.test.js — stub fetch again inside the test, which wins because it runs after the setup hook.)

- [ ] **Step 5: Run the full suite — nothing consumes fetch yet, so everything must still pass**

Run: `npm test`
Expected: all files PASS (the stub is installed but dormant)

- [ ] **Step 6: Commit**

```bash
git add src/lib/apiClient.js src/lib/apiClient.test.js src/test/mockApi.js src/test/setup.js
git commit -m "feat: add apiClient and global test fetch stub"
```

---

### Task 6: Swap SupplierContext to the API (with all dependent test updates)

**Files:**
- Modify: `src/context/SupplierContext.jsx`, `src/context/SupplierContext.test.jsx`
- Modify: `src/hooks/useSuppliers.js`, `src/hooks/dataHooks.test.jsx`
- Modify: `src/pages/SupplierDetail.jsx`, `src/pages/SupplierDetail.test.jsx`
- Modify: `src/pages/Suppliers.test.jsx`, `src/components/ui/ContractModal.test.jsx`, `src/components/ui/SpendModal.test.jsx` (and `src/components/ui/SupplierModal.test.jsx` only if it renders SupplierProvider)

- [ ] **Step 1: Rewrite SupplierContext**

Replace `src/context/SupplierContext.jsx` with:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const SupplierContext = createContext(null)

export function SupplierProvider({ children }) {
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/suppliers')
      .then((data) => {
        if (!cancelled) setSuppliers(data)
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

  function addSupplier(data) {
    api
      .post('/api/suppliers', data)
      .then((created) => setSuppliers((prev) => [...prev, created]))
      .catch((e) => setError(e))
  }

  function updateSupplier(id, data) {
    api
      .patch(`/api/suppliers/${id}`, data)
      .then((updated) => setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s))))
      .catch((e) => setError(e))
  }

  function setSupplierStatus(id, status) {
    updateSupplier(id, { status })
  }

  return (
    <SupplierContext.Provider
      value={{ suppliers, isLoading, error, addSupplier, updateSupplier, setSupplierStatus }}
    >
      {children}
    </SupplierContext.Provider>
  )
}

export function useSupplierContext() {
  const ctx = useContext(SupplierContext)
  if (!ctx) throw new Error('useSupplierContext must be used inside SupplierProvider')
  return ctx
}
```

- [ ] **Step 2: Rewrite useSuppliers to wrap the context**

Replace `src/hooks/useSuppliers.js` with:

```js
import { useSupplierContext } from '../context/SupplierContext'

export function useSuppliers() {
  const { suppliers, isLoading, error } = useSupplierContext()
  return { suppliers: isLoading ? null : suppliers, isLoading, error }
}
```

(This also fixes a latent quirk: the old hook read mockData directly, so the Dashboard never saw suppliers added in-session.)

- [ ] **Step 3: Update SupplierContext.test.jsx for async loading**

Open `src/context/SupplierContext.test.jsx`. Apply this transformation to every test (the file's existing structure mirrors ContractContext.test.jsx):
- Add `waitFor` to the `@testing-library/react` import.
- The "seeds" test becomes async and awaits the fetch:

```jsx
  it('loads suppliers from the API on mount', async () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length)
    expect(result.current.suppliers[0].id).toBe(seedSuppliers[0].id)
  })
```

- Every test that calls `addSupplier` / `updateSupplier` / `setSupplierStatus` first awaits the initial load (`await waitFor(() => expect(result.current.isLoading).toBe(false))`), then wraps the mutation in `act(...)`, then awaits the effect, e.g.:

```jsx
  it('addSupplier appends the API-created supplier', async () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.addSupplier({ name: 'New Co', email: 'a@b.com' }))
    await waitFor(() => expect(result.current.suppliers).toHaveLength(seedSuppliers.length + 1))
    expect(result.current.suppliers.at(-1).name).toBe('New Co')
    expect(result.current.suppliers.at(-1).id).toBeTruthy()
  })

  it('updateSupplier merges the API response into the matching supplier', async () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.suppliers[0].id
    act(() => result.current.updateSupplier(id, { name: 'Renamed' }))
    await waitFor(() => expect(result.current.suppliers.find((s) => s.id === id).name).toBe('Renamed'))
  })
```

- The "throws outside provider" test stays unchanged.

- [ ] **Step 4: Update the useSuppliers test in dataHooks.test.jsx**

In `src/hooks/dataHooks.test.jsx`:
- Add `import { SupplierProvider } from '../context/SupplierContext'`.
- Replace the `useSuppliers` test with:

```jsx
  it('useSuppliers resolves with API-loaded suppliers', async () => {
    const wrapper = ({ children }) => <SupplierProvider>{children}</SupplierProvider>
    const { result } = renderHook(() => useSuppliers(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suppliers).toHaveLength(suppliers.length)
    expect(result.current.suppliers[0].id).toBe(suppliers[0].id)
  })
```

(If the old test asserted `toEqual(suppliers)`, the length+id form replaces it — fetched JSON has ISO-string dates, mockData has Date objects.)

- [ ] **Step 5: Add the loading guard to SupplierDetail**

In `src/pages/SupplierDetail.jsx`:
- Add to imports: `import LoadingSpinner from '../components/ui/LoadingSpinner'`
- Destructure `isLoading` from the supplier context:

```jsx
  const { suppliers, updateSupplier, setSupplierStatus, isLoading } = useSupplierContext()
```

- Immediately BEFORE the existing `if (!supplier) {` block, add:

```jsx
  if (isLoading) {
    return <LoadingSpinner className="py-24" />
  }
```

- [ ] **Step 6: Update page/modal tests that assert seeded supplier data synchronously**

The fetch stub resolves after first render, so the first seeded-data assertion in each affected test must await. Apply mechanically:

- `src/pages/Suppliers.test.jsx` — in each test, convert the FIRST assertion that references a seeded supplier (e.g. `screen.getByText('Atlas Steelworks')`) from `getBy*` to `await screen.findBy*`. Subsequent assertions in the same test can stay `getBy*`. Tests that begin with `fireEvent.change(screen.getByPlaceholderText('Search suppliers...'))` don't need changes for the input itself (it renders immediately) but DO need the seeded-row assertion awaited.
- `src/pages/SupplierDetail.test.jsx` — in each test, the first reference to supplier content awaits: `expect(await screen.findByText('Atlas Steelworks')).toBeInTheDocument()` (or `await screen.findByRole(...)` where the first assertion is a role query). For tab tests, await the supplier name first, then `fireEvent.click` the tab. The "not found" test becomes:

```jsx
  it('shows a not-found message for an unknown supplier id', async () => {
    renderDetail('sup_unknown_999')
    expect(await screen.findByRole('heading', { name: 'Supplier not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Suppliers/i })).toBeInTheDocument()
  })
```

- `src/components/ui/ContractModal.test.jsx` and `src/components/ui/SpendModal.test.jsx` — any test that `fireEvent.change`s the Supplier `<select>` to `'sup_1'` must first wait for the options to load:

```jsx
    await screen.findByRole('option', { name: 'Atlas Steelworks' })
```

(insert that line before the first `fireEvent.change(screen.getByLabelText('Supplier'), ...)` in each affected test, and make the test `async`). The `defaultSupplierId` pre-fill test in SpendModal.test.jsx also needs the option await before asserting `toHaveValue('sup_1')`.
- `src/components/ui/SupplierModal.test.jsx` — check whether it renders `SupplierProvider`; if it doesn't (the modal edits its own fields, no supplier select), leave it untouched.

- [ ] **Step 7: Run all affected test files**

Run: `npm test -- src/context/SupplierContext.test.jsx src/hooks/dataHooks.test.jsx src/pages/Suppliers.test.jsx src/pages/SupplierDetail.test.jsx src/components/ui/ContractModal.test.jsx src/components/ui/SpendModal.test.jsx`
Expected: PASS

- [ ] **Step 8: Run the FULL suite**

Run: `npm test`
Expected: PASS. If another file fails on a seeded-supplier sync assertion (e.g. App.test.jsx or Dashboard.test.jsx), apply the same findBy/waitFor conversion there — but both already await their first assertions, so they're expected to pass.

- [ ] **Step 9: Commit**

```bash
git add src/context/SupplierContext.jsx src/context/SupplierContext.test.jsx src/hooks/useSuppliers.js src/hooks/dataHooks.test.jsx src/pages/SupplierDetail.jsx src/pages/SupplierDetail.test.jsx src/pages/Suppliers.test.jsx src/components/ui/ContractModal.test.jsx src/components/ui/SpendModal.test.jsx
git commit -m "feat: SupplierContext fetches from the API; async-aware tests"
```

(Include SupplierModal.test.jsx in the add list only if it was touched.)

---

### Task 7: Swap ContractContext + SpendContext to the API

**Files:**
- Modify: `src/context/ContractContext.jsx`, `src/context/ContractContext.test.jsx`
- Modify: `src/context/SpendContext.jsx`, `src/context/SpendContext.test.jsx`
- Modify: `src/hooks/dataHooks.test.jsx`
- Modify: `src/pages/Contracts.test.jsx`, `src/pages/Spend.test.jsx`, `src/pages/SupplierDetail.test.jsx` (contract/spend tab assertions), `src/pages/Dashboard.test.jsx` (only if a sync seeded assertion fails)

- [ ] **Step 1: Rewrite ContractContext**

Replace `src/context/ContractContext.jsx` with:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const ContractContext = createContext(null)

export function ContractProvider({ children }) {
  const [contracts, setContracts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/contracts')
      .then((data) => {
        if (!cancelled) setContracts(data)
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

  function addContract(data) {
    api
      .post('/api/contracts', data)
      .then((created) => setContracts((prev) => [...prev, created]))
      .catch((e) => setError(e))
  }

  function updateContract(id, data) {
    api
      .patch(`/api/contracts/${id}`, data)
      .then((updated) => setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c))))
      .catch((e) => setError(e))
  }

  function setContractStatus(id, status) {
    updateContract(id, { status })
  }

  return (
    <ContractContext.Provider
      value={{ contracts, isLoading, error, addContract, updateContract, setContractStatus }}
    >
      {children}
    </ContractContext.Provider>
  )
}

export function useContractContext() {
  const ctx = useContext(ContractContext)
  if (!ctx) throw new Error('useContractContext must be used inside ContractProvider')
  return ctx
}
```

- [ ] **Step 2: Rewrite SpendContext**

Replace `src/context/SpendContext.jsx` with:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const SpendContext = createContext(null)

export function SpendProvider({ children }) {
  const [spendRecords, setSpendRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/spend')
      .then((data) => {
        if (!cancelled) setSpendRecords(data)
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

  function addSpendRecord(data) {
    api
      .post('/api/spend', data)
      .then((created) => setSpendRecords((prev) => [...prev, created]))
      .catch((e) => setError(e))
  }

  function updateSpendRecord(id, data) {
    api
      .patch(`/api/spend/${id}`, data)
      .then((updated) => setSpendRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r))))
      .catch((e) => setError(e))
  }

  return (
    <SpendContext.Provider value={{ spendRecords, isLoading, error, addSpendRecord, updateSpendRecord }}>
      {children}
    </SpendContext.Provider>
  )
}

export function useSpendContext() {
  const ctx = useContext(SpendContext)
  if (!ctx) throw new Error('useSpendContext must be used inside SpendProvider')
  return ctx
}
```

- [ ] **Step 3: Update both context test files for async loading**

Apply the same transformation as Task 6 Step 3 to `src/context/ContractContext.test.jsx` and `src/context/SpendContext.test.jsx`: add `waitFor` to imports; the seeding test awaits `isLoading === false` then asserts length + first id; mutation tests await initial load, `act(...)` the mutation, then `await waitFor(...)` the state change. SpendModal-shaped POST bodies (`date: new Date('2026-06-01')`) serialize fine through the stub. The "throws outside provider" tests stay unchanged. Keep `setContractStatus` coverage: await load, `act(() => result.current.setContractStatus(id, 'expired'))`, then `await waitFor(() => expect(result.current.contracts.find((c) => c.id === id).status).toBe('expired'))`.

- [ ] **Step 4: Update useContracts/useSpend/useRisk/useEsg assertions in dataHooks.test.jsx**

The `useContracts` and `useSpend` tests currently assert `toEqual(contracts)` / `toEqual(spendRecords)` — fetched JSON has ISO-string dates, so replace those assertions with length + first-id form:

```jsx
    expect(result.current.contracts).toHaveLength(contracts.length)
    expect(result.current.contracts[0].id).toBe(contracts[0].id)
```

```jsx
    expect(result.current.spendRecords).toHaveLength(spendRecords.length)
    expect(result.current.spendRecords[0].id).toBe(spendRecords[0].id)
```

(Leave the `useRisk`/`useEsg` tests untouched in this task — they still read mockData until Task 8.)

- [ ] **Step 5: Update page tests with sync seeded-data assertions**

Same mechanical conversion as Task 6 Step 6:
- `src/pages/Contracts.test.jsx` — first seeded-contract assertion per test → `await screen.findByText(...)`. The slide-over test clicks a contract title: await the title first, then click.
- `src/pages/Spend.test.jsx` — first seeded assertion per test → `findBy*`. The stat-card totals test computes from mockData and asserts rendered text — await the first stat value. The add-record test already awaits the final assertion; it needs the initial `findByText(spendRecords[0].invoiceRef)`-style await only if it asserts seeded content before interacting (check each test; the modal-open flow itself is immediate).
- `src/pages/SupplierDetail.test.jsx` — the Contracts tab test (asserts `'Master Supply Agreement — Atlas Steelworks'`) and Spend tab tests (assert `'Total Spend: $68,550'` / 6 rows) must await those assertions (`findByText`) after clicking the tab.
- `src/pages/Dashboard.test.jsx` — already waitFor-based; touch only if the full-suite run shows a failure.

- [ ] **Step 6: Run affected files, then the FULL suite**

Run: `npm test -- src/context/ContractContext.test.jsx src/context/SpendContext.test.jsx src/hooks/dataHooks.test.jsx src/pages/Contracts.test.jsx src/pages/Spend.test.jsx src/pages/SupplierDetail.test.jsx`
Expected: PASS

Run: `npm test`
Expected: PASS (fix any straggler with the same findBy conversion)

- [ ] **Step 7: Commit**

```bash
git add src/context/ContractContext.jsx src/context/ContractContext.test.jsx src/context/SpendContext.jsx src/context/SpendContext.test.jsx src/hooks/dataHooks.test.jsx src/pages/Contracts.test.jsx src/pages/Spend.test.jsx src/pages/SupplierDetail.test.jsx
git commit -m "feat: ContractContext and SpendContext fetch from the API"
```

(Add Dashboard.test.jsx to the list if it was touched.)

---

### Task 8: Swap useRisk/useEsg to the API; wean ChatContext, Risk page, and SupplierDetail tabs off mockData

**Files:**
- Modify: `src/hooks/useRisk.js`, `src/hooks/useEsg.js`, `src/hooks/dataHooks.test.jsx`
- Modify: `src/context/ChatContext.jsx`
- Modify: `src/pages/Risk.jsx`, `src/pages/Risk.test.jsx`
- Modify: `src/pages/SupplierDetail.jsx`, `src/pages/SupplierDetail.test.jsx`

- [ ] **Step 1: Rewrite useRisk and useEsg**

Replace `src/hooks/useRisk.js` with:

```js
import { useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

export function useRisk() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/risk')
      .then((d) => {
        if (!cancelled) setData(d)
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

  return { riskAssessments: data, isLoading, error }
}
```

Replace `src/hooks/useEsg.js` with the identical pattern for `/api/esg`:

```js
import { useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

export function useEsg() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/esg')
      .then((d) => {
        if (!cancelled) setData(d)
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

  return { esgResponses: data, isLoading, error }
}
```

In `src/hooks/dataHooks.test.jsx`, the `useRisk`/`useEsg` tests assert `toEqual(riskAssessments)` / `toEqual(esgResponses)` — convert both to length + first-id form (ISO dates).

- [ ] **Step 2: Wean ChatContext off mockData with a live-data ref**

Replace `src/context/ChatContext.jsx` with:

```jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSupplierContext } from './SupplierContext'
import { useContractContext } from './ContractContext'
import { useSpendContext } from './SpendContext'
import { useRisk } from '../hooks/useRisk'
import { useEsg } from '../hooks/useEsg'
import { getAssistantReply } from '../lib/assistantEngine'

const ChatContext = createContext(null)

const GREETING_TEXT =
  "Hi! I'm your ProcureIQ assistant. Ask me about supplier risk, spend, expiring contracts, ESG performance, or any supplier by name."

function makeGreeting() {
  return { id: 'msg_0', role: 'assistant', text: GREETING_TEXT, createdAt: new Date() }
}

export function ChatProvider({ children }) {
  const { suppliers } = useSupplierContext()
  const { contracts } = useContractContext()
  const { spendRecords } = useSpendContext()
  const { riskAssessments } = useRisk()
  const { esgResponses } = useEsg()
  const [messages, setMessages] = useState(() => [makeGreeting()])
  const [isThinking, setIsThinking] = useState(false)
  const counterRef = useRef(0)
  const timerRef = useRef(null)

  // Replies read this ref at reply time (600ms after send), so data that
  // finished loading between send and reply is included.
  const dataRef = useRef({})
  dataRef.current = {
    suppliers,
    contracts,
    spendRecords,
    riskAssessments: riskAssessments ?? [],
    esgResponses: esgResponses ?? [],
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    counterRef.current += 1
    const userMessage = { id: `msg_${counterRef.current}`, role: 'user', text: trimmed, createdAt: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setIsThinking(true)
    timerRef.current = setTimeout(() => {
      const reply = getAssistantReply(trimmed, dataRef.current)
      counterRef.current += 1
      setMessages((prev) => [
        ...prev,
        { id: `msg_${counterRef.current}`, role: 'assistant', text: reply.text, createdAt: new Date() },
      ])
      setIsThinking(false)
    }, 600)
  }

  function clearChat() {
    clearTimeout(timerRef.current)
    setIsThinking(false)
    setMessages([makeGreeting()])
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage, isThinking, clearChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used inside ChatProvider')
  return ctx
}
```

(`ChatContext.test.jsx` and `AIAssistant.test.jsx` should keep passing unchanged: the data-backed reply assertions use `waitFor` with the 600ms delay, by which time the stubbed fetches have long resolved.)

- [ ] **Step 3: Switch Risk.jsx to context suppliers**

In `src/pages/Risk.jsx`:
- Replace `import { suppliers } from '../lib/mockData'` with `import { useSupplierContext } from '../context/SupplierContext'`.
- Inside the component, after the `useRisk()` line, add: `const { suppliers } = useSupplierContext()`.

In `src/pages/Risk.test.jsx`, wrap the render with `SupplierProvider`:

```jsx
import { SupplierProvider } from '../context/SupplierContext'

function renderRisk() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <Risk />
      </SupplierProvider>
    </MemoryRouter>
  )
}
```

(The tests' existing `waitFor`-based assertions stay as they are.)

- [ ] **Step 4: Switch SupplierDetail's Risk/ESG tabs to the hooks**

In `src/pages/SupplierDetail.jsx`:
- Remove `riskAssessments` and `esgResponses` from the mockData import (delete the entire `import { ... } from '../lib/mockData'` line if nothing else remains).
- Add imports: `import { useRisk } from '../hooks/useRisk'` and `import { useEsg } from '../hooks/useEsg'`.
- In the component body, after the existing context destructuring, add:

```jsx
  const { riskAssessments } = useRisk()
  const { esgResponses } = useEsg()
```

- Where the code does `riskAssessments.find(...)` / `esgResponses.find(...)`, guard for the loading null: change to `(riskAssessments ?? []).find(...)` and `(esgResponses ?? []).find(...)`. (Both lookups already have "No … available" empty states, which render briefly while loading — acceptable.)

In `src/pages/SupplierDetail.test.jsx`, the Risk tab and ESG tab tests must await their assertions after clicking the tab (the hook now fetches): convert the first assertion after the tab click to `await screen.findByText(...)`, e.g. `expect(await screen.findByText('Financial Risk')).toBeInTheDocument()` and `expect(await screen.findByText('Needs Improvement')).toBeInTheDocument()`.

- [ ] **Step 5: Run affected files, then the FULL suite**

Run: `npm test -- src/hooks/dataHooks.test.jsx src/context/ChatContext.test.jsx src/pages/AIAssistant.test.jsx src/pages/Risk.test.jsx src/pages/ESG.test.jsx src/pages/SupplierDetail.test.jsx`
Expected: PASS

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Verify mockData is no longer imported by production data paths**

Run: `npx eslint src api` (no new errors beyond the pre-existing baseline) and grep:

```bash
grep -rn "from '../lib/mockData'" src --include=*.jsx --include=*.js | grep -v test | grep -v mockApi
```

Expected remaining production imports: `src/pages/Dashboard.jsx` (recentActivity only — confirm it imports nothing else from mockData; if it imports more, those usages were missed). `src/test/mockApi.js` and `prisma/seed.js` import it by design.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRisk.js src/hooks/useEsg.js src/hooks/dataHooks.test.jsx src/context/ChatContext.jsx src/pages/Risk.jsx src/pages/Risk.test.jsx src/pages/SupplierDetail.jsx src/pages/SupplierDetail.test.jsx
git commit -m "feat: risk/esg fetch from API; wean chat, Risk page, SupplierDetail off mockData"
```

---

### Task 9: Final gate — full suite + live round-trip verification

**Files:** none created; verification only.

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: ALL test files green. Report exact counts.

- [ ] **Step 2: Lint**

Run: `npx eslint src api`
Expected: no NEW errors beyond the pre-existing baseline (~14 errors in earlier-phase files: set-state-in-effect in hooks/modals, only-export-components in contexts).

- [ ] **Step 3: Live round-trip against Neon (manual, requires `vercel` CLI)**

If the `vercel` CLI is available (`vercel --version`), run `vercel dev` in the background and verify:
1. `GET http://localhost:3000/api/suppliers` returns 20 suppliers (curl or Invoke-RestMethod)
2. The app at `http://localhost:3000` shows the Dashboard with the same numbers as before
3. Add a supplier via the UI → appears in the list → **refresh the page** → still there (persistence!)
4. Edit a contract value → refresh → persisted
5. Add a spend record → Dashboard "Spend by Category" reflects it after refresh

If the CLI is not available or login is required, run what's possible (e.g. a direct node script: `node -e "import('./api/_lib/prisma.js').then(async ({prisma}) => { console.log(await prisma.supplier.count()); process.exit(0) })"` should print `20`) and report which manual steps remain for the user.

- [ ] **Step 4: Commit any straggler fixes; report deployment checklist**

Deployment (user-facing, do not execute): push to the Vercel-linked repo; set `DATABASE_URL` in Vercel project env vars; the build script already runs `prisma generate && prisma migrate deploy`; seed once with `npx prisma db seed` locally (already done — same database).

---

## Self-Review Notes

- **Spec coverage:** schema/seed/migrations (Task 1), API layer + ORG_ID + error contract + vercel.json (Tasks 2-4), apiClient + contexts + isLoading + SupplierDetail guard (Tasks 5-7), useRisk/useEsg + ChatProvider weaning (Task 8), test strategy with mocked-Prisma handler tests + global fetch stub (Tasks 2-5), manual verification + deployment (Task 9). Spec's "Pages reading context directly gain a loading guard" → Task 6 Step 5. Spec's "mockData stops being imported by production data paths except recentActivity" → Task 8 Step 6 enforces by grep.
- **Beyond-spec but required:** `Risk.jsx` imported mock `suppliers` directly (pre-existing); leaving it would show stale suppliers next to live risk data — switched to context in Task 8 Step 3, with its test wrapper updated. `SupplierDetail.jsx` likewise imported risk/esg arrays directly — switched to hooks (Task 8 Step 4). `useSuppliers` read mockData directly — rewritten to wrap the context (Task 6 Step 2). All three are the spec's architecture applied to spots the spec listed generically.
- **Type consistency:** `api.get/post/patch` (Task 5) used identically in Tasks 6-8. Context value shapes: `{ <items>, isLoading, error, add*, update*, set*Status }` consistent across all three contexts and matching prior interfaces plus the documented additions. `coerceDates(body, keys)` defined Task 2, used Tasks 3. `ORG_ID` defined Task 2, used Tasks 2-4. Mock fetch routes match apiClient paths (`/api/suppliers`, `/api/contracts`, `/api/spend`, `/api/risk`, `/api/esg`) and the PATCH URL regex matches `api.patch('/api/<col>/<id>')`.
- **Known judgment points for the implementer:** Tasks 6-8 update existing test files whose exact current text varies — the transformation rules are explicit (first seeded assertion per test → `findBy*`; mutations → await-load/act/waitFor; option-await before select changes). If a test resists the mechanical rule, the implementer should report rather than weaken assertions.
- **No placeholders:** all new-file code is complete; existing-file edits specify exact anchors and replacement code.
