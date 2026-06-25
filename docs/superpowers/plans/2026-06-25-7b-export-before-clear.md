# Lot B — Export-before-clear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an org admin download a full JSON backup of their org's data before wiping it, via a new `GET /api/org/export` endpoint and a "Download backup" button in the Danger zone.

**Architecture:** A new admin-only read endpoint assembles all six models (org-scoped) into one JSON payload. A small browser helper turns that payload into a file download. The Admin page wires a button to it and adds a reminder line to the existing clear/reset confirm dialogs. No changes to `ConfirmDialog`, `clear.js`, or `reset.js`.

**Tech Stack:** Vercel serverless functions, Prisma + Neon, Clerk auth (`requireOrgAdmin`), React, Vitest + Testing Library.

## Global Constraints

- `GET /api/org/export` is wrapped in `requireOrgAdmin` and scopes every query by `req.auth.orgId`.
- Response shape: `{ exportedAt: <ISO string>, orgId, data: { suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests } }`. Non-GET → `405` with `Allow: GET`.
- Export is JSON only; no import/restore; no CSV.
- Do NOT modify `ConfirmDialog.jsx`, `api/org/clear.js`, or `api/org/reset.js` behaviour. The only Admin.jsx change to the dialogs is appending a reminder sentence to their `description` prop.
- The export button lives inside the admin-gated render path (non-admins never see it).
- Tests must stay green (currently 375). Run api half: `npx vitest run api/`; src half serial: `npx vitest run src/ --no-file-parallelism`. Match existing style (ESM, no semicolons, 2-space indent).
- Commit after each task with a `feat(7b-exp):` / `test(7b-exp):` prefix.

---

### Task 1: `GET /api/org/export` endpoint

**Files:**
- Create: `api/org/export.js`
- Test: `api/org/export.test.js`

**Interfaces:**
- Produces: `GET /api/org/export` → `200 { exportedAt, orgId, data: { suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests } }`. Consumed by the Admin page (Task 3) via `api.get('/api/org/export')`.

- [ ] **Step 1: Write the failing test**

Create `api/org/export.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    supplier: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    riskAssessment: { findMany: vi.fn() },
    esgResponse: { findMany: vi.fn() },
    spendRecord: { findMany: vi.fn() },
    portalRequest: { findMany: vi.fn() },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))

import handler from './export.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({
  method: 'GET',
  auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  prisma.supplier.findMany.mockResolvedValue([{ id: 'sup_1' }])
  prisma.contract.findMany.mockResolvedValue([{ id: 'con_1' }])
  prisma.riskAssessment.findMany.mockResolvedValue([{ id: 'risk_1' }])
  prisma.esgResponse.findMany.mockResolvedValue([{ id: 'esg_1' }])
  prisma.spendRecord.findMany.mockResolvedValue([{ id: 'spend_1' }])
  prisma.portalRequest.findMany.mockResolvedValue([{ id: 'preq_1' }])
})

describe('GET /api/org/export', () => {
  it('returns all six models org-scoped in one payload', async () => {
    const res = mockRes()
    await handler(authReq(), res)
    for (const model of ['supplier', 'contract', 'riskAssessment', 'esgResponse', 'spendRecord', 'portalRequest']) {
      expect(prisma[model].findMany).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
    }
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.orgId).toBe('org_test')
    expect(typeof payload.exportedAt).toBe('string')
    expect(payload.data).toEqual({
      suppliers: [{ id: 'sup_1' }],
      contracts: [{ id: 'con_1' }],
      riskAssessments: [{ id: 'risk_1' }],
      esgResponses: [{ id: 'esg_1' }],
      spendRecords: [{ id: 'spend_1' }],
      portalRequests: [{ id: 'preq_1' }],
    })
  })

  it('rejects non-GET with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'POST' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.supplier.findMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/org/export.test.js`
Expected: FAIL — cannot resolve `./export.js`.

- [ ] **Step 3: Write the implementation**

Create `api/org/export.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { requireOrgAdmin } from '../_lib/auth.js'

// Admin-only: return every record in the active org as one JSON payload, so an
// admin can download a backup before a clear/reset. Read-only, org-scoped.
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const where = { where: { orgId } }
    const [suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests] =
      await Promise.all([
        prisma.supplier.findMany(where),
        prisma.contract.findMany(where),
        prisma.riskAssessment.findMany(where),
        prisma.esgResponse.findMany(where),
        prisma.spendRecord.findMany(where),
        prisma.portalRequest.findMany(where),
      ])
    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      orgId,
      data: { suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/org/export.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full api half**

Run: `npx vitest run api/`
Expected: PASS. Report the count.

- [ ] **Step 6: Commit**

```bash
git add api/org/export.js api/org/export.test.js
git commit -m "feat(7b-exp): add admin-only GET /api/org/export"
```

---

### Task 2: `downloadJson` browser helper

**Files:**
- Create: `src/lib/downloadJson.js`
- Test: `src/lib/downloadJson.test.js`

**Interfaces:**
- Produces: `downloadJson(data, filename)` — serializes `data` to pretty JSON and triggers a browser download named `filename`. Consumed by the Admin page (Task 3).

- [ ] **Step 1: Write the failing test**

Create `src/lib/downloadJson.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadJson } from './downloadJson'

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:fake-url'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('downloadJson', () => {
  it('creates a blob url, clicks a download anchor with the filename, and revokes the url', () => {
    const clicked = []
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag)
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(() => clicked.push({ href: el.href, download: el.download }))
      return el
    })

    downloadJson({ a: 1 }, 'backup.json')

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('backup.json')
    expect(clicked[0].href).toContain('blob:fake-url')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/downloadJson.test.js`
Expected: FAIL — cannot resolve `./downloadJson`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/downloadJson.js`:

```js
// Triggers a browser download of `data` serialized as pretty JSON, named `filename`.
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/downloadJson.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/downloadJson.js src/lib/downloadJson.test.js
git commit -m "feat(7b-exp): add downloadJson browser helper"
```

---

### Task 3: Wire the "Download backup" button into Admin

**Files:**
- Modify: `src/pages/Admin.jsx`
- Modify: `src/pages/Admin.test.jsx`

**Interfaces:**
- Consumes: `GET /api/org/export` (Task 1) via `api.get`; `downloadJson` (Task 2).

- [ ] **Step 1: Write the failing test**

In `src/pages/Admin.test.jsx`, add this test inside the `describe('Admin', ...)` block (it reuses the existing `vi.stubGlobal('fetch', ...)` admin setup style):

```js
  it('downloads a JSON backup when the export button is clicked', async () => {
    const exportPayload = { exportedAt: '2026-06-25T00:00:00.000Z', orgId: 'org_test', data: { suppliers: [] } }
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => exportPayload }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    const realCreate = document.createElement.bind(document)
    let clickedDownload = null
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag)
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(() => { clickedDownload = el.download })
      return el
    })

    render(<Admin />)
    fireEvent.click(screen.getByRole('button', { name: /Download backup/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/org/export', expect.objectContaining({ method: undefined }))
    )
    await waitFor(() => expect(clickedDownload).toMatch(/^procureiq-backup-.*\.json$/))
  })
```

> NOTE on the fetch assertion: `api.get(path)` calls `request(path)` with no `options`, so the second `fetch` arg has no `method` key. `expect.objectContaining({ method: undefined })` matches that (the property is absent → `undefined`). If this proves brittle in the runner, assert only the URL: `expect(fetchMock).toHaveBeenCalledWith('/api/org/export', expect.anything())`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Admin.test.jsx`
Expected: FAIL — no "Download backup" button yet.

- [ ] **Step 3: Add the export handler and button to `Admin.jsx`**

3a. Add imports at the top (alongside the existing imports):

```js
import { Lock, AlertTriangle, Download } from 'lucide-react'
import { downloadJson } from '../lib/downloadJson'
```

(Replace the existing `import { Lock, AlertTriangle } from 'lucide-react'` line with the three-icon version above.)

3b. Inside the component, after the existing `const [busy, setBusy] = useState(false)` line, add export state:

```js
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  async function handleExport() {
    setExportError(null)
    setExporting(true)
    try {
      const payload = await api.get('/api/org/export')
      downloadJson(payload, `procureiq-backup-${new Date().toISOString().slice(0, 10)}.json`)
    } catch {
      setExportError('Could not export data. Please try again.')
    } finally {
      setExporting(false)
    }
  }
```

3c. In the Danger zone `Card`, insert a backup row at the TOP of the `mt-4 flex flex-col gap-4` container (before the "Reload demo data" row), then a divider:

```jsx
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Download backup</p>
              <p className="text-sm text-text-secondary">
                Download a full JSON backup of this organization's data before clearing or resetting.
              </p>
              {exportError && <p className="mt-1 text-xs text-accent-red">{exportError}</p>}
            </div>
            <Button variant="secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} />
              {exporting ? 'Exporting…' : 'Download backup (JSON)'}
            </Button>
          </div>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Reload demo data</p>
```

(The existing "Reload demo data" row and everything after it stays unchanged.)

3d. Append the reminder sentence to BOTH ConfirmDialog `description` props:

- reset dialog description becomes:
  `"This deletes all current data in this organization and replaces it with a fresh sample dataset. This cannot be undone. Tip: download a backup from the Danger zone first."`
- clear dialog description becomes:
  `"This permanently deletes all suppliers, contracts, risk, ESG and spend records in this organization. This cannot be undone. Tip: download a backup from the Danger zone first."`

- [ ] **Step 4: Run the Admin test**

Run: `npx vitest run src/pages/Admin.test.jsx`
Expected: PASS (all existing + the new download test).

- [ ] **Step 5: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS. Report the count.

- [ ] **Step 6: Lint the changed files**

Run: `npx eslint src/pages/Admin.jsx src/lib/downloadJson.js`
Expected: no NEW errors beyond the project's known baseline.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Admin.jsx src/pages/Admin.test.jsx
git commit -m "feat(7b-exp): add Download backup button + dialog reminder to Admin"
```

---

### Task 4: full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the api half**

Run: `npx vitest run api/`
Expected: PASS (incl. the new export endpoint test).

- [ ] **Step 2: Run the src half (serial)**

Run: `npx vitest run src/ --no-file-parallelism`
Expected: PASS (incl. downloadJson + the extended Admin test).

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint api/org/export.js src/lib/downloadJson.js src/pages/Admin.jsx`
Expected: no NEW errors beyond the known baseline.

---

## Self-Review

**Spec coverage:**
- `GET /api/org/export` (admin-only, 6 models org-scoped, shape, 405) → Task 1. ✓
- `downloadJson` helper → Task 2. ✓
- Admin "Download backup" button + handler + dialog reminder copy → Task 3. ✓
- ConfirmDialog/clear/reset untouched (only dialog `description` copy changes) → Task 3 (3d). ✓
- Tests for all → each task + Task 4. ✓
- Non-goals respected: no import/restore, no CSV, no forced export, no ConfirmDialog API change. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The Admin.jsx edits
reference the real existing structure (the `mt-4 flex flex-col gap-4` container and the two
existing dialog descriptions).

**Type consistency:** `downloadJson(data, filename)` signature identical in Task 2
(definition) and Task 3 (call). Export response shape (`{ exportedAt, orgId, data: {...} }`)
identical in Task 1 (handler + test) and consumed as an opaque object by Task 3. The six
`data` keys (`suppliers`/`contracts`/`riskAssessments`/`esgResponses`/`spendRecords`/
`portalRequests`) match between the endpoint and its test.
