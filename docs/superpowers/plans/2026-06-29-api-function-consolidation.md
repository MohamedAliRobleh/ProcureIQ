# API Function Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 21 Serverless Functions under `api/` into 9 (5 catch-all routers + 4 unchanged singles) so the Vercel Hobby plan's 12-function limit no longer rejects production deploys — with zero behaviour, URL, or frontend change and the full ~418-test suite green.

**Architecture:** Each multi-endpoint resource folder gets one optional catch-all router `api/<resource>/[[...path]].js`. The endpoint logic moves verbatim into `api/_handlers/<resource>.js` (an `_`-prefixed dir Vercel ignores for the functions build, exactly like the existing `api/_lib/`), exported as bare named functions WITHOUT the `requireAuth`/`requireOrgAdmin` wrapper. The router applies auth once at its boundary and dispatches on `req.query.path`.

**Tech Stack:** Vercel Node.js Serverless Functions, Vitest, Prisma, Clerk auth wrappers.

## Global Constraints

- Target ≤ 12 deployed functions; this plan reaches **9** (must not regress above 12). Deployed = `api/**/*.js` minus `_`-prefixed dirs minus `**/*.test.js` (excluded by `.vercelignore`).
- Handler **business logic, validation, status codes, and org-scoping are preserved verbatim** — this is a pure relocation + routing change. No data-model or behaviour change.
- Public API URLs are unchanged (`/api/suppliers`, `/api/suppliers/:id`, `/api/contracts/summarize`, `/api/org/clear`, …). No `src/` (frontend) change. No `vercel.json` change.
- Handler files live under `api/_handlers/`; routers under `api/<resource>/[[...path]].js`. Import depth from both `api/_handlers/x.js` and `api/<resource>/y.js` to `api/_lib/` is identical (`../_lib/…`), so moved import lines need no path edit.
- Routers normalize the catch-all param with `const segs = [].concat(req.query.path ?? [])` (yields `[]` at base, `['x']` for one segment, tolerates a bare string).
- The org admin gate must replicate `requireOrgAdmin` exactly: `if (req.auth.orgRole !== 'org:admin') return res.status(403).json({ error: 'Admin access required' })`.
- Test run convention (unchanged): api and src halves; src serial via `npx vitest run --no-file-parallelism`. For a single folder during a task: `npx vitest run api/<folder>`.
- When moving a `handler` into `_handlers/`, also move any module-level constants it references (e.g. `SUMMARY_SYSTEM` in `summarize.js`, any email-template consts in `notify.js`). Drop the `requireAuth`/`requireOrgAdmin` import and the `export default require…(handler)` line. Keep every other import the moved bodies use.
- Existing `vi.mock('../_lib/auth.js', …)` lines in repointed test files become harmless no-ops (bare handlers no longer import auth) — leave them as-is to minimize churn. Only change the handler-import lines specified per task.

---

### Task 1: Suppliers router (establishes the list+byId pattern)

**Files:**
- Create: `api/_handlers/suppliers.js`
- Create: `api/suppliers/[[...path]].js`
- Create: `api/suppliers/router.test.js`
- Modify: `api/suppliers/suppliers.test.js:11-12`
- Delete: `api/suppliers/index.js`, `api/suppliers/[id].js`

**Interfaces:**
- Produces: `api/_handlers/suppliers.js` exports `async function list(req, res)` (GET list + POST create) and `async function byId(req, res)` (PATCH, reads `req.query.id`). Router default-exports `requireAuth(dispatch)`.

- [ ] **Step 1: Create the handlers module**

Create `api/_handlers/suppliers.js`. Import block (drop `requireAuth`):

```js
import { prisma } from '../_lib/prisma.js'
import { canManage } from '../_lib/permissions.js'
```

Then copy the entire `async function handler(req, res) { … }` body from `api/suppliers/index.js` verbatim, renamed to `export async function list(req, res)`. Copy the `handler` body from `api/suppliers/[id].js` verbatim, renamed to `export async function byId(req, res)`. Do NOT add `export default` and do NOT wrap with `requireAuth`.

- [ ] **Step 2: Repoint the existing logic tests and run them green**

In `api/suppliers/suppliers.test.js` replace lines 11-12:

```js
import listHandler from './index.js'
import idHandler from './[id].js'
```

with:

```js
import { list as listHandler, byId as idHandler } from '../_handlers/suppliers.js'
```

Run: `npx vitest run api/suppliers/suppliers.test.js`
Expected: PASS (same assertions, logic unchanged) — confirms the move is behaviour-preserving.

- [ ] **Step 3: Write the failing router test**

Create `api/suppliers/router.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/suppliers.js', () => ({ list: vi.fn(), byId: vi.fn() }))

import router from './[[...path]].js'
import { list, byId } from '../_handlers/suppliers.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('suppliers catch-all router', () => {
  it('routes the base path to list', async () => {
    const req = { method: 'GET', query: {}, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(list).toHaveBeenCalledTimes(1)
    expect(byId).not.toHaveBeenCalled()
  })

  it('routes /:id to byId and sets req.query.id', async () => {
    const req = { method: 'PATCH', query: { path: ['sup_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('sup_1')
    expect(byId).toHaveBeenCalledTimes(1)
    expect(list).not.toHaveBeenCalled()
  })
})
```

Run: `npx vitest run api/suppliers/router.test.js`
Expected: FAIL — `Cannot find module './[[...path]].js'`.

- [ ] **Step 4: Create the router**

Create `api/suppliers/[[...path]].js`:

```js
import { requireAuth } from '../_lib/auth.js'
import { list, byId } from '../_handlers/suppliers.js'

export default requireAuth(async (req, res) => {
  const segs = [].concat(req.query.path ?? [])
  if (segs.length === 0) return list(req, res)
  req.query.id = segs[0]
  return byId(req, res)
})
```

Run: `npx vitest run api/suppliers/router.test.js`
Expected: PASS.

- [ ] **Step 5: Delete the old endpoint files and run the folder green**

```bash
git rm api/suppliers/index.js api/suppliers/[id].js
```

Run: `npx vitest run api/suppliers`
Expected: PASS (suppliers.test.js + router.test.js).

- [ ] **Step 6: Commit**

```bash
git add api/_handlers/suppliers.js api/suppliers/[[...path]].js api/suppliers/router.test.js api/suppliers/suppliers.test.js
git commit -m "refactor(api): consolidate suppliers into a catch-all router"
```

---

### Task 2: Spend router (same list+byId shape)

**Files:**
- Create: `api/_handlers/spend.js`
- Create: `api/spend/[[...path]].js`
- Create: `api/spend/router.test.js`
- Modify: `api/spend/spend.test.js:12-13`
- Delete: `api/spend/index.js`, `api/spend/[id].js`

**Interfaces:**
- Produces: `api/_handlers/spend.js` exports `list` (GET+POST) and `byId` (PATCH, reads `req.query.id`).

- [ ] **Step 1: Create the handlers module**

Create `api/_handlers/spend.js`. Import block (drop `requireAuth`):

```js
import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
import { canManage } from '../_lib/permissions.js'
```

Copy the `handler` body from `api/spend/index.js` verbatim into `export async function list(req, res)`, and from `api/spend/[id].js` into `export async function byId(req, res)`.

- [ ] **Step 2: Repoint the existing logic tests and run them green**

In `api/spend/spend.test.js` replace lines 12-13:

```js
import listHandler from './index.js'
import idHandler from './[id].js'
```

with:

```js
import { list as listHandler, byId as idHandler } from '../_handlers/spend.js'
```

Run: `npx vitest run api/spend/spend.test.js`
Expected: PASS.

- [ ] **Step 3: Write the failing router test**

Create `api/spend/router.test.js` (identical structure to suppliers, swapping the module path and ids):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/spend.js', () => ({ list: vi.fn(), byId: vi.fn() }))

import router from './[[...path]].js'
import { list, byId } from '../_handlers/spend.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('spend catch-all router', () => {
  it('routes the base path to list', async () => {
    const req = { method: 'GET', query: {}, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(list).toHaveBeenCalledTimes(1)
    expect(byId).not.toHaveBeenCalled()
  })

  it('routes /:id to byId and sets req.query.id', async () => {
    const req = { method: 'PATCH', query: { path: ['spend_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('spend_1')
    expect(byId).toHaveBeenCalledTimes(1)
  })
})
```

Run: `npx vitest run api/spend/router.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the router**

Create `api/spend/[[...path]].js`:

```js
import { requireAuth } from '../_lib/auth.js'
import { list, byId } from '../_handlers/spend.js'

export default requireAuth(async (req, res) => {
  const segs = [].concat(req.query.path ?? [])
  if (segs.length === 0) return list(req, res)
  req.query.id = segs[0]
  return byId(req, res)
})
```

Run: `npx vitest run api/spend/router.test.js`
Expected: PASS.

- [ ] **Step 5: Delete old files and run the folder green**

```bash
git rm api/spend/index.js api/spend/[id].js
```

Run: `npx vitest run api/spend`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_handlers/spend.js api/spend/[[...path]].js api/spend/router.test.js api/spend/spend.test.js
git commit -m "refactor(api): consolidate spend into a catch-all router"
```

---

### Task 3: Contracts router (list+byId + reserved sub-routes)

**Files:**
- Create: `api/_handlers/contracts.js`
- Create: `api/contracts/[[...path]].js`
- Create: `api/contracts/router.test.js`
- Modify: `api/contracts/contracts.test.js:12-13`, `api/contracts/summarize.test.js:13`, `api/contracts/upload-signature.test.js:13`, `api/contracts/notify.test.js:12`
- Delete: `api/contracts/index.js`, `api/contracts/[id].js`, `api/contracts/summarize.js`, `api/contracts/upload-signature.js`, `api/contracts/notify.js`

**Interfaces:**
- Produces: `api/_handlers/contracts.js` exports `list` (GET+POST), `byId` (PATCH, `req.query.id`), `summarize` (POST, `req.body.id`), `uploadSignature` (POST, `req.body.id`), `notify` (POST).
- Router dispatch: base → `list`; `summarize`/`upload-signature`/`notify` → that handler; any other first segment → `byId` (`req.query.id = segs[0]`). Contract ids (`con_*`, `${orgId}__con_*`) never collide with the three reserved names.

- [ ] **Step 1: Create the handlers module**

Create `api/_handlers/contracts.js`. Merged import block (union of all five source files, `requireAuth` dropped):

```js
import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
import { canManage } from '../_lib/permissions.js'
import { getAnthropic, isAiConfigured, AI_MODEL } from '../_lib/anthropic.js'
import { isUploadConfigured, uploadConfig, signUpload } from '../_lib/cloudinary.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'
import { escapeHtml } from '../_lib/htmlEscape.js'
```

Move the bodies verbatim, plus any module-level constants each references (e.g. `SUMMARY_SYSTEM` from `summarize.js`, and any email-template constants declared above the `handler` in `notify.js`):
- `api/contracts/index.js` handler → `export async function list(req, res)`
- `api/contracts/[id].js` handler → `export async function byId(req, res)`
- `api/contracts/summarize.js` handler → `export async function summarize(req, res)` (move `SUMMARY_SYSTEM` const too)
- `api/contracts/upload-signature.js` handler → `export async function uploadSignature(req, res)`
- `api/contracts/notify.js` handler → `export async function notify(req, res)` (move its template consts too)

If ESLint reports a specific import as unused after the merge, remove only that import.

- [ ] **Step 2: Repoint the existing logic tests and run them green**

- `api/contracts/contracts.test.js` lines 12-13 →
  ```js
  import { list as listHandler, byId as idHandler } from '../_handlers/contracts.js'
  ```
- `api/contracts/summarize.test.js` line 13 (`import handler from './summarize.js'`) →
  ```js
  import { summarize as handler } from '../_handlers/contracts.js'
  ```
- `api/contracts/upload-signature.test.js` line 13 (`import handler from './upload-signature.js'`) →
  ```js
  import { uploadSignature as handler } from '../_handlers/contracts.js'
  ```
- `api/contracts/notify.test.js` line 12 (`import handler from './notify.js'`) →
  ```js
  import { notify as handler } from '../_handlers/contracts.js'
  ```

Run: `npx vitest run api/contracts/contracts.test.js api/contracts/summarize.test.js api/contracts/upload-signature.test.js api/contracts/notify.test.js`
Expected: PASS.

- [ ] **Step 3: Write the failing router test**

Create `api/contracts/router.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/contracts.js', () => ({
  list: vi.fn(), byId: vi.fn(), summarize: vi.fn(), uploadSignature: vi.fn(), notify: vi.fn(),
}))

import router from './[[...path]].js'
import * as h from '../_handlers/contracts.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('contracts catch-all router', () => {
  it('routes base path to list', async () => {
    await router({ method: 'GET', query: {}, auth: { orgId: 'org_test' } }, mockRes())
    expect(h.list).toHaveBeenCalledTimes(1)
  })

  it('routes summarize / upload-signature / notify to their handlers', async () => {
    await router({ method: 'POST', query: { path: ['summarize'] }, auth: {} }, mockRes())
    await router({ method: 'POST', query: { path: ['upload-signature'] }, auth: {} }, mockRes())
    await router({ method: 'POST', query: { path: ['notify'] }, auth: {} }, mockRes())
    expect(h.summarize).toHaveBeenCalledTimes(1)
    expect(h.uploadSignature).toHaveBeenCalledTimes(1)
    expect(h.notify).toHaveBeenCalledTimes(1)
    expect(h.byId).not.toHaveBeenCalled()
  })

  it('routes any other first segment to byId as the id', async () => {
    const req = { method: 'PATCH', query: { path: ['con_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('con_1')
    expect(h.byId).toHaveBeenCalledTimes(1)
  })
})
```

Run: `npx vitest run api/contracts/router.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the router**

Create `api/contracts/[[...path]].js`:

```js
import { requireAuth } from '../_lib/auth.js'
import { list, byId, summarize, uploadSignature, notify } from '../_handlers/contracts.js'

const SUBROUTES = {
  summarize,
  'upload-signature': uploadSignature,
  notify,
}

export default requireAuth(async (req, res) => {
  const segs = [].concat(req.query.path ?? [])
  if (segs.length === 0) return list(req, res)
  const sub = SUBROUTES[segs[0]]
  if (sub) return sub(req, res)
  req.query.id = segs[0]
  return byId(req, res)
})
```

Run: `npx vitest run api/contracts/router.test.js`
Expected: PASS.

- [ ] **Step 5: Delete old files and run the folder green**

```bash
git rm api/contracts/index.js "api/contracts/[id].js" api/contracts/summarize.js api/contracts/upload-signature.js api/contracts/notify.js
```

Run: `npx vitest run api/contracts`
Expected: PASS (all contracts test files).

- [ ] **Step 6: Commit**

```bash
git add api/_handlers/contracts.js api/contracts/[[...path]].js api/contracts/router.test.js api/contracts/contracts.test.js api/contracts/summarize.test.js api/contracts/upload-signature.test.js api/contracts/notify.test.js
git commit -m "refactor(api): consolidate contracts into a catch-all router"
```

---

### Task 4: Portal-requests router (list+byId[PATCH+DELETE]+notify)

**Files:**
- Create: `api/_handlers/portalRequests.js`
- Create: `api/portal-requests/[[...path]].js`
- Create: `api/portal-requests/router.test.js`
- Modify: `api/portal-requests/index.test.js:11`, `api/portal-requests/[id].test.js:8`, `api/portal-requests/notify.test.js:7`
- Delete: `api/portal-requests/index.js`, `api/portal-requests/[id].js`, `api/portal-requests/notify.js`

**Interfaces:**
- Produces: `api/_handlers/portalRequests.js` exports `list` (GET+POST), `byId` (PATCH+DELETE, `req.query.id`), `notify` (POST).
- Router dispatch: base → `list`; `notify` → `notify`; any other first segment → `byId`.

- [ ] **Step 1: Create the handlers module**

Create `api/_handlers/portalRequests.js`. Merged import block (`requireAuth` dropped):

```js
import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { canManage } from '../_lib/permissions.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'
import { escapeHtml } from '../_lib/htmlEscape.js'
```

Move bodies verbatim (plus any module-level template consts in `notify.js`):
- `api/portal-requests/index.js` handler → `export async function list(req, res)`
- `api/portal-requests/[id].js` handler → `export async function byId(req, res)`
- `api/portal-requests/notify.js` handler → `export async function notify(req, res)`

Remove only ESLint-flagged unused imports, if any.

- [ ] **Step 2: Repoint the existing logic tests and run them green**

- `api/portal-requests/index.test.js` line 11 (`import listHandler from './index.js'`) →
  ```js
  import { list as listHandler } from '../_handlers/portalRequests.js'
  ```
- `api/portal-requests/[id].test.js` line 8 (`import idHandler from './[id].js'`) →
  ```js
  import { byId as idHandler } from '../_handlers/portalRequests.js'
  ```
- `api/portal-requests/notify.test.js` line 7 (`import handler from './notify.js'`) →
  ```js
  import { notify as handler } from '../_handlers/portalRequests.js'
  ```

Run: `npx vitest run api/portal-requests`
Expected: PASS (logic tests; router test not yet created).

- [ ] **Step 3: Write the failing router test**

Create `api/portal-requests/router.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/portalRequests.js', () => ({ list: vi.fn(), byId: vi.fn(), notify: vi.fn() }))

import router from './[[...path]].js'
import * as h from '../_handlers/portalRequests.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('portal-requests catch-all router', () => {
  it('routes base path to list', async () => {
    await router({ method: 'GET', query: {}, auth: { orgId: 'org_test' } }, mockRes())
    expect(h.list).toHaveBeenCalledTimes(1)
  })

  it('routes notify to the notify handler', async () => {
    await router({ method: 'POST', query: { path: ['notify'] }, auth: {} }, mockRes())
    expect(h.notify).toHaveBeenCalledTimes(1)
    expect(h.byId).not.toHaveBeenCalled()
  })

  it('routes any other first segment to byId as the id', async () => {
    const req = { method: 'DELETE', query: { path: ['por_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('por_1')
    expect(h.byId).toHaveBeenCalledTimes(1)
  })
})
```

Run: `npx vitest run api/portal-requests/router.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the router**

Create `api/portal-requests/[[...path]].js`:

```js
import { requireAuth } from '../_lib/auth.js'
import { list, byId, notify } from '../_handlers/portalRequests.js'

export default requireAuth(async (req, res) => {
  const segs = [].concat(req.query.path ?? [])
  if (segs.length === 0) return list(req, res)
  if (segs[0] === 'notify') return notify(req, res)
  req.query.id = segs[0]
  return byId(req, res)
})
```

Run: `npx vitest run api/portal-requests/router.test.js`
Expected: PASS.

- [ ] **Step 5: Delete old files and run the folder green**

```bash
git rm api/portal-requests/index.js "api/portal-requests/[id].js" api/portal-requests/notify.js
```

Run: `npx vitest run api/portal-requests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_handlers/portalRequests.js api/portal-requests/[[...path]].js api/portal-requests/router.test.js api/portal-requests/index.test.js api/portal-requests/[id].test.js api/portal-requests/notify.test.js
git commit -m "refactor(api): consolidate portal-requests into a catch-all router"
```

---

### Task 5: Org router (mixed auth + reserved-word export)

**Files:**
- Create: `api/_handlers/org.js`
- Create: `api/org/[[...path]].js`
- Create: `api/org/router.test.js`
- Modify: `api/org/seed.test.js:27`, `api/org/clear.test.js:19`, `api/org/reset.test.js:27`, `api/org/export.test.js:16`, `api/org/audit.test.js:8`
- Delete: `api/org/seed.js`, `api/org/clear.js`, `api/org/reset.js`, `api/org/export.js`, `api/org/audit.js`

**Interfaces:**
- Produces: `api/_handlers/org.js` exports `seed` (POST, open to any member), `clear` (POST), `reset` (POST), `exportData` (GET — named `exportData` because `export` is a reserved binding), `audit` (GET).
- Router applies `requireAuth`; routes `seed` directly; gates `clear`/`reset`/`export`/`audit` with the admin check; unknown segment → 404.

- [ ] **Step 1: Create the handlers module**

Create `api/_handlers/org.js`. Merged import block (drop BOTH `requireAuth` and `requireOrgAdmin`):

```js
import { prisma } from '../_lib/prisma.js'
import { buildSeedData } from '../_lib/seedData.js'
import { buildAuditData } from '../_lib/audit.js'
```

Move the `handler` bodies verbatim:
- `api/org/seed.js` → `export async function seed(req, res)`
- `api/org/clear.js` → `export async function clear(req, res)`
- `api/org/reset.js` → `export async function reset(req, res)`
- `api/org/export.js` → `export async function exportData(req, res)`
- `api/org/audit.js` → `export async function audit(req, res)`

- [ ] **Step 2: Repoint the existing logic tests and run them green**

Each org test imports `import handler from './<name>.js'`. Replace with the named import from the handlers module:
- `api/org/seed.test.js` line 27 → `import { seed as handler } from '../_handlers/org.js'`
- `api/org/clear.test.js` line 19 → `import { clear as handler } from '../_handlers/org.js'`
- `api/org/reset.test.js` line 27 → `import { reset as handler } from '../_handlers/org.js'`
- `api/org/export.test.js` line 16 → `import { exportData as handler } from '../_handlers/org.js'`
- `api/org/audit.test.js` line 8 → `import { audit as handler } from '../_handlers/org.js'`

These test files currently mock `'../_lib/auth.js'` providing `requireAuth` and/or `requireOrgAdmin` as identity. The bare handlers no longer import auth, so the admin-gate behaviour those tests previously bypassed is now the router's concern (covered in Step 3). The logic-test bodies (which assume an authed/admin caller via a hand-built `req.auth`) are unchanged and must still pass.

Run: `npx vitest run api/org`
Expected: PASS (the five logic test files; router test not yet created).

- [ ] **Step 3: Write the failing router test**

Create `api/org/router.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/org.js', () => ({
  seed: vi.fn(), clear: vi.fn(), reset: vi.fn(), exportData: vi.fn(), audit: vi.fn(),
}))

import router from './[[...path]].js'
import * as h from '../_handlers/org.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('org catch-all router', () => {
  it('routes seed for any member', async () => {
    await router({ method: 'POST', query: { path: ['seed'] }, auth: { orgRole: 'org:member' } }, mockRes())
    expect(h.seed).toHaveBeenCalledTimes(1)
  })

  it('403s a member on an admin-only route and does not call the handler', async () => {
    const res = mockRes()
    await router({ method: 'POST', query: { path: ['clear'] }, auth: { orgRole: 'org:member' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' })
    expect(h.clear).not.toHaveBeenCalled()
  })

  it('routes admin-only segments for an admin', async () => {
    await router({ method: 'POST', query: { path: ['clear'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    await router({ method: 'POST', query: { path: ['reset'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    await router({ method: 'GET', query: { path: ['export'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    await router({ method: 'GET', query: { path: ['audit'] }, auth: { orgRole: 'org:admin' } }, mockRes())
    expect(h.clear).toHaveBeenCalledTimes(1)
    expect(h.reset).toHaveBeenCalledTimes(1)
    expect(h.exportData).toHaveBeenCalledTimes(1)
    expect(h.audit).toHaveBeenCalledTimes(1)
  })

  it('404s an unknown segment', async () => {
    const res = mockRes()
    await router({ method: 'GET', query: { path: ['nope'] }, auth: { orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
  })
})
```

Run: `npx vitest run api/org/router.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the router**

Create `api/org/[[...path]].js`:

```js
import { requireAuth } from '../_lib/auth.js'
import { seed, clear, reset, exportData, audit } from '../_handlers/org.js'

const ADMIN_ROUTES = { clear, reset, export: exportData, audit }

export default requireAuth(async (req, res) => {
  const name = [].concat(req.query.path ?? [])[0]
  if (name === 'seed') return seed(req, res)
  const adminHandler = ADMIN_ROUTES[name]
  if (!adminHandler) return res.status(404).json({ error: 'Not found' })
  if (req.auth.orgRole !== 'org:admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  return adminHandler(req, res)
})
```

Run: `npx vitest run api/org/router.test.js`
Expected: PASS.

- [ ] **Step 5: Delete old files and run the folder green**

```bash
git rm api/org/seed.js api/org/clear.js api/org/reset.js api/org/export.js api/org/audit.js
```

Run: `npx vitest run api/org`
Expected: PASS (five logic test files + router.test.js).

- [ ] **Step 6: Commit**

```bash
git add api/_handlers/org.js api/org/[[...path]].js api/org/router.test.js api/org/seed.test.js api/org/clear.test.js api/org/reset.test.js api/org/export.test.js api/org/audit.test.js
git commit -m "refactor(api): consolidate org endpoints into a catch-all router"
```

---

### Task 6: Verify the function count and the whole suite

**Files:** none modified (verification + final commit of any incidental fixes).

**Interfaces:** none.

- [ ] **Step 1: Count deployed function files**

Run (Git Bash):

```bash
git ls-files 'api/**/*.js' | grep -v '/_' | grep -v '\.test\.js$'
```

Expected output — exactly these 9 lines (order may vary):

```
api/assistant.js
api/billing/checkout.js
api/contracts/[[...path]].js
api/esg/index.js
api/org/[[...path]].js
api/portal-requests/[[...path]].js
api/risk/index.js
api/spend/[[...path]].js
api/suppliers/[[...path]].js
```

If any old `index.js`/`[id].js`/named endpoint file still appears, it was not deleted — go back and `git rm` it. The count must be **9** (≤ 12).

- [ ] **Step 2: Run the api half of the suite**

Run: `npx vitest run api`
Expected: PASS (all api test files, including the 5 new `router.test.js`).

- [ ] **Step 3: Run the src half serially**

Run: `npx vitest run src --no-file-parallelism`
Expected: PASS (no `src/` files changed; this confirms no cross-import breakage).

- [ ] **Step 4: Lint**

Run: `npx eslint api`
Expected: no NEW errors beyond the project's accepted baseline. Fix any unused-import error introduced by the merged handler modules by removing the specific unused import.

- [ ] **Step 5: Final commit (only if Step 4 required a fix)**

```bash
git add -A
git commit -m "refactor(api): drop unused imports after handler consolidation"
```

If Steps 1-4 passed with no change needed, skip this commit.

---

## Self-Review

**Spec coverage:**
- "Relocate handler logic → `api/_handlers/<resource>.js`" → Tasks 1-5 Step 1. ✓
- "Catch-all routers" → Tasks 1-5 Step 4. ✓
- Reserved sub-route dispatch (contracts, portal-requests) → Tasks 3-4. ✓
- Mixed-auth org dispatch + verbatim 403 → Task 5. ✓
- "No frontend changes / no vercel.json change" → Global Constraints; Task 6 Step 3 confirms src untouched. ✓
- Test strategy (repoint imports + new router tests) → every task Steps 2-3. ✓
- "9 functions / ≤12" success criterion → Task 6 Step 1. ✓

**Placeholder scan:** No TBD/TODO. Body moves reference exact source files + the named handler function; merged import blocks are given literally; all new code (routers, router tests) is shown in full. ✓

**Type/name consistency:** Export names (`list`, `byId`, `summarize`, `uploadSignature`, `notify`, `seed`, `clear`, `reset`, `exportData`, `audit`) are used identically in each handlers module, its router, its router test, and the repointed logic-test imports. The org router maps the path segment `'export'` → `exportData`. The `segs`/`[].concat(req.query.path ?? [])` idiom is identical across all five routers. ✓
