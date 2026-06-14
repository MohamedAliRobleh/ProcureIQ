# Phase 6e: Brevo Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual "Email reminder" button on the contract slide-over that emails the signed-in user a reminder about that contract, via Brevo's transactional API (server-side, key never in the browser).

**Architecture:** A backend `email` lib calls Brevo's REST API with the API key (server-side only); `POST /api/contracts/notify` org-scopes the contract, builds an HTML email, and sends it. A config guard keeps the whole suite green **without credentials** (handler tests mock the lib; the endpoint 503s when unconfigured). The slide-over gets an "Email reminder" button wired through `ContractContext.notifyContract`, with the recipient = the signed-in user's email from the Clerk seam.

**Tech Stack:** Brevo transactional email REST API (raw `fetch`, no SDK), Vite + React 19, existing Vercel `api/` + Prisma/Neon (6a) + Clerk auth (6b), Vitest + RTL + jsdom.

---

## KEY-OPTIONAL EXECUTION

`BREVO_*` creds are not required to implement or test this phase. Tasks 1–5 are fully implementable and testable without them — the notify-endpoint test mocks `api/_lib/email.js`, the endpoint 503s when unconfigured, and the frontend tests stub `/api/contracts/notify`. **Only Task 6's live send needs real creds (and a verified Brevo sender) and is explicitly deferred.**

---

## Scene setting (read before starting)

- Spec: `docs/superpowers/specs/2026-06-14-phase6e-brevo-email-design.md`.
- No DB change (this phase adds no columns).
- Patterns to mirror:
  - **Lib + key-optional:** `api/_lib/cloudinary.js` / `api/_lib/anthropic.js` — `isXConfigured()` reading env; the endpoint 503s when false; handler tests mock the lib. The Brevo lib uses raw `fetch` (no SDK), so its test does NOT need `// @vitest-environment node` (no SDK import).
  - **Endpoint:** `api/contracts/summarize.js` / `api/contracts/upload-signature.js` — POST-only/405 → 400 → 503 → org-scoped `findFirst` (404) → work → return; `export default requireAuth(handler)`. Static filename wins over `[id].js`.
  - **Context action:** `summarizeContract`/`attachContractDocument` (return a promise, `.catch` re-throws). `notifyContract` mirrors them but mutates no state.
  - **Slide-over gating:** the AI Summary block renders only with `onSummarize`; the Document block only with `onUpload`. The Notifications block follows the same gate on `onNotify`.
  - **Auth email:** `useUser()` from `src/lib/auth.jsx` (the global test mock in `src/test/authState.js` provides `user.emailAddresses[0].emailAddress = 'amara.chen@procureiq-demo.com'`). `TopBar.jsx` already uses `useUser`.
- The frontend fetch stub `src/test/mockApi.js` already stubs assistant/summarize/upload-signature/cloudinary; add `/api/contracts/notify`.
- Suite baseline: 46 files / 281 tests green. ESLint baseline: 9 errors (3 `set-state-in-effect`, 6 `only-export-components`); `api/**` has Node globals via `eslint.config.js`.
- Note: the full suite occasionally shows a flaky `Spend.test.jsx` timeout under load — if that's the only failure, re-run for a clean pass.
- Test runner: `npm test -- <file>`; full `npm test`.

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `.env.example` | Modify | document the `BREVO_*` vars |
| `api/_lib/email.js` (+ `email.test.js`) | Create | `isEmailConfigured`, `sendEmail` (Brevo REST) |
| `api/contracts/notify.js` (+ `.test.js`) | Create | org-scoped contract reminder send |
| `src/test/mockApi.js` | Modify | stub `/api/contracts/notify` |
| `src/context/ContractContext.jsx` (+ test) | Modify | `notifyContract(id, toEmail)` |
| `src/components/ui/ContractSlideOver.jsx` (+ test) | Modify | Notifications section (Email reminder) |
| `src/pages/Contracts.jsx`, `src/pages/SupplierDetail.jsx` | Modify | read `useUser` email, pass `onNotify` |
| `src/pages/Contracts.test.jsx` | Modify | send-reminder-from-slide-over test |

---

### Task 1: Brevo email lib + env docs

**Files:**
- Modify: `.env.example`
- Create: `api/_lib/email.js`, `api/_lib/email.test.js`

- [ ] **Step 1: Document the env keys**

Append to `.env.example`:

```
# Brevo transactional email (get yours at brevo.com → SMTP & API → API Keys;
# BREVO_SENDER_EMAIL must be a verified sender/domain in your Brevo account)
BREVO_API_KEY="xkeysib-..."
BREVO_SENDER_EMAIL="noreply@yourdomain.com"
BREVO_SENDER_NAME="ProcureIQ"
```

- [ ] **Step 2: Write the failing tests**

Create `api/_lib/email.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isEmailConfigured, sendEmail } from './email.js'

const ORIGINAL = {
  key: process.env.BREVO_API_KEY,
  sender: process.env.BREVO_SENDER_EMAIL,
  name: process.env.BREVO_SENDER_NAME,
}

function restore(k, v) {
  if (v === undefined) delete process.env[k]
  else process.env[k] = v
}

afterEach(() => {
  restore('BREVO_API_KEY', ORIGINAL.key)
  restore('BREVO_SENDER_EMAIL', ORIGINAL.sender)
  restore('BREVO_SENDER_NAME', ORIGINAL.name)
  vi.unstubAllGlobals()
})

describe('email lib', () => {
  it('isEmailConfigured is true only when key and sender are set', () => {
    delete process.env.BREVO_API_KEY
    delete process.env.BREVO_SENDER_EMAIL
    expect(isEmailConfigured()).toBe(false)
    process.env.BREVO_API_KEY = 'xkeysib-test'
    expect(isEmailConfigured()).toBe(false)
    process.env.BREVO_SENDER_EMAIL = 'noreply@demo.com'
    expect(isEmailConfigured()).toBe(true)
  })

  it('sendEmail POSTs to Brevo with the api-key header and the right body', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test'
    process.env.BREVO_SENDER_EMAIL = 'noreply@demo.com'
    process.env.BREVO_SENDER_NAME = 'ProcureIQ'
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ messageId: 'abc' }) }))
    vi.stubGlobal('fetch', fetchMock)

    await sendEmail({ to: 'amara@demo.com', subject: 'Reminder: X', html: '<p>hello</p>' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(options.method).toBe('POST')
    expect(options.headers['api-key']).toBe('xkeysib-test')
    const sent = JSON.parse(options.body)
    expect(sent.sender).toEqual({ email: 'noreply@demo.com', name: 'ProcureIQ' })
    expect(sent.to).toEqual([{ email: 'amara@demo.com' }])
    expect(sent.subject).toBe('Reminder: X')
    expect(sent.htmlContent).toBe('<p>hello</p>')
  })

  it('sendEmail throws on a non-OK Brevo response', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test'
    process.env.BREVO_SENDER_EMAIL = 'noreply@demo.com'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, text: async () => 'bad sender' })))
    await expect(sendEmail({ to: 'a@b.com', subject: 'S', html: '<p>x</p>' })).rejects.toThrow('Brevo send failed')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- api/_lib/email.test.js`
Expected: FAIL — cannot find module `./email.js`

- [ ] **Step 4: Implement**

Create `api/_lib/email.js`:

```js
// Sends transactional email via Brevo's REST API. The API key is read here
// and never leaves the server. Uses the runtime's global fetch — no SDK.

export function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL)
}

export async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'ProcureIQ' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Brevo send failed: ${res.status} ${text}`)
  }
  return true
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- api/_lib/email.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add .env.example api/_lib/email.js api/_lib/email.test.js
git commit -m "feat: add Brevo email lib (config guard + transactional send)"
```

---

### Task 2: `/api/contracts/notify` endpoint

**Files:**
- Create: `api/contracts/notify.js`, `api/contracts/notify.test.js`

> Static filename — Vercel routes `POST /api/contracts/notify` here (static wins over the dynamic `[id].js`).

- [ ] **Step 1: Write the failing tests**

Create `api/contracts/notify.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({
  prisma: { contract: { findFirst: vi.fn() } },
}))
vi.mock('../_lib/email.js', () => ({
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
}))

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/contracts/notify', () => {
  it('sends a reminder and returns { ok: true }', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({
      id: 'con_1',
      title: 'Master Supply Agreement',
      value: 600000,
      currency: 'USD',
      status: 'active',
      endDate: '2026-12-31',
    })
    sendEmail.mockResolvedValue(true)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1', toEmail: 'amara@demo.com' } }, res)

    expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_demo' } })
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('amara@demo.com')
    expect(arg.subject).toContain('Master Supply Agreement')
    expect(arg.html).toContain('Master Supply Agreement')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('returns 404 when the contract is not in the org', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_other', toEmail: 'a@b.com' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 503 when email is not configured (before any DB call)', async () => {
    isEmailConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1', toEmail: 'a@b.com' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when id or toEmail is missing', async () => {
    const res1 = mockRes()
    await handler({ method: 'POST', body: { toEmail: 'a@b.com' } }, res1)
    expect(res1.status).toHaveBeenCalledWith(400)
    const res2 = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' } }, res2)
    expect(res2.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET' }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 502 when the email send fails', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1', title: 'X', value: 1, currency: 'USD', status: 'active', endDate: null })
    sendEmail.mockRejectedValue(new Error('Brevo send failed: 400 bad sender'))
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1', toEmail: 'a@b.com' } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- api/contracts/notify.test.js`
Expected: FAIL — cannot find module `./notify.js`

- [ ] **Step 3: Implement**

Create `api/contracts/notify.js`:

```js
import { prisma } from '../_lib/prisma.js'
import { ORG_ID } from '../_lib/org.js'
import { requireAuth } from '../_lib/auth.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { id, toEmail } = req.body ?? {}
  if (!id || !toEmail) return res.status(400).json({ error: 'id and toEmail are required' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email notifications are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: ORG_ID } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const subject = `Reminder: ${contract.title}`
    const end = contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : 'n/a'
    const html = [
      `<h2>Contract reminder</h2>`,
      `<p>Here is a reminder about <strong>${contract.title}</strong>.</p>`,
      `<ul>`,
      `<li>Value: ${contract.currency} ${contract.value}</li>`,
      `<li>Status: ${contract.status}</li>`,
      `<li>End date: ${end}</li>`,
      `</ul>`,
      `<p>— ProcureIQ</p>`,
    ].join('')

    await sendEmail({ to: toEmail, subject, html })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

export default requireAuth(handler)
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- api/contracts/notify.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add api/contracts/notify.js api/contracts/notify.test.js
git commit -m "feat: add /api/contracts/notify (org-scoped Brevo reminder)"
```

---

### Task 3: ContractContext.notifyContract + stub route

**Files:**
- Modify: `src/test/mockApi.js`, `src/context/ContractContext.jsx`, `src/context/ContractContext.test.jsx`

- [ ] **Step 1: Add the stub route**

In `src/test/mockApi.js`, add this check immediately after the existing `if (method === 'POST' && url.startsWith('https://api.cloudinary.com/')) {...}` block (and before the `if (method === 'GET')` block):

```js
    if (method === 'POST' && url === '/api/contracts/notify') {
      return jsonResponse({ ok: true })
    }
```

- [ ] **Step 2: Write the failing test**

In `src/context/ContractContext.test.jsx`, add this test before the `'throws when used outside ContractProvider'` test:

```jsx
  it('notifyContract resolves with { ok: true }', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    let outcome
    await act(async () => {
      outcome = await result.current.notifyContract(id, 'amara@demo.com')
    })
    expect(outcome).toEqual({ ok: true })
  })
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/context/ContractContext.test.jsx`
Expected: FAIL — `result.current.notifyContract is not a function`

- [ ] **Step 4: Implement**

In `src/context/ContractContext.jsx`, add this function after `attachContractDocument`:

```jsx
  function notifyContract(id, toEmail) {
    return api.post('/api/contracts/notify', { id, toEmail }).catch((e) => {
      setError(e)
      throw e
    })
  }
```

Add `notifyContract` to the provider value object (after `attachContractDocument,`):

```jsx
        attachContractDocument,
        notifyContract,
```

- [ ] **Step 5: Run to verify pass, then the full suite**

Run: `npm test -- src/context/ContractContext.test.jsx`
Expected: PASS (8 tests)

Run: `npm test`
Expected: all green (report counts)

- [ ] **Step 6: Commit**

```bash
git add src/test/mockApi.js src/context/ContractContext.jsx src/context/ContractContext.test.jsx
git commit -m "feat: add notifyContract to ContractContext + notify stub"
```

---

### Task 4: ContractSlideOver Notifications section

**Files:**
- Modify: `src/components/ui/ContractSlideOver.jsx`, `src/components/ui/ContractSlideOver.test.jsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/ui/ContractSlideOver.test.jsx`, add these two tests at the end of the `describe` block:

```jsx
  it('does not render the Email reminder button without onNotify', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.queryByRole('button', { name: 'Email reminder' })).not.toBeInTheDocument()
  })

  it('clicking Email reminder calls onNotify and shows confirmation', async () => {
    const onNotify = vi.fn().mockResolvedValue({ ok: true })
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onNotify,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Email reminder' }))
    expect(onNotify).toHaveBeenCalled()
    expect(await screen.findByText(/Reminder sent/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/ui/ContractSlideOver.test.jsx`
Expected: FAIL — no "Email reminder" button

- [ ] **Step 3: Implement**

In `src/components/ui/ContractSlideOver.jsx`:

Add `onNotify` to the component signature:

```jsx
export default function ContractSlideOver({ isOpen, onClose, contract, supplier, onEdit, onSummarize, onUpload, onNotify }) {
```

Add notify state + handler right after the existing `handleFileChange` function (before `if (!contract) return null`):

```jsx
  const [isSending, setIsSending] = useState(false)
  const [notifySent, setNotifySent] = useState(false)
  const [notifyError, setNotifyError] = useState(null)

  async function handleNotify() {
    setNotifyError(null)
    setIsSending(true)
    try {
      await onNotify()
      setNotifySent(true)
    } catch {
      setNotifyError('Could not send the reminder. Please try again.')
    } finally {
      setIsSending(false)
    }
  }
```

Add the Notifications block inside the scroll area, immediately after the `{onUpload && (...)}` block and before the closing `</div>` of the `flex-1 ... overflow-y-auto` container:

```jsx
              {onNotify && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Notifications</p>
                  <Button variant="secondary" onClick={handleNotify} disabled={isSending}>
                    {isSending ? 'Sending…' : 'Email reminder'}
                  </Button>
                  {notifySent && <p className="mt-1 text-xs text-accent-green">Reminder sent ✓</p>}
                  {notifyError && <p className="mt-1 text-xs text-accent-red">{notifyError}</p>}
                </div>
              )}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/components/ui/ContractSlideOver.test.jsx`
Expected: PASS (11 tests — 9 existing + 2 new; the 9 existing pass no `onNotify`, so the Notifications block doesn't render for them)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ContractSlideOver.jsx src/components/ui/ContractSlideOver.test.jsx
git commit -m "feat: add Notifications (Email reminder) section to ContractSlideOver"
```

---

### Task 5: Wire onNotify into the pages

**Files:**
- Modify: `src/pages/Contracts.jsx`, `src/pages/SupplierDetail.jsx`, `src/pages/Contracts.test.jsx`

- [ ] **Step 1: Write the failing page test**

In `src/pages/Contracts.test.jsx`, add this test at the end of the `describe('Contracts', ...)` block:

```jsx
  it('sends an email reminder from the contract slide-over', async () => {
    renderContracts()
    fireEvent.click(await screen.findByText('Master Supply Agreement — Atlas Steelworks'))
    fireEvent.click(screen.getByRole('button', { name: 'Email reminder' }))
    expect(await screen.findByText(/Reminder sent/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/pages/Contracts.test.jsx`
Expected: FAIL — no "Email reminder" button (the page doesn't pass `onNotify` yet)

- [ ] **Step 3: Wire Contracts.jsx**

In `src/pages/Contracts.jsx`:

- Add the auth import after the existing `useSupplierContext` import (line ~12):

```jsx
import { useUser } from '../lib/auth'
```

- Add `notifyContract` to the context destructuring (line 18):

```jsx
  const { contracts, addContract, updateContract, summarizeContract, attachContractDocument, notifyContract } = useContractContext()
```

- Read the signed-in user's email — add right after that destructuring:

```jsx
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
```

- Add `onNotify` to the `<ContractSlideOver>` (after the `onUpload` line at line 212):

```jsx
        onUpload={liveSelected ? (file) => attachContractDocument(liveSelected.id, file) : undefined}
        onNotify={liveSelected && userEmail ? () => notifyContract(liveSelected.id, userEmail) : undefined}
      />
```

- [ ] **Step 4: Wire SupplierDetail.jsx**

In `src/pages/SupplierDetail.jsx`:

- Add the auth import near the other `../lib/...` or context imports (e.g. after the `useSpendContext` import):

```jsx
import { useUser } from '../lib/auth'
```

- Add `notifyContract` to the context destructuring (line 32):

```jsx
  const { contracts, addContract, updateContract, summarizeContract, attachContractDocument, notifyContract } = useContractContext()
```

- Read the user email — add right after that destructuring line:

```jsx
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
```

- Add `onNotify` to the `<ContractSlideOver>` (after the `onUpload` line at line 203):

```jsx
          onUpload={liveSelected ? (file) => attachContractDocument(liveSelected.id, file) : undefined}
          onNotify={liveSelected && userEmail ? () => notifyContract(liveSelected.id, userEmail) : undefined}
        />
```

> If a page's exact import or destructuring line differs slightly from the line numbers above, add `useUser`/`notifyContract`/`userEmail` to whatever is already there; don't change the other names.

- [ ] **Step 5: Run the page tests, then the full suite**

Run: `npm test -- src/pages/Contracts.test.jsx src/pages/SupplierDetail.test.jsx`
Expected: PASS

Run: `npm test`
Expected: all green (report counts)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Contracts.jsx src/pages/SupplierDetail.jsx src/pages/Contracts.test.jsx
git commit -m "feat: wire contract email reminder into Contracts and SupplierDetail slide-overs"
```

---

### Task 6: Final gate

**Files:** none (verification only; commit stragglers if real fixes surface).

- [ ] **Step 1: Full suite** — `npm test`, run twice (re-run if only the documented `Spend.test.jsx` flake appears); report exact counts (baseline 46 files / 281 tests + new: `email` 3, `notify` 6, `ContractContext` +1, `ContractSlideOver` +2, `Contracts` +1 ≈ +13 tests across +2 files → ~48 files / ~294 tests).

- [ ] **Step 2: Lint** — `npx eslint src api`; expect no NEW categories beyond the 9-error baseline. Fix any unused-var/import the new files introduce.

- [ ] **Step 3: Confirm key-optional posture** — verify the whole suite is green with NO `BREVO_*` vars set (it is — the notify-endpoint test mocks `_lib/email.js`; the email lib test sets/restores its own env). Do NOT print `.env` or env vars to confirm; rely only on the passing suite.

- [ ] **Step 4: DEFERRED live verification (requires `BREVO_*` creds + a verified Brevo sender)** — do NOT run now. When the user adds `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` (+ optional `BREVO_SENDER_NAME`) to `.env` and verifies the sender in Brevo:
  1. `vercel dev`, sign in.
  2. Open a contract → "Email reminder" → "Reminder sent ✓" appears and the signed-in user receives the email with the contract details.
  3. Temporarily blank `BREVO_API_KEY` → the button surfaces the "Email notifications are not configured" error (503). With an unverified sender, it surfaces the 502 send error.

- [ ] **Step 5: Report** — suite counts, lint result, and the deferred-step checklist for the user.

---

## Self-Review Notes

- **Spec coverage:** Brevo email lib + key-server-side (Task 1); org-scoped notify endpoint, 503/404/400/405/502 (Task 2); `notifyContract` + stub (Task 3); slide-over Notifications section (Task 4); page wiring with `useUser` email (Task 5); testing + deferred live check (Task 6). Spec's "recipient = signed-in user's email" → Task 5 reads `useUser().user.emailAddresses[0].emailAddress`. Spec's "502 on Brevo failure" → Task 2.
- **Key-optional:** the central constraint. The lib reads the key only in `sendEmail`; the endpoint 503s before any DB call when unconfigured; the notify test mocks `_lib/email.js`; the email lib test sets/restores its own env. Only Task 6 Step 4 needs creds, and it's deferred.
- **Type consistency:** `isEmailConfigured`/`sendEmail({to, subject, html})` (Task 1) consumed in Task 2. `/api/contracts/notify` returns `{ ok: true }` (Task 2) — the stub returns the same (Task 3); `notifyContract` resolves to it (Task 3). `notifyContract(id, toEmail)` (Task 3) is the prop the slide-over's `onNotify()` calls (Task 4), supplied by the pages with `userEmail` (Task 5). "Email reminder" / "Reminder sent" strings (Task 4) asserted in Tasks 4–5.
- **Slide-over regression:** the Notifications block is gated on `onNotify`; the 9 existing ContractSlideOver tests pass no `onNotify`, so it doesn't render for them — they stay green (Task 4 expects 11 total).
- **No DB migration, no SDK install** (Brevo via raw fetch). No App.jsx change.
- **No placeholders:** every step has complete, runnable code; existing-file edits give exact anchors.
