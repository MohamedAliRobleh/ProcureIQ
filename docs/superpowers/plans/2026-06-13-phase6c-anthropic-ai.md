# Phase 6c: Anthropic AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real Claude (`claude-opus-4-8`) behind the chat assistant (grounded on the org's live data, with a deterministic fallback) and behind on-demand, persisted contract summaries.

**Architecture:** Two new Vercel functions behind the existing `requireAuth` — `POST /api/assistant` (fetches the org dataset, builds a text digest as the system prompt, calls Claude, falls back to the existing pure `getAssistantReply` engine on any failure) and `POST /api/contracts/summarize` (summarizes one contract, writes `aiSummary`, 503 if AI unconfigured). A lazy Anthropic client singleton keeps the key server-side and lets the whole suite run green **without a key** (handler tests mock the client). Frontend: `ChatContext` becomes a thin API caller; `ContractContext` gains `summarizeContract`; the contract slide-over gets a "Generate summary" button.

**Tech Stack:** `@anthropic-ai/sdk`, Vite + React 19, existing Vercel `api/` + Prisma/Neon (6a) + Clerk auth (6b), Vitest + RTL + jsdom.

---

## KEY-OPTIONAL EXECUTION

`ANTHROPIC_API_KEY` is **not yet available** and must not block this work. Tasks 1–8 are fully implementable and testable without it — every handler test mocks `api/_lib/anthropic.js`, so no real Claude call ever runs in the suite. **Only Task 9's live round-trip needs the key and is explicitly deferred.** The lazy singleton (`getAnthropic()` constructs on first call) means the absence of a key never throws at import time.

---

## Scene setting (read before starting)

- Spec: `docs/superpowers/specs/2026-06-12-phase6c-anthropic-ai-design.md`.
- Repo is `"type": "module"` (ESM). `api/` functions are plain `export default async (req, res) => {}`, wrapped by `requireAuth` (6b). The frontend talks to them via `src/lib/apiClient.js` (`api.get/post/patch`, attaches the Clerk bearer token automatically).
- The pure engine `src/lib/assistantEngine.js` exports `getAssistantReply(message, data)` → `{ text }`, where `data = { suppliers, contracts, riskAssessments, esgResponses, spendRecords }`. It imports only pure utils (no React) — safe to import from `api/`. DB rows (ISO-string dates) work because every consumer does `new Date(x)`.
- The global test fetch stub is `src/test/mockApi.js` (`createMockFetch`), installed per-test in `src/test/setup.js`. The auth seam is globally mocked there too (6b).
- `ContractContext` (6a) is fetch-backed: `{ contracts, isLoading, error, addContract, updateContract, setContractStatus }`.
- Suite baseline: 39 files / 246 tests green. ESLint baseline: 9 errors (3 `set-state-in-effect`, 6 `react-refresh/only-export-components`); `api/**` and `prisma/**` get Node globals via `eslint.config.js` (added in 6b).
- Test runner: `npm test -- <file>`; full `npm test`.

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `package.json` | Modify | add `@anthropic-ai/sdk` |
| `.env.example` | Modify | document `ANTHROPIC_API_KEY` |
| `api/_lib/anthropic.js` (+ `anthropic.test.js`) | Create | lazy client singleton, `isAiConfigured`, `AI_MODEL` |
| `api/_lib/digest.js` (+ `digest.test.js`) | Create | pure `buildDigest(data)` → text |
| `api/assistant.js` (+ `assistant.test.js`) | Create | chat endpoint w/ deterministic fallback |
| `api/contracts/summarize.js` (+ `summarize.test.js`) | Create | persist contract `aiSummary` |
| `src/test/mockApi.js` | Modify | stub `/api/assistant` + `/api/contracts/summarize` |
| `src/context/ChatContext.jsx` | Modify | thin API caller (drop engine/dataRef/data-contexts) |
| `src/context/ChatContext.test.jsx` | Modify | assert stubbed reply, simplified wrapper |
| `src/pages/AIAssistant.test.jsx` | Modify | assert stubbed reply per chip |
| `src/context/ContractContext.jsx` (+ test) | Modify | add `summarizeContract(id)` |
| `src/components/ui/ContractSlideOver.jsx` (+ test) | Modify | AI Summary section + Generate button |
| `src/pages/Contracts.jsx`, `src/pages/SupplierDetail.jsx` | Modify | pass live contract + `onSummarize` |
| `src/pages/Contracts.test.jsx` | Modify | slide-over summary-generation test |

---

### Task 1: Anthropic client singleton + env docs

**Files:**
- Modify: `package.json` (via npm install), `.env.example`
- Create: `api/_lib/anthropic.js`, `api/_lib/anthropic.test.js`

- [ ] **Step 1: Install the SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Document the env key**

Append to `.env.example`:

```
# Anthropic API key for AI features (get yours at console.anthropic.com)
ANTHROPIC_API_KEY="sk-ant-..."
```

- [ ] **Step 3: Write the failing tests**

Create `api/_lib/anthropic.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest'
import { isAiConfigured, getAnthropic, AI_MODEL } from './anthropic.js'

const ORIGINAL = process.env.ANTHROPIC_API_KEY

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = ORIGINAL
})

describe('anthropic lib', () => {
  it('AI_MODEL is the Opus 4.8 id', () => {
    expect(AI_MODEL).toBe('claude-opus-4-8')
  })

  it('isAiConfigured reflects the env var', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(isAiConfigured()).toBe(false)
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(isAiConfigured()).toBe(true)
  })

  it('getAnthropic throws when the key is missing', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(() => getAnthropic()).toThrow('ANTHROPIC_API_KEY is not configured')
  })

  it('getAnthropic returns a client with a messages API when configured', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    const client = getAnthropic()
    expect(client.messages).toBeTruthy()
    expect(typeof client.messages.create).toBe('function')
  })
})
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test -- api/_lib/anthropic.test.js`
Expected: FAIL — cannot find module `./anthropic.js`

- [ ] **Step 5: Implement**

Create `api/_lib/anthropic.js`:

```js
import Anthropic from '@anthropic-ai/sdk'

export const AI_MODEL = 'claude-opus-4-8'

let client = null

// True when an API key is present. Endpoints check this before touching the SDK
// so the app degrades gracefully when AI isn't configured (no key yet).
export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Lazily constructs a cached client. Never called without a key (guarded by
// isAiConfigured at the call sites), so importing this module is always safe.
export function getAnthropic() {
  if (!isAiConfigured()) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  if (!client) client = new Anthropic()
  return client
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- api/_lib/anthropic.test.js`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example api/_lib/anthropic.js api/_lib/anthropic.test.js
git commit -m "feat: add lazy Anthropic client singleton and AI config guard"
```

---

### Task 2: Digest builder

**Files:**
- Create: `api/_lib/digest.js`, `api/_lib/digest.test.js`

- [ ] **Step 1: Write the failing tests**

Create `api/_lib/digest.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildDigest } from './digest.js'

const data = {
  suppliers: [
    { id: 'sup_1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'United States', status: 'active', riskScore: 78, esgScore: 41 },
    { id: 'sup_2', name: 'Nordic Freight', category: 'Logistics', country: 'Germany', status: 'pending', riskScore: 22, esgScore: 80 },
  ],
  contracts: [
    { id: 'con_1', supplierId: 'sup_1', title: 'Master Supply Agreement', value: 600000, currency: 'USD', status: 'active', startDate: '2025-01-12', endDate: '2099-01-01', autoRenew: true, terms: 'Net-30' },
  ],
  riskAssessments: [
    { supplierId: 'sup_1', score: 78, level: 'high', financialRisk: 80, complianceRisk: 70, operationalRisk: 60, geopoliticalRisk: 90 },
  ],
  esgResponses: [
    { supplierId: 'sup_2', score: 80, environmental: 82, social: 78, governance: 80 },
  ],
  spendRecords: [
    { supplierId: 'sup_1', amount: 10000, category: 'Raw Materials', date: '2026-01-05' },
    { supplierId: 'sup_2', amount: 5000, category: 'Logistics', date: '2026-01-06' },
  ],
}

describe('buildDigest', () => {
  it('includes suppliers, contracts, risk, esg, and spend sections', () => {
    const digest = buildDigest(data)
    expect(digest).toContain('Atlas Steelworks')
    expect(digest).toContain('Master Supply Agreement')
    expect(digest).toContain('## Risk assessments')
    expect(digest).toContain('## ESG responses')
    expect(digest).toContain('## Spend')
  })

  it('reports the total tracked spend', () => {
    const digest = buildDigest(data)
    expect(digest).toContain('Total tracked spend: 15000')
  })

  it('resolves supplier names for joined rows', () => {
    const digest = buildDigest(data)
    // risk row for sup_1 names the supplier, not the raw id
    expect(digest).toMatch(/Atlas Steelworks: score 78 \(high\)/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- api/_lib/digest.test.js`
Expected: FAIL — cannot find module `./digest.js`

- [ ] **Step 3: Implement**

Create `api/_lib/digest.js`:

```js
// Builds a compact, model-readable text snapshot of the org's procurement data.
// Self-contained (no cross-imports) so it stays trivially testable.

function daysUntil(date) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

export function buildDigest({ suppliers, contracts, riskAssessments, esgResponses, spendRecords }) {
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? id
  const lines = []

  lines.push('## Suppliers')
  for (const s of suppliers) {
    lines.push(`- ${s.name} (${s.category}, ${s.country}) — status ${s.status}, risk ${s.riskScore}, ESG ${s.esgScore}`)
  }

  lines.push('', '## Contracts')
  for (const c of contracts) {
    const d = daysUntil(c.endDate)
    const expiry = d == null ? 'no end date' : d < 0 ? `expired ${Math.abs(d)}d ago` : `${d}d to expiry`
    lines.push(`- "${c.title}" — ${supplierName(c.supplierId)}, ${c.currency} ${c.value}, ${c.status}, ${expiry}${c.autoRenew ? ', auto-renew' : ''}`)
  }

  lines.push('', '## Risk assessments')
  for (const r of riskAssessments) {
    lines.push(`- ${supplierName(r.supplierId)}: score ${r.score} (${r.level}) — financial ${r.financialRisk}, compliance ${r.complianceRisk}, operational ${r.operationalRisk}, geopolitical ${r.geopoliticalRisk}`)
  }

  lines.push('', '## ESG responses')
  for (const e of esgResponses) {
    lines.push(`- ${supplierName(e.supplierId)}: overall ${e.score} — environmental ${e.environmental}, social ${e.social}, governance ${e.governance}`)
  }

  const total = spendRecords.reduce((sum, r) => sum + r.amount, 0)
  const now = new Date()
  const thisMonth = spendRecords
    .filter((r) => {
      const d = new Date(r.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((sum, r) => sum + r.amount, 0)
  const byCategory = {}
  const bySupplier = {}
  for (const r of spendRecords) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount
    bySupplier[r.supplierId] = (bySupplier[r.supplierId] ?? 0) + r.amount
  }

  lines.push('', '## Spend')
  lines.push(`- Total tracked spend: ${total}`)
  lines.push(`- This month: ${thisMonth}`)
  lines.push('- By category:')
  for (const [cat, amt] of Object.entries(byCategory)) lines.push(`  - ${cat}: ${amt}`)
  lines.push('- By supplier:')
  for (const [sid, amt] of Object.entries(bySupplier)) lines.push(`  - ${supplierName(sid)}: ${amt}`)

  return lines.join('\n')
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- api/_lib/digest.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add api/_lib/digest.js api/_lib/digest.test.js
git commit -m "feat: add procurement data digest builder for the assistant"
```

---

### Task 3: `/api/assistant` endpoint

**Files:**
- Create: `api/assistant.js`, `api/assistant.test.js`

- [ ] **Step 1: Write the failing tests**

Create `api/assistant.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('./_lib/prisma.js', () => ({
  prisma: {
    supplier: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    riskAssessment: { findMany: vi.fn() },
    esgResponse: { findMany: vi.fn() },
    spendRecord: { findMany: vi.fn() },
  },
}))
vi.mock('./_lib/anthropic.js', () => ({
  AI_MODEL: 'claude-opus-4-8',
  isAiConfigured: vi.fn(),
  getAnthropic: vi.fn(),
}))

import handler from './assistant.js'
import { prisma } from './_lib/prisma.js'
import { isAiConfigured, getAnthropic } from './_lib/anthropic.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  prisma.supplier.findMany.mockResolvedValue([
    { id: 'sup_1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'US', status: 'active', riskScore: 90, esgScore: 40 },
    { id: 'sup_2', name: 'Nordic Freight', category: 'Logistics', country: 'DE', status: 'active', riskScore: 20, esgScore: 80 },
  ])
  prisma.contract.findMany.mockResolvedValue([])
  prisma.riskAssessment.findMany.mockResolvedValue([
    { supplierId: 'sup_1', score: 90, level: 'critical', financialRisk: 90, complianceRisk: 90, operationalRisk: 90, geopoliticalRisk: 90 },
    { supplierId: 'sup_2', score: 20, level: 'low', financialRisk: 20, complianceRisk: 20, operationalRisk: 20, geopoliticalRisk: 20 },
  ])
  prisma.esgResponse.findMany.mockResolvedValue([])
  prisma.spendRecord.findMany.mockResolvedValue([])
})

describe('POST /api/assistant', () => {
  it('returns the Claude reply when AI is configured', async () => {
    isAiConfigured.mockReturnValue(true)
    getAnthropic.mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'CLAUDE REPLY' }] }) },
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'Which suppliers are riskiest?' }] } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ reply: 'CLAUDE REPLY', fallback: false })
  })

  it('falls back to the deterministic engine when AI is not configured', async () => {
    isAiConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'Which suppliers are riskiest?' }] } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.fallback).toBe(true)
    expect(payload.reply).toContain('Atlas Steelworks')
  })

  it('falls back when the Claude call throws', async () => {
    isAiConfigured.mockReturnValue(true)
    getAnthropic.mockReturnValue({
      messages: { create: vi.fn().mockRejectedValue(new Error('boom')) },
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'Which suppliers are riskiest?' }] } }, res)
    const payload = res.json.mock.calls[0][0]
    expect(payload.fallback).toBe(true)
    expect(payload.reply).toContain('Atlas Steelworks')
  })

  it('returns 400 when messages is missing or empty', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET' }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- api/assistant.test.js`
Expected: FAIL — cannot find module `./assistant.js`

- [ ] **Step 3: Implement**

Create `api/assistant.js`:

```js
import { prisma } from './_lib/prisma.js'
import { ORG_ID } from './_lib/org.js'
import { requireAuth } from './_lib/auth.js'
import { getAnthropic, isAiConfigured, AI_MODEL } from './_lib/anthropic.js'
import { buildDigest } from './_lib/digest.js'
import { getAssistantReply } from '../src/lib/assistantEngine.js'

const SYSTEM_PREAMBLE =
  "You are the ProcureIQ procurement assistant. Answer the user's questions using ONLY the procurement data provided below. " +
  'Be concise and specific — cite real numbers and supplier names from the data. ' +
  'If a question cannot be answered from this data, say so plainly. Respond in plain text (no markdown tables).\n\nPROCUREMENT DATA:'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const incoming = req.body?.messages
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'messages is required' })
  }
  try {
    const [suppliers, contracts, riskAssessments, esgResponses, spendRecords] = await Promise.all([
      prisma.supplier.findMany({ where: { orgId: ORG_ID } }),
      prisma.contract.findMany({ where: { orgId: ORG_ID } }),
      prisma.riskAssessment.findMany({ where: { orgId: ORG_ID } }),
      prisma.esgResponse.findMany({ where: { orgId: ORG_ID } }),
      prisma.spendRecord.findMany({ where: { orgId: ORG_ID } }),
    ])
    const data = { suppliers, contracts, riskAssessments, esgResponses, spendRecords }

    if (isAiConfigured()) {
      try {
        const message = await getAnthropic().messages.create({
          model: AI_MODEL,
          max_tokens: 2048,
          thinking: { type: 'adaptive' },
          system: `${SYSTEM_PREAMBLE}\n${buildDigest(data)}`,
          messages: incoming.map((m) => ({ role: m.role, content: m.content })),
        })
        const text = message.content.find((b) => b.type === 'text')?.text?.trim()
        if (text) return res.status(200).json({ reply: text, fallback: false })
      } catch {
        // fall through to the deterministic engine
      }
    }

    const lastUser = [...incoming].reverse().find((m) => m.role === 'user')
    const reply = getAssistantReply(lastUser?.content ?? '', data)
    return res.status(200).json({ reply: reply.text, fallback: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

> Note: `../src/lib/assistantEngine.js` is a pure module (no React); Vercel bundles it into the function. This keeps the engine alive as the fallback rather than dead code.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- api/assistant.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add api/assistant.js api/assistant.test.js
git commit -m "feat: add /api/assistant with digest-grounded Claude and deterministic fallback"
```

---

### Task 4: `/api/contracts/summarize` endpoint

**Files:**
- Create: `api/contracts/summarize.js`, `api/contracts/summarize.test.js`

> Filename note: `summarize.js` is a **static** segment, so Vercel routes `POST /api/contracts/summarize` to it (static wins over the dynamic `[id].js`); `PATCH /api/contracts/con_1` still hits `[id].js`. No conflict.

- [ ] **Step 1: Write the failing tests**

Create `api/contracts/summarize.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({
  prisma: { contract: { findFirst: vi.fn(), update: vi.fn() } },
}))
vi.mock('../_lib/anthropic.js', () => ({
  AI_MODEL: 'claude-opus-4-8',
  isAiConfigured: vi.fn(),
  getAnthropic: vi.fn(),
}))

import handler from './summarize.js'
import { prisma } from '../_lib/prisma.js'
import { isAiConfigured, getAnthropic } from '../_lib/anthropic.js'

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

describe('POST /api/contracts/summarize', () => {
  it('generates, persists, and returns the contract with aiSummary', async () => {
    isAiConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1', title: 'Master Supply Agreement', value: 600000, currency: 'USD', status: 'active', terms: 'Net-30' })
    getAnthropic.mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'A concise summary.' }] }) },
    })
    prisma.contract.update.mockResolvedValue({ id: 'con_1', aiSummary: 'A concise summary.' })
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' } }, res)
    expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_demo' } })
    expect(prisma.contract.update).toHaveBeenCalledWith({ where: { id: 'con_1' }, data: { aiSummary: 'A concise summary.' } })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ id: 'con_1', aiSummary: 'A concise summary.' })
  })

  it('returns 404 when the contract is not in the org', async () => {
    isAiConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_other' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('returns 503 when AI is not configured', async () => {
    isAiConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET' }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- api/contracts/summarize.test.js`
Expected: FAIL — cannot find module `./summarize.js`

- [ ] **Step 3: Implement**

Create `api/contracts/summarize.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { requireAuth } from '../_lib/auth.js'
import { getAnthropic, isAiConfigured, AI_MODEL } from '../_lib/anthropic.js'

const SUMMARY_SYSTEM =
  'You are a procurement analyst. Summarize the contract below in 2-3 sentences for a procurement manager. ' +
  'Cover the value, term, renewal, and any notable terms. Output only the summary, with no preamble.'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const id = req.body?.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isAiConfigured()) return res.status(503).json({ error: 'AI features are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: ORG_ID } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const details = [
      `Title: ${contract.title}`,
      `Value: ${contract.currency} ${contract.value}`,
      `Status: ${contract.status}`,
      `Start: ${contract.startDate ?? 'n/a'}`,
      `End: ${contract.endDate ?? 'n/a'}`,
      `Auto-renew: ${contract.autoRenew ? 'yes' : 'no'}`,
      `Terms: ${contract.terms ?? 'n/a'}`,
    ].join('\n')

    const message = await getAnthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system: SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: details }],
    })
    const aiSummary = message.content.find((b) => b.type === 'text')?.text?.trim()
    if (!aiSummary) return res.status(502).json({ error: 'No summary generated' })

    const updated = await prisma.contract.update({ where: { id }, data: { aiSummary } })
    return res.status(200).json(updated)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- api/contracts/summarize.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add api/contracts/summarize.js api/contracts/summarize.test.js
git commit -m "feat: add /api/contracts/summarize that persists aiSummary"
```

---

### Task 5: Frontend — ChatContext calls the API

**Files:**
- Modify: `src/test/mockApi.js`, `src/context/ChatContext.jsx`, `src/context/ChatContext.test.jsx`, `src/pages/AIAssistant.test.jsx`

- [ ] **Step 1: Add the stub routes**

In `src/test/mockApi.js`, inside `createMockFetch`'s returned function, add these two checks **immediately after** the `const body = ...` line and **before** the `if (method === 'GET')` block:

```js
    if (method === 'POST' && url === '/api/assistant') {
      return jsonResponse({ reply: 'MOCK ASSISTANT REPLY', fallback: false })
    }
    if (method === 'POST' && url === '/api/contracts/summarize') {
      return jsonResponse({ id: body.id, aiSummary: 'MOCK AI SUMMARY' })
    }
```

- [ ] **Step 2: Update ChatContext tests for the API path**

Replace `src/context/ChatContext.test.jsx` entirely:

```jsx
import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ChatProvider, useChatContext } from './ChatContext'

const wrapper = ({ children }) => <ChatProvider>{children}</ChatProvider>

describe('ChatContext', () => {
  it('seeds with a single assistant greeting', () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.messages[0].text).toContain('ProcureIQ assistant')
    expect(result.current.isThinking).toBe(false)
  })

  it('appends the user message immediately and the API reply after the request', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('Which suppliers are riskiest?'))

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].role).toBe('user')
    expect(result.current.messages[1].text).toBe('Which suppliers are riskiest?')
    expect(result.current.isThinking).toBe(true)

    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    expect(result.current.messages[2].role).toBe('assistant')
    expect(result.current.messages[2].text).toBe('MOCK ASSISTANT REPLY')
    expect(result.current.isThinking).toBe(false)
  })

  it('assigns unique ids to user and assistant messages', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('hello'))
    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    const ids = result.current.messages.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignores empty and whitespace-only messages', () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('   '))
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.isThinking).toBe(false)
  })

  it('clearChat resets to the greeting', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('hello'))
    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    act(() => result.current.clearChat())
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.isThinking).toBe(false)
  })

  it('throws when used outside ChatProvider', () => {
    expect(() => renderHook(() => useChatContext())).toThrow(
      'useChatContext must be used inside ChatProvider'
    )
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/context/ChatContext.test.jsx`
Expected: FAIL — the current ChatContext returns the deterministic engine reply ('Pacific Rim Logistics'/engine text), not 'MOCK ASSISTANT REPLY'

- [ ] **Step 4: Rewrite ChatContext**

Replace `src/context/ChatContext.jsx` entirely:

```jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../lib/apiClient'

const ChatContext = createContext(null)

const GREETING_TEXT =
  "Hi! I'm your ProcureIQ assistant. Ask me about supplier risk, spend, expiring contracts, ESG performance, or any supplier by name."

const ERROR_TEXT = "Sorry, I couldn't reach the assistant just now. Please try again."

function makeGreeting() {
  return { id: 'msg_0', role: 'assistant', text: GREETING_TEXT, createdAt: new Date() }
}

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState(() => [makeGreeting()])
  const [isThinking, setIsThinking] = useState(false)
  const counterRef = useRef(0)
  const activeRef = useRef(true)

  useEffect(() => () => { activeRef.current = false }, [])

  function appendAssistant(text) {
    counterRef.current += 1
    setMessages((prev) => [...prev, { id: `msg_${counterRef.current}`, role: 'assistant', text, createdAt: new Date() }])
  }

  function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    // Conversation turns after the greeting, plus the new user turn.
    const priorTurns = messages.slice(1).map((m) => ({ role: m.role, content: m.text }))
    const payload = [...priorTurns, { role: 'user', content: trimmed }]

    counterRef.current += 1
    setMessages((prev) => [...prev, { id: `msg_${counterRef.current}`, role: 'user', text: trimmed, createdAt: new Date() }])
    setIsThinking(true)

    api
      .post('/api/assistant', { messages: payload })
      .then((data) => {
        if (activeRef.current) appendAssistant(data.reply)
      })
      .catch(() => {
        if (activeRef.current) appendAssistant(ERROR_TEXT)
      })
      .finally(() => {
        if (activeRef.current) setIsThinking(false)
      })
  }

  function clearChat() {
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

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- src/context/ChatContext.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 6: Update AIAssistant tests for the stubbed reply**

In `src/pages/AIAssistant.test.jsx`, the replies are now the single stubbed string. Update the three tests that assert deterministic engine text:

- In `'clicking a chip sends the prompt, hides the chips, and renders a data-backed reply'`, change the `waitFor` assertion from `/Pacific Rim Logistics/` to:

```jsx
    await waitFor(() => expect(screen.getByText('MOCK ASSISTANT REPLY')).toBeInTheDocument())
```

- In `'sends a typed message on submit and clears the input'`, change the final `waitFor` from `/portfolio overview/` to:

```jsx
    await waitFor(() => expect(screen.getByText('MOCK ASSISTANT REPLY')).toBeInTheDocument())
```

- In `'Clear chat resets the conversation and restores the chips'`, change the first `waitFor` from `/active contracts/` to `expect(screen.getByText('MOCK ASSISTANT REPLY')).toBeInTheDocument()` and the post-clear assertion from `queryByText(/active contracts/)` to:

```jsx
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
    expect(screen.queryByText('MOCK ASSISTANT REPLY')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give me a portfolio overview' })).toBeInTheDocument()
```

(The greeting, chip-visibility, thinking-indicator, and empty-submit assertions are unchanged.)

- [ ] **Step 7: Run the affected files, then the full suite**

Run: `npm test -- src/context/ChatContext.test.jsx src/pages/AIAssistant.test.jsx`
Expected: PASS

Run: `npm test`
Expected: all green (report counts)

- [ ] **Step 8: Commit**

```bash
git add src/test/mockApi.js src/context/ChatContext.jsx src/context/ChatContext.test.jsx src/pages/AIAssistant.test.jsx
git commit -m "feat: ChatContext calls /api/assistant; stub + tests updated"
```

---

### Task 6: ContractContext.summarizeContract

**Files:**
- Modify: `src/context/ContractContext.jsx`, `src/context/ContractContext.test.jsx`

- [ ] **Step 1: Write the failing test**

In `src/context/ContractContext.test.jsx`, add this test before the `'throws when used outside ContractProvider'` test:

```jsx
  it('summarizeContract sets aiSummary on the matching contract', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    await act(async () => {
      await result.current.summarizeContract(id)
    })
    expect(result.current.contracts.find((c) => c.id === id).aiSummary).toBe('MOCK AI SUMMARY')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/context/ContractContext.test.jsx`
Expected: FAIL — `result.current.summarizeContract is not a function`

- [ ] **Step 3: Implement**

In `src/context/ContractContext.jsx`, add this function after `setContractStatus`:

```jsx
  function summarizeContract(id) {
    return api
      .post('/api/contracts/summarize', { id })
      .then((updated) => {
        setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)))
        return updated
      })
      .catch((e) => {
        setError(e)
        throw e
      })
  }
```

Add `summarizeContract` to the provider value:

```jsx
    <ContractContext.Provider
      value={{ contracts, isLoading, error, addContract, updateContract, setContractStatus, summarizeContract }}
    >
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/context/ContractContext.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/context/ContractContext.jsx src/context/ContractContext.test.jsx
git commit -m "feat: add summarizeContract to ContractContext"
```

---

### Task 7: ContractSlideOver — AI Summary section

**Files:**
- Modify: `src/components/ui/ContractSlideOver.jsx`, `src/components/ui/ContractSlideOver.test.jsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/ui/ContractSlideOver.test.jsx`, add these two tests at the end of the `describe` block:

```jsx
  it('renders an existing aiSummary and no generate button', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: { ...mockContract, aiSummary: 'This is the AI summary.' },
      supplier: mockSupplier,
      onEdit: () => {},
      onSummarize: vi.fn(),
    })
    expect(screen.getByText('This is the AI summary.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generate summary' })).not.toBeInTheDocument()
  })

  it('shows a Generate summary button that calls onSummarize', () => {
    const onSummarize = vi.fn().mockResolvedValue({})
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onSummarize,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate summary' }))
    expect(onSummarize).toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/ui/ContractSlideOver.test.jsx`
Expected: FAIL — no "Generate summary" button / aiSummary text rendered

- [ ] **Step 3: Implement**

In `src/components/ui/ContractSlideOver.jsx`:

Change the React import (line 1) to add `useState`:

```jsx
import { useEffect, useState } from 'react'
```

Change the component signature to accept `onSummarize`:

```jsx
export default function ContractSlideOver({ isOpen, onClose, contract, supplier, onEdit, onSummarize }) {
```

Add summary state and handler right after the existing `useEffect` (before `if (!contract) return null`):

```jsx
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  async function handleSummarize() {
    setSummaryError(null)
    setIsSummarizing(true)
    try {
      await onSummarize()
    } catch {
      setSummaryError('Could not generate a summary. Please try again.')
    } finally {
      setIsSummarizing(false)
    }
  }
```

Add the AI Summary block inside the scrollable area — immediately after the `{contract.terms && (...)}` block and before its closing `</div>` (the `flex-1 ... overflow-y-auto` container):

```jsx
              {onSummarize && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">AI Summary</p>
                  {contract.aiSummary ? (
                    <p className="text-sm text-text-primary">{contract.aiSummary}</p>
                  ) : (
                    <Button variant="secondary" onClick={handleSummarize} disabled={isSummarizing}>
                      {isSummarizing ? 'Generating…' : 'Generate summary'}
                    </Button>
                  )}
                  {summaryError && <p className="mt-1 text-xs text-accent-red">{summaryError}</p>}
                </div>
              )}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/components/ui/ContractSlideOver.test.jsx`
Expected: PASS (7 tests — 5 existing + 2 new; existing tests pass no `onSummarize`, so the section doesn't render for them)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ContractSlideOver.jsx src/components/ui/ContractSlideOver.test.jsx
git commit -m "feat: add AI Summary section to ContractSlideOver"
```

---

### Task 8: Wire the summary into the pages

**Files:**
- Modify: `src/pages/Contracts.jsx`, `src/pages/SupplierDetail.jsx`, `src/pages/Contracts.test.jsx`

- [ ] **Step 1: Write the failing page test**

In `src/pages/Contracts.test.jsx`, add this test at the end of the `describe('Contracts', ...)` block (the file already imports `render, screen, fireEvent` and uses `waitFor`/`findBy*` — add `waitFor` to the testing-library import if not present):

```jsx
  it('generates an AI summary from the contract slide-over', async () => {
    renderContracts()
    fireEvent.click(await screen.findByText('Master Supply Agreement — Atlas Steelworks'))
    fireEvent.click(screen.getByRole('button', { name: 'Generate summary' }))
    expect(await screen.findByText('MOCK AI SUMMARY')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/pages/Contracts.test.jsx`
Expected: FAIL — no "Generate summary" button (the page doesn't pass `onSummarize` yet)

- [ ] **Step 3: Wire Contracts.jsx**

In `src/pages/Contracts.jsx`:

- Pull `summarizeContract` from the context (line 18):

```jsx
  const { contracts, addContract, updateContract, summarizeContract } = useContractContext()
```

- Derive the live selected contract just before the `return (` (so a fresh `aiSummary` re-renders the open slide-over). Add after the `columns` array definition:

```jsx
  const liveSelected = selectedContract
    ? contracts.find((c) => c.id === selectedContract.id) ?? selectedContract
    : null
```

- Replace the `<ContractSlideOver .../>` block with:

```jsx
      <ContractSlideOver
        isOpen={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        contract={liveSelected}
        supplier={liveSelected ? suppliers.find((s) => s.id === liveSelected.supplierId) : null}
        onEdit={() => openEdit(liveSelected)}
        onSummarize={liveSelected ? () => summarizeContract(liveSelected.id) : undefined}
      />
```

- [ ] **Step 4: Wire SupplierDetail.jsx**

In `src/pages/SupplierDetail.jsx`:

- Add `summarizeContract` to the contract-context destructuring (the line currently reading `const { contracts, addContract, updateContract } = useContractContext()` — keep the other names it already pulls):

```jsx
  const { contracts, addContract, updateContract, summarizeContract } = useContractContext()
```

- In `renderContractsTab()` (just before its `return (`), derive the live contract:

```jsx
    const liveSelected = selectedContract
      ? contracts.find((c) => c.id === selectedContract.id) ?? selectedContract
      : null
```

- Replace the `<ContractSlideOver .../>` block (lines ~193–199) with:

```jsx
        <ContractSlideOver
          isOpen={contractSlideOpen}
          onClose={() => setContractSlideOpen(false)}
          contract={liveSelected}
          supplier={supplier}
          onEdit={() => openEditContract(liveSelected)}
          onSummarize={liveSelected ? () => summarizeContract(liveSelected.id) : undefined}
        />
```

> If `SupplierDetail.jsx`'s contract-context destructuring line differs from the text above, just add `summarizeContract` to whatever it already pulls; don't change the other names.

- [ ] **Step 5: Run the page tests, then the full suite**

Run: `npm test -- src/pages/Contracts.test.jsx src/pages/SupplierDetail.test.jsx`
Expected: PASS

Run: `npm test`
Expected: all green (report counts)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Contracts.jsx src/pages/SupplierDetail.jsx src/pages/Contracts.test.jsx
git commit -m "feat: wire contract AI summary into Contracts and SupplierDetail slide-overs"
```

---

### Task 9: Final gate

**Files:** none (verification only; commit stragglers if real fixes surface).

- [ ] **Step 1: Full suite** — `npm test`, run twice; report exact counts (baseline 39 files / 246 tests + the new tests: `anthropic` 4, `digest` 3, `assistant` 5, `summarize` 5, `ContractContext` +1, `ContractSlideOver` +2, `Contracts` +1 ≈ +21 tests across +4 files).

- [ ] **Step 2: Lint** — `npx eslint src api`; expect no NEW categories beyond the baseline (`set-state-in-effect`, `react-refresh/only-export-components`). `ContractSlideOver.jsx` now calls `setState` in an event handler (`handleSummarize`), which is fine; if the new endpoints trip an unused-var or similar, fix it.

- [ ] **Step 3: Confirm the key-optional posture** — verify the whole suite is green **with no `ANTHROPIC_API_KEY` set** (it is, since every handler test mocks `_lib/anthropic.js`). This proves the work doesn't block on the license.

- [ ] **Step 4: DEFERRED live verification (requires `ANTHROPIC_API_KEY`)** — do NOT run now; this is the only step that needs the key. When the user adds `ANTHROPIC_API_KEY=sk-ant-...` to `.env`:
  1. `vercel dev`, sign in.
  2. Ask the assistant a data question → real Claude answer whose numbers match the dashboards (`fallback: false` in the network response).
  3. Open a contract → "Generate summary" → summary appears and persists across refresh.
  4. Temporarily blank the key → assistant still answers (deterministic fallback, `fallback: true`); "Generate summary" surfaces the 503 "AI features are not configured" message.

- [ ] **Step 5: Report** — suite counts, lint result, and the deferred-step checklist for the user.

---

## Self-Review Notes

- **Spec coverage:** Anthropic singleton + key-server-side (Task 1); `/api/assistant` with digest grounding + deterministic fallback (Tasks 2–3); persisted contract `aiSummary` with 404/503 (Task 4); ChatContext simplified to an API caller (Task 5); `summarizeContract` (Task 6); slide-over Generate button (Task 7); page wiring (Task 8); testing strategy (mocked-Anthropic handler tests incl. fallback, stub additions, updated chat assertions) and the deferred manual verification (Task 9). Spec's "503 (no fallback) for summaries" → Task 4. Spec's "conversation history so follow-ups work" → ChatContext sends prior turns after the greeting (Task 5).
- **Key-optional:** the central constraint. The lazy singleton never constructs without a key; every handler test mocks `_lib/anthropic.js`; the suite is green with no key. Only Task 9 Step 4 needs the license, and it's explicitly deferred.
- **Type consistency:** `getAnthropic`/`isAiConfigured`/`AI_MODEL` (Task 1) consumed in Tasks 3–4. `buildDigest(data)` (Task 2) called in Task 3. `getAssistantReply(message, data)` returns `{ text }` — used as `reply.text` (Task 3). `/api/assistant` returns `{ reply, fallback }` — ChatContext reads `data.reply` (Task 5); stub returns the same shape. `/api/contracts/summarize` returns the updated contract — `summarizeContract` merges it (Task 6); stub echoes `{ id, aiSummary }`. `onSummarize` prop (Task 7) supplied by the pages (Task 8). `MOCK ASSISTANT REPLY` / `MOCK AI SUMMARY` stub strings (Task 5) asserted in Tasks 5–8.
- **Routing:** `api/contracts/summarize.js` (static) wins over `[id].js` (dynamic) for `/api/contracts/summarize` on Vercel — noted in Task 4.
- **No App.jsx change:** ChatProvider no longer consumes the data contexts but its nesting is harmless; App.jsx/App.test.jsx are untouched.
- **No placeholders:** every step has complete, runnable code; existing-file edits give exact anchors.
